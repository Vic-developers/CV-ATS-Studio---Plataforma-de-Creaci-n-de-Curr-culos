import type { Block, ResumeData } from "./resume";

export function presentation(data: ResumeData, kind: Block["kind"]) {
  const { size, color, mode, template } = data.style;
  const visual = mode === "visual";
  const heading = kind === "heading",
    title = kind === "title";
  return {
    size: title
      ? size + (visual ? 14 : 11)
      : heading
        ? size + 1.5
        : kind === "contact"
          ? size - 0.6
          : size,
    before: heading ? 12 : kind === "label" ? 6 : 0,
    after: title ? 4 : heading ? 4 : kind === "contact" ? 3 : 2,
    bold: title || heading || kind === "label" || kind === "subtitle",
    color:
      visual && (title || heading || kind === "subtitle") ? color : "#202832",
    border:
      visual &&
      heading &&
      ["executive", "technology", "creative", "international"].includes(
        template,
      ),
  };
}
