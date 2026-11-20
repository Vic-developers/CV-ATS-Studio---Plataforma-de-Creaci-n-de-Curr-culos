import { recordId } from "@/domain/extensions";
import { db } from "./db";
import { HttpError, json } from "./http";
import { attachment } from "./extended-resumes";
import { openPdf, renderPdfPage } from "./ocr";
import { rate } from "./auth";

export async function original(
  req: Request,
  userId: string,
  id: string,
  action?: string,
) {
  if (!recordId.safeParse(id).success)
    throw new HttpError(404, "Archivo no encontrado.");
  const where = {
    id,
    userId,
    OR: [
      { resumeId: { not: null } },
      { createdAt: { gt: new Date(Date.now() - 24 * 60 * 60_000) } },
    ],
  };
  if (req.method === "DELETE" && !action) {
    await db.importFile.deleteMany({ where: { id, userId, resumeId: null } });
    return json({ ok: true });
  }
  if (req.method !== "GET")
    throw new HttpError(405, "Operación no disponible.");
  const file = await db.importFile.findFirst({
    where,
    select: { bytes: true, mime: true, name: true },
  });
  if (!file) throw new HttpError(404, "Archivo no encontrado.");
  if (!action) return attachment(file.bytes, file.name, file.mime);
  if (action !== "page" || file.mime !== "application/pdf")
    throw new HttpError(404, "Vista previa no disponible.");
  const number = Number(new URL(req.url).searchParams.get("number") ?? "1");
  if (!Number.isInteger(number) || number < 1 || number > 40)
    throw new HttpError(422, "Número de página inválido.");
  await rate("source-page:" + userId, 80, 60 * 60_000);
  const pdf = openPdf(file.bytes);
  try {
    const info = await pdf.getInfo({ parsePageInfo: true, partial: [number] });
    const page = info.pages.find((item) => item.pageNumber === number);
    if (!page) throw new HttpError(404, "Página no encontrada.");
    const image = await renderPdfPage(pdf, page, 950);
    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
      },
    });
  } finally {
    await pdf.destroy();
  }
}
