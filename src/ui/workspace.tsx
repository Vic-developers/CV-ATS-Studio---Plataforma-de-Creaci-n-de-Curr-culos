"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  ChevronDown,
  ClipboardList,
  Clock3,
  FileCheck2,
  FilePlus2,
  FileText,
  LayoutGrid,
  LogOut,
  Plus,
  ScanLine,
  Upload,
  Copy,
  Pencil,
  Trash2,
  Download,
  Search,
  PanelLeft,
} from "lucide-react";
import {
  api,
  apiResponse,
  displayDate,
  message,
  payload,
  saveDownload,
  type ImportResult,
  type SavedResume,
} from "./client";
import { Brand, Empty, Modal, Notice } from "./primitives";
import { Editor } from "./editor";
import { templates } from "@/domain/resume";

type Panel = "home" | "resumes" | "reports";
type Dialog =
  | { kind: "create" | "import" }
  | {
      kind: "actions" | "duplicate" | "rename" | "delete" | "download";
      item: SavedResume;
    };
const menu = [
  { id: "home", label: "Panel principal", icon: LayoutGrid },
  { id: "resumes", label: "Mis currículums", icon: FileText },
  { id: "reports", label: "Análisis ATS", icon: ScanLine },
] as const;
const labels = {
  draft: "Borrador",
  optimized: "Optimizado",
  review: "Por revisar",
};
const path = "/resumes";

export function Workspace({ email }: { email: string }) {
  const [items, setItems] = useState<SavedResume[]>([]);
  const [panel, setPanel] = useState<Panel>("home");
  const [selected, setSelected] = useState<SavedResume | null>(null);
  const [staged, setStaged] = useState<ImportResult | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [mobile, setMobile] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const scored = items.filter((item) => item.score !== null);
  useEffect(() => {
    const abort = new AbortController();
    api<SavedResume[]>(path, { signal: abort.signal })
      .then(setItems)
      .catch((e) => {
        if (!abort.signal.aborted) setError(message(e));
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, []);
  const changed = (item: SavedResume) =>
    setItems((list) =>
      [item, ...list.filter((x) => x.id !== item.id)].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    );
  const open = (item: SavedResume, analysis = false) => {
    setSelected(item);
    setShowReports(analysis);
  };
  const modal = (value: Dialog) => {
    setDialog(value);
    setDialogError("");
  };
  const navigate = (dest: Panel) => {
    setPanel(dest);
    setQuery("");
    setMobile(false);
  };
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      window.location.assign("/");
    } catch (e) {
      setError(message(e));
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dialog || dialog.kind === "actions" || busy) return;
    setBusy(true);
    setDialogError("");
    const form = new FormData(e.currentTarget);
    try {
      if (dialog.kind === "import") {
        const file = form.get("file");
        if (file instanceof File && file.size > 8 * 1024 * 1024)
          throw new Error("El archivo supera los 8 MB.");
        setStaged(
          await api<ImportResult>("/imports", { method: "POST", body: form }),
        );
        setShowReports(false);
      } else if (dialog.kind === "create") {
        const item = await api<SavedResume>(
          path,
          payload({ title: form.get("title") }),
        );
        changed(item);
        open(item);
      } else if ("item" in dialog) {
        const url = path + "/" + dialog.item.id;
        if (dialog.kind === "delete") {
          await api(url, { method: "DELETE" });
          setItems((list) => list.filter((item) => item.id !== dialog.item.id));
        } else if (dialog.kind === "download") {
          const response = await apiResponse(
            url + "/export",
            payload({
              format: form.get("format"),
              mode: form.get("mode"),
              acknowledge: form.get("ack") === "on",
            }),
          );
          saveDownload(response, await response.blob());
        } else {
          const item = await api<SavedResume>(
            url + (dialog.kind === "duplicate" ? "/duplicate" : ""),
            payload(
              { title: form.get("title"), revision: dialog.item.revision },
              dialog.kind === "rename" ? "PATCH" : "POST",
            ),
          );
          changed(item);
        }
      }
      setDialog(null);
    } catch (e) {
      setDialogError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (selected || staged)
    return (
      <Editor
        key={selected?.id ?? staged?.source.id}
        initial={selected}
        staged={staged}
        initialTab={showReports ? "analysis" : "content"}
        onChange={changed}
        onOpen={(item) => {
          setStaged(null);
          changed(item);
          open(item);
        }}
        onExit={() => {
          setSelected(null);
          setStaged(null);
        }}
      />
    );

  const title = menu.find((item) => item.id === panel)!.label;
  const visible = items.filter((item) =>
    item.title
      .toLocaleLowerCase("es")
      .includes(query.trim().toLocaleLowerCase("es")),
  );
  const cards = [
    {
      title: "Currículums creados",
      value: items.length,
      icon: FileText,
      style: "violet",
    },
    {
      title: "Currículums optimizados",
      value: items.filter((item) => item.status === "optimized").length,
      icon: FileCheck2,
      style: "green",
    },
    {
      title: "Promedio ATS",
      value: scored.length
        ? Math.round(
            scored.reduce((sum, item) => sum + (item.score ?? 0), 0) /
              scored.length,
          ) + "%"
        : "—",
      icon: Activity,
      style: "blue",
    },
    {
      title: "Último currículum editado",
      value: items[0]?.title ?? "—",
      detail: items[0] ? displayDate(items[0].updatedAt) : "",
      icon: Clock3,
      style: "amber",
    },
  ];
  const dialogTitle =
    dialog &&
    {
      actions: dialog.kind === "actions" ? dialog.item.title : "",
      create: "Nuevo currículum",
      import: "Importar currículum",
      rename: "Renombrar currículum",
      duplicate: "Duplicar currículum",
      delete: "Eliminar currículum",
      download: "Descargar currículum",
    }[dialog.kind];
  return (
    <div className="workspace">
      <aside
        id="workspace-navigation"
        className={"sidebar " + (mobile ? "mobile-open" : "")}
      >
        <Brand />
        <nav aria-label="Espacio de trabajo">
          {menu.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={panel === id ? "selected" : ""}
              aria-current={panel === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="account" title={email} onClick={logout}>
            <span className="avatar">{email.slice(0, 1).toUpperCase()}</span>
            <span>
              <b>{email.split("@")[0]}</b>
              <small>Cerrar sesión</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Abrir navegación"
            aria-expanded={mobile}
            aria-controls="workspace-navigation"
            onClick={() => setMobile(!mobile)}
          >
            <PanelLeft size={20} />
          </button>
          <span>{title}</span>
          <span className="top-account" title={email}>
            {email}
          </span>
        </header>
        {mobile && (
          <button
            className="mobile-backdrop"
            aria-label="Cerrar navegación"
            onClick={() => setMobile(false)}
          />
        )}
        <div className="dashboard">
          <div className="page-heading">
            <div>
              <h1>{title}</h1>
              <p className="muted">
                {panel === "home"
                  ? "Crea, organiza y mejora tus currículums profesionales."
                  : panel === "resumes"
                    ? "Gestiona tu CV base y sus versiones para cada vacante."
                    : "Consulta la preparación ATS y el historial de cada currículum."}
              </p>
            </div>
            {panel !== "reports" && (
              <div className="actions">
                <button
                  className="button"
                  onClick={() => modal({ kind: "import" })}
                >
                  <Upload size={17} /> Importar
                </button>
                <button
                  className="button primary"
                  onClick={() => modal({ kind: "create" })}
                >
                  <Plus size={18} /> Nuevo currículum
                </button>
              </div>
            )}
          </div>
          {error && <Notice>{error}</Notice>}
          {panel === "home" && (
            <div className="stat-grid">
              {cards.map(({ title, value, detail, icon: Icon, style }) => (
                <div key={title} className="stat">
                  <span className={"stat-icon " + style}>
                    <Icon size={19} />
                  </span>
                  <span className="stat-title">{title}</span>
                  <strong
                    title={detail ? String(value) : undefined}
                    className={detail ? "stat-resume" : undefined}
                  >
                    {loading ? "—" : value}
                  </strong>
                  {detail && <small>{detail}</small>}
                </div>
              ))}
            </div>
          )}
          <section className="surface">
            <div className="surface-heading">
              <div>
                <h2>
                  {panel === "home"
                    ? "Currículums recientes"
                    : panel === "reports"
                      ? "Historial por currículum"
                      : "Todos los currículums"}
                </h2>
                {panel === "home" && (
                  <p className="muted">
                    Abre un documento para continuar donde lo dejaste.
                  </p>
                )}
              </div>
              {panel === "home" ? (
                <button
                  className="button subtle"
                  onClick={() => navigate("resumes")}
                >
                  Ver todos <ArrowUpRight size={15} />
                </button>
              ) : (
                <label className="search">
                  <Search size={16} />
                  <input
                    aria-label="Buscar currículums"
                    placeholder="Buscar currículums"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              )}
            </div>
            {loading ? (
              <p className="table-state" role="status">
                Cargando currículums…
              </p>
            ) : !visible.length ? (
              <Empty
                title={
                  query
                    ? "Sin resultados"
                    : panel === "reports"
                      ? "Aún no hay currículums para analizar"
                      : "Aún no tienes currículums"
                }
              >
                <p className="muted">
                  {query
                    ? "Prueba con otro nombre."
                    : "Crea un currículum o importa uno que ya tengas."}
                </p>
                {!query && (
                  <button
                    className="button"
                    onClick={() => modal({ kind: "create" })}
                  >
                    <FilePlus2 size={16} /> Crear currículum
                  </button>
                )}
              </Empty>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Currículum</th>
                      <th>Estado</th>
                      <th>ATS</th>
                      <th className="modified-column">Última edición</th>
                      <th aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {(panel === "home" ? visible.slice(0, 5) : visible).map(
                      (item) => (
                        <tr key={item.id}>
                          <td>
                            <button
                              className="resume-link"
                              onClick={() => open(item, panel === "reports")}
                            >
                              <span className="doc-icon">
                                <FileText size={18} />
                              </span>
                              <span>
                                <b>{item.title}</b>
                                <small>
                                  {
                                    templates.find(
                                      (t) => t.id === item.data.style.template,
                                    )?.name
                                  }
                                  {item.parentId ? " · Versión" : ""}
                                </small>
                                <small className="mobile-date">
                                  {displayDate(item.updatedAt)}
                                </small>
                              </span>
                            </button>
                          </td>
                          <td>
                            <span className={"pill " + item.status}>
                              {labels[item.status as keyof typeof labels] ??
                                "Borrador"}
                            </span>
                          </td>
                          <td>
                            {item.score === null ? (
                              "—"
                            ) : (
                              <b>{item.score}/100</b>
                            )}
                          </td>
                          <td className="modified-column">
                            {displayDate(item.updatedAt)}
                          </td>
                          <td>
                            {panel === "reports" ? (
                              <button
                                className="icon-button"
                                aria-label={"Abrir análisis de " + item.title}
                                onClick={() => open(item, true)}
                              >
                                <ClipboardList size={17} />
                              </button>
                            ) : (
                              <button
                                className="icon-button"
                                aria-label={"Acciones de " + item.title}
                                onClick={() => modal({ kind: "actions", item })}
                              >
                                <ChevronDown size={18} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {panel === "home" && (
            <div className="info-banner">
              <span className="stat-icon violet">
                <ScanLine size={20} />
              </span>
              <div>
                <h3>Revisa tu preparación ATS</h3>
                <p className="muted">
                  Detecta problemas de estructura y compara tu CV con las
                  palabras clave de una oferta.
                </p>
              </div>
              <button className="button" onClick={() => navigate("reports")}>
                Ver análisis
              </button>
            </div>
          )}
        </div>
      </main>
      {dialog && (
        <Modal
          key={dialog.kind}
          title={dialogTitle!}
          onClose={() => {
            if (!busy) setDialog(null);
          }}
        >
          {dialog.kind === "actions" ? (
            <div className="stack">
              <button
                className="button"
                onClick={() => modal({ kind: "rename", item: dialog.item })}
              >
                <Pencil size={16} /> Renombrar
              </button>
              <button
                className="button"
                onClick={() => modal({ kind: "duplicate", item: dialog.item })}
              >
                <Copy size={16} /> Duplicar
              </button>
              <button
                className="button"
                onClick={() => modal({ kind: "download", item: dialog.item })}
              >
                <Download size={16} /> Descargar
              </button>
              <button
                className="button danger-text"
                onClick={() => modal({ kind: "delete", item: dialog.item })}
              >
                <Trash2 size={16} /> Eliminar
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="stack">
              {dialogError && <Notice>{dialogError}</Notice>}
              {dialog.kind === "import" ? (
                <>
                  <p className="muted">
                    Revisa los campos extraídos antes de guardar el currículum.
                  </p>
                  <label>
                    Archivo PDF o DOCX de hasta 8 MB
                    <input
                      type="file"
                      name="file"
                      accept=".pdf,.docx"
                      required
                    />
                  </label>
                </>
              ) : dialog.kind === "delete" ? (
                <p>
                  Se eliminará «{dialog.item.title}» junto con su archivo
                  original, sus análisis y sus exportaciones almacenadas.
                </p>
              ) : dialog.kind === "download" ? (
                <>
                  <label>
                    Formato
                    <select name="format">
                      <option value="pdf">PDF</option>
                      <option value="docx">Word (DOCX)</option>
                    </select>
                  </label>
                  <label>
                    Diseño
                    <select name="mode">
                      <option value="ats">ATS recomendado</option>
                      <option value="visual">Visual</option>
                    </select>
                  </label>
                  <label className="check">
                    <input name="ack" type="checkbox" /> Exportar aunque haya
                    alertas de gravedad alta
                  </label>
                </>
              ) : (
                <label>
                  Nombre del currículum
                  <input
                    name="title"
                    autoFocus
                    required
                    maxLength={100}
                    placeholder="Ej. CV · Analista de datos"
                    defaultValue={
                      "item" in dialog
                        ? (
                            dialog.item.title +
                            (dialog.kind === "duplicate" ? " · Copia" : "")
                          ).slice(0, 100)
                        : ""
                    }
                  />
                </label>
              )}
              <div className="actions align-right">
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => setDialog(null)}
                >
                  Cancelar
                </button>
                <button
                  className={
                    "button " +
                    (dialog.kind === "delete" ? "danger" : "primary")
                  }
                  disabled={busy}
                >
                  {busy
                    ? "Procesando…"
                    : dialog.kind === "delete"
                      ? "Eliminar definitivamente"
                      : dialog.kind === "import"
                        ? "Extraer texto"
                        : dialog.kind === "download"
                          ? "Descargar"
                          : "Guardar"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
