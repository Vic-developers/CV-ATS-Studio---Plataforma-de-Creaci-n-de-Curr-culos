import assert from "node:assert/strict";
import test from "node:test";
import {
  blankResume,
  documentBlocks,
  resumeSchema,
} from "../src/domain/resume";
import { analyze, compareJob } from "../src/domain/ats";
import { fixture } from "./fixtures";

test("the document keeps section order, visibility, accents and fixed dates", () => {
  const resume = fixture();
  const first = documentBlocks(resume);
  assert.equal(first[0].text, "María Núñez");
  assert.ok(first.some((b) => b.text.includes("03/2022 – 05/2025")));
  assert.equal(first.filter((b) => b.kind === "bullet").length, 3);
  resume.hiddenPersonal.push("email");
  resume.style.hidden.push("education");
  resume.style.order = [...resume.style.order.slice(1), "profile"];
  const edited = documentBlocks(resume);
  assert.ok(!edited.some((b) => /maria@|Universidad/.test(b.text)));
  assert.ok(
    edited.findIndex((b) => b.text === "Perfil profesional") >
      edited.findIndex((b) => b.text === "Experiencia laboral"),
  );
});

test("the readiness calculation respects its independent category weights", () => {
  const complete = analyze(fixture());
  const blank = analyze(blankResume());
  assert.deepEqual(complete.maxima, {
    structure: 25,
    technical: 25,
    relevance: 30,
    writing: 20,
  });
  assert.equal(complete.total, 100);
  assert.ok(blank.total < 60);
  assert.ok(blank.issues.some((issue) => issue.severity === "alta"));
  assert.equal(
    blank.total,
    Object.values(blank.scores).reduce((a, b) => a + b, 0),
  );
});

test("matching includes evidence, ignores hidden skills and handles bilingual heading groups", () => {
  const resume = fixture();
  resume.style.hidden.push("skills");
  const comparison = compareJob(
    resume,
    "Puesto: Analista\nResponsabilidades:\nElaborar informes\nRequisitos obligatorios: SQL\nRequisitos deseables: Docker",
  );
  assert.equal(comparison.title, "Analista");
  assert.deepEqual(comparison.required, ["SQL"]);
  assert.deepEqual(comparison.preferred, ["Docker"]);
  assert.ok(comparison.found.includes("sql"));
  assert.ok(comparison.missing.includes("docker"));
  assert.ok(!comparison.evidenceNeeded.includes("sql"));
  resume.style.hidden.push("experience");
  assert.ok(
    compareJob(
      resume,
      "Data Analyst\nRequirements: SQL",
    ).evidenceNeeded.includes("sql"),
  );
});

test("schemas reject dangerous links, repeated section IDs and malformed dates", () => {
  const resume = fixture();
  resume.personal.website = "javascript:alert(1)";
  resume.experience[0].start = "2026-22";
  resume.style.order[0] = resume.style.order[1];
  assert.equal(resumeSchema.safeParse(resume).success, false);
});
