import type { Prisma } from "./generated/client";
import { z } from "@/domain/validation";
import { blankResume, resumeSchema } from "@/domain/resume";
import { analyze, compareJob, type Diagnostic } from "@/domain/ats";
import { db } from "./db";
import { body, HttpError, json, limitedBody } from "./http";
import { rate } from "./auth";
import { extract, maxImportSize } from "./import";
import {
  resumeExtension,
  resumeSelection as selection,
} from "./extended-resumes";
import { aiTasks, grammarReview, recommend } from "./ai";
import { fileName, makeDocx, makePdf, validateExport } from "./documents";

const title = z.string().trim().min(1).max(100);
const jobText = z.string().trim().max(25_000);
const revisionField = z.number().int().nonnegative();
const jsonDb = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const state = (score: number) => (score >= 75 ? "optimized" : "review");
const idSchema = z.string().regex(/^[a-z0-9]{10,40}$/i);
function download(
  buffer: Uint8Array,
  name: string,
  type: string,
  inline = false,
) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": type,
      "Content-Disposition":
        (inline ? "inline" : "attachment") + '; filename="' + name + '"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function importResume(req: Request, userId: string) {
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.");
  await rate("import:" + userId, 20, 60 * 60_000);
  if (!req.headers.get("content-type")?.startsWith("multipart/form-data;"))
    throw new HttpError(415, "Selecciona un archivo PDF o DOCX.");
  let form;
  const content = await limitedBody(req, maxImportSize + 32_768);
  try {
    form = await new Response(new Uint8Array(content), {
      headers: { "Content-Type": req.headers.get("content-type")! },
    }).formData();
  } catch {
    throw new HttpError(400, "No se pudo interpretar el archivo cargado.");
  }
  const entry = form.get("file");
  if (
    !entry ||
    typeof entry === "string" ||
    !entry.size ||
    entry.size > maxImportSize
  )
    throw new HttpError(413, "Selecciona un PDF o DOCX de hasta 8 MB.");
  const bytes = Buffer.from(await entry.arrayBuffer());
  const name = entry.name.replace(/[\u0000-\u001f]/g, "").slice(-160);
  const result = await extract(bytes, name, entry.type);
  // Temporary imports are private and replaced on the next staging request.
  const source = await db.$transaction(async (tx) => {
    await tx.importFile.deleteMany({ where: { userId, resumeId: null } });
    return tx.importFile.create({
      data: {
        userId,
        name,
        bytes,
        mime: result.mime,
        diagnostics: jsonDb(result.findings),
      },
      select: { id: true, name: true },
    });
  });
  return json({ ...result, source }, 201);
}
export async function resumes(
  req: Request,
  userId: string,
  id?: string,
  action?: string,
  subId?: string,
) {
  if (!id && !subId) {
    if (req.method === "GET")
      return json(
        await db.resume.findMany({
          where: { userId },
          include: selection,
          orderBy: { updatedAt: "desc" },
        }),
      );
    if (req.method !== "POST") throw new HttpError(405, "Método no permitido.");
    await rate("create:" + userId, 80, 60 * 60_000);
    const input = z
      .object({
        title,
        data: resumeSchema.optional(),
        importId: idSchema.optional(),
        confirmed: z.boolean().optional(),
      })
      .parse(await body(req));
    if (input.importId && (!input.confirmed || !input.data))
      throw new HttpError(
        422,
        "Confirma y revisa los datos extraídos antes de guardar.",
      );
    const saved = await db.$transaction(async (tx) => {
      const row = await tx.resume.create({
        data: { title: input.title, userId, data: input.data ?? blankResume() },
      });
      if (input.importId) {
        const changed = await tx.importFile.updateMany({
          where: {
            id: input.importId,
            userId,
            resumeId: null,
            createdAt: { gt: new Date(Date.now() - 24 * 60 * 60_000) },
          },
          data: { resumeId: row.id },
        });
        if (!changed.count)
          throw new HttpError(404, "La importación ya no está disponible.");
      }
      return tx.resume.findUniqueOrThrow({
        where: { id: row.id },
        include: selection,
      });
    });
    return json(saved, 201);
  }
  if (!id || !idSchema.safeParse(id).success)
    throw new HttpError(404, "Currículum no encontrado.");
  const resume = await db.resume.findFirst({
    where: { id, userId },
    include: selection,
  });
  if (!resume) throw new HttpError(404, "Currículum no encontrado.");
  const extended = await resumeExtension(req, resume, action, subId);
  if (extended) return extended;
  if (subId) throw new HttpError(404, "Ruta no encontrada.");
  if (!action) {
    if (req.method === "GET") return json(resume);
    if (req.method === "DELETE") {
      await db.resume.delete({ where: { id, userId } });
      return json({ ok: true });
    }
    if (req.method === "PATCH") {
      const input = z
        .object({
          revision: revisionField,
          title: title.optional(),
          data: resumeSchema.optional(),
          job: jobText.optional(),
        })
        .parse(await body(req));
      if (
        input.title === undefined &&
        input.data === undefined &&
        input.job === undefined
      )
        throw new HttpError(422, "No hay cambios para guardar.");
      return json(
        await db.$transaction(async (tx) => {
          const changed = await tx.resume.updateMany({
            where: { id, userId, revision: input.revision },
            data: {
              title: input.title,
              data: input.data,
              revision: { increment: 1 },
              ...(input.data || input.job !== undefined
                ? { score: null, status: "draft" }
                : {}),
            },
          });
          if (!changed.count)
            throw new HttpError(
              409,
              "Hay cambios en otra pestaña. Conserva una copia de tu texto antes de recargar.",
            );
          if (input.job !== undefined) {
            if (!input.job)
              await tx.jobDescription.deleteMany({ where: { resumeId: id } });
            else
              await tx.jobDescription.upsert({
                where: { resumeId: id },
                create: { resumeId: id, text: input.job },
                update: { text: input.job },
              });
          }
          return tx.resume.findUniqueOrThrow({
            where: { id },
            include: selection,
          });
        }),
      );
    }
  }
  const data = resumeSchema.parse(resume.data);
  if (action === "duplicate" && req.method === "POST") {
    const input = z
      .object({ title, job: jobText.optional() })
      .parse(await body(req));
    await rate("create:" + userId, 80, 60 * 60_000);
    const job = input.job ?? resume.job?.text;
    return json(
      await db.resume.create({
        data: {
          userId,
          title: input.title,
          data,
          parentId: id,
          ...(job ? { job: { create: { text: job } } } : {}),
        },
        include: selection,
      }),
      201,
    );
  }
  if (action === "analyses" && req.method === "GET")
    return json(
      await db.aTSAnalysis.findMany({
        where: { resumeId: id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    );
  if (action === "compare" && req.method === "POST") {
    const { job } = z.object({ job: jobText.min(8) }).parse(await body(req));
    return json(compareJob(data, job));
  }
  if (action === "analyses" && req.method === "POST") {
    await rate("ats:" + userId, 60, 60 * 60_000);
    const input = z
      .object({ grammarConsent: z.boolean().default(false) })
      .parse(await body(req));
    const grammar = input.grammarConsent ? await grammarReview(data) : [];
    const report = {
      ...analyze(data, resume.job?.text, [], grammar),
      grammarChecked: input.grammarConsent,
      sourceFindings: (resume.source?.diagnostics ?? []) as Diagnostic[],
    };
    return json(
      await db.$transaction(async (tx) => {
        const changed = await tx.resume.updateMany({
          where: { id, userId, revision: resume.revision },
          data: {
            score: report.total,
            status: state(report.total),
            updatedAt: resume.updatedAt,
          },
        });
        if (!changed.count)
          throw new HttpError(
            409,
            "El CV cambió durante el análisis. Vuelve a analizarlo.",
          );
        return tx.aTSAnalysis.create({
          data: {
            resumeId: id,
            revision: resume.revision,
            score: report.total,
            report: jsonDb(report),
          },
        });
      }),
      201,
    );
  }
  if (action === "ai" && req.method === "POST") {
    const { task, consent, direction } = z
      .object({
        task: z.enum(aiTasks),
        consent: z.boolean(),
        direction: z.string().max(400).default(""),
      })
      .parse(await body(req));
    if (!consent)
      throw new HttpError(
        422,
        "Autoriza el envío del contenido al proveedor de IA.",
      );
    await rate("ai:" + userId, 20, 60 * 60_000);
    const result = await recommend(
      task,
      data,
      resume.job?.text ?? "",
      direction,
    );
    await db.aIRecommendation.create({
      data: { resumeId: id, task, result: jsonDb(result) },
    });
    return json({ result, revision: resume.revision });
  }
  if (action === "preview" && req.method === "POST") {
    const { data: draft } = z
      .object({ data: resumeSchema })
      .parse(await body(req));
    await rate("preview:" + userId, 180, 60 * 60_000);
    if (!draft.personal.name)
      throw new HttpError(
        422,
        "Completa el nombre antes de generar la vista de impresión.",
      );
    return download(await makePdf(draft), "CV.pdf", "application/pdf", true);
  }
  if (action === "export" && req.method === "POST") {
    await rate("export:" + userId, 60, 60 * 60_000);
    const input = z
      .object({
        format: z.enum(["pdf", "docx"]),
        mode: z.enum(["ats", "visual"]),
        acknowledge: z.boolean().default(false),
      })
      .parse(await body(req));
    const draft = { ...data, style: { ...data.style, mode: input.mode } };
    validateExport(draft);
    const report = analyze(draft, resume.job?.text);
    if (report.issues.some((e) => e.severity === "alta") && !input.acknowledge)
      throw new HttpError(
        422,
        "Revisa las alertas de gravedad alta o confirma que quieres exportar con ellas.",
      );
    const output =
      input.format === "pdf" ? await makePdf(draft) : await makeDocx(draft);
    const name = fileName(draft, input.format);
    await db.exportHistory.create({
      data: {
        resumeId: id,
        bytes: new Uint8Array(output),
        name,
        format: input.format,
        revision: resume.revision,
        snapshot: {
          title: resume.title,
          data: draft,
          job: resume.job?.text ?? "",
        },
        mode: input.mode,
      },
    });
    const mime =
      input.format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    return download(output, name, mime);
  }
  throw new HttpError(405, "Operación no disponible.");
}
