"use client";
import { useState } from "react";
import { ClipboardCheck, Copy, ScanLine, Sparkles } from "lucide-react";
import { categoryLabels, type compareJob } from "@/domain/ats";
import { documentBlocks, type ResumeData } from "@/domain/resume";
import {
  api,
  displayDate,
  message,
  payload,
  type PastAnalysis,
  type SavedResume,
} from "./client";
import { Notice } from "./primitives";

const aiChoices = {
  profile: "Redactar perfil profesional",
  rewrite: "Mejorar descripciones laborales",
  job: "Adaptar a la oferta guardada",
  verbs: "Recomendar verbos de acción",
  metrics: "Identificar logros cuantificables",
  redundancy: "Detectar redundancias",
  translate: "Traducir al inglés",
  industry: "Adaptar a una industria",
  seniority: "Ajustar al nivel profesional",
  grammar: "Revisar ortografía y gramática",
};
type ExperienceProposal = Pick<
  ResumeData["experience"][number],
  "duties" | "achievements" | "metrics"
> & { index: number };
type Proposal = {
  advice: string[];
  profile?: string;
  experience?: ExperienceProposal[];
  translation?: ResumeData;
};
function Tags({ values }: { values: string[] }) {
  return (
    <div className="tags">
      {values.length ? (
        values.map((value, i) => (
          <span className="tag" key={i}>
            {value}
          </span>
        ))
      ) : (
        <span className="muted">Ninguna identificada</span>
      )}
    </div>
  );
}
export function Reports({
  history,
  revision,
  busy,
  run,
  onCorrect,
}: {
  history: PastAnalysis[];
  revision: number;
  busy: boolean;
  run: (external: boolean) => void;
  onCorrect: (section: string) => void;
}) {
  const [external, setExternal] = useState(false);
  const [chosen, setChosen] = useState("");
  const row = history.find((item) => item.id === chosen) ?? history[0];
  const report = row?.report;
  return (
    <div className="stack">
      <h2>Compatibilidad ATS</h2>
      <p className="muted">
        El ATS Readiness Score es una evaluación interna de preparación. Cada
        plataforma y proceso de selección aplica sus propios criterios.
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={external}
          onChange={(e) => setExternal(e.target.checked)}
        />{" "}
        Enviar el texto del CV al servicio lingüístico configurado para revisar
        ortografía y gramática
      </label>
      <button
        className="button primary"
        disabled={busy}
        onClick={() => {
          setChosen("");
          run(external);
        }}
      >
        <ScanLine size={17} /> {busy ? "Analizando…" : "Analizar currículum"}
      </button>
      {report && (
        <>
          <label>
            Historial de análisis
            <select value={row.id} onChange={(e) => setChosen(e.target.value)}>
              {history.map((item) => (
                <option key={item.id} value={item.id}>
                  {displayDate(item.createdAt)} · {item.score}/100 · Rev.{" "}
                  {item.revision}
                </option>
              ))}
            </select>
          </label>
          {row.revision !== revision && (
            <Notice kind="info">
              Este análisis corresponde a una versión anterior. Ejecuta otro
              análisis para evaluar el CV actual.
            </Notice>
          )}
          <div className="score-box">
            <strong>
              {report.total}
              <small>/100</small>
            </strong>
            <span>{report.rating}</span>
          </div>
          <div className="stack">
            {Object.entries(report.scores).map(([key, value]) => {
              const category = key as keyof typeof categoryLabels;
              return (
                <div className="metric" key={key}>
                  <div>
                    {categoryLabels[category]}{" "}
                    <b>
                      {value}/{report.maxima[category]}
                    </b>
                  </div>
                  <progress value={value} max={report.maxima[category]} />
                </div>
              );
            })}
          </div>
          <h3>Acciones correctivas</h3>
          {report.issues.length ? (
            report.issues.map((issue, i) => (
              <div className="finding" key={i}>
                <span className={"pill " + issue.severity}>
                  {issue.severity}
                </span>
                <div>
                  <strong>{issue.finding}</strong>
                  <p>{issue.action}</p>
                  {issue.section && (
                    <button
                      className="link-button"
                      onClick={() => onCorrect(issue.section!)}
                    >
                      Abrir sección
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <Notice kind="success">La revisión no detectó problemas.</Notice>
          )}
          {!!report.sourceFindings?.length && (
            <>
              <h3>Hallazgos en el archivo original</h3>
              {report.sourceFindings.map((issue, i) => (
                <div className="finding" key={i}>
                  <span className={"pill " + issue.severity}>
                    {issue.severity}
                  </span>
                  <div>
                    <strong>{issue.finding}</strong>
                    <p>{issue.action}</p>
                  </div>
                </div>
              ))}
            </>
          )}
          {report.grammarChecked && (
            <p className="muted">Incluye revisión lingüística externa.</p>
          )}
        </>
      )}
    </div>
  );
}

export function JobReview({
  job,
  setJob,
  compare,
  variant,
  busy,
  result,
  adapt,
}: {
  job: string;
  setJob: (value: string) => void;
  compare: () => void;
  variant: (title: string) => void;
  busy: boolean;
  result: ReturnType<typeof compareJob> | null;
  adapt: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="stack">
      <h2>Optimizar para una oferta</h2>
      <label>
        Descripción de la oferta
        <textarea
          rows={9}
          value={job}
          maxLength={25000}
          onChange={(e) => setJob(e.target.value)}
          placeholder="Pega el cargo, las responsabilidades y los requisitos…"
        />
      </label>
      <button
        className="button primary"
        disabled={busy || job.trim().length < 8}
        onClick={compare}
      >
        <ClipboardCheck size={17} /> Comparar con mi CV
      </button>
      {result && (
        <>
          <div className="score-box">
            <strong>{result.score === null ? "—" : result.score + "%"}</strong>
            <span>{result.title || "Coincidencia de palabras clave"}</span>
          </div>
          {(
            [
              ["Responsabilidades", result.responsibilities],
              ["Requisitos obligatorios", result.required],
              ["Requisitos deseables", result.preferred],
            ] as const
          ).map(([label, items]) => (
            <details className="record" key={label}>
              <summary>{label}</summary>
              {items.length ? (
                <ul>
                  {items.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Sin apartados identificados.</p>
              )}
            </details>
          ))}
          {(
            [
              ["Palabras clave encontradas", result.found],
              ["Palabras clave faltantes", result.missing],
              ["Competencias que necesitan evidencia", result.evidenceNeeded],
              ["Herramientas y tecnologías", result.tools],
              ["Competencias técnicas", result.technical],
              ["Competencias profesionales", result.professional],
            ] as const
          ).map(([label, values]) => (
            <div key={label}>
              <h3>{label}</h3>
              <Tags values={values} />
            </div>
          ))}
          <Notice kind="info">{result.recommendation}</Notice>
          <button className="button" onClick={adapt}>
            <Sparkles size={16} /> Adaptar perfil y experiencia con IA
          </button>
          <form
            className="stack record"
            onSubmit={(e) => {
              e.preventDefault();
              variant(
                name.trim() ||
                  (result.title
                    ? "CV · " + result.title.slice(0, 94)
                    : "CV · Versión para oferta"),
              );
            }}
          >
            <h3>Crear una versión para esta oferta</h3>
            <label>
              Nombre de la nueva versión
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={result.title || "CV · Versión para oferta"}
                maxLength={100}
              />
            </label>
            <button className="button" disabled={busy}>
              <Copy size={16} /> Guardar como versión
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export function AIReview({
  path,
  task,
  setTask,
  flush,
  data,
  change,
}: {
  path: string;
  task: string;
  setTask: (v: string) => void;
  flush: () => Promise<SavedResume>;
  data: ResumeData;
  change: (data: ResumeData) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [direction, setDirection] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<Proposal | null>(null);
  const [base, setBase] = useState("");
  const unchanged = base === JSON.stringify(data);
  async function generate() {
    setBusy(true);
    setError("");
    setSuggestion(null);
    try {
      const saved = await flush();
      const response = await api<{ result: Proposal; revision: number }>(
        path + "/ai",
        payload({ task, consent, direction }),
      );
      if (response.revision !== saved.revision)
        throw new Error(
          "El CV cambió. Guarda los cambios y solicita otra propuesta.",
        );
      setBase(JSON.stringify(data));
      setSuggestion(response.result);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const apply = (next: ResumeData, remaining: Proposal | null) => {
    change(next);
    setBase(JSON.stringify(next));
    setSuggestion(remaining);
  };
  return (
    <div className="stack">
      <h2>Asistente de IA</h2>
      <label>
        Qué quieres mejorar
        <select
          value={task}
          onChange={(e) => {
            setTask(e.target.value);
            setSuggestion(null);
          }}
        >
          {Object.entries(aiChoices).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Contexto adicional (opcional)
        <input
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          maxLength={400}
          placeholder="Ej. sector educativo o perfil inicial"
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />{" "}
        Autorizo enviar el contenido profesional y la oferta guardada al
        proveedor configurado para esta solicitud.
      </label>
      <button
        className="button primary"
        disabled={!consent || busy}
        onClick={generate}
      >
        <Sparkles size={17} /> {busy ? "Generando…" : "Solicitar propuesta"}
      </button>
      {error && <Notice>{error}</Notice>}
      {suggestion && (
        <>
          <h3>Propuesta para revisar</h3>
          {!unchanged && (
            <Notice kind="info">
              El CV cambió después de la solicitud. Genera una nueva propuesta
              para aplicarla.
            </Notice>
          )}
          {!!suggestion.advice.length && (
            <ul className="advice">
              {suggestion.advice.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
          {suggestion.profile && (
            <div className="record stack">
              <h3>Perfil propuesto</h3>
              <p className="preserve">{suggestion.profile}</p>
              <button
                disabled={!unchanged}
                className="button"
                onClick={() =>
                  apply(
                    { ...data, profile: suggestion.profile! },
                    { ...suggestion, profile: undefined },
                  )
                }
              >
                Aplicar perfil
              </button>
            </div>
          )}
          {suggestion.experience?.map((item, i) => (
            <div className="record stack" key={i}>
              <h3>
                {data.experience[item.index]?.role ||
                  "Experiencia " + (item.index + 1)}
              </h3>
              <dl>
                <dt>Responsabilidades</dt>
                <dd className="preserve">{item.duties || "—"}</dd>
                <dt>Logros</dt>
                <dd className="preserve">{item.achievements || "—"}</dd>
                <dt>Resultados</dt>
                <dd className="preserve">{item.metrics || "—"}</dd>
              </dl>
              <button
                disabled={!unchanged}
                className="button"
                onClick={() => {
                  const { index, ...fields } = item;
                  apply(
                    {
                      ...data,
                      experience: data.experience.map((e, j) =>
                        j === index ? { ...e, ...fields } : e,
                      ),
                    },
                    {
                      ...suggestion,
                      experience: suggestion.experience!.filter(
                        (_, j) => i !== j,
                      ),
                    },
                  );
                }}
              >
                Aplicar a esta experiencia
              </button>
            </div>
          ))}
          {suggestion.translation && (
            <div className="record stack">
              <h3>Traducción propuesta</h3>
              <pre className="raw">
                {documentBlocks(suggestion.translation)
                  .map((b) => b.text)
                  .join("\n")}
              </pre>
              <button
                disabled={!unchanged}
                className="button"
                onClick={() =>
                  apply(suggestion.translation!, {
                    ...suggestion,
                    translation: undefined,
                  })
                }
              >
                Aplicar traducción
              </button>
            </div>
          )}
          {!suggestion.advice.length &&
            !suggestion.profile &&
            !suggestion.experience?.length &&
            !suggestion.translation && (
              <p className="muted">No hay cambios pendientes de aprobación.</p>
            )}
        </>
      )}
    </div>
  );
}
