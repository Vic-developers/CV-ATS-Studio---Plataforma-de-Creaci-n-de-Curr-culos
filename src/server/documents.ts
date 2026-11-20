import { join } from "node:path";
import { readFileSync } from "node:fs";
import PDFDocument from "pdfkit";
import { create as parseFont } from "fontkit";
import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { documentBlocks, type Block, type ResumeData } from "@/domain/resume";
import { HttpError } from "./http";
import { presentation } from "@/domain/presentation";

const US = { width: 612, height: 792 };

const fontCache = new Map<string, { bytes: Buffer; glyphs: Set<number> }>();
function font(data: ResumeData, bold: boolean) {
  const family = data.style.font === "serif" ? "NotoSerif" : "NotoSans";
  const name = family + (bold ? "-Bold.ttf" : "-Regular.ttf");
  const cached = fontCache.get(name);
  if (cached) return cached;
  const bytes = readFileSync(join(process.cwd(), "assets", "fonts", name));
  const parsed = parseFont(bytes);
  if (!("characterSet" in parsed))
    throw new Error("Expected a single export font");
  const loaded = { bytes, glyphs: new Set(parsed.characterSet) };
  fontCache.set(name, loaded);
  return loaded;
}

function validateGlyphs(data: ResumeData, blocks: Block[]) {
  for (const block of blocks) {
    const { bold } = presentation(data, block.kind);
    const { glyphs } = font(data, bold);
    if ([...block.text].some((char) => !glyphs.has(char.codePointAt(0)!))) {
      throw new HttpError(
        422,
        "La fuente PDF no contiene uno o más caracteres del CV. Puedes conservarlos en la descarga de Word.",
      );
    }
  }
}

export async function makePdf(data: ResumeData): Promise<Buffer> {
  const blocks = documentBlocks(data);
  validateGlyphs(data, blocks);
  const margin = data.style.margin;
  const doc = new PDFDocument({
    size: "LETTER",
    margin,
    info: {
      Title: data.hiddenPersonal.includes("name")
        ? "CV"
        : data.personal.name || "CV",
    },
  });
  doc.registerFont("body", font(data, false).bytes);
  doc.registerFont("bold", font(data, true).bytes);
  const result = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const set = (block: Block) => {
    const style = presentation(data, block.kind);
    doc
      .font(style.bold ? "bold" : "body")
      .fontSize(style.size)
      .fillColor(style.color);
    return style;
  };
  const width = US.width - 2 * margin;
  const limit = US.height - margin;
  const indent = (block: Block) => (block.kind === "bullet" ? 13 : 0);
  for (const [i, block] of blocks.entries()) {
    const style = set(block);
    const options = {
      width: width - indent(block),
      lineGap: style.size * (data.style.leading - 1.15),
    };
    const ownLine = doc.currentLineHeight(true) + options.lineGap;
    let keep = ownLine;
    const next = blocks[i + 1];
    if (next && ["heading", "label", "title"].includes(block.kind)) {
      const nextStyle = set(next);
      keep +=
        nextStyle.before +
        doc.currentLineHeight(true) +
        nextStyle.size * (data.style.leading - 1.15) +
        style.after;
      set(block);
    }
    if (doc.y + style.before + keep > limit && doc.y > margin) doc.addPage();
    doc.y += style.before;
    const y = doc.y;
    if (style.border)
      doc
        .save()
        .strokeColor(data.style.color)
        .lineWidth(0.75)
        .moveTo(margin, y - 3)
        .lineTo(US.width - margin, y - 3)
        .stroke()
        .restore();
    if (block.kind === "bullet") doc.text("•", margin, y, { lineBreak: false });
    doc.text(block.text, margin + indent(block), y, options);
    doc.y += style.after;
  }
  doc.end();
  return result;
}

export async function makeDocx(data: ResumeData) {
  const margin = data.style.margin * 20;
  const family = data.style.font === "serif" ? "Georgia" : "Arial";
  const children = documentBlocks(data).map((block) => {
    const style = presentation(data, block.kind);
    return new Paragraph({
      children: [
        new TextRun({
          text: block.text,
          font: family,
          size: Math.round(style.size * 2),
          bold: style.bold,
          color: style.color.slice(1),
        }),
      ],
      heading:
        block.kind === "heading"
          ? HeadingLevel.HEADING_1
          : block.kind === "title"
            ? HeadingLevel.TITLE
            : undefined,
      bullet: block.kind === "bullet" ? { level: 0 } : undefined,
      keepNext: ["title", "heading", "label"].includes(block.kind),
      spacing: {
        before: style.before * 20,
        after: style.after * 20,
        line: Math.round(data.style.leading * 240),
      },
      border: style.border
        ? {
            top: {
              color: data.style.color.slice(1),
              style: BorderStyle.SINGLE,
              size: 6,
              space: 2,
            },
          }
        : undefined,
    });
  });
  return Packer.toBuffer(
    new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: margin,
                bottom: margin,
                left: margin,
                right: margin,
              },
              size: { width: US.width * 20, height: US.height * 20 },
            },
          },
          children,
        },
      ],
    }),
  );
}

export function validateExport(data: ResumeData) {
  const blocks = documentBlocks(data);
  if (
    !blocks.some((b) => b.kind === "title") ||
    !blocks.some((b) => b.kind === "body" || b.kind === "label")
  ) {
    throw new HttpError(
      422,
      "Incluye un nombre visible y al menos una sección con contenido antes de exportar.",
    );
  }
}

export function fileName(data: ResumeData, format: string) {
  const exposed = !data.hiddenPersonal.includes("name") && data.personal.name;
  const name = (exposed || "Curriculum")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 90);
  return "CV_" + (name || "Curriculum") + "." + format;
}
