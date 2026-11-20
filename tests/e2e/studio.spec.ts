import { expect, test } from "@playwright/test";
import { makeDocx, makePdf } from "../../src/server/documents";
import { fixture } from "../fixtures";

test("registration, saving, ATS history, vacancy version, exports, import and account isolation", async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin,
    prefix = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const email = prefix + "@example.test",
    password = "Ejemplo privado 2026";
  await page.goto("/");
  await page.getByRole("button", { name: "Crea una cuenta" }).click();
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(
    page.getByRole("heading", { name: "Panel principal" }),
  ).toBeVisible();
  await expect(page.getByText("Aún no tienes currículums")).toBeVisible();
  if (process.env.CV_TEST_ARTIFACTS === "true")
    await page.screenshot({ path: "tmp/browser/dashboard.png" });
  await page.getByRole("button", { name: "Nuevo currículum" }).click();
  await page.getByLabel("Nombre del currículum").fill("CV para pruebas");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByLabel("Nombre completo").fill("María Núñez");
  await page.getByLabel("Título profesional").fill("Analista de datos");
  await page.getByLabel("Correo electrónico").fill("maria@example.test");
  await page.getByLabel("Sección del currículum").selectOption("1");
  await page
    .getByLabel("Resumen profesional")
    .fill(
      "Analista de datos con experiencia en automatización de informes con SQL y Python.",
    );
  await expect(
    page
      .locator(".paper")
      .getByText("Analista de datos con experiencia", { exact: false }),
  ).toBeVisible();
  if (process.env.CV_TEST_ARTIFACTS === "true")
    await page.screenshot({ path: "tmp/browser/editor.png" });
  await page.getByRole("button", { name: "Análisis ATS", exact: true }).click();
  await page.getByRole("button", { name: "Analizar currículum" }).click();
  await expect(page.getByLabel("Historial de análisis")).toBeVisible();
  await page.getByRole("button", { name: "Oferta laboral" }).click();
  await page
    .getByLabel("Descripción de la oferta")
    .fill("Puesto: Analista\nRequisitos: SQL y Docker");
  await page.getByRole("button", { name: "Comparar con mi CV" }).click();
  await expect(page.getByText("Palabras clave faltantes")).toBeVisible();
  await page
    .getByLabel("Nombre de la nueva versión")
    .fill("CV analista · Oferta");
  await page.getByRole("button", { name: "Guardar como versión" }).click();
  await expect(page.getByLabel("Nombre del currículum")).toHaveValue(
    "CV analista · Oferta",
  );
  for (const format of ["pdf", "docx"]) {
    await page.getByRole("button", { name: "Exportar" }).click();
    await page.getByLabel("Formato").selectOption(format);
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar", exact: true }).click();
    expect((await downloaded).suggestedFilename()).toBe(
      "CV_Maria_Nunez." + format,
    );
  }
  const own = await (await page.request.get("/api/resumes")).json();
  const base = own.find(
    (r: { title: string }) => r.title === "CV para pruebas",
  );
  const variant = own.find(
    (r: { title: string }) => r.title === "CV analista · Oferta",
  );
  expect(base.job).toBeNull();
  expect(variant.parentId).toBe(base.id);
  expect(variant.job.text).toContain("Docker");
  expect((await request.get("/api/resumes/" + base.id)).status()).toBe(401);
  const outsider = await browser.newContext();
  try {
    const registered = await outsider.request.post(
      origin + "/api/auth/register",
      {
        headers: { Origin: origin },
        data: { email: "other-" + email, password },
      },
    );
    expect(registered.status()).toBe(201);
    expect(
      (await outsider.request.get(origin + "/api/resumes/" + base.id)).status(),
    ).toBe(404);
    expect(
      (
        await outsider.request.delete(origin + "/api/resumes/" + base.id, {
          headers: { Origin: origin },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.delete("/api/resumes/" + base.id, {
          headers: { Origin: "https://external.test" },
        })
      ).status(),
    ).toBe(403);
  } finally {
    await outsider.close();
  }
  await page.getByRole("button", { name: "Volver al panel" }).click();
  for (const [name, mimeType, buffer] of [
    [
      "CV original.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      await makeDocx(fixture()),
    ],
    ["CV original.pdf", "application/pdf", await makePdf(fixture())],
  ] as const) {
    await page.getByRole("button", { name: "Importar", exact: true }).click();
    await page
      .getByLabel("Archivo PDF o DOCX de hasta 8 MB")
      .setInputFiles({ name, mimeType, buffer });
    await page.getByRole("button", { name: "Extraer texto" }).click();
    await expect(
      page.getByRole("heading", { name: "Revisar importación" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Guardar currículum importado" }),
    ).toBeDisabled();
    await page.getByLabel("Revisé y confirmé los datos extraídos").check();
    await page
      .getByRole("button", { name: "Guardar currículum importado" })
      .click();
    await expect(page.getByRole("button", { name: "Exportar" })).toBeVisible();
    await page.getByRole("button", { name: "Volver al panel" }).click();
  }
  await page.getByRole("button", { name: /Cerrar sesión/ }).click();
  await expect(
    page.getByRole("heading", { name: "Inicia sesión" }),
  ).toBeVisible();
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^CV analista · Oferta/ }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  if (process.env.CV_TEST_ARTIFACTS === "true")
    await page.screenshot({ path: "tmp/browser/mobile.png" });
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await expect(
    page.getByRole("button", { name: "Mis currículums" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mis currículums" }).click();
  await page
    .getByRole("button", { name: /Acciones de CV analista · Oferta/ })
    .click();
  await expect(page.getByRole("button", { name: "Renombrar" })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: /^CV analista · Oferta/ }).click();
  await expect(page.getByLabel("Sección del currículum")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
});
