"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  BriefcaseBusiness,
  Download,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { applicationStatus } from "@/domain/extensions";
import { documentBlocks, type ResumeData } from "@/domain/resume";
import { api, displayDate, message, payload, type SavedResume } from "./client";
import { Modal, Notice } from "./primitives";

export type Achievement = {
  id: string;
  title: string;
  context: string;
  description: string;
  metrics: string;
};
type Application = {
  id: string;
  resumeId: string | null;
  company: string;
  role: string;
  sentOn: string;
  status: keyof typeof applicationStatus;
  url: string;
  notes: string;
  resumeTitle: string;
  resumeRevision: number;
  artifactName: string | null;
};
export type StoredExport = {
  id: string;
  name: string;
  format: string;
  revision: number | null;
  createdAt: string;
};
const localDay = () => {
  const date = new Date();
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((n) => String(n).padStart(2, "0"))
    .join("-");
};

function useList<T>(path: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = () => api<T[]>(path).then(setRows);
  useEffect(() => {
    const abort = new AbortController();
    api<T[]>(path, { signal: abort.signal })
      .then(setRows)
      .catch((e) => {
        if (!abort.signal.aborted) setError(message(e));
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoaded(true);
      });
    return () => abort.abort();
  }, [path]);
  async function run(operation: () => Promise<unknown>) {
    setError("");
    setBusy(true);
    try {
      await operation();
      await reload();
      return true;
    } catch (e) {
      setError(message(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { rows, loaded, error, busy, run };
}

export function AchievementsPanel() {
  const { rows, loaded, error, busy, run } =
    useList<Achievement>("/achievements");
  const [editing, setEditing] = useState<Achievement | null | undefined>();
  const [deleting, setDeleting] = useState<Achievement | null>(null);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = {
      ...Object.fromEntries(form),
      confirmed: form.get("confirmed") === "on",
    };
    const id = editing?.id;
    if (
      await run(() =>
        api(
          "/achievements" + (id ? "/" + id : ""),
          payload(fields, id ? "PATCH" : "POST"),
        ),
      )
    )
      setEditing(undefined);
  }
  return (
    <section className="surface feature-panel stack">
      <div className="surface-actions">
        <h2>Logros confirmados</h2>
        <button className="button primary" onClick={() => setEditing(null)}>
          <Plus size={17} /> Nuevo logro
        </button>
      </div>
      {error && editing === undefined && !deleting && <Notice>{error}</Notice>}
      {!loaded ? (
        <p role="status">Cargando logros…</p>
      ) : (
        !rows.length && (
          <p className="muted">
            Guarda un logro para reutilizarlo en la experiencia laboral de tus
            currículums.
          </p>
        )
      )}
      {rows.map((row) => (
        <article className="record stack" key={row.id}>
          <div className="surface-actions">
            <h3>{row.title}</h3>
            <div className="actions">
              <button
                className="icon-button"
                aria-label={"Editar " + row.title}
                onClick={() => setEditing(row)}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-button danger-text"
                aria-label={"Eliminar " + row.title}
                onClick={() => setDeleting(row)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          {row.context && <p className="muted">{row.context}</p>}
          <p className="preserve">{row.description}</p>
          {row.metrics && <p className="preserve">{row.metrics}</p>}
        </article>
      ))}
      {editing !== undefined && (
        <Modal
          title={editing ? "Editar logro" : "Nuevo logro"}
          onClose={() => {
            if (!busy) setEditing(undefined);
          }}
        >
          <form className="stack" onSubmit={save}>
            {error && <Notice>{error}</Notice>}
            <label>
              Título
              <input
                name="title"
                required
                maxLength={100}
                defaultValue={editing?.title}
              />
            </label>
            <label>
              Contexto
              <input
                name="context"
                maxLength={500}
                defaultValue={editing?.context}
              />
            </label>
            <label>
              Logro
              <textarea
                name="description"
                required
                maxLength={2500}
                defaultValue={editing?.description}
              />
            </label>
            <label>
              Métricas verificables
              <textarea
                name="metrics"
                maxLength={1200}
                defaultValue={editing?.metrics}
              />
            </label>
            <label className="check">
              <input type="checkbox" name="confirmed" required /> Confirmo que
              el logro y las cifras corresponden a mi experiencia.
            </label>
            <button className="button primary" disabled={busy}>
              Guardar logro
            </button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Eliminar logro"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <div className="stack">
            {error && <Notice>{error}</Notice>}
            <p>Eliminar «{deleting.title}» del banco de logros.</p>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                if (
                  await run(() =>
                    api("/achievements/" + deleting.id, { method: "DELETE" }),
                  )
                )
                  setDeleting(null);
              }}
            >
              Eliminar logro
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

export function AchievementPicker({
  data,
  change,
  close,
}: {
  data: ResumeData;
  change: (index: number, entry: Achievement) => boolean;
  close: () => void;
}) {
  const { rows, loaded, error } = useList<Achievement>("/achievements");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <Modal title="Usar un logro del banco" onClose={close}>
      <div className="stack">
        {error && <Notice>{error}</Notice>}
        {notice && <Notice>{notice}</Notice>}
        {!loaded ? (
          <p role="status">Cargando logros…</p>
        ) : !rows.length ? (
          <p>Crea un logro en el banco desde el panel principal.</p>
        ) : (
          <>
            <label>
              Logro confirmado
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Selecciona un logro</option>
                {rows.map((row) => (
                  <option value={row.id} key={row.id}>
                    {row.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Experiencia laboral
              <select
                value={index}
                onChange={(e) => setIndex(Number(e.target.value))}
              >
                {data.experience.map((row, i) => (
                  <option key={i} value={i}>
                    {row.role || row.company || "Experiencia " + (i + 1)}
                  </option>
                ))}
              </select>
            </label>
            {rows.find((row) => row.id === selected) && (
              <pre className="raw">
                {rows.find((row) => row.id === selected)?.description}
              </pre>
            )}
            <button
              className="button primary"
              disabled={!selected || !data.experience.length}
              onClick={() => {
                const entry = rows.find((row) => row.id === selected);
                if (entry && change(index, entry)) close();
                else
                  setNotice(
                    "El registro excedería la longitud permitida o ya no está disponible.",
                  );
              }}
            >
              Añadir a esta experiencia
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

export function ApplicationsPanel({ resumes }: { resumes: SavedResume[] }) {
  const { rows, loaded, error, busy, run } =
    useList<Application>("/applications");
  const [editing, setEditing] = useState<Application | null | undefined>();
  const [view, setView] = useState<
    (Application & { snapshot: { data: ResumeData; job: string } }) | null
  >(null);
  const [detailError, setDetailError] = useState("");
  const [deleting, setDeleting] = useState<Application | null>(null);
  const [filter, setFilter] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [exports, setExports] = useState<StoredExport[]>([]);
  const [artifactError, setArtifactError] = useState("");
  const [exportId, setExportId] = useState("");
  useEffect(() => {
    if (!resumeId || editing !== null) return;
    const abort = new AbortController();
    api<StoredExport[]>("/resumes/" + resumeId + "/exports", {
      signal: abort.signal,
    })
      .then((files) =>
        setExports(files.filter((file) => file.revision !== null)),
      )
      .catch((e) => {
        if (!abort.signal.aborted) setArtifactError(message(e));
      });
    return () => abort.abort();
  }, [resumeId, editing]);
  function start() {
    setResumeId(resumes[0]?.id ?? "");
    setExports([]);
    setExportId("");
    setArtifactError("");
    setEditing(null);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const selected = resumes.find((row) => row.id === resumeId);
    const path = "/applications" + (editing ? "/" + editing.id : "");
    if (
      await run(() =>
        api(
          path,
          payload(
            editing
              ? fields
              : {
                  ...fields,
                  resumeId,
                  revision: selected?.revision,
                  exportId: exportId || undefined,
                },
            editing ? "PATCH" : "POST",
          ),
        ),
      )
    )
      setEditing(undefined);
  }
  const visible = rows.filter((row) => !filter || row.status === filter);
  return (
    <section className="surface feature-panel stack">
      <div className="surface-actions">
        <h2>Postulaciones registradas</h2>
        <button
          className="button primary"
          disabled={!resumes.length}
          onClick={start}
        >
          <Plus size={17} /> Registrar postulación
        </button>
      </div>
      {error && editing === undefined && !deleting && <Notice>{error}</Notice>}
      {detailError && <Notice>{detailError}</Notice>}
      <label>
        Filtrar por estado
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todos</option>
          {Object.entries(applicationStatus).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {!loaded ? (
        <p role="status">Cargando postulaciones…</p>
      ) : (
        !visible.length && (
          <p className="muted">
            {resumes.length
              ? "No hay postulaciones para este filtro."
              : "Crea un CV para vincularlo a una postulación."}
          </p>
        )
      )}
      {visible.map((row) => (
        <article className="record stack" key={row.id}>
          <div className="surface-actions">
            <h3>
              {row.role} · {row.company}
            </h3>
            <span className="pill">{applicationStatus[row.status]}</span>
          </div>
          <p className="muted">
            {displayDate(row.sentOn + "T12:00:00")} · {row.resumeTitle} ·
            revisión {row.resumeRevision}
          </p>
          {row.notes && <p className="preserve">{row.notes}</p>}
          <div className="actions">
            <button
              className="button compact"
              onClick={async () => {
                setDetailError("");
                try {
                  setView(await api("/applications/" + row.id));
                } catch (e) {
                  setDetailError(message(e));
                }
              }}
            >
              <BriefcaseBusiness size={15} /> Ver CV asociado
            </button>
            {row.url && (
              <a
                className="button compact"
                href={row.url}
                target="_blank"
                rel="noreferrer"
              >
                Ver oferta
              </a>
            )}
            <button className="button compact" onClick={() => setEditing(row)}>
              Editar postulación
            </button>
            <button
              className="icon-button danger-text"
              aria-label={"Eliminar postulación de " + row.company}
              onClick={() => setDeleting(row)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </article>
      ))}
      {editing !== undefined && (
        <Modal
          title={editing ? "Editar postulación" : "Registrar postulación"}
          onClose={() => {
            if (!busy) setEditing(undefined);
          }}
        >
          <form className="stack" onSubmit={save}>
            {error && <Notice>{error}</Notice>}
            <label>
              Empresa
              <input
                name="company"
                required
                maxLength={120}
                defaultValue={editing?.company}
              />
            </label>
            <label>
              Vacante
              <input
                name="role"
                required
                maxLength={120}
                defaultValue={editing?.role}
              />
            </label>
            <div className="field-grid">
              <label>
                Fecha de envío
                <input
                  type="date"
                  name="sentOn"
                  required
                  defaultValue={editing?.sentOn ?? localDay()}
                />
              </label>
              <label>
                Estado
                <select name="status" defaultValue={editing?.status ?? "sent"}>
                  {Object.entries(applicationStatus).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!editing && (
              <>
                <label>
                  Currículum
                  <select
                    value={resumeId}
                    onChange={(e) => {
                      setResumeId(e.target.value);
                      setExports([]);
                      setExportId("");
                      setArtifactError("");
                    }}
                    required
                  >
                    {resumes.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Archivo enviado (opcional)
                  <select
                    value={exportId}
                    onChange={(e) => setExportId(e.target.value)}
                  >
                    <option value="">Guardar el contenido actual del CV</option>
                    {exports.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.name} · rev. {file.revision} ·{" "}
                        {displayDate(file.createdAt)}
                      </option>
                    ))}
                  </select>
                </label>
                {artifactError && <Notice>{artifactError}</Notice>}
                <p className="muted">
                  Si eliges una descarga del historial, se guardarán el archivo
                  exacto y su revisión.
                </p>
              </>
            )}
            <label>
              Enlace a la oferta
              <input
                name="url"
                type="url"
                maxLength={500}
                defaultValue={editing?.url}
              />
            </label>
            <label>
              Notas
              <textarea
                name="notes"
                rows={3}
                maxLength={4000}
                defaultValue={editing?.notes}
              />
            </label>
            <button
              className="button primary"
              disabled={busy || (!editing && !resumeId)}
            >
              Guardar postulación
            </button>
          </form>
        </Modal>
      )}
      {view && (
        <Modal
          title={"CV asociado · " + view.resumeTitle}
          onClose={() => setView(null)}
        >
          <div className="stack">
            <p className="muted">Revisión {view.resumeRevision}</p>
            {view.artifactName && (
              <a
                className="button"
                href={"/api/applications/" + view.id + "/document"}
              >
                <Download size={16} /> Descargar archivo enviado
              </a>
            )}
            <pre className="raw">
              {documentBlocks(view.snapshot.data)
                .map((block) => block.text)
                .join("\n")}
            </pre>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Eliminar postulación"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <div className="stack">
            {error && <Notice>{error}</Notice>}
            <p>
              Se eliminará la postulación a {deleting.company} y la copia del CV
              vinculada.
            </p>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                if (
                  await run(() =>
                    api("/applications/" + deleting.id, { method: "DELETE" }),
                  )
                )
                  setDeleting(null);
              }}
            >
              Eliminar postulación
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

export function AccountPanel({ email }: { email: string }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="surface feature-panel stack">
      <h2>Tus datos</h2>
      <p className="muted">{email}</p>
      <p>
        Descarga tus datos en JSON, con archivos originales y exportaciones
        codificados en Base64. Guarda la descarga en un lugar privado.
      </p>
      <a className="button" href="/api/account/export">
        <Download size={17} /> Descargar mis datos
      </a>
      <h3>Eliminar cuenta</h3>
      <p>
        Se eliminarán tus CV, logros, postulaciones, archivos e historial de
        análisis. Esta acción es definitiva.
      </p>
      <button
        className="button danger"
        onClick={() => {
          setError("");
          setConfirm(true);
        }}
      >
        Eliminar mi cuenta
      </button>
      {confirm && (
        <Modal
          title="Eliminar mi cuenta"
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <form
            className="stack"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              const fields = Object.fromEntries(
                new FormData(event.currentTarget),
              );
              try {
                await api("/account", payload(fields, "DELETE"));
                window.location.assign("/");
              } catch (e) {
                setError(message(e));
                setBusy(false);
              }
            }}
          >
            {error && <Notice>{error}</Notice>}
            <label>
              Contraseña actual
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                minLength={12}
                maxLength={128}
              />
            </label>
            <label>
              Escribe ELIMINAR
              <input
                name="confirm"
                required
                pattern="ELIMINAR"
                autoComplete="off"
              />
            </label>
            <button className="button danger" disabled={busy}>
              Confirmar eliminación
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
