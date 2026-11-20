import { z } from "@/domain/validation";
import {
  inspectReading,
  formats,
  modes,
  recordId,
  revisionNumber,
} from "@/domain/extensions";
import { documentBlocks, resumeSchema } from "@/domain/resume";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { db } from "./db";
import type { Prisma } from "./generated/client";
import { body, HttpError, json } from "./http";
import { rate } from "./auth";
import { makeDocx, makePdf, validateExport } from "./documents";

export const resumeSelection = {
  job: { select: { text: true } },
  source: { select: { id: true, name: true, diagnostics: true } },
} as const;
type OwnedResume = Prisma.ResumeGetPayload<{ include: typeof resumeSelection }>;

export const documentMime = (format: string) =>
  format === "pdf"
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export function attachment(bytes: Uint8Array, name: string, mime: string) {
  const fallback =
    name
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9 ._-]/gi, "_") || "archivo";
  const encoded = encodeURIComponent(name.toWellFormed()).replace(
    /['()*]/g,
    (char) => "%" + char.charCodeAt(0).toString(16),
  );
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition":
        'attachment; filename="' + fallback + "\"; filename*=UTF-8''" + encoded,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

const versionMeta = {
  id: true,
  label: true,
  title: true,
  revision: true,
  createdAt: true,
} as const;
const exportMeta = {
  id: true,
  name: true,
  format: true,
  mode: true,
  revision: true,
  createdAt: true,
} as const;
const versionSnapshot = (resume: OwnedResume, label: string) => ({
  resumeId: resume.id,
  label,
  title: resume.title,
  revision: resume.revision,
  data: resumeSchema.parse(resume.data),
  job: resume.job?.text ?? "",
});

export async function resumeExtension(
  req: Request,
  resume: OwnedResume,
  action: string | undefined,
  subId?: string,
) {
  const { id: resumeId, userId } = resume;
  if (subId && !recordId.safeParse(subId).success)
    throw new HttpError(404, "Registro no encontrado.");
  const method = req.method;
  if (action === "reading" && !subId && method === "POST") {
    const input = z
      .object({ format: formats, mode: modes, exportId: recordId.optional() })
      .parse(await body(req));
    await rate("reading:" + userId, 40, 60 * 60_000);
    const archived = input.exportId
      ? await db.exportHistory.findFirst({
          where: { id: input.exportId, resumeId, revision: { not: null } },
        })
      : null;
    if (input.exportId && !archived?.snapshot)
      throw new HttpError(404, "La descarga no tiene una versión disponible.");
    const format = archived ? formats.parse(archived.format) : input.format;
    const mode = archived ? modes.parse(archived.mode) : input.mode;
    const data = archived
      ? z.object({ data: resumeSchema }).parse(archived.snapshot).data
      : resumeSchema.parse(resume.data);
    data.style.mode = mode;
    validateExport(data);
    const bytes = archived
      ? Buffer.from(archived.bytes)
      : format === "pdf"
        ? await makePdf(data)
        : await makeDocx(data);
    let pages: { number: number; text: string }[];
    if (format === "pdf") {
      const pdf = new PDFParse({
        data: new Uint8Array(bytes),
        isEvalSupported: false,
      });
      try {
        pages = (
          await pdf.getText({ pageJoiner: "", lineEnforce: true })
        ).pages.map((page) => ({ number: page.num, text: page.text }));
      } finally {
        await pdf.destroy();
      }
    } else {
      pages = [
        {
          number: 1,
          text: (await mammoth.extractRawText({ buffer: bytes })).value,
        },
      ];
    }
    return json({
      ...inspectReading(documentBlocks(data), pages),
      format,
      mode,
      revision: archived?.revision ?? resume.revision,
    });
  }
  if (action === "base" && !subId && method === "GET") {
    if (!resume.parentId) return json(null);
    return json(
      await db.resume.findFirst({
        where: { id: resume.parentId, userId },
        select: {
          title: true,
          revision: true,
          data: true,
          job: { select: { text: true } },
        },
      }),
    );
  }
  if (action === "versions") {
    if (!subId && method === "GET")
      return json(
        await db.resumeVersion.findMany({
          where: { resumeId },
          select: versionMeta,
          orderBy: { createdAt: "desc" },
        }),
      );
    if (!subId && method === "POST") {
      const { label, revision } = z
        .object({
          label: z.string().trim().min(1).max(100),
          revision: revisionNumber,
        })
        .parse(await body(req));
      if (revision !== resume.revision)
        throw new HttpError(
          409,
          "El currículum cambió. Recarga antes de crear un punto de guardado.",
        );
      await rate("versions:" + userId, 60, 60 * 60_000);
      return json(
        await db.resumeVersion.create({
          data: versionSnapshot(resume, label),
          select: versionMeta,
        }),
        201,
      );
    }
    if (subId) {
      const version = await db.resumeVersion.findFirst({
        where: { id: subId, resumeId },
      });
      if (!version) throw new HttpError(404, "Versión no encontrada.");
      if (method === "GET") return json(version);
      if (method === "DELETE") {
        await db.resumeVersion.deleteMany({ where: { id: subId, resumeId } });
        return json({ ok: true });
      }
      if (method === "POST") {
        const { revision } = z
          .object({ revision: revisionNumber })
          .parse(await body(req));
        if (revision !== resume.revision)
          throw new HttpError(
            409,
            "El currículum cambió. Recarga antes de restaurar.",
          );
        await rate("versions:" + userId, 60, 60 * 60_000);
        return json(
          await db.$transaction(async (tx) => {
            const changed = await tx.resume.updateMany({
              where: { id: resumeId, userId, revision },
              data: {
                title: version.title,
                data: resumeSchema.parse(version.data),
                revision: { increment: 1 },
                score: null,
                status: "draft",
              },
            });
            if (!changed.count)
              throw new HttpError(
                409,
                "El currículum cambió durante la restauración.",
              );
            await tx.resumeVersion.create({
              data: versionSnapshot(resume, "Antes de restaurar"),
            });
            if (version.job)
              await tx.jobDescription.upsert({
                where: { resumeId },
                create: { resumeId, text: version.job },
                update: { text: version.job },
              });
            else await tx.jobDescription.deleteMany({ where: { resumeId } });
            return tx.resume.findUniqueOrThrow({
              where: { id: resumeId },
              include: resumeSelection,
            });
          }),
        );
      }
    }
  }
  if (action === "exports") {
    if (!subId && method === "GET") {
      const revision = new URL(req.url).searchParams.get("revision");
      const requested =
        revision === null ? undefined : revisionNumber.parse(Number(revision));
      return json(
        await db.exportHistory.findMany({
          where: { resumeId, revision: requested },
          select: exportMeta,
          orderBy: { createdAt: "desc" },
        }),
      );
    }
    if (subId && method === "DELETE") {
      const result = await db.exportHistory.deleteMany({
        where: { id: subId, resumeId },
      });
      if (!result.count) throw new HttpError(404, "Descarga no encontrada.");
      return json({ ok: true });
    }
    if (subId && method === "GET") {
      const file = await db.exportHistory.findFirst({
        where: { id: subId, resumeId },
      });
      if (!file) throw new HttpError(404, "Descarga no encontrada.");
      return attachment(file.bytes, file.name, documentMime(file.format));
    }
  }
  if (action === "source" && !subId && method === "DELETE") {
    await db.importFile.deleteMany({ where: { resumeId, userId } });
    return json({ ok: true });
  }
  return null;
}
