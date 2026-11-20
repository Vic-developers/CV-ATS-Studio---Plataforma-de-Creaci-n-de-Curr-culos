import { join } from "node:path";
import { copyFile, mkdtemp, rmdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createWorker, OEM } from "tesseract.js";
import { PDFParse } from "pdf-parse";
import { HttpError } from "./http";

export const maxOcrPages = 4;
let recognizing = false;

async function within<T>(operation: Promise<T>, milliseconds: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new HttpError(
                422,
                "El OCR tardó demasiado. Prueba con menos páginas o una copia más clara.",
              ),
            ),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function openPdf(bytes: Uint8Array) {
  return new PDFParse({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: false,
    stopAtErrors: true,
    maxImageSize: 12_000_000,
    canvasMaxAreaInBytes: 32_000_000,
  });
}

export async function renderPdfPage(
  pdf: PDFParse,
  page: { pageNumber: number; width: number; height: number },
  edge: number,
) {
  const { pageNumber, width, height } = page;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    Math.min(width, height) <= 0
  )
    throw new HttpError(422, "La página tiene dimensiones inválidas.");
  const result = await pdf.getScreenshot({
    partial: [pageNumber],
    scale: edge / Math.max(width, height),
    imageBuffer: true,
    imageDataUrl: false,
  });
  const image = result.pages[0]?.data;
  if (!image?.length)
    throw new HttpError(422, "No se pudo representar la página del PDF.");
  return image;
}

export async function recognizePages(pdf: PDFParse, numbers: number[]) {
  if (recognizing)
    throw new HttpError(
      429,
      "El servidor está leyendo otro PDF escaneado. Inténtalo de nuevo en unos segundos.",
    );
  recognizing = true;
  const models = ["spa", "eng"];
  let directory: string | undefined;
  try {
    const metadata = await pdf.getInfo({ parsePageInfo: true });
    const langPath = await mkdtemp(join(tmpdir(), "cv-ats-ocr-"));
    directory = langPath;
    for (const code of models) {
      const name = code + ".traineddata.gz";
      await copyFile(
        join(
          process.cwd(),
          "node_modules",
          "@tesseract.js-data",
          code,
          "4.0.0_best_int",
          name,
        ),
        join(langPath, name),
      );
    }
    const startup = createWorker("spa+eng", OEM.LSTM_ONLY, {
      langPath,
      cacheMethod: "none",
      errorHandler: () => {},
    });
    const worker = await within(startup, 20_000).catch((error) => {
      void startup.then((worker) => worker.terminate()).catch(() => {});
      throw error;
    });
    try {
      const recognized = new Map<number, string>();
      for (const number of numbers.slice(0, maxOcrPages)) {
        const page = metadata.pages.find((item) => item.pageNumber === number);
        if (!page) continue;
        const image = await renderPdfPage(pdf, page, 1750);
        const result = await within(
          worker.recognize(Buffer.from(image)),
          20_000,
        );
        const text = result.data.text.trim();
        if (text) recognized.set(number, text);
      }
      return recognized;
    } finally {
      await worker.terminate();
    }
  } finally {
    if (directory) {
      for (const code of models)
        await unlink(join(directory, code + ".traineddata.gz")).catch(() => {});
      await rmdir(directory).catch(() => {});
    }
    recognizing = false;
  }
}
