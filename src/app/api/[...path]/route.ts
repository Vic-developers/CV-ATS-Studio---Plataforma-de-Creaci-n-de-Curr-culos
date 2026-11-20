import { auth, requireUser } from "@/server/auth";
import { HttpError, route } from "@/server/http";
import { importResume, resumes } from "@/server/resumes";
import { original } from "@/server/originals";
import { accountData, workspaceData } from "@/server/workspace-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handler = route(async (req, [resource, id, action, subId, ...extra]) => {
  if (extra.length) throw new HttpError(404, "Ruta no encontrada.");
  if (resource === "resumes") {
    const user = await requireUser();
    return resumes(req, user.id, id, action, subId);
  }
  if (subId) throw new HttpError(404, "Ruta no encontrada.");
  if (resource === "auth" && id && !action) return auth(req, id);
  const user = await requireUser();
  if (resource === "imports" && id) return original(req, user.id, id, action);
  if (resource === "imports" && !id && !action)
    return importResume(req, user.id);
  if (resource === "account" && !action) return accountData(req, user.id, id);
  if (resource === "achievements" || resource === "applications")
    return workspaceData(req, user.id, resource, id, action);
  throw new HttpError(404, "Ruta no encontrada.");
});
export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
