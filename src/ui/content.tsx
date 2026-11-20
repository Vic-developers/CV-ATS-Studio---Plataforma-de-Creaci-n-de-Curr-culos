"use client";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  extraSections,
  labels,
  newCertification,
  newEducation,
  newExperience,
  newExtra,
  personalLabels,
  skillLabels,
  type ResumeData,
} from "@/domain/resume";

export const steps = [
  "Información personal",
  "Perfil profesional",
  "Experiencia laboral",
  "Formación académica",
  "Habilidades",
  "Cursos y certificaciones",
  "Secciones adicionales",
];
type Field = {
  key: string;
  label: string;
  type?: "long" | "date" | "url" | "toggle";
};
const experience: Field[] = [
  { key: "company", label: "Empresa" },
  { key: "role", label: "Cargo" },
  { key: "location", label: "Ubicación" },
  { key: "start", label: "Fecha de inicio", type: "date" },
  { key: "current", label: "Empleo actual", type: "toggle" },
  { key: "end", label: "Fecha de finalización", type: "date" },
  { key: "duties", label: "Responsabilidades", type: "long" },
  { key: "achievements", label: "Logros profesionales", type: "long" },
  { key: "metrics", label: "Resultados cuantificables", type: "long" },
];
const education: Field[] = [
  { key: "institution", label: "Institución" },
  { key: "degree", label: "Titulación" },
  { key: "field", label: "Área de estudio" },
  { key: "start", label: "Fecha de inicio", type: "date" },
  { key: "end", label: "Fecha de finalización", type: "date" },
  { key: "status", label: "Estado de los estudios" },
  { key: "honors", label: "Reconocimientos", type: "long" },
];
const certification: Field[] = [
  { key: "name", label: "Nombre de la certificación" },
  { key: "issuer", label: "Institución emisora" },
  { key: "obtained", label: "Fecha de obtención", type: "date" },
  { key: "expiry", label: "Fecha de vencimiento", type: "date" },
  { key: "credential", label: "Identificador de credencial" },
  { key: "url", label: "URL de verificación", type: "url" },
];
const extra: Field[] = [
  { key: "title", label: "Título" },
  { key: "organization", label: "Organización" },
  { key: "date", label: "Fecha", type: "date" },
  { key: "description", label: "Descripción", type: "long" },
];
function Records<T extends Record<string, string | boolean>>({
  title,
  rows,
  onChange,
  fields,
  create,
}: {
  title: string;
  rows: T[];
  onChange: (v: T[]) => void;
  fields: Field[];
  create: () => T;
}) {
  const move = (i: number, to: number) => {
    const copy = [...rows];
    [copy[i], copy[to]] = [copy[to], copy[i]];
    onChange(copy);
  };
  return (
    <div className="stack">
      {rows.map((row, i) => (
        <div className="record stack" key={i}>
          <div className="record-head">
            <strong>
              {String(row.role || row.degree || row.name || row.title || title)}
              {rows.length > 1 ? " · " + (i + 1) : ""}
            </strong>
            <div className="actions">
              <button
                className="icon-button"
                aria-label="Subir registro"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                <ArrowUp size={15} />
              </button>
              <button
                className="icon-button"
                aria-label="Bajar registro"
                disabled={i === rows.length - 1}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown size={15} />
              </button>
              <button
                className="icon-button danger-text"
                aria-label="Eliminar registro"
                onClick={() => onChange(rows.filter((_, j) => i !== j))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div className="field-grid">
            {fields.map(({ key, label, type }) => {
              const value = row[key];
              const update = (v: string | boolean) =>
                onChange(
                  rows.map((item, j) =>
                    j === i
                      ? {
                          ...item,
                          [key]: v,
                          ...(key === "current" && v ? { end: "" } : {}),
                        }
                      : item,
                  ),
                );
              if (key === "end" && row.current) return null;
              return type === "toggle" ? (
                <label className="check full" key={key}>
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => update(e.target.checked)}
                  />
                  {label}
                </label>
              ) : (
                <label
                  className={type === "long" ? "full" : undefined}
                  key={key}
                >
                  {label}
                  {type === "long" ? (
                    <textarea
                      rows={3}
                      maxLength={6000}
                      value={String(value)}
                      onChange={(e) => update(e.target.value)}
                    />
                  ) : (
                    <input
                      type={type === "url" ? "url" : "text"}
                      maxLength={type === "date" ? 7 : 500}
                      placeholder={
                        type === "date" ? "AAAA o AAAA-MM" : undefined
                      }
                      value={String(value)}
                      onChange={(e) => update(e.target.value)}
                    />
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <button
        className="button dashed"
        disabled={rows.length >= 40}
        onClick={() => onChange([...rows, create()])}
      >
        <Plus size={16} /> Añadir registro
      </button>
    </div>
  );
}
export function Content({
  data,
  change,
  step,
  setStep,
  ai,
}: {
  data: ResumeData;
  change: (value: ResumeData) => void;
  step: number;
  setStep: (value: number) => void;
  ai: (task: string) => void;
}) {
  return (
    <>
      <label className="step-select">
        Sección del currículum
        <select value={step} onChange={(e) => setStep(Number(e.target.value))}>
          {steps.map((label, i) => (
            <option key={label} value={i}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="section-heading">
        <h2>{steps[step]}</h2>
        <span className="muted">
          Paso {step + 1} de {steps.length}
        </span>
      </div>
      <div className="progress-track">
        <span style={{ width: ((step + 1) / steps.length) * 100 + "%" }} />
      </div>
      {step === 0 && (
        <div className="field-grid">
          {(
            Object.keys(personalLabels) as (keyof ResumeData["personal"])[]
          ).map((key) => (
            <div
              className={
                key === "name" || key === "role"
                  ? "full personal-field"
                  : "personal-field"
              }
              key={key}
            >
              <label>
                {personalLabels[key]}
                <input
                  autoComplete="off"
                  type={
                    key === "email"
                      ? "email"
                      : key === "phone"
                        ? "tel"
                        : ["linkedin", "portfolio", "website"].includes(key)
                          ? "url"
                          : "text"
                  }
                  value={data.personal[key]}
                  onChange={(e) =>
                    change({
                      ...data,
                      personal: { ...data.personal, [key]: e.target.value },
                    })
                  }
                  maxLength={key === "email" ? 254 : 500}
                />
              </label>
              <label className="check compact-check">
                <input
                  type="checkbox"
                  checked={!data.hiddenPersonal.includes(key)}
                  onChange={(e) =>
                    change({
                      ...data,
                      hiddenPersonal: e.target.checked
                        ? data.hiddenPersonal.filter((x) => x !== key)
                        : [...data.hiddenPersonal, key],
                    })
                  }
                />{" "}
                Mostrar en el CV
              </label>
            </div>
          ))}
        </div>
      )}
      {step === 1 && (
        <div className="stack">
          <p className="muted">
            Describe tu especialidad, las competencias que aplicas y el tipo de
            trabajo al que te orientas.
          </p>
          <label>
            Resumen profesional
            <textarea
              rows={7}
              maxLength={6000}
              value={data.profile}
              onChange={(e) => change({ ...data, profile: e.target.value })}
              placeholder="Escribe un resumen breve de tu trayectoria…"
            />
          </label>
          <button className="button" onClick={() => ai("profile")}>
            <Sparkles size={17} /> Generar propuesta con IA
          </button>
        </div>
      )}
      {step === 2 && (
        <div className="stack">
          <p className="muted">
            Empieza cada logro con un verbo de acción. Añade cifras solo cuando
            puedas verificarlas.
          </p>
          <Records
            title="Experiencia"
            rows={data.experience}
            fields={experience}
            create={newExperience}
            onChange={(value) => change({ ...data, experience: value })}
          />
          <button className="button" onClick={() => ai("rewrite")}>
            <Sparkles size={17} /> Revisar redacción con IA
          </button>
        </div>
      )}
      {step === 3 && (
        <Records
          title="Formación"
          rows={data.education}
          fields={education}
          create={newEducation}
          onChange={(value) => change({ ...data, education: value })}
        />
      )}
      {step === 4 && (
        <div className="stack">
          {(Object.keys(skillLabels) as (keyof ResumeData["skills"])[]).map(
            (key) => {
              const values = data.skills[key];
              const update = (next: string[]) =>
                change({ ...data, skills: { ...data.skills, [key]: next } });
              return (
                <fieldset className="record stack" key={key}>
                  <legend>{skillLabels[key]}</legend>
                  {values.map((value, i) => (
                    <div className="skill-row" key={i}>
                      <input
                        aria-label={skillLabels[key] + " " + (i + 1)}
                        value={value}
                        onChange={(e) =>
                          update(
                            values.map((v, j) =>
                              i === j ? e.target.value : v,
                            ),
                          )
                        }
                        maxLength={500}
                      />
                      <button
                        className="icon-button danger-text"
                        aria-label="Eliminar habilidad"
                        onClick={() => update(values.filter((_, j) => i !== j))}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="button compact"
                    onClick={() => update([...values, ""])}
                    disabled={values.length >= 40}
                  >
                    <Plus size={15} /> Añadir habilidad
                  </button>
                </fieldset>
              );
            },
          )}
        </div>
      )}
      {step === 5 && (
        <Records
          title="Certificación"
          rows={data.certifications}
          fields={certification}
          create={newCertification}
          onChange={(value) => change({ ...data, certifications: value })}
        />
      )}
      {step === 6 && (
        <div className="stack">
          {extraSections.map((key) => (
            <details className="record extra-record" key={key}>
              <summary>
                {labels[key]} ({data.extras[key].length})
              </summary>
              <Records
                title={labels[key]}
                rows={data.extras[key]}
                fields={extra}
                create={newExtra}
                onChange={(value) =>
                  change({ ...data, extras: { ...data.extras, [key]: value } })
                }
              />
            </details>
          ))}
        </div>
      )}
      <div className="step-actions">
        <button
          className="button"
          disabled={!step}
          onClick={() => setStep(step - 1)}
        >
          <ChevronLeft size={17} /> Anterior
        </button>
        <button
          className="button primary"
          disabled={step === steps.length - 1}
          onClick={() => setStep(step + 1)}
        >
          Siguiente <ChevronRight size={17} />
        </button>
      </div>
    </>
  );
}
