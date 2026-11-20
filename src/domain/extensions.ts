import { z } from "./validation";
import { documentBlocks, type Block, type ResumeData } from "./resume";

export const recordId = z.string().regex(/^[a-z0-9]{10,40}$/i);
export const revisionNumber = z.number().int().nonnegative();
export const formats = z.enum(["pdf", "docx"]);
export const modes = z.enum(["ats", "visual"]);
export const achievementFields = z.object({
  title: z.string().trim().min(1).max(100),
  context: z.string().trim().max(500).default(""),
  description: z.string().trim().min(1).max(2500),
  metrics: z.string().trim().max(1200).default(""),
  confirmed: z.literal(true),
});
export const applicationStatus = {
  sent: "Enviada",
  interview: "Entrevista",
  offer: "Oferta",
  rejected: "Rechazada",
  withdrawn: "Retirada",
} as const;
export const applicationFields = z.object({
  company: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  sentOn: z.iso.date(),
  status: z.enum(["sent", "interview", "offer", "rejected", "withdrawn"]),
  url: z
    .string()
    .trim()
    .max(500)
    .refine((value) => {
      if (!value) return true;
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    })
    .default(""),
  notes: z.string().trim().max(4000).default(""),
});

export function addAchievement(
  data: ResumeData,
  index: number,
  entry: Pick<z.output<typeof achievementFields>, "description" | "metrics">,
) {
  const append = (previous: string, added: string) => {
    if (
      !added ||
      previous
        .split("\n")
        .some(
          (_, i, rows) =>
            rows.slice(i, i + added.split("\n").length).join("\n") === added,
        )
    )
      return previous;
    return [previous.trim(), added].filter(Boolean).join("\n");
  };
  const current = data.experience[index];
  if (!current) return null;
  const achievements = append(current.achievements, entry.description);
  const metrics = append(current.metrics, entry.metrics);
  if (achievements.length > 6000 || metrics.length > 6000) return null;
  return {
    ...data,
    experience: data.experience.map((item, i) =>
      i === index ? { ...item, achievements, metrics } : item,
    ),
  };
}

const readingText = (value: string) =>
  value
    .normalize("NFC")
    .replace(/\u00ad/g, "")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[•·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export function inspectReading(
  expected: Block[],
  pages: { number: number; text: string }[],
) {
  const actual = readingText(pages.map((page) => page.text).join("\n"));
  let after = 0;
  const missing: Block[] = [];
  const reordered: Block[] = [];
  for (const block of expected) {
    const value = readingText(block.text);
    if (!value) continue;
    const position = actual.indexOf(value, after);
    if (position >= 0) after = position + value.length;
    else if (actual.includes(value)) reordered.push(block);
    else missing.push(block);
  }
  return {
    pages,
    missing,
    reordered,
    empty: pages.filter((page) => !page.text.trim()).map((page) => page.number),
    total: expected.length,
  };
}
export type ReadingReport = ReturnType<typeof inspectReading>;

export function compareVersions(before: ResumeData, after: ResumeData) {
  const group = (data: ResumeData) => {
    const result = new Map<string, string[]>([["Encabezado y contacto", []]]);
    let section = "Encabezado y contacto";
    for (const block of documentBlocks(data)) {
      if (block.kind === "heading") {
        section = block.text;
        result.set(section, []);
      } else result.get(section)!.push(block.text);
    }
    return result;
  };
  const oldGroups = group(before),
    newGroups = group(after);
  const oldOrder = [...oldGroups.keys()],
    newOrder = [...newGroups.keys()];
  return {
    sections: [...new Set([...oldOrder, ...newOrder])].flatMap((section) => {
      const old = oldGroups.get(section) ?? [],
        current = newGroups.get(section) ?? [];
      return JSON.stringify(old) === JSON.stringify(current)
        ? []
        : [{ section, before: old, after: current }];
    }),
    orderChanged:
      oldOrder.filter((s) => newGroups.has(s)).join("\n") !==
      newOrder.filter((s) => oldGroups.has(s)).join("\n"),
    styleChanged: JSON.stringify(before.style) !== JSON.stringify(after.style),
  };
}
