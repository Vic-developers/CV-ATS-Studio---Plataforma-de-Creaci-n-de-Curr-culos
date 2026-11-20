import JSZip from "jszip";
import mammoth from "mammoth";
import { maxOcrPages, openPdf, recognizePages } from "./ocr";
import {
  blankResume,
  english,
  labels,
  lines,
  newCertification,
  newEducation,
  newExperience,
  newExtra,
  norm,
  sections,
  type ResumeData,
  type Section,
} from "@/domain/resume";
import type { Diagnostic } from "@/domain/ats";
import { HttpError } from "./http";

export const maxImportSize = 8 * 1024 * 1024;
const wordMime =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const aliases: Record<string, Section> = {
  perfil: "profile",
  resumen: "profile",
  summary: "profile",
  experiencia: "experience",
  experience: "experience",
  educacion: "education",
  education: "education",
  formacion: "education",
  habilidades: "skills",
  competencias: "skills",
  skills: "skills",
  certificaciones: "certifications",
  cursos: "certifications",
};
for (const key of sections) {
  aliases[norm(labels[key])] = key;
  aliases[norm(english[key])] = key;
}
const unsupported = "El archivo no es un PDF o DOCX válido para importar.";
const warning = (
  finding: string,
  action: string,
  severity: Diagnostic["severity"] = "media",
): Diagnostic => ({ finding, action, severity });

async function unpackWord(bytes: Buffer, findings: Diagnostic[]) {
  const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (
    eocd < 0 ||
    eocd + 22 > bytes.length ||
    bytes.readUInt32LE(eocd + 4) !== 0
  )
    throw new HttpError(415, unsupported);
  const count = bytes.readUInt16LE(eocd + 10);
  let offset = bytes.readUInt32LE(eocd + 16),
    expanded = 0;
  if (count > 512)
    throw new HttpError(413, "El DOCX contiene demasiados elementos.");
  for (let i = 0; i < count; i++) {
    if (offset + 46 > eocd || bytes.readUInt32LE(offset) !== 0x02014b50)
      throw new HttpError(415, unsupported);
    expanded += bytes.readUInt32LE(offset + 24);
    if (expanded > 30 * 1024 * 1024)
      throw new HttpError(
        413,
        "El DOCX descomprimido supera el límite permitido.",
      );
    offset +=
      46 +
      bytes.readUInt16LE(offset + 28) +
      bytes.readUInt16LE(offset + 30) +
      bytes.readUInt16LE(offset + 32);
  }
  const zip = await JSZip.loadAsync(bytes);
  const clean = new JSZip();
  let actual = 0;
  const names = Object.keys(zip.files).filter((name) =>
    /^(?:\[Content_Types\]\.xml|word\/(?:document|styles|numbering|footnotes|endnotes)\.xml)$/.test(
      name,
    ),
  );
  for (const name of names) {
    const xml = await new Promise<string>((resolve, reject) => {
      const stream = zip.files[name].nodeStream("nodebuffer");
      const chunks: Buffer[] = [];
      stream
        .on("data", (chunk: Buffer) => {
          actual += Buffer.byteLength(chunk);
          if (actual > 12 * 1024 * 1024) {
            stream.pause();
            reject(
              new HttpError(
                413,
                "El contenido de texto del DOCX excede el límite permitido.",
              ),
            );
          } else chunks.push(chunk);
        })
        .on("error", reject)
        .on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
        .resume();
    });
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new HttpError(415, unsupported);
    clean.file(name, xml);
  }
  const xml = await clean.file("word/document.xml")?.async("string");
  if (
    !xml ||
    !clean.file("[Content_Types].xml") ||
    !/wordprocessingml\.document\.main\+xml/.test(
      await clean.file("[Content_Types].xml")!.async("string"),
    )
  )
    throw new HttpError(415, unsupported);
  if (/<w:tbl[\s>]/.test(xml))
    findings.push(
      warning(
        "El archivo original contiene tablas.",
        "Comprueba el orden de lectura de filas y columnas.",
      ),
    );
  if (/<w:cols[^>]+w:num="(?:[2-9]|\d{2,})"/.test(xml))
    findings.push(
      warning(
        "El archivo original usa varias columnas.",
        "Comprueba la secuencia de los campos.",
        "alta",
      ),
    );
  if (/<w:txbxContent|<v:textbox/.test(xml))
    findings.push(
      warning(
        "El archivo original contiene cuadros de texto.",
        "Traslada esa información a campos del CV.",
        "alta",
      ),
    );
  if (/<w:(headerReference|footerReference)\b/.test(xml))
    findings.push(
      warning(
        "El archivo original usa encabezados o pies.",
        "Revisa que los datos importantes estén en el cuerpo del CV.",
      ),
    );
  if (/<w:drawing|<w:pict/.test(xml))
    findings.push(
      warning(
        "El archivo original contiene elementos gráficos.",
        "Revisa que iconos e imágenes no sustituyan datos escritos.",
      ),
    );
  const fonts = [...xml.matchAll(/w:(?:ascii|hAnsi)="([^"]+)"/g)].map(
    (match) => match[1],
  );
  if (
    fonts.some(
      (font) =>
        !/^(Arial|Calibri|Aptos|Georgia|Times New Roman|Cambria|Helvetica|Verdana|Tahoma|Noto (Sans|Serif))$/i.test(
          font,
        ),
    )
  )
    findings.push(
      warning(
        "El archivo original declara tipografías no habituales.",
        "Usa una de las fuentes del editor.",
        "baja",
      ),
    );
  return (
    await mammoth.extractRawText({
      buffer: await clean.generateAsync({ type: "nodebuffer" }),
    })
  ).value;
}

function parseText(raw: string): { data: ResumeData; unclassified: string[] } {
  const data = blankResume();
  const rows = lines(raw);
  const grouped = new Map<Section, string[]>();
  const head: string[] = [];
  let target = head;
  for (const row of rows) {
    const field = aliases[norm(row).replace(/[:\s]+$/g, "")];
    if (field) {
      target = grouped.get(field) ?? [];
      grouped.set(field, target);
    } else target.push(row);
  }
  const contacts = head.join(" ");
  data.personal.email =
    contacts.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ?? "";
  data.personal.phone =
    contacts.match(
      /(?:\+\d{1,3}[ .-]?)?(?:\(?\d{3}\)?[ .-]?)\d{3}[ .-]?\d{4}/,
    )?.[0] ?? "";
  const websites = contacts.match(/https?:\/\/[^\s,·]+/gi) ?? [];
  data.personal.linkedin =
    websites.find((site) => /linkedin\.com\//i.test(site)) ?? "";
  data.personal.website =
    websites.find((site) => site !== data.personal.linkedin) ?? "";
  const leaders = head.filter(
    (row) =>
      !row.includes("@") &&
      !row.includes("http") &&
      !/\d{3}/.test(row) &&
      row.length <= 110,
  );
  data.personal.name = leaders.shift() ?? "";
  data.personal.role = leaders.shift() ?? "";
  data.profile = (grouped.get("profile") ?? []).join("\n").slice(0, 6000);
  const split = (value: string) =>
    value.split(/\s+[·|–—]\s+/).map((x) => x.trim());
  const dateTokens = (value: string) =>
    [
      ...value.matchAll(
        /\b(?:(0[1-9]|1[0-2])\/(\d{4})|(\d{4})(?:-(0[1-9]|1[0-2]))?)\b/g,
      ),
    ].map((m) => (m[2] ? m[2] + "-" + m[1] : m[3] + (m[4] ? "-" + m[4] : "")));
  const entries = (field: Section) => {
    const items = grouped.get(field) ?? [];
    const result: string[][] = [];
    for (const row of items) {
      if (
        !result.length ||
        (row.length < 180 &&
          !dateTokens(row).length &&
          /\s+[·|–—]\s+/.test(row) &&
          result.at(-1)!.length > 1)
      )
        result.push([row]);
      else result.at(-1)!.push(row);
    }
    return result.slice(0, 40);
  };
  data.experience = entries("experience").map(([title, ...rest]) => {
    const [role, company = ""] = split(title),
      dateLine =
        rest.find((row) => dateTokens(row).length > 0 && row.length < 90) ?? "";
    const [start = "", end = ""] = dateTokens(dateLine);
    return {
      ...newExperience(),
      role: role.slice(0, 500),
      company: company.slice(0, 500),
      start,
      end,
      current: /actualidad|present/i.test(dateLine),
      duties: rest
        .filter((row) => row !== dateLine)
        .join("\n")
        .slice(0, 6000),
    };
  });
  data.education = entries("education").map(([title, ...rest]) => {
    const [degree, institution = ""] = split(title);
    const [start = "", end = ""] = dateTokens(rest.join(" "));
    return {
      ...newEducation(),
      degree: degree.slice(0, 500),
      institution: institution.slice(0, 500),
      start,
      end,
      honors: rest
        .filter((row) => !dateTokens(row).length)
        .join("\n")
        .slice(0, 6000),
    };
  });
  data.certifications = entries("certifications").map(([title, ...rest]) => {
    const [name, issuer = ""] = split(title),
      [obtained = "", expiry = ""] = dateTokens(rest.join(" "));
    return {
      ...newCertification(),
      name: name.slice(0, 500),
      issuer: issuer.slice(0, 500),
      obtained,
      expiry,
    };
  });
  const categoryAliases: Record<string, keyof ResumeData["skills"]> = {
    "competencias tecnicas": "technical",
    "technical skills": "technical",
    "competencias profesionales": "professional",
    "professional skills": "professional",
    "herramientas y tecnologias": "tools",
    "tools and technologies": "tools",
    idiomas: "languages",
    languages: "languages",
    certificaciones: "certificates",
    certifications: "certificates",
    "habilidades digitales": "digital",
    "digital skills": "digital",
  };
  for (const row of grouped.get("skills") ?? []) {
    const colon = row.indexOf(":");
    const category =
      colon < 0 ? undefined : categoryAliases[norm(row.slice(0, colon))];
    const values = (category ? row.slice(colon + 1) : row)
      .split(/[,;·]/)
      .map((x) => x.trim().slice(0, 500))
      .filter(Boolean);
    const key = category ?? "technical";
    data.skills[key] = [...data.skills[key], ...values].slice(0, 40);
  }
  for (const key of Object.keys(
    data.extras,
  ) as (keyof ResumeData["extras"])[]) {
    data.extras[key] = entries(key).map(([title, ...rest]) => {
      const [name, organization = ""] = split(title);
      return {
        ...newExtra(),
        title: name.slice(0, 500),
        organization: organization.slice(0, 500),
        description: rest.join("\n").slice(0, 6000),
      };
    });
  }
  return { data, unclassified: leaders.slice(0, 30) };
}

export async function extract(
  bytes: Buffer,
  name: string,
  providedType: string,
) {
  const findings: Diagnostic[] = [];
  const pdf =
    /\.pdf$/i.test(name) && bytes.subarray(0, 5).toString() === "%PDF-";
  const word =
    /\.docx$/i.test(name) &&
    bytes.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]));
  const mime = pdf ? "application/pdf" : wordMime;
  if (
    (!pdf && !word) ||
    (providedType && ![mime, "application/octet-stream"].includes(providedType))
  )
    throw new HttpError(415, unsupported);
  let raw;
  let pageCount: number | null = null;
  try {
    if (pdf) {
      const parse = openPdf(bytes);
      try {
        const info = await parse.getInfo();
        pageCount = info.total;
        if (info.total > 40)
          throw new HttpError(413, "El PDF supera el límite de 40 páginas.");
        const content = await parse.getText({
          pageJoiner: "",
          lineEnforce: true,
        });
        const scanned = content.pages
          .filter((page) => !/[\p{L}\p{N}]/u.test(page.text))
          .map((page) => page.num);
        const recognized = scanned.length
          ? await recognizePages(parse, scanned)
          : new Map<number, string>();
        raw = content.pages
          .map((page) => recognized.get(page.num) ?? page.text)
          .join("\n")
          .trim();
        if (recognized.size)
          findings.push(
            warning(
              "Se reconoció texto mediante OCR en " +
                recognized.size +
                " página(s).",
              "Compara el resultado con el PDF original antes de confirmar.",
            ),
          );
        if (scanned.length > recognized.size)
          findings.push(
            warning(
              "Algunas páginas no aportaron texto legible.",
              "El OCR analiza hasta " +
                maxOcrPages +
                " páginas sin texto por archivo. Revisa las páginas restantes.",
              "alta",
            ),
          );
        const firstLines = content.pages
          .map((page) => lines(page.text)[0])
          .filter(Boolean);
        const lastLines = content.pages
          .map((page) => lines(page.text).at(-1))
          .filter(Boolean);
        const repeats = (values: (string | undefined)[]) =>
          values.length > 1 && new Set(values).size < values.length;
        if (repeats(firstLines) || repeats(lastLines))
          findings.push(
            warning(
              "El PDF repite líneas en el borde de varias páginas.",
              "Comprueba si los encabezados o pies contienen información importante.",
              "baja",
            ),
          );
        const structure = bytes.toString("latin1");
        if (/\/Subtype\s*\/Image\b/.test(structure))
          findings.push(
            warning(
              "El PDF original contiene imágenes.",
              "Comprueba que los iconos y las imágenes tengan equivalentes en texto.",
              "baja",
            ),
          );
        if (content.pages.some((page) => /\S[ \t]{5,}\S/.test(page.text)))
          findings.push(
            warning(
              "Se detectaron posibles columnas en el PDF original.",
              "Comprueba la secuencia del texto extraído.",
            ),
          );
      } finally {
        await parse.destroy();
      }
    } else raw = await unpackWord(bytes, findings);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      422,
      "No se pudo leer el documento. Verifica que sea válido y que no esté protegido.",
    );
  }
  if (!raw.trim())
    throw new HttpError(
      422,
      "No se encontró texto legible. Prueba con una copia de mejor resolución.",
    );
  if (raw.length > 100_000)
    throw new HttpError(
      413,
      "El contenido del documento supera el límite de importación.",
    );
  const result = parseText(raw);
  return { ...result, raw, mime, findings, pageCount };
}
