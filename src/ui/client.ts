import type { ResumeData } from "@/domain/resume";
import type { Diagnostic, Report } from "@/domain/ats";

export type SavedResume = {
  id: string;
  title: string;
  revision: number;
  status: string;
  score: number | null;
  data: ResumeData;
  updatedAt: string;
  createdAt: string;
  parentId: string | null;
  job: { text: string } | null;
  source: { name: string; diagnostics: Diagnostic[] } | null;
};
export type PastAnalysis = {
  id: string;
  revision: number;
  createdAt: string;
  score: number;
  report: Report & { sourceFindings?: Diagnostic[] };
};
export type ImportResult = {
  data: ResumeData;
  source: { id: string; name: string };
  raw: string;
  unclassified: string[];
  findings: Diagnostic[];
};
export async function apiResponse(path: string, init: RequestInit = {}) {
  const response = await fetch("/api" + path, { ...init, cache: "no-store" });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const fields = (error.fields ?? []) as { path: string; message: string }[];
    throw new Error(
      fields.length
        ? fields.map((f) => f.path + " · " + f.message).join(" / ")
        : error.error || "No se pudo completar la operación.",
    );
  }
  return response;
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  return (await apiResponse(path, init)).json() as Promise<T>;
}
export const payload = (value: unknown, method = "POST"): RequestInit => ({
  method,
  body: JSON.stringify(value),
  headers: { "Content-Type": "application/json" },
});
export const displayDate = (value: string) =>
  new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(
    new Date(value),
  );
export const message = (error: unknown) =>
  error instanceof Error ? error.message : "Ocurrió un error.";
export function saveDownload(response: Response, blob: Blob) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    /filename="([^"]+)"/.exec(
      response.headers.get("content-disposition") ?? "",
    )?.[1] ?? "CV";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
