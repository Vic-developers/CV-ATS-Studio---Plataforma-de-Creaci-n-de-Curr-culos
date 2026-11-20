import { cookies } from "next/headers";
import { z } from "@/domain/validation";
import {
  achievementFields,
  applicationFields,
  recordId,
  revisionNumber,
} from "@/domain/extensions";
import { resumeSchema } from "@/domain/resume";
import { db } from "./db";
import { body, HttpError, json } from "./http";
import { rate, verifyPassword, clearSessionCookie } from "./auth";
import { attachment, documentMime } from "./extended-resumes";

const applicationList = {
  id: true,
  resumeId: true,
  company: true,
  role: true,
  sentOn: true,
  status: true,
  url: true,
  notes: true,
  resumeTitle: true,
  resumeRevision: true,
  artifactName: true,
  artifactFormat: true,
  createdAt: true,
  updatedAt: true,
} as const;
const exportSnapshot = z.object({
  title: z.string(),
  data: resumeSchema,
  job: z.string(),
});

export async function workspaceData(
  req: Request,
  userId: string,
  resource: string,
  id?: string,
  action?: string,
) {
  const method = req.method;
  if (id && !recordId.safeParse(id).success)
    throw new HttpError(404, "Registro no encontrado.");
  if (resource === "achievements" && !action) {
    if (!id && method === "GET")
      return json(
        await db.achievement.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
        }),
      );
    if (!id && method === "POST") {
      const { confirmed, ...fields } = achievementFields.parse(await body(req));
      await rate("achievement:" + userId, 100, 60 * 60_000);
      return json(
        await db.achievement.create({ data: { userId, ...fields } }),
        201,
      );
    }
    if (id && method === "PATCH") {
      const { confirmed, ...fields } = achievementFields.parse(await body(req));
      const updated = await db.achievement.updateMany({
        where: { id, userId },
        data: fields,
      });
      if (!updated.count) throw new HttpError(404, "Logro no encontrado.");
      return json({ ok: true });
    }
    if (id && method === "DELETE") {
      if (!(await db.achievement.deleteMany({ where: { id, userId } })).count)
        throw new HttpError(404, "Logro no encontrado.");
      return json({ ok: true });
    }
  }
  if (resource === "applications") {
    if (!id && method === "GET")
      return json(
        await db.application.findMany({
          where: { userId },
          select: applicationList,
          orderBy: [{ sentOn: "desc" }, { createdAt: "desc" }],
        }),
      );
    if (!id && method === "POST") {
      const { resumeId, revision, exportId, ...fields } = applicationFields
        .extend({
          resumeId: recordId,
          revision: revisionNumber,
          exportId: recordId.optional(),
        })
        .parse(await body(req));
      await rate("application:" + userId, 100, 60 * 60_000);
      const application = await db.$transaction(async (tx) => {
        const resume = await tx.resume.findFirst({
          where: { id: resumeId, userId },
          include: { job: { select: { text: true } } },
        });
        if (!resume) throw new HttpError(404, "Currículum no encontrado.");
        const artifact = exportId
          ? await tx.exportHistory.findFirst({
              where: { id: exportId, resumeId, revision: { not: null } },
            })
          : null;
        const archived = artifact?.snapshot
          ? exportSnapshot.safeParse(artifact.snapshot)
          : null;
        if (exportId && (!artifact || !archived?.success))
          throw new HttpError(
            404,
            "La descarga no tiene una versión disponible.",
          );
        if (!artifact && resume.revision !== revision)
          throw new HttpError(
            409,
            "El currículum cambió. Recarga antes de registrar la postulación.",
          );
        const snapshot = archived?.success
          ? archived.data
          : {
              title: resume.title,
              data: resumeSchema.parse(resume.data),
              job: resume.job?.text ?? "",
            };
        return tx.application.create({
          data: {
            userId,
            resumeId,
            ...fields,
            resumeTitle: snapshot.title,
            resumeRevision: artifact?.revision ?? resume.revision,
            snapshot,
            artifactName: artifact?.name,
            artifactFormat: artifact?.format,
            artifact: artifact?.bytes,
          },
          select: applicationList,
        });
      });
      return json(application, 201);
    }
    if (id && !action && method === "PATCH") {
      const fields = applicationFields.parse(await body(req));
      if (
        !(
          await db.application.updateMany({
            where: { id, userId },
            data: fields,
          })
        ).count
      )
        throw new HttpError(404, "Postulación no encontrada.");
      return json({ ok: true });
    }
    if (id && !action && method === "DELETE") {
      if (!(await db.application.deleteMany({ where: { id, userId } })).count)
        throw new HttpError(404, "Postulación no encontrada.");
      return json({ ok: true });
    }
    if (id && method === "GET" && action === "document") {
      const row = await db.application.findFirst({
        where: { id, userId },
        select: { artifact: true, artifactFormat: true, artifactName: true },
      });
      if (!row?.artifact || !row.artifactName || !row.artifactFormat)
        throw new HttpError(404, "Archivo no encontrado.");
      return attachment(
        row.artifact,
        row.artifactName,
        documentMime(row.artifactFormat),
      );
    }
    if (id && method === "GET" && !action) {
      const row = await db.application.findFirst({
        where: { id, userId },
        select: { ...applicationList, snapshot: true },
      });
      if (!row) throw new HttpError(404, "Postulación no encontrada.");
      return json(row);
    }
  }
  throw new HttpError(405, "Operación no disponible.");
}

function databaseFile<T extends { bytes: Uint8Array }>(file: T) {
  const { bytes, ...metadata } = file;
  return { ...metadata, base64: Buffer.from(bytes).toString("base64") };
}
async function* accountRows(userId: string) {
  const owner = { userId };
  const viaResume = { resume: owner };
  const account = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, createdAt: true },
  });
  const batches = {
    resumes: (id: string) =>
      db.resume.findMany({
        where: { ...owner, id: { gt: id } },
        orderBy: { id: "asc" },
        take: 10,
        include: { job: true },
      }),
    versions: (id: string) =>
      db.resumeVersion.findMany({
        where: { ...viaResume, id: { gt: id } },
        orderBy: { id: "asc" },
        take: 10,
      }),
    analyses: (id: string) =>
      db.aTSAnalysis.findMany({
        where: { ...viaResume, id: { gt: id } },
        orderBy: { id: "asc" },
        take: 10,
      }),
    recommendations: (id: string) =>
      db.aIRecommendation.findMany({
        where: { ...viaResume, id: { gt: id } },
        orderBy: { id: "asc" },
        take: 10,
      }),
    achievements: (id: string) =>
      db.achievement.findMany({
        where: { ...owner, id: { gt: id } },
        orderBy: { id: "asc" },
        take: 10,
      }),
    applications: async (id: string) =>
      (
        await db.application.findMany({
          where: { ...owner, id: { gt: id } },
          orderBy: { id: "asc" },
          take: 1,
        })
      ).map(({ artifact, ...row }) => ({
        ...row,
        artifactBase64: artifact
          ? Buffer.from(artifact).toString("base64")
          : null,
      })),
    originals: async (id: string) =>
      (
        await db.importFile.findMany({
          where: { ...owner, id: { gt: id } },
          orderBy: { id: "asc" },
          take: 1,
        })
      ).map(databaseFile),
    exports: async (id: string) =>
      (
        await db.exportHistory.findMany({
          where: { ...viaResume, id: { gt: id } },
          orderBy: { id: "asc" },
          take: 1,
        })
      ).map(databaseFile),
  };
  yield '{"schemaVersion":1,"account":' + JSON.stringify(account);
  for (const [name, read] of Object.entries(batches)) {
    yield ',"' + name + '":[';
    let cursor = "";
    while (true) {
      const rows = await read(cursor);
      if (!rows.length) break;
      for (const row of rows) {
        yield (cursor ? "," : "") + JSON.stringify(row);
        cursor = row.id;
      }
    }
    yield "]";
  }
  yield "}";
}

export async function accountData(
  req: Request,
  userId: string,
  action?: string,
) {
  if (req.method === "GET" && action === "export") {
    await rate("account-export:" + userId, 4, 60 * 60_000);
    const rows = accountRows(userId);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const value = await rows.next();
        if (value.done) controller.close();
        else controller.enqueue(encoder.encode(value.value));
      },
      async cancel() {
        await rows.return(undefined);
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition":
          'attachment; filename="CV_ATS_Studio_datos.json"',
        "Cache-Control": "private, no-store",
      },
    });
  }
  if (req.method === "DELETE" && !action) {
    await rate("account-delete:" + userId, 8, 60 * 60_000);
    const input = z
      .object({
        password: z.string().min(12).max(128),
        confirm: z.literal("ELIMINAR"),
      })
      .parse(await body(req));
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    if (!user || !(await verifyPassword(input.password, user.password)))
      throw new HttpError(403, "La contraseña no coincide.");
    const deleted = await db.user.deleteMany({
      where: { id: userId, password: user.password },
    });
    if (!deleted.count)
      throw new HttpError(409, "La cuenta cambió. Inténtalo nuevamente.");
    await clearSessionCookie();
    return json({ ok: true });
  }
  throw new HttpError(405, "Operación no disponible.");
}
