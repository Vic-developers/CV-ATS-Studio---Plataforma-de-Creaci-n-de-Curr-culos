import assert from "node:assert/strict";
import test from "node:test";
import {
  addAchievement,
  compareVersions,
  inspectReading,
} from "../src/domain/extensions";
import { compareJob } from "../src/domain/ats";
import { documentBlocks } from "../src/domain/resume";
import { extract } from "../src/server/import";
import { fixture } from "./fixtures";
import { scannedFixture } from "./scanned-fixture";

test("reading flags missing and out-of-order fragments without confusing page breaks", () => {
  const blocks = documentBlocks(fixture()).slice(0, 4);
  const reordered = inspectReading(blocks, [
    { number: 1, text: blocks[1].text + "\n" + blocks[0].text },
    { number: 2, text: blocks[3].text },
    { number: 3, text: " " },
  ]);
  assert.deepEqual(reordered.missing, [blocks[2]]);
  assert.deepEqual(reordered.reordered, [blocks[1]]);
  assert.deepEqual(reordered.empty, [3]);
  const correct = inspectReading(blocks, [
    {
      number: 1,
      text: blocks
        .slice(0, 2)
        .map((x) => x.text)
        .join("\n"),
    },
    {
      number: 2,
      text: blocks
        .slice(2)
        .map((x) => x.text)
        .join("\n"),
    },
  ]);
  assert.equal(correct.missing.length + correct.reordered.length, 0);
});

test("comparison detects changed text, section order and layout", () => {
  const a = fixture(),
    b = structuredClone(a);
  b.profile = "Perfil actualizado";
  [b.style.order[0], b.style.order[1]] = [b.style.order[1], b.style.order[0]];
  const diff = compareVersions(a, b);
  assert.equal(diff.styleChanged, true);
  assert.equal(diff.orderChanged, true);
  assert.equal(diff.sections.length, 1);
  assert.equal(diff.sections[0].after[0], b.profile);
});

test("requirements distinguish a contextual quote, an isolated mention and a missing term", () => {
  const data = fixture();
  const report = compareJob(
    data,
    "Puesto: Analista\nRequisitos: SQL, Python y Docker",
  );
  const evidence = report.requirementEvidence[0].matches;
  assert.equal(evidence.find((x) => x.term === "sql")?.status, "context");
  assert.match(
    evidence.find((x) => x.term === "sql")?.quote ?? "",
    /Automaticé/,
  );
  assert.equal(evidence.find((x) => x.term === "python")?.status, "mention");
  assert.equal(evidence.find((x) => x.term === "docker")?.status, "missing");
  data.style.hidden.push("experience");
  assert.equal(
    compareJob(data, "Puesto: Analista\nRequisitos: SQL").requirementEvidence[0]
      .matches[0].status,
    "mention",
  );
});

test("confirmed achievement reuse preserves fields, limits and original data", () => {
  const data = fixture(),
    item = {
      description: "Creé un tablero interno.",
      metrics: "Reduje el tiempo en 12 minutos.",
    };
  const copy = addAchievement(data, 0, item)!;
  assert.ok(copy.experience[0].achievements.includes(item.description));
  assert.ok(copy.experience[0].metrics.includes(item.metrics));
  assert.ok(!data.experience[0].achievements.includes(item.description));
  assert.deepEqual(addAchievement(copy, 0, item), copy);
  assert.equal(addAchievement(data, 12, item), null);
  assert.equal(
    addAchievement(data, 0, { ...item, description: "x".repeat(6000) }),
    null,
  );
});

test(
  "a raster-only CV is recognized locally and classified as editable text",
  { timeout: 45000 },
  async () => {
    const scanned = await scannedFixture();
    const result = await extract(
      scanned,
      "CV escaneado.pdf",
      "application/pdf",
    );
    assert.equal(result.pageCount, 1);
    assert.match(result.raw, /María Núñez/i);
    assert.match(result.data.profile, /automatización/i);
    assert.ok(
      result.findings.some((finding) => finding.finding.includes("OCR")),
    );
  },
);
