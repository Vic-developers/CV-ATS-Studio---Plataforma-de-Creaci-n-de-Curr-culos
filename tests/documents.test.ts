import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import JSZip from "jszip";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { extract } from "../src/server/import";
import {
  fileName,
  makeDocx,
  makePdf,
  validateExport,
} from "../src/server/documents";
import { blankResume } from "../src/domain/resume";
import { fixture } from "./fixtures";

test("PDF preserves selectable text, accents, dates and reading order on every page", async () => {
  const data = fixture();
  data.experience[0].duties +=
    "\n" +
    Array.from(
      { length: 125 },
      (_, i) =>
        "Verificación " + (i + 1) + " con datos de República Dominicana.",
    ).join("\n");
  const pdf = await makePdf(data);
  const parser = new PDFParse({ data: new Uint8Array(pdf) });
  try {
    const text = await parser.getText({ pageJoiner: "" });
    assert.ok(text.pages.length > 1);
    assert.ok(text.pages.every((p) => p.text.trim()));
    assert.match(text.text, /María Núñez/);
    assert.match(text.text, /03\/2022 – 05\/2025/);
    assert.match(text.text, /Verificación 125/);
    assert.ok(
      text.text.indexOf("Perfil profesional") <
        text.text.indexOf("Experiencia laboral"),
    );
    assert.equal(fileName(data, "pdf"), "CV_Maria_Nunez.pdf");
  } finally {
    await parser.destroy();
  }
  if (process.env.CV_TEST_ARTIFACTS === "true") {
    await mkdir("tmp/pdfs", { recursive: true });
    await writeFile("tmp/pdfs/CV_Maria_Nunez.pdf", pdf);
  }
});

test("DOCX contains semantic headings, true editable bullets and text that can be reimported", async () => {
  const data = fixture(),
    docx = await makeDocx(data);
  const archive = await JSZip.loadAsync(docx);
  const xml = await archive.file("word/document.xml")!.async("string");
  assert.match(xml, /w:pStyle w:val="Heading1"/);
  assert.match(xml, /<w:numPr>/);
  assert.doesNotMatch(xml, /<w:drawing>/);
  const text = (await mammoth.extractRawText({ buffer: docx })).value;
  for (const s of [
    "María Núñez",
    "Ingeniería",
    "03/2022 – 05/2025",
    "Reduje el tiempo de revisión en un 20 %.",
  ])
    assert.ok(text.includes(s), s);
  const imported = await extract(
    docx,
    "CV.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  assert.equal(imported.data.personal.name, "María Núñez");
  assert.equal(imported.data.experience[0].start, "2022-03");
  assert.deepEqual(imported.data.skills.tools, ["SQL", "Python"]);
});

test("import rejects extension spoofing and accepts extracted PDF content", async () => {
  await assert.rejects(
    extract(Buffer.from("formato incorrecto"), "CV.pdf", "application/pdf"),
    { status: 415 },
  );
  const pdf = await makePdf(fixture());
  const imported = await extract(pdf, "CV.pdf", "application/pdf");
  assert.match(imported.raw, /María Núñez/);
  assert.ok(imported.data.profile.includes("automatización"));
  assert.throws(() => validateExport(blankResume()), { status: 422 });
});

test("mixed names and multiple alphabets retain glyphs or report an actionable PDF error", async () => {
  const data = fixture();
  data.personal.name = "Łukasz María Νίκος Анна";
  const pdf = new PDFParse({ data: new Uint8Array(await makePdf(data)) });
  try {
    assert.match((await pdf.getText()).text, /Łukasz María Νίκος Анна/);
  } finally {
    await pdf.destroy();
  }
  data.personal.name = "María 山田";
  await assert.rejects(makePdf(data), { status: 422 });
  const text = (await mammoth.extractRawText({ buffer: await makeDocx(data) }))
    .value;
  assert.match(text, /María 山田/);
});
