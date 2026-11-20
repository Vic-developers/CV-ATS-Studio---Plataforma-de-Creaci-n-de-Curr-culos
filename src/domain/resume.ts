import { z } from "@/domain/validation";

export const labels = {
  profile: "Perfil profesional",
  experience: "Experiencia laboral",
  education: "Formación académica",
  skills: "Habilidades y competencias",
  certifications: "Cursos y certificaciones",
  projects: "Proyectos",
  publications: "Publicaciones",
  research: "Investigación",
  volunteer: "Voluntariado",
  awards: "Premios y reconocimientos",
  teaching: "Experiencia docente",
  references: "Referencias profesionales",
} as const;
export type Section = keyof typeof labels;
export const sections = Object.keys(labels) as Section[];
export const personalLabels = {
  name: "Nombre completo",
  role: "Título profesional",
  email: "Correo electrónico",
  phone: "Teléfono",
  city: "Ciudad",
  country: "País",
  linkedin: "LinkedIn",
  portfolio: "Portafolio",
  website: "Sitio web",
} as const;
export const skillLabels = {
  technical: "Competencias técnicas",
  professional: "Competencias profesionales",
  tools: "Herramientas y tecnologías",
  languages: "Idiomas",
  certificates: "Certificaciones",
  digital: "Habilidades digitales",
} as const;
export const templates = [
  {
    id: "classic",
    name: "Profesional clásico",
    description: "Jerarquía tradicional y tipografía con serifas.",
    color: "#253645",
    font: "serif",
    score: 100,
  },
  {
    id: "executive",
    name: "Ejecutivo",
    description: "Encabezados firmes y acento azul marino.",
    color: "#234576",
    font: "serif",
    score: 100,
  },
  {
    id: "technology",
    name: "Tecnológico",
    description: "Tipografía limpia y acento verde azulado.",
    color: "#126D65",
    font: "sans",
    score: 100,
  },
  {
    id: "academic",
    name: "Académico",
    description: "Estilo editorial para formación e investigación.",
    color: "#6E4933",
    font: "serif",
    score: 100,
  },
  {
    id: "administrative",
    name: "Administrativo",
    description: "Encabezados sobrios en azul grisáceo.",
    color: "#3E5C78",
    font: "sans",
    score: 100,
  },
  {
    id: "creative",
    name: "Creativo",
    description: "Acento violeta con orden de lectura lineal.",
    color: "#6847AC",
    font: "sans",
    score: 100,
  },
  {
    id: "first",
    name: "Primer empleo",
    description: "Presentación abierta y acento verde.",
    color: "#376848",
    font: "sans",
    score: 100,
  },
  {
    id: "international",
    name: "Perfil internacional",
    description: "Diseño limpio para candidaturas internacionales.",
    color: "#783B58",
    font: "sans",
    score: 100,
  },
] as const;
const text = z.string().trim().max(500);
const long = z.string().trim().max(6000);
const month = z.string().regex(/^(?:\d{4}(?:-(?:0[1-9]|1[0-2]))?)?$/);
const email = z.string().max(254).email().or(z.literal(""));
const link = text.refine(
  (value) => !value || /^https?:\/\/\S+$/i.test(value),
  "Usa una URL http o https.",
);
const experience = z.object({
  company: text,
  role: text,
  location: text,
  start: month,
  end: month,
  current: z.boolean(),
  duties: long,
  achievements: long,
  metrics: long,
});
const education = z.object({
  institution: text,
  degree: text,
  field: text,
  start: month,
  end: month,
  status: text,
  honors: long,
});
const certification = z.object({
  name: text,
  issuer: text,
  obtained: month,
  expiry: month,
  credential: text,
  url: link,
});
const extra = z.object({
  title: text,
  organization: text,
  date: month,
  description: long,
});
export const extraSections = [
  "projects",
  "publications",
  "research",
  "volunteer",
  "awards",
  "teaching",
  "references",
] as const;
const section = z.enum([
  "profile",
  "experience",
  "education",
  "skills",
  "certifications",
  ...extraSections,
]);
const lists = <T extends z.ZodTypeAny>(schema: T) => z.array(schema).max(40);
export const resumeSchema = z.object({
  personal: z.object({
    name: text,
    role: text,
    email,
    phone: text,
    city: text,
    country: text,
    linkedin: link,
    portfolio: link,
    website: link,
  }),
  hiddenPersonal: z
    .array(
      z.enum([
        "name",
        "role",
        "email",
        "phone",
        "city",
        "country",
        "linkedin",
        "portfolio",
        "website",
      ]),
    )
    .max(9),
  profile: long,
  experience: lists(experience),
  education: lists(education),
  certifications: lists(certification),
  skills: z.object({
    technical: lists(text),
    professional: lists(text),
    tools: lists(text),
    languages: lists(text),
    certificates: lists(text),
    digital: lists(text),
  }),
  extras: z.object({
    projects: lists(extra),
    publications: lists(extra),
    research: lists(extra),
    volunteer: lists(extra),
    awards: lists(extra),
    teaching: lists(extra),
    references: lists(extra),
  }),
  style: z.object({
    template: z.enum([
      "classic",
      "executive",
      "technology",
      "academic",
      "administrative",
      "creative",
      "first",
      "international",
    ]),
    mode: z.enum(["ats", "visual"]),
    font: z.enum(["sans", "serif"]),
    size: z.number().min(9).max(15),
    margin: z.number().int().min(32).max(76),
    leading: z.number().min(1.1).max(1.8),
    color: z.string().regex(/^#[a-f\d]{6}$/i),
    order: z
      .array(section)
      .length(sections.length)
      .refine((x) => new Set(x).size === sections.length),
    hidden: z.array(section).max(sections.length),
    language: z.enum(["es", "en"]).default("es"),
  }),
});
export type ResumeData = z.infer<typeof resumeSchema>;
export const newExperience = (): ResumeData["experience"][number] => ({
  company: "",
  role: "",
  location: "",
  start: "",
  end: "",
  current: false,
  duties: "",
  achievements: "",
  metrics: "",
});
export const newEducation = (): ResumeData["education"][number] => ({
  institution: "",
  degree: "",
  field: "",
  start: "",
  end: "",
  status: "",
  honors: "",
});
export const newCertification = (): ResumeData["certifications"][number] => ({
  name: "",
  issuer: "",
  obtained: "",
  expiry: "",
  credential: "",
  url: "",
});
export const newExtra = (): ResumeData["extras"]["projects"][number] => ({
  title: "",
  organization: "",
  date: "",
  description: "",
});
export function blankResume(): ResumeData {
  return {
    personal: {
      name: "",
      role: "",
      email: "",
      phone: "",
      city: "",
      country: "",
      linkedin: "",
      portfolio: "",
      website: "",
    },
    hiddenPersonal: [],
    profile: "",
    experience: [],
    education: [],
    certifications: [],
    skills: {
      technical: [],
      professional: [],
      tools: [],
      languages: [],
      certificates: [],
      digital: [],
    },
    extras: {
      projects: [],
      publications: [],
      research: [],
      volunteer: [],
      awards: [],
      teaching: [],
      references: [],
    },
    style: {
      template: "classic",
      mode: "ats",
      font: "serif",
      size: 10.5,
      margin: 46,
      leading: 1.35,
      color: "#253645",
      order: [...sections],
      hidden: [],
      language: "es",
    },
  };
}
export const lines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•]\s*/, "").trim())
    .filter(Boolean);
export const norm = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export type Block = {
  kind:
    | "title"
    | "subtitle"
    | "contact"
    | "heading"
    | "label"
    | "body"
    | "bullet";
  text: string;
};
export const english: Record<Section, string> = {
  profile: "Professional Summary",
  experience: "Work Experience",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  projects: "Projects",
  publications: "Publications",
  research: "Research",
  volunteer: "Volunteering",
  awards: "Awards",
  teaching: "Teaching Experience",
  references: "Professional References",
};
const englishSkills = [
  "Technical skills",
  "Professional skills",
  "Tools and technologies",
  "Languages",
  "Certifications",
  "Digital skills",
];
export function documentBlocks(data: ResumeData): Block[] {
  const entries: Block[] = [];
  const add = (kind: Block["kind"], ...values: string[]) => {
    const text = values
      .map((x) =>
        x
          .trim()
          .normalize("NFC")
          .replace(/[\r\n\t]+/g, " "),
      )
      .filter(Boolean)
      .join(" · ");
    if (text) entries.push({ kind, text });
  };
  const person = (key: keyof ResumeData["personal"]) =>
    data.hiddenPersonal.includes(key) ? "" : data.personal[key];
  const en = data.style.language === "en";
  const date = (value: string) => value.replace(/^(\d{4})-(\d{2})$/, "$2/$1");
  const range = (start: string, end: string, current = false) =>
    [date(start), current ? (en ? "Present" : "Actualidad") : date(end)]
      .filter(Boolean)
      .join(" – ");
  add("title", person("name"));
  add("subtitle", person("role"));
  add(
    "contact",
    person("email"),
    person("phone"),
    [person("city"), person("country")].filter(Boolean).join(", "),
  );
  add("contact", person("linkedin"), person("portfolio"), person("website"));
  for (const id of data.style.order) {
    if (data.style.hidden.includes(id)) continue;
    const start = entries.length;
    const bullets = (...values: string[]) =>
      values.flatMap(lines).forEach((line) => add("bullet", line));
    switch (id) {
      case "profile":
        lines(data.profile).forEach((line) => add("body", line));
        break;
      case "experience":
        data.experience.forEach((e) => {
          add("label", e.role, e.company);
          add("contact", e.location, range(e.start, e.end, e.current));
          bullets(e.duties, e.achievements, e.metrics);
        });
        break;
      case "education":
        data.education.forEach((e) => {
          add("label", e.degree, e.institution);
          add("contact", e.field, range(e.start, e.end), e.status);
          bullets(e.honors);
        });
        break;
      case "certifications":
        data.certifications.forEach((e) => {
          add("label", e.name, e.issuer);
          add("contact", range(e.obtained, e.expiry), e.credential, e.url);
        });
        break;
      case "skills":
        (Object.keys(skillLabels) as (keyof typeof skillLabels)[]).forEach(
          (key, i) => {
            const values = data.skills[key].filter((x) => x.trim());
            if (values.length)
              add(
                "body",
                (en ? englishSkills[i] : skillLabels[key]) +
                  ": " +
                  values.join(", "),
              );
          },
        );
        break;
      default:
        data.extras[id].forEach((e) => {
          add("label", e.title, e.organization);
          add("contact", date(e.date));
          lines(e.description).forEach((line) => add("body", line));
        });
    }
    if (entries.length > start)
      entries.splice(start, 0, {
        kind: "heading",
        text: (en ? english : labels)[id],
      });
  }
  return entries;
}
