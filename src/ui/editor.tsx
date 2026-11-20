"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  FileText,
  Palette,
  ScanLine,
  Sparkles,
} from "lucide-react";
import { analyze, type compareJob } from "@/domain/ats";
import {
  blankResume,
  extraSections,
  resumeSchema,
  type ResumeData,
} from "@/domain/resume";
import {
  api,
  apiResponse,
  message,
  payload,
  saveDownload,
  type ImportResult,
  type PastAnalysis,
  type SavedResume,
} from "./client";
import { Content } from "./content";
import { Design } from "./design";
import { Preview } from "./preview";
import { AIReview, JobReview, Reports } from "./reviews";
import { Modal, Notice } from "./primitives";

type Tab = "content" | "design" | "analysis" | "job" | "ai";
type Draft = { data: ResumeData; title: string };
const tabs = [
  { id: "content", label: "Contenido", icon: FileText },
  { id: "design", label: "Diseño", icon: Palette },
  { id: "analysis", label: "Análisis ATS", icon: ScanLine },
  { id: "job", label: "Oferta laboral", icon: ClipboardList },
  { id: "ai", label: "Asistente IA", icon: Sparkles },
] as const;
const sectionSteps: Record<string, number> = {
  profile: 1,
  experience: 2,
  education: 3,
  skills: 4,
  certifications: 5,
};

export function Editor({
  initial,
  staged,
  initialTab,
  onChange,
  onOpen,
  onExit,
}: {
  initial: SavedResume | null;
  staged: ImportResult | null;
  initialTab: Tab;
  onChange: (item: SavedResume) => void;
  onOpen: (item: SavedResume) => void;
  onExit: () => void;
}) {
  const [data, setData] = useState(
    initial?.data ?? staged?.data ?? blankResume(),
  );
  const [title, setTitle] = useState(
    initial?.title ??
      staged?.source.name.replace(/\.[^.]+$/, "").slice(0, 100) ??
      "Currículum importado",
  );
  const [revision, setRevision] = useState(initial?.revision ?? 0);
  const [job, setJob] = useState(initial?.job?.text ?? "");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [step, setStep] = useState(0);
  const [history, setHistory] = useState<PastAnalysis[]>([]);
  const [aiTask, setAiTask] = useState("profile");
  const [comparison, setComparison] = useState<ReturnType<
    typeof compareJob
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saveState, setSaveState] = useState("Guardado");
  const [sourceReviewed, setSourceReviewed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMode, setExportMode] = useState<"ats" | "visual">(
    data.style.mode,
  );
  const [exportError, setExportError] = useState("");
  const [printUrl, setPrintUrl] = useState("");
  const [exitDialog, setExitDialog] = useState(false);
  const path = "/resumes/" + (initial?.id ?? "");
  const draft = useRef<Draft>({ data, title });
  const savedDraft = useRef(draft.current);
  const saved = useRef(initial);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  }, [onChange]);
  const update = (next: ResumeData) => {
    draft.current = { ...draft.current, data: next };
    setData(next);
    setComparison(null);
    if (initial) setSaveState("Cambios pendientes");
  };
  const rename = (next: string) => {
    draft.current = { ...draft.current, title: next };
    setTitle(next);
    if (initial) setSaveState("Cambios pendientes");
  };
  const flush = useCallback(
    (associatedJob?: string) => {
      const next = queue.current.then(async () => {
        if (!saved.current)
          throw new Error("Guarda primero el currículum importado.");
        const snapshot = draft.current;
        const changes = {
          data: snapshot.data !== savedDraft.current.data,
          title: snapshot.title !== savedDraft.current.title,
          job:
            associatedJob !== undefined &&
            associatedJob.trim() !== (saved.current.job?.text ?? ""),
        };
        if (!changes.data && !changes.title && !changes.job)
          return saved.current;
        setSaveState("Guardando…");
        try {
          if (changes.data) {
            const validation = resumeSchema.safeParse(snapshot.data);
            if (!validation.success)
              throw new Error(
                "Revisa " +
                  validation.error.issues
                    .map((x) => x.path.join("."))
                    .slice(0, 3)
                    .join(", ") +
                  " antes de guardar.",
              );
          }
          if (!snapshot.title.trim())
            throw new Error("Escribe un nombre para este currículum.");
          const item = await api<SavedResume>(
            path,
            payload(
              {
                revision: saved.current.revision,
                data: changes.data ? snapshot.data : undefined,
                title: changes.title ? snapshot.title : undefined,
                job: changes.job ? associatedJob : undefined,
              },
              "PATCH",
            ),
          );
          saved.current = item;
          savedDraft.current = snapshot;
          changed.current(item);
          setRevision(item.revision);
          setSaveState(
            draft.current === snapshot ? "Guardado" : "Cambios pendientes",
          );
          return item;
        } catch (e) {
          setSaveState("Sin guardar");
          throw e;
        }
      });
      queue.current = next.catch(() => undefined);
      return next;
    },
    [path],
  );
  useEffect(() => {
    if (!initial || draft.current === savedDraft.current) return;
    const timeout = window.setTimeout(() => {
      flush()
        .then(() => setError(""))
        .catch((e) => setError(message(e)));
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [data, title, flush, initial]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (staged || draft.current !== savedDraft.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [staged]);
  useEffect(() => {
    if (!initial || tab !== "analysis") return;
    const abort = new AbortController();
    api<PastAnalysis[]>(path + "/analyses", { signal: abort.signal })
      .then(setHistory)
      .catch((e) => {
        if (!abort.signal.aborted) setError(message(e));
      });
    return () => abort.abort();
  }, [initial, tab, path]);
  useEffect(
    () => () => {
      if (printUrl) URL.revokeObjectURL(printUrl);
    },
    [printUrl],
  );
  const choose = (next: Tab) => {
    setTab(next);
    setSuccess("");
  };
  const showAI = (task: string) => {
    setAiTask(task);
    choose("ai");
  };
  async function operate(fn: () => Promise<void>) {
    if (busy) return;
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const exit = () =>
    operate(async () => {
      if (staged) {
        setExitDialog(true);
        return;
      }
      try {
        await flush();
        onExit();
      } catch {
        setExitDialog(true);
      }
    });
  const inspectPrint = () =>
    operate(async () => {
      const response = await apiResponse(
        path + "/preview",
        payload({ data: draft.current.data }),
      );
      setPrintUrl(URL.createObjectURL(await response.blob()));
    });
  const warnings = analyze({
    ...data,
    style: { ...data.style, mode: exportMode },
  }).issues.filter((i) => i.severity === "alta");

  return (
    <div className="editor">
      <header className="editor-header">
        <div className="actions">
          <button
            className="icon-button"
            title="Volver al panel"
            aria-label="Volver al panel"
            onClick={exit}
          >
            <ArrowLeft size={20} />
          </button>
          <span className="editor-divider" />
          <span className="doc-icon">
            <FileText size={18} />
          </span>
          <label className="title-input">
            <span className="sr-only">Nombre del currículum</span>
            <input
              value={title}
              maxLength={100}
              onChange={(e) => rename(e.target.value)}
            />
          </label>
        </div>
        <div className="actions">
          <span className="save-state" aria-live="polite">
            {initial && saveState === "Guardado" && <Check size={15} />}{" "}
            {initial ? saveState : "Importación pendiente"}
          </span>
          {initial && (
            <button
              className="button primary"
              onClick={() => {
                setExportError("");
                setExporting(true);
                setExportMode(data.style.mode);
              }}
            >
              <Download size={17} /> Exportar <ChevronDown size={14} />
            </button>
          )}
        </div>
      </header>
      <main className="editor-body">
        <section className="editor-left">
          {initial ? (
            <nav
              className="editor-tabs"
              aria-label="Herramientas del currículum"
            >
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={tab === id ? "active" : ""}
                  aria-current={tab === id ? "page" : undefined}
                  onClick={() => choose(id)}
                >
                  <Icon size={17} />
                  {label}
                </button>
              ))}
            </nav>
          ) : null}
          <div className="edit-content stack">
            {error && <Notice>{error}</Notice>}
            {success && <Notice kind="success">{success}</Notice>}
            {staged && (
              <div className="record stack">
                <h2>Revisar importación</h2>
                <p>
                  Confirma que los datos de {staged.source.name} estén en las
                  secciones correctas.
                </p>
                {!data.personal.name && (
                  <Notice kind="info">No se identificó el nombre.</Notice>
                )}
                {!data.personal.email && !data.personal.phone && (
                  <Notice kind="info">
                    No se identificó un correo o teléfono.
                  </Notice>
                )}
                {!data.profile && (
                  <Notice kind="info">
                    No se identificó un perfil profesional.
                  </Notice>
                )}
                {!data.experience.length && (
                  <Notice kind="info">
                    No se identificaron experiencias laborales.
                  </Notice>
                )}
                {!!staged.findings.length &&
                  staged.findings.map((item, i) => (
                    <Notice kind="info" key={i}>
                      {item.finding} {item.action}
                    </Notice>
                  ))}
                {!!staged.unclassified.length && (
                  <details>
                    <summary>Texto sin clasificar</summary>
                    <pre className="raw">{staged.unclassified.join("\n")}</pre>
                  </details>
                )}
                <details>
                  <summary>Ver todo el texto extraído</summary>
                  <pre className="raw">{staged.raw}</pre>
                </details>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={sourceReviewed}
                    onChange={(e) => setSourceReviewed(e.target.checked)}
                  />{" "}
                  Revisé y confirmé los datos extraídos
                </label>
                <button
                  className="button primary"
                  disabled={!sourceReviewed || busy}
                  onClick={() =>
                    operate(async () =>
                      onOpen(
                        await api<SavedResume>(
                          "/resumes",
                          payload({
                            title,
                            data,
                            importId: staged.source.id,
                            confirmed: true,
                          }),
                        ),
                      ),
                    )
                  }
                >
                  Guardar currículum importado
                </button>
              </div>
            )}
            {tab === "content" && (
              <Content
                data={data}
                change={update}
                step={step}
                setStep={setStep}
                ai={(task) =>
                  initial
                    ? showAI(task)
                    : setError(
                        "Confirma y guarda la importación para solicitar ayuda de IA.",
                      )
                }
              />
            )}
            {tab === "design" && <Design data={data} change={update} />}
            {tab === "analysis" && (
              <Reports
                history={history}
                revision={revision}
                busy={busy}
                run={(grammarConsent) =>
                  operate(async () => {
                    const item = await flush();
                    const row = await api<PastAnalysis>(
                      path + "/analyses",
                      payload({ grammarConsent }),
                    );
                    setHistory((list) => [
                      row,
                      ...list.filter((x) => x.id !== row.id),
                    ]);
                    const latest = {
                      ...item,
                      score: row.score,
                      status: row.score >= 75 ? "optimized" : "review",
                    };
                    if (saved.current?.revision === row.revision) {
                      saved.current = latest;
                      changed.current(latest);
                    }
                  })
                }
                onCorrect={(section) => {
                  setStep(
                    sectionSteps[section] ??
                      (extraSections.includes(
                        section as (typeof extraSections)[number],
                      )
                        ? 6
                        : 0),
                  );
                  choose("content");
                }}
              />
            )}
            {tab === "job" && (
              <>
                <JobReview
                  job={job}
                  setJob={(value) => {
                    setJob(value);
                    setComparison(null);
                  }}
                  busy={busy}
                  result={comparison}
                  compare={() =>
                    operate(async () => {
                      await flush();
                      setComparison(
                        await api<ReturnType<typeof compareJob>>(
                          path + "/compare",
                          payload({ job }),
                        ),
                      );
                    })
                  }
                  variant={(name) =>
                    operate(async () => {
                      await flush();
                      onOpen(
                        await api<SavedResume>(
                          path + "/duplicate",
                          payload({ title: name, job }),
                        ),
                      );
                    })
                  }
                  adapt={() =>
                    operate(async () => {
                      if (job.trim() !== saved.current?.job?.text)
                        throw new Error(
                          "Vincula la oferta a este CV o crea una versión antes de adaptarlo.",
                        );
                      showAI("job");
                    })
                  }
                />
                <button
                  className="button"
                  disabled={
                    busy || job.trim() === (saved.current?.job?.text ?? "")
                  }
                  onClick={() =>
                    operate(async () => {
                      await flush(job);
                      setSuccess(
                        job.trim()
                          ? "Oferta vinculada al currículum."
                          : "Oferta desvinculada.",
                      );
                    })
                  }
                >
                  {job.trim()
                    ? "Vincular oferta a este CV"
                    : "Desvincular oferta guardada"}
                </button>
              </>
            )}
            {tab === "ai" && (
              <AIReview
                path={path}
                task={aiTask}
                setTask={setAiTask}
                flush={flush}
                data={data}
                change={update}
              />
            )}
          </div>
        </section>
        <Preview
          data={data}
          canPrint={!!initial && !!data.personal.name && !busy}
          openPrint={inspectPrint}
        />
      </main>
      {exitDialog && (
        <Modal
          title={staged ? "Cancelar importación" : "Salir sin guardar"}
          onClose={() => setExitDialog(false)}
        >
          <div className="stack">
            <p>
              {staged
                ? "Se descartarán la extracción y el archivo pendiente."
                : "Los cambios pendientes se perderán."}
            </p>
            {error && <Notice>{error}</Notice>}
            <div className="actions align-right">
              <button className="button" onClick={() => setExitDialog(false)}>
                Seguir editando
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() =>
                  operate(async () => {
                    if (staged)
                      await api("/imports/" + staged.source.id, {
                        method: "DELETE",
                      });
                    onExit();
                  })
                }
              >
                Descartar y salir
              </button>
            </div>
          </div>
        </Modal>
      )}
      {exporting && (
        <Modal
          title="Exportar currículum"
          onClose={() => {
            if (!busy) setExporting(false);
          }}
        >
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              setBusy(true);
              setExportError("");
              try {
                await flush();
                const response = await apiResponse(
                  path + "/export",
                  payload({
                    format: form.get("format"),
                    mode: exportMode,
                    acknowledge: form.get("ack") === "on",
                  }),
                );
                saveDownload(response, await response.blob());
                setExporting(false);
              } catch (e) {
                setExportError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {exportError && <Notice>{exportError}</Notice>}
            <label>
              Formato
              <select name="format">
                <option value="pdf">PDF</option>
                <option value="docx">Word (DOCX)</option>
              </select>
            </label>
            <label>
              Diseño
              <select
                value={exportMode}
                onChange={(e) =>
                  setExportMode(e.target.value as "ats" | "visual")
                }
              >
                <option value="ats">ATS recomendado</option>
                <option value="visual">Visual</option>
              </select>
            </label>
            {exportMode === "visual" && (
              <Notice kind="info">
                Las líneas y acentos pueden afectar la interpretación
                automatizada.
              </Notice>
            )}
            {!!warnings.length && (
              <>
                <ul className="advice">
                  {warnings.map((item) => (
                    <li key={item.finding}>{item.finding}</li>
                  ))}
                </ul>
                <label className="check">
                  <input type="checkbox" name="ack" required /> Entiendo las
                  alertas y quiero exportar
                </label>
              </>
            )}
            <div className="actions align-right">
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() => setExporting(false)}
              >
                Volver a editar
              </button>
              <button className="button primary" disabled={busy}>
                <Download size={16} /> {busy ? "Generando…" : "Descargar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {printUrl && (
        <Modal title="Vista de impresión" onClose={() => setPrintUrl("")}>
          <div className="stack">
            <iframe
              title="PDF listo para imprimir"
              className="print-frame"
              src={printUrl}
            />
            <div className="actions align-right">
              <button className="button" onClick={() => setPrintUrl("")}>
                Volver a editar
              </button>
              <a
                className="button primary"
                href={printUrl}
                target="_blank"
                rel="noreferrer"
              >
                Abrir PDF para imprimir
              </a>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
