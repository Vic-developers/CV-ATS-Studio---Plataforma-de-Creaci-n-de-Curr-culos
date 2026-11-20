import { auth, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { HttpError, json, route } from "@/server/http";
import { importResume, resumes } from "@/server/resumes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handler = route(async (req, [resource, id, action, ...extra]) => {
  if (extra.length) throw new HttpError(404, "Ruta no encontrada.");
  if (resource === "auth" && id && !action) return auth(req, id);
  const user = await requireUser();
  if (resource === "resumes") return resumes(req, user.id, id, action);
  if (resource === "imports" && !action) {
    if (!id) return importResume(req, user.id);
    if (req.method === "DELETE") {
      await db.importFile.deleteMany({
        where: { id, userId: user.id, resumeId: null },
      });
      return json({ ok: true });
    }
  }
  throw new HttpError(404, "Ruta no encontrada.");
});
export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
