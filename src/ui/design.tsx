"use client";
import { ArrowDown, ArrowUp, Check, Columns2, FileText } from "lucide-react";
import { labels, templates, type ResumeData } from "@/domain/resume";
import { Notice } from "./primitives";

export function Design({
  data,
  change,
}: {
  data: ResumeData;
  change: (value: ResumeData) => void;
}) {
  const { style } = data;
  const set = (patch: Partial<ResumeData["style"]>) =>
    change({ ...data, style: { ...style, ...patch } });
  return (
    <div className="stack">
      <div className="section-heading">
        <h2>Diseño del documento</h2>
      </div>
      <div className="segment">
        <button
          className={style.mode === "ats" ? "active" : ""}
          onClick={() => set({ mode: "ats" })}
        >
          <FileText size={16} /> Modo ATS
        </button>
        <button
          className={style.mode === "visual" ? "active" : ""}
          onClick={() => set({ mode: "visual" })}
        >
          <Columns2 size={16} /> Modo visual
        </button>
      </div>
      {style.mode === "visual" && (
        <Notice kind="info">
          Los acentos y las líneas decorativas pueden afectar la interpretación
          en algunos sistemas ATS.
        </Notice>
      )}
      <div className="template-grid" role="group" aria-label="Plantillas">
        {templates.map((t) => (
          <button
            key={t.id}
            aria-pressed={t.id === style.template}
            className={"template " + (t.id === style.template ? "active" : "")}
            onClick={() => {
              const rest: ResumeData["style"]["order"] = style.order.filter(
                (id) => id !== "education",
              );
              if (t.id === "academic" || t.id === "first")
                rest.splice(1, 0, "education");
              const order =
                t.id === "academic" || t.id === "first" ? rest : style.order;
              set({
                template: t.id,
                font: t.font,
                color: t.color,
                order,
                leading:
                  t.id === "executive" ? 1.24 : t.id === "first" ? 1.45 : 1.35,
                margin:
                  t.id === "academic" ? 54 : t.id === "technology" ? 39 : 46,
              });
            }}
          >
            <span className="template-paper" style={{ color: t.color }}>
              <i />
              <i />
              <i />
              <i />
              {t.id === style.template && <Check size={14} />}
            </span>
            <strong>{t.name}</strong>
            <small>{t.description}</small>
            <small>Compatibilidad de plantilla ATS {t.score}/100</small>
          </button>
        ))}
      </div>
      <div className="field-grid">
        <label>
          Tipografía
          <select
            value={style.font}
            onChange={(e) => set({ font: e.target.value as "sans" | "serif" })}
          >
            <option value="sans">Sin serifas</option>
            <option value="serif">Con serifas</option>
          </select>
        </label>
        <label>
          Idioma de encabezados
          <select
            value={style.language}
            onChange={(e) => set({ language: e.target.value as "es" | "en" })}
          >
            <option value="es">Español</option>
            <option value="en">Inglés</option>
          </select>
        </label>
        <label>
          Tamaño ({style.size} pt)
          <input
            type="range"
            min={9}
            max={15}
            step={0.5}
            value={style.size}
            onChange={(e) => set({ size: Number(e.target.value) })}
          />
        </label>
        <label>
          Márgenes ({style.margin} pt)
          <input
            type="range"
            min={32}
            max={76}
            value={style.margin}
            onChange={(e) => set({ margin: Number(e.target.value) })}
          />
        </label>
        <label>
          Interlineado ({style.leading})
          <input
            type="range"
            min={1.1}
            max={1.8}
            step={0.05}
            value={style.leading}
            onChange={(e) => set({ leading: Number(e.target.value) })}
          />
        </label>
        <label>
          Color de acento
          <input
            type="color"
            value={style.color}
            onChange={(e) => set({ color: e.target.value })}
          />
        </label>
      </div>
      <h3>Orden y visibilidad</h3>
      <div className="sequence">
        {style.order.map((key, i) => {
          const move = (to: number) => {
            const order = [...style.order];
            [order[to], order[i]] = [order[i], order[to]];
            set({ order });
          };
          return (
            <div key={key} className="sequence-row">
              <label className="check">
                <input
                  type="checkbox"
                  checked={!style.hidden.includes(key)}
                  onChange={(e) =>
                    set({
                      hidden: e.target.checked
                        ? style.hidden.filter((k) => k !== key)
                        : [...style.hidden, key],
                    })
                  }
                />
                {labels[key]}
              </label>
              <div className="actions">
                <button
                  className="icon-button"
                  aria-label={"Subir " + labels[key]}
                  onClick={() => move(i - 1)}
                  disabled={i === 0}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={"Bajar " + labels[key]}
                  onClick={() => move(i + 1)}
                  disabled={i === style.order.length - 1}
                >
                  <ArrowDown size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
