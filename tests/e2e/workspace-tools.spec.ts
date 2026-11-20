import { expect, test } from "@playwright/test";
import { fixture } from "../fixtures";
import { scannedFixture } from "../scanned-fixture";

test("OCR, ATS reading, reusable achievements, snapshots, applications and account privacy", async ({
  page,
  browser,
  baseURL,
}) => {
  const headers = { Origin: new URL(baseURL!).origin };
  const email = "tools-" + Date.now() + "@example.test";
  const password = "Contraseña de pruebas 2026";
  const request = page.request;

  expect(
    (
      await request.post("/api/auth/register", {
        headers,
        data: { email, password },
      })
    ).status(),
  ).toBe(201);
  const created = await request.post("/api/resumes", {
    headers,
    data: { title: "CV verificado", data: fixture() },
  });
  expect(created.status()).toBe(201);
  const resume = await created.json();
  const path = "/api/resumes/" + resume.id;

  await page.goto("/");
  await page.getByRole("button", { name: "Banco de logros" }).click();
  await page.getByRole("button", { name: "Nuevo logro" }).click();
  await page.getByLabel("Título", { exact: true }).fill("Tablero validado");
  await page
    .getByLabel("Logro", { exact: true })
    .fill("Creé un tablero interno.");
  await page
    .getByLabel("Métricas verificables")
    .fill("12 minutos menos de espera.");
  await page.getByLabel("Confirmo que").check();
  await page.getByRole("button", { name: "Guardar logro" }).click();
  await expect(
    page.getByRole("heading", { name: "Tablero validado" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Mis currículums" }).click();
  await page.getByRole("button", { name: /^CV verificado/ }).click();
  await page.getByLabel("Sección del currículum").selectOption("2");
  await page.getByRole("button", { name: "Usar un logro del banco" }).click();
  await page
    .getByLabel("Logro confirmado")
    .selectOption({ label: "Tablero validado" });
  await page.getByRole("button", { name: "Añadir a esta experiencia" }).click();
  await expect(page.getByLabel("Logros profesionales")).toHaveValue(
    /Creé un tablero interno/,
  );

  await page.getByRole("button", { name: "Lectura ATS", exact: true }).click();
  await page.getByRole("button", { name: "Ver lectura del archivo" }).click();
  await expect(
    page.getByText(/Se verificaron los \d+ fragmentos/),
  ).toBeVisible();
  await page.getByLabel("Formato de lectura").selectOption("docx");
  await page.getByRole("button", { name: "Ver lectura del archivo" }).click();
  await expect(
    page.getByText("Texto de Word en orden de lectura"),
  ).toBeVisible();
  await expect(
    page.getByText(/Se verificaron los \d+ fragmentos/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Versiones", exact: true }).click();
  await page
    .getByLabel("Nombre del punto de guardado")
    .fill("Antes de adaptar");
  await page.getByRole("button", { name: "Guardar versión actual" }).click();
  await expect(page.getByText("Punto de guardado creado.")).toBeVisible();
  const [before] = await (await request.get(path + "/versions")).json();

  await page.getByRole("button", { name: "Contenido", exact: true }).click();
  await page.getByLabel("Sección del currículum").selectOption("1");
  await page
    .getByLabel("Resumen profesional")
    .fill("Perfil adaptado a otra vacante.");
  await page.getByRole("button", { name: "Versiones", exact: true }).click();
  await page.getByLabel("Comparar con").selectOption(before.id);
  await expect(
    page
      .locator(".comparison-panes")
      .getByText("Perfil adaptado a otra vacante."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restaurar versión" }).click();
  await page.getByRole("button", { name: "Confirmar restauración" }).click();
  await expect(page.getByText(/Versión restaurada/)).toBeVisible();
  const restored = await (await request.get(path)).json();
  expect(restored.data.profile).toBe(fixture().profile);

  const exported = await request.post(path + "/export", {
    headers,
    data: { format: "pdf", mode: "ats" },
  });
  expect(exported.status()).toBe(200);
  const exactBytes = await exported.body();
  const [savedExport] = await (await request.get(path + "/exports")).json();
  await page.getByRole("button", { name: "Volver al panel" }).click();
  await page.getByRole("button", { name: "Postulaciones" }).click();
  await page.getByRole("button", { name: "Registrar postulación" }).click();
  await page.getByLabel("Empresa").fill("Empresa de prueba");
  await page.getByLabel("Vacante", { exact: true }).fill("Analista de datos");
  await page
    .getByLabel("Archivo enviado (opcional)")
    .selectOption(savedExport.id);
  await page.getByRole("button", { name: "Guardar postulación" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Analista de datos · Empresa de prueba",
    }),
  ).toBeVisible();
  const application = (
    await (await request.get("/api/applications")).json()
  )[0];
  expect(application.resumeRevision).toBe(restored.revision);
  expect(
    (
      await request.delete(path + "/exports/" + savedExport.id, { headers })
    ).status(),
  ).toBe(200);
  expect(
    (await request.get(path + "/exports/" + savedExport.id)).status(),
  ).toBe(404);
  expect(
    Buffer.compare(
      await (
        await request.get("/api/applications/" + application.id + "/document")
      ).body(),
      exactBytes,
    ),
  ).toBe(0);

  await page.getByRole("button", { name: "Panel principal" }).click();
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await page
    .getByLabel("Archivo PDF o DOCX de hasta 8 MB")
    .setInputFiles({
      name: "Escaneado.pdf",
      mimeType: "application/pdf",
      buffer: await scannedFixture(),
    });
  await page.getByRole("button", { name: "Extraer texto" }).click();
  await expect(
    page.getByRole("heading", { name: "Archivo original", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Se reconoció texto mediante OCR/)).toBeVisible();
  const originalImage = page.getByRole("img", {
    name: "Página 1 del PDF original",
  });
  await expect
    .poll(() =>
      originalImage.evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByLabel("Revisé y confirmé").check();
  await page
    .getByRole("button", { name: "Guardar currículum importado" })
    .click();
  await page.getByRole("button", { name: "Archivos", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Descargar original" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Eliminar original" }).click();
  await page
    .getByRole("button", { name: "Confirmar eliminación de archivo" })
    .click();
  await expect(page.getByText(/no tiene un archivo original/)).toBeVisible();

  const other = await browser.newContext();
  try {
    expect(
      (
        await other.request.post(baseURL + "/api/auth/register", {
          headers,
          data: { email: "other-" + email, password },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await other.request.get(baseURL + path + "/versions/" + before.id)
      ).status(),
    ).toBe(404);
    expect(
      (
        await other.request.get(
          baseURL + "/api/applications/" + application.id + "/document",
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await other.request.delete(
          baseURL + "/api/applications/" + application.id,
          { headers },
        )
      ).status(),
    ).toBe(404);
  } finally {
    await other.close();
  }

  const download = await request.get("/api/account/export");
  expect(download.status()).toBe(200);
  const personal = await download.json();
  expect(personal.account.email).toBe(email);
  expect(personal.account.password).toBeUndefined();
  expect(personal.achievements[0].title).toBe("Tablero validado");
  expect(personal.applications[0].artifactBase64).toBe(
    exactBytes.toString("base64"),
  );
  expect(
    personal.versions.map((row: { label: string }) => row.label),
  ).toContain("Antes de restaurar");
  expect(
    (
      await request.delete("/api/account", {
        headers,
        data: { confirm: "ELIMINAR", password: "Contraseña equivocada 2026" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.delete("/api/account", {
        headers,
        data: { confirm: "ELIMINAR", password },
      })
    ).status(),
  ).toBe(200);
  expect((await request.get("/api/resumes")).status()).toBe(401);
});
