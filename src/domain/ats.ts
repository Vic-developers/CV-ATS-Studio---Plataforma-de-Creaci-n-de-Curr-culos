import {
  documentBlocks,
  lines,
  norm,
  type ResumeData,
  type Section,
} from "./resume";

export type Diagnostic = {
  severity: "alta" | "media" | "baja";
  finding: string;
  action: string;
};
const categories = {
  structure: 25,
  technical: 25,
  relevance: 30,
  writing: 20,
} as const;
type Category = keyof typeof categories;
export const categoryLabels: Record<Category, string> = {
  structure: "Estructura y organización",
  technical: "Compatibilidad técnica",
  relevance: "Relevancia y palabras clave",
  writing: "Calidad de redacción",
};
const stop = new Set(
  norm(
    "para con por las los como una que del este esta quien sobre junto desde años ano experiencia buscamos capacidad trabajo candidato equipo conocimientos manejo dominio deseable requerido excelentes puesto profesional profesionalmente requerimientos habilidades requisitos responsabilidades ofrecemos the and for with from that this will your our you are role work years experience required preferred must strong ability skills knowledge including have has about",
  ).split(" "),
);
const terms =
  /(?:power bi|project management|machine learning|gestion de proyectos|atencion al cliente|analisis de datos|trabajo en equipo|comunicacion efectiva|pensamiento critico|resolucion de problemas|microsoft office|google workspace|customer service|data analysis|problem solving|team work|react|javascript|typescript|python|java|sql|excel|aws|azure|docker|kubernetes|figma|salesforce|scrum|agile|sap|oracle|linux|git|wordpress|lms|html|css|node\.js|c\+\+|c#)(?![\p{L}\p{N}])/gu;
const professional =
  /equipo|comunicacion|gestion|liderazgo|resolucion|service|solving|management|critico|collaboration/;
const tools =
  /^(?:power bi|react|javascript|typescript|python|java|sql|excel|aws|azure|docker|kubernetes|figma|salesforce|sap|oracle|linux|git|wordpress|lms|html|css|node\.js|c\+\+|c#|microsoft office|google workspace)$/;
const contains = (text: string, term: string) => {
  for (
    let i = text.indexOf(term);
    i >= 0;
    i = text.indexOf(term, i + term.length)
  ) {
    if (
      !/[\p{L}\p{N}]/u.test(text[i - 1] ?? "") &&
      !/[\p{L}\p{N}]/u.test(text[i + term.length] ?? "")
    )
      return true;
  }
  return false;
};

function requirementEvidence(
  data: ResumeData,
  groups: { required: string[]; preferred: string[] },
  keywords: string[],
) {
  const visible = documentBlocks(data)
    .filter((block) => block.kind !== "heading")
    .map((block) => block.text);
  const contextual: { section: string; quote: string }[] = [];
  if (!data.style.hidden.includes("experience"))
    for (const e of data.experience)
      for (const quote of lines(
        [e.duties, e.achievements, e.metrics].join("\n"),
      ))
        contextual.push({
          section:
            [e.role, e.company].filter(Boolean).join(" · ") ||
            "Experiencia laboral",
          quote,
        });
  for (const section of [
    "projects",
    "research",
    "teaching",
    "volunteer",
  ] as const) {
    if (data.style.hidden.includes(section)) continue;
    for (const e of data.extras[section])
      for (const quote of lines(e.description))
        contextual.push({ section: e.title || section, quote });
  }
  return (["required", "preferred"] as const).flatMap((type) =>
    groups[type].slice(0, 30).map((requirement) => {
      const text = norm(requirement);
      const relevant = [
        ...new Set([
          ...Array.from(text.matchAll(terms), (m) => m[0]),
          ...keywords,
        ]),
      ]
        .filter((term) => contains(text, term))
        .slice(0, 12);
      return {
        type,
        requirement,
        matches: relevant.map((term) => {
          const evidence = contextual.find(
            (item) =>
              contains(norm(item.quote), term) &&
              !/\b(?:sin|no|never|without)\b/i.test(item.quote) &&
              norm(item.quote).trim() !== term,
          );
          const mention = visible.find((quote) => contains(norm(quote), term));
          return {
            term,
            status: evidence
              ? ("context" as const)
              : mention
                ? ("mention" as const)
                : ("missing" as const),
            quote: evidence?.quote ?? mention ?? "",
            section: evidence?.section ?? "",
          };
        }),
      };
    }),
  );
}

export function compareJob(data: ResumeData, job: string) {
  const rows = lines(job);
  const first = rows[0] ?? "";
  const title =
    first.length <= 120
      ? first.replace(/^(?:puesto|cargo|vacante|job title)\s*:\s*/i, "")
      : "";
  const groups = {
    responsibilities: [] as string[],
    required: [] as string[],
    preferred: [] as string[],
  };
  let target: keyof typeof groups = "responsibilities";
  for (const row of rows.slice(title ? 1 : 0)) {
    const match =
      /^(responsabilidades|funciones|responsibilities|requisitos deseables|requisitos opcionales|requisitos(?: obligatorios)?|requirements|required qualifications|deseables|preferred qualifications|preferibles)\s*[:\-]?\s*(.*)$/i.exec(
        norm(row),
      );
    if (match) {
      target = /deseables|opcionales|preferred|preferibles/.test(match[1])
        ? "preferred"
        : /requisitos|requirements|required/.test(match[1])
          ? "required"
          : "responsibilities";
      const inline = row
        .slice(match[1].length)
        .replace(/^\s*[:\-]\s*/, "")
        .trim();
      if (inline) groups[target].push(inline);
    } else groups[target].push(row);
  }
  const source = norm(job);
  const dictionary = [
    ...new Set(
      Array.from(source.matchAll(terms), (m) => m[0]).filter((t) =>
        contains(source, t),
      ),
    ),
  ];
  const frequency = new Map<string, number>();
  for (const word of source.match(/[a-z][a-z0-9+#.-]{3,}/g) ?? []) {
    if (
      stop.has(word) ||
      dictionary.some((term) => term.split(" ").includes(word))
    )
      continue;
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }
  const keywords = [
    ...dictionary,
    ...[...frequency]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word),
  ].slice(0, 24);
  const visible = norm(
    documentBlocks(data)
      .filter((b) => b.kind !== "heading")
      .map((b) => b.text)
      .join(" "),
  );
  const evidence = data.style.hidden.includes("experience")
    ? ""
    : norm(
        data.experience
          .flatMap((e) => [e.duties, e.achievements, e.metrics])
          .join(" "),
      );
  const found = keywords.filter((word) => contains(visible, word));
  return {
    title,
    ...groups,
    requirementEvidence: requirementEvidence(data, groups, keywords),
    keywords,
    found,
    missing: keywords.filter((word) => !found.includes(word)),
    evidenceNeeded: found.filter((word) => !contains(evidence, word)),
    score: keywords.length
      ? Math.round((found.length / keywords.length) * 100)
      : null,
    tools: dictionary.filter((t) => tools.test(t)),
    professional: dictionary.filter((t) => professional.test(t)),
    technical: dictionary.filter(
      (t) => !tools.test(t) && !professional.test(t),
    ),
    recommendation:
      "Añade ejemplos reales para respaldar las competencias que ya tienes. Usa los términos de la oferta cuando describan tu experiencia.",
  };
}

export function analyze(
  data: ResumeData,
  job = "",
  source: Diagnostic[] = [],
  grammar: Diagnostic[] = [],
) {
  const scores: Record<Category, number> = { ...categories };
  const issues: (Diagnostic & { category: Category; section?: Section })[] = [];
  const flag = (
    category: Category,
    penalty: number,
    finding: string,
    action: string,
    severity: Diagnostic["severity"] = "media",
    section?: Section,
  ) => {
    scores[category] = Math.max(0, scores[category] - penalty);
    issues.push({ category, finding, action, severity, section });
  };
  const has = (section: Section) => !data.style.hidden.includes(section);
  const visible = documentBlocks(data);
  const contact = (key: "name" | "email" | "phone") =>
    !data.hiddenPersonal.includes(key) && !!data.personal[key];
  if (!contact("name"))
    flag(
      "structure",
      10,
      "Falta un nombre visible.",
      "Completa Información personal.",
      "alta",
    );
  if (!contact("email") && !contact("phone"))
    flag(
      "structure",
      5,
      "Falta un medio de contacto visible.",
      "Muestra un correo o un teléfono.",
    );
  const experience = has("experience")
    ? data.experience.filter(
        (e) => e.role || e.company || e.duties || e.achievements || e.metrics,
      )
    : [];
  if (
    !experience.length &&
    !["projects", "volunteer", "research", "teaching"].some(
      (id) =>
        has(id as Section) &&
        data.extras[id as keyof ResumeData["extras"]].some(
          (e) => e.title || e.description,
        ),
    )
  ) {
    flag(
      "structure",
      5,
      "Faltan antecedentes profesionales o proyectos.",
      "Incluye experiencia, proyectos reales o voluntariado.",
      "media",
      "experience",
    );
  }
  if (
    experience.some(
      (e) =>
        !e.role ||
        !e.company ||
        !e.start ||
        (!e.end && !e.current) ||
        (!!e.end && !!e.start && e.end < e.start),
    )
  ) {
    flag(
      "structure",
      6,
      "Hay experiencias con campos o fechas inconsistentes.",
      "Comprueba empresa, cargo y período de cada experiencia.",
      "alta",
      "experience",
    );
  }
  if (
    experience.some(
      (e, i) =>
        i > 0 &&
        (e.current ? "9999" : e.end || e.start) >
          (experience[i - 1].current
            ? "9999"
            : experience[i - 1].end || experience[i - 1].start),
    )
  ) {
    flag(
      "structure",
      3,
      "La experiencia no sigue el orden cronológico inverso.",
      "Ordena primero las experiencias más recientes.",
      "baja",
      "experience",
    );
  }
  if (
    has("profile") &&
    data.profile &&
    data.style.order.indexOf("profile") >
      data.style.order.indexOf("experience") &&
    experience.length
  ) {
    flag(
      "structure",
      2,
      "El perfil aparece después de la experiencia.",
      "Considera colocar el resumen al principio.",
      "baja",
      "profile",
    );
  }
  if (
    has("education") &&
    data.education.some(
      (e) =>
        !e.degree ||
        !e.institution ||
        (!!e.end && !!e.start && e.end < e.start),
    )
  ) {
    flag(
      "structure",
      3,
      "Hay registros de formación incompletos o con fechas invertidas.",
      "Revisa institución, titulación y fechas.",
      "media",
      "education",
    );
  }
  if (data.style.mode === "visual")
    flag(
      "technical",
      2,
      "El modo visual incluye líneas y acentos gráficos.",
      "Elige el modo ATS si la plataforma pide un diseño sencillo.",
      "baja",
    );
  for (const item of source)
    flag(
      "technical",
      item.severity === "alta" ? 8 : 3,
      item.finding,
      item.action,
      item.severity,
    );
  if (!visible.some((b) => b.kind === "bullet" || b.kind === "body"))
    flag(
      "technical",
      visible.length ? 6 : 25,
      "El CV tiene poco texto extraíble.",
      "Añade contenido en los campos del editor.",
    );
  const profile = has("profile") ? data.profile : "";
  if (profile.length < 60)
    flag(
      "relevance",
      7,
      "Falta un perfil profesional suficientemente descriptivo.",
      "Resume tu especialidad y competencias con hechos reales.",
      "media",
      "profile",
    );
  if (!has("skills") || !Object.values(data.skills).flat().some(Boolean))
    flag(
      "relevance",
      7,
      "Faltan competencias visibles.",
      "Incluye las habilidades que puedas demostrar.",
      "media",
      "skills",
    );
  if (
    experience.length &&
    !experience.some((e) => /\d/.test(e.achievements + e.metrics + e.duties))
  )
    flag(
      "relevance",
      5,
      "La experiencia no muestra resultados cuantificados.",
      "Agrega cifras verificables si las tienes.",
      "baja",
      "experience",
    );
  if (experience.length && !experience.some((e) => e.achievements || e.metrics))
    flag(
      "relevance",
      4,
      "Faltan logros o resultados diferenciados.",
      "Incluye contribuciones concretas.",
      "media",
      "experience",
    );
  const comparison = job.trim() ? compareJob(data, job) : null;
  if (
    comparison?.score !== null &&
    comparison?.score !== undefined &&
    comparison.score < 100
  )
    flag(
      "relevance",
      Math.ceil((100 - comparison.score) / 10),
      "Hay palabras clave de la oferta que no aparecen.",
      comparison.recommendation,
      "media",
      "skills",
    );
  const content = visible
    .filter((b) => b.kind === "body" || b.kind === "bullet")
    .map((b) => b.text);
  if (content.some((p) => p.length > 500))
    flag(
      "writing",
      4,
      "Hay párrafos extensos.",
      "Divide las descripciones en párrafos o logros breves.",
    );
  const comparable = content
    .filter((p) => p.length > 20)
    .map((p) => norm(p).replace(/[^a-z0-9 ]/g, ""));
  if (new Set(comparable).size !== comparable.length)
    flag(
      "writing",
      4,
      "Se encontró contenido repetido.",
      "Consolida las frases duplicadas.",
    );
  const generic = experience
    .flatMap((e) => lines(e.duties))
    .some((p) =>
      /^(responsable de|encargad[oa] de|responsible for|in charge of)/i.test(p),
    );
  if (generic)
    flag(
      "writing",
      4,
      "Hay responsabilidades redactadas en términos genéricos.",
      "Empieza con un verbo de acción que describa tu contribución.",
      "media",
      "experience",
    );
  if (
    content.some((p) => /\b(\p{L}{2,})\s+\1\b|[!?.,]{3,}|\s+[.,;!?]/iu.test(p))
  )
    flag(
      "writing",
      3,
      "Hay repeticiones de palabras o signos.",
      "Revisa la puntuación y las palabras consecutivas.",
    );
  const writing = content.join(" ");
  const spanish = (
    norm(writing).match(
      /\b(?:para|con|nuestros|los|las|una|mediante|durante|responsable)\b/g,
    ) ?? []
  ).length;
  const english = (
    norm(writing).match(
      /\b(?:with|through|under|using|the|and|responsible|from)\b/g,
    ) ?? []
  ).length;
  if (spanish >= 3 && english >= 3)
    flag(
      "writing",
      3,
      "Hay indicios de mezcla de español e inglés en el texto.",
      "Revisa el idioma del documento y conserva los nombres propios y las herramientas.",
    );
  for (const item of grammar.slice(0, 10))
    flag("writing", 1, item.finding, item.action, item.severity);
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  return {
    total,
    scores,
    maxima: categories,
    issues,
    comparison,
    grammarChecked: grammar.length > 0,
    rating:
      total >= 90
        ? "Excelente preparación"
        : total >= 75
          ? "Buena preparación"
          : total >= 60
            ? "Necesita mejoras"
            : "Requiere optimización",
  };
}
export type Report = ReturnType<typeof analyze>;
