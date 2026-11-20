import PDFDocument from "pdfkit";
import { PDFParse } from "pdf-parse";
import { makePdf } from "../src/server/documents";
import { fixture } from "./fixtures";

export async function scannedFixture() {
  const source = await makePdf(fixture());
  const extractor = new PDFParse({ data: new Uint8Array(source) });
  let image: Uint8Array;
  try {
    image = (
      await extractor.getScreenshot({
        partial: [1],
        desiredWidth: 1750,
        imageDataUrl: false,
        imageBuffer: true,
      })
    ).pages[0].data;
  } finally {
    await extractor.destroy();
  }
  const pdf = new PDFDocument({ size: "LETTER", margin: 0 });
  return new Promise<Buffer>((resolve, reject) => {
    const data: Buffer[] = [];
    pdf.on("data", (chunk) => data.push(chunk));
    pdf.on("error", reject);
    pdf.on("end", () => resolve(Buffer.concat(data)));
    pdf.image(Buffer.from(image), 0, 0, { width: 612, height: 792 });
    pdf.end();
  });
}
