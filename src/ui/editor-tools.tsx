"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Download, FileCheck2, History, ScanLine, Trash2 } from "lucide-react";
import { compareVersions, type ReadingReport } from "@/domain/extensions";
import { type ResumeData } from "@/domain/resume";
import {
  api,
  displayDate,
  message,
  payload,
  type ImportResult,
  type SavedResume,
} from "./client";
import { Modal, Notice } from "./primitives";
import type { StoredExport } from "./workspace-records";

type Flush = () => Promise<SavedResume>;
type VersionMeta = {
  id: string;
  label: string;
  title: string;
  revision: number;
  createdAt: string;
};
type ComparisonTarget = {
  title: string;
  revision: number;
  data: ResumeData;
  job: string | { text: string } | null;
};
const shortJob = (job: ComparisonTarget["job"]) =>
  typeof job === "string" ? job : (job?.text ?? "");

export function ReadingPanel({
  path,
  flush,
  mode,
  revision,
  fileRefresh,
}: {
  path: string;
  flush: Flush;
  mode: "ats" | "visual";
  revision: number;
  fileRefresh: number;
}) {
  const [format, setFormat] = useState<"pdf" | "docx">("pdf");
  const [layout, setLayout] = useState(mode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<
    (ReadingReport & { format: string; mode: string; revision: number }) | null
  >(null);
  const [exports, setExports] = useState<StoredExport[]>([]);
  const [exportId, setExportId] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    api<StoredExport[]>(path + "/exports", { signal: abort.signal })
      .then((rows) => setExports(rows.filter((row) => row.revision !== null)))
      .catch((e) => {
        if (!abort.signal.aborted) setError(message(e));
      });
    return () => abort.abort();
  }, [path, fileRefresh]);
  async function inspect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      if (!exportId) await flush();
      setResult(
        await api(
          path + "/reading",
          payload({ format, mode: layout, exportId: exportId || undefined }),
        ),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <h2>Vista de lectura ATS</h2>
      <p className="muted">
        Lee el texto que se extrae del archivo y compáralo con lo que esperabas
        incluir.
      </p>
      <form className="stack" onSubmit={inspect}>
        {!!exports.length && (
          <label>
            Documento para revisar
            <select
              value={exportId}
              onChange={(e) => {
                setExportId(e.target.value);
                setResult(null);
              }}
            >
              <option value="">Generar con el CV actual</option>
              {exports.map((row) => (
                <option value={row.id} key={row.id}>
                  {row.name} · revisión {row.revision}
                </option>
              ))}
            </select>
          </label>
        )}
        {!exportId && (
          <div className="field-grid">
            <label>
              Formato de lectura
              <select
                value={format}
                onChange={(event) => {
                  setFormat(event.target.value as typeof format);
                  setResult(null);
                }}
              >
                <option value="pdf">PDF</option>
                <option value="docx">Word (DOCX)</option>
              </select>
            </label>
            <label>
              Diseño de lectura
              <select
                value={layout}
                onChange={(event) => {
                  setLayout(event.target.value as typeof layout);
                  setResult(null);
                }}
              >
                <option value="ats">ATS</option>
                <option value="visual">Visual</option>
              </select>
            </label>
          </div>
        )}
        <button className="button primary" disabled={busy}>
          <ScanLine size={17} />
          {busy ? "Extrayendo texto…" : "Ver lectura del archivo"}
        </button>
      </form>
      {error && <Notice>{error}</Notice>}
      {result && (
        <div className="stack">
          <p className="muted">
            {result.format.toUpperCase()} ·{" "}
            {result.mode === "ats" ? "ATS" : "Visual"} · revisión{" "}
            {result.revision}
          </p>
          {!exportId && result.revision !== revision && (
            <Notice kind="info">
              El currículum cambió desde la última lectura. Vuelve a ejecutar la
              revisión.
            </Notice>
          )}
          {!!(
            result.missing.length +
            result.reordered.length +
            result.empty.length
          ) ? (
            <>
              {!!result.missing.length && (
                <div>
                  <h3>Fragmentos que no se pudieron verificar</h3>
                  <ul>
                    {result.missing.map((block, i) => (
                      <li key={i}>{block.text}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!!result.reordered.length && (
                <div>
                  <h3>Posibles cambios en el orden de lectura</h3>
                  <ul>
                    {result.reordered.map((block, i) => (
                      <li key={i}>{block.text}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!!result.empty.length && (
                <Notice kind="info">
                  Páginas sin texto {result.empty.join(", ")}.
                </Notice>
              )}
            </>
          ) : (
            <Notice kind="success">
              Se verificaron los {result.total} fragmentos esperados en el orden
              previsto.
            </Notice>
          )}
          {result.pages.map((page) => (
            <details
              className="record"
              key={page.number}
              open={page.number === 1}
            >
              <summary>
                {result.format === "pdf"
                  ? "Página " + page.number
                  : "Texto de Word en orden de lectura"}
              </summary>
              <pre className="raw">{page.text || "Sin texto extraíble."}</pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

export function VersionsPanel({
  path,
  flush,
  restore,
  current,
}: {
  path: string;
  flush: Flush;
  restore: (id: string) => Promise<void>;
  current: { title: string; data: ResumeData; job: string };
}) {
  const [rows, setRows] = useState<VersionMeta[]>([]);
  const [label, setLabel] = useState("");
  const [selected, setSelected] = useState("");
  const [target, setTarget] = useState<ComparisonTarget | null>(null);
  const [base, setBase] = useState<ComparisonTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirm, setConfirm] = useState<"restore" | "delete" | null>(null);
  const reload = () => api<VersionMeta[]>(path + "/versions").then(setRows);
  useEffect(() => {
    let active = true;
    Promise.all([
      api<VersionMeta[]>(path + "/versions"),
      api<ComparisonTarget | null>(path + "/base"),
    ])
      .then(([rows, base]) => {
        if (active) {
          setRows(rows);
          setBase(base);
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [path]);
  async function run(op: () => Promise<void>) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await op();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const diff = target && compareVersions(target.data, current.data);
  return (
    <div className="stack">
      <h2>Historial y comparación</h2>
      <p className="muted">
        Guarda puntos de control con nombre o compara el CV actual con el
        documento base.
      </p>
      {!confirm && error && <Notice>{error}</Notice>}
      {success && <Notice kind="success">{success}</Notice>}
      <form
        className="record stack"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const row = await flush();
            const version = await api<VersionMeta>(
              path + "/versions",
              payload({ label, revision: row.revision }),
            );
            setRows((items) => [version, ...items]);
            setLabel("");
            setSuccess("Punto de guardado creado.");
          });
        }}
      >
        <label>
          Nombre del punto de guardado
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={100}
            required
            placeholder="Ej. CV antes de adaptar a la vacante"
          />
        </label>
        <button className="button" disabled={busy || !label.trim()}>
          <History size={17} /> Guardar versión actual
        </button>
      </form>
      <label>
        Comparar con
        <select
          value={selected}
          disabled={busy}
          onChange={(e) => {
            const value = e.target.value;
            setSelected(value);
            setTarget(null);
            if (value === "base") setTarget(base);
            else if (value)
              void run(async () =>
                setTarget(await api(path + "/versions/" + value)),
              );
          }}
        >
          <option value="">Selecciona una versión</option>
          {base && <option value="base">CV base · {base.title}</option>}
          {rows.map((row) => (
            <option value={row.id} key={row.id}>
              {row.label} · rev. {row.revision}
            </option>
          ))}
        </select>
      </label>
      {target && diff && (
        <>
          <p className="muted">
            {target.title} · revisión {target.revision}
          </p>
          {target.title !== current.title && (
            <p>
              Nombre anterior «{target.title}». Nombre actual «{current.title}».
            </p>
          )}
          {diff.styleChanged && (
            <p>Hay cambios de diseño, idioma, orden o visibilidad.</p>
          )}
          {diff.orderChanged && (
            <p>Cambió el orden de lectura de las secciones.</p>
          )}
          {shortJob(target.job) !== current.job && (
            <details className="record">
              <summary>Oferta vinculada</summary>
              <div className="comparison-panes">
                <div>
                  <h3>Versión elegida</h3>
                  <pre className="raw">
                    {shortJob(target.job) || "Sin oferta"}
                  </pre>
                </div>
                <div>
                  <h3>Currículum actual</h3>
                  <pre className="raw">{current.job || "Sin oferta"}</pre>
                </div>
              </div>
            </details>
          )}
          {!diff.sections.length && (
            <p className="muted">
              El texto visible coincide en ambas versiones.
            </p>
          )}
          {diff.sections.map((item) => (
            <details className="record" open key={item.section}>
              <summary>{item.section}</summary>
              <div className="comparison-panes">
                <div>
                  <h3>Versión elegida</h3>
                  <pre className="raw">
                    {item.before.join("\n") || "Sin contenido"}
                  </pre>
                </div>
                <div>
                  <h3>Currículum actual</h3>
                  <pre className="raw">
                    {item.after.join("\n") || "Sin contenido"}
                  </pre>
                </div>
              </div>
            </details>
          ))}
          {selected !== "base" && (
            <div className="actions">
              <button
                className="button primary"
                disabled={busy}
                onClick={() => setConfirm("restore")}
              >
                Restaurar versión
              </button>
              <button
                className="button danger-text"
                disabled={busy}
                onClick={() => setConfirm("delete")}
              >
                Eliminar punto de guardado
              </button>
            </div>
          )}
        </>
      )}
      {confirm && (
        <Modal
          title={
            confirm === "restore"
              ? "Restaurar versión"
              : "Eliminar punto de guardado"
          }
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
        >
          <div className="stack">
            {error && <Notice>{error}</Notice>}
            <p>
              {confirm === "restore"
                ? "El CV actual se guardará como respaldo antes de restaurar el contenido, el diseño y la oferta de esta versión."
                : "Se eliminará este punto de guardado del historial."}
            </p>
            <button
              className={
                "button " + (confirm === "restore" ? "primary" : "danger")
              }
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (confirm === "restore") {
                    await restore(selected);
                    setSuccess(
                      "Versión restaurada. El respaldo está en el historial.",
                    );
                  } else {
                    await api(path + "/versions/" + selected, {
                      method: "DELETE",
                    });
                    setSelected("");
                    setTarget(null);
                    setSuccess("Punto de guardado eliminado.");
                  }
                  setConfirm(null);
                  await reload();
                })
              }
            >
              {confirm === "restore"
                ? "Confirmar restauración"
                : "Confirmar eliminación"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function FilesPanel({
  path,
  source,
  onRemoveSource,
  fileRefresh,
}: {
  path: string;
  source: SavedResume["source"];
  onRemoveSource: () => void;
  fileRefresh: number;
}) {
  const [rows, setRows] = useState<StoredExport[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<{
    url: string;
    title: string;
    id?: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    api<StoredExport[]>(path + "/exports")
      .then((rows) => {
        if (active) setRows(rows);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [path, fileRefresh]);
  return (
    <div className="stack">
      <h2>Archivos del currículum</h2>
      {!target && error && <Notice>{error}</Notice>}
      <section className="record stack">
        <h3>Archivo original</h3>
        {source ? (
          <>
            <p>{source.name}</p>
            <div className="actions">
              <a className="button compact" href={"/api/imports/" + source.id}>
                <Download size={16} /> Descargar original
              </a>
              <button
                className="button compact danger-text"
                onClick={() => {
                  setError("");
                  setTarget({ url: path + "/source", title: source.name });
                }}
              >
                Eliminar original
              </button>
            </div>
          </>
        ) : (
          <p className="muted">
            Este CV no tiene un archivo original guardado.
          </p>
        )}
      </section>
      <h3>Historial de descargas</h3>
      {!rows.length && (
        <p className="muted">
          Cuando exportes el currículum, el archivo aparecerá aquí.
        </p>
      )}
      {rows.map((row) => (
        <div className="record stack" key={row.id}>
          <strong>{row.name}</strong>
          <p className="muted">
            {displayDate(row.createdAt)}
            {row.revision !== null ? " · revisión " + row.revision : ""}
          </p>
          <div className="actions">
            <a
              className="button compact"
              href={"/api" + path + "/exports/" + row.id}
            >
              <Download size={16} /> Descargar
            </a>
            <button
              className="button compact danger-text"
              onClick={() => {
                setError("");
                setTarget({
                  url: path + "/exports/" + row.id,
                  title: row.name,
                  id: row.id,
                });
              }}
            >
              <Trash2 size={15} /> Eliminar descarga
            </button>
          </div>
        </div>
      ))}
      {target && (
        <Modal
          title="Eliminar archivo guardado"
          onClose={() => {
            if (!busy) setTarget(null);
          }}
        >
          <div className="stack">
            {error && <Notice>{error}</Notice>}
            <p>
              Elimina «{target.title}» del historial. El contenido editable del
              CV seguirá disponible.
            </p>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                setError("");
                setBusy(true);
                try {
                  await api(target.url, { method: "DELETE" });
                  if (target.id)
                    setRows((items) =>
                      items.filter((row) => row.id !== target.id),
                    );
                  else onRemoveSource();
                  setTarget(null);
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirmar eliminación de archivo
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function OriginalReview({ source }: { source: ImportResult }) {
  const [page, setPage] = useState(1);
  const [error, setError] = useState(false);
  return (
    <aside
      className="review-original stack"
      aria-label="Archivo original para comparar"
    >
      <div className="surface-actions">
        <h2>
          <FileCheck2 size={18} /> Archivo original
        </h2>
        <a className="button compact" href={"/api/imports/" + source.source.id}>
          <Download size={15} /> Descargar original
        </a>
      </div>
      <p className="muted">{source.source.name}</p>
      {source.pageCount ? (
        <>
          <label>
            Página original
            <select
              value={page}
              onChange={(e) => {
                setPage(Number(e.target.value));
                setError(false);
              }}
            >
              {Array.from({ length: source.pageCount }, (_, i) => (
                <option key={i} value={i + 1}>
                  Página {i + 1} de {source.pageCount}
                </option>
              ))}
            </select>
          </label>
          {error ? (
            <Notice>
              La página no está disponible. Puedes descargar el original para
              revisarlo.
            </Notice>
          ) : (
            <img
              className="original-page"
              alt={"Página " + page + " del PDF original"}
              src={"/api/imports/" + source.source.id + "/page?number=" + page}
              onError={() => setError(true)}
            />
          )}
        </>
      ) : (
        <p className="muted">
          Para documentos Word se muestra el texto extraído. Descarga el
          original para revisar su formato.
        </p>
      )}
      <details className="record" open={!source.pageCount}>
        <summary>Texto extraído completo</summary>
        <pre className="raw">{source.raw}</pre>
      </details>
    </aside>
  );
}
