import { blankResume, newEducation, newExperience } from "../src/domain/resume";

export function fixture() {
  const data = blankResume();
  data.personal = {
    ...data.personal,
    name: "María Núñez",
    role: "Analista de datos",
    city: "Santo Domingo",
    country: "República Dominicana",
    email: "maria@example.test",
  };
  data.profile =
    "Analista de datos con experiencia en automatización de informes con SQL y Python.";
  data.experience.push({
    ...newExperience(),
    company: "Soluciones Ñandú",
    role: "Analista",
    start: "2022-03",
    end: "2025-05",
    duties: "Automaticé informes en SQL.\nDocumenté el proceso de revisión.",
    achievements: "Reduje el tiempo de revisión en un 20 %.",
  });
  data.education.push({
    ...newEducation(),
    institution: "Universidad Local",
    degree: "Ingeniería",
    start: "2015",
    end: "2020",
  });
  data.skills.tools = ["SQL", "Python"];
  return data;
}
