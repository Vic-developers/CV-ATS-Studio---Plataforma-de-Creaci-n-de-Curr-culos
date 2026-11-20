import { expect, test } from "@playwright/test";

test("review services require consent and the emailed token resets the password once", async ({
  page,
  request,
  baseURL,
}) => {
  test.skip(
    process.env.CV_TEST_EXTERNAL_SERVER === "true",
    "Requires the isolated test service.",
  );
  const origin = new URL(baseURL!).origin;
  const email = "services-" + Date.now() + "@example.test";
  const password = "Contraseña sintética 2026";
  const replacement = "Otra contraseña 2026";
  const headers = { Origin: origin };
  const registration = await page.request.post("/api/auth/register", {
    headers,
    data: { email, password },
  });
  expect(registration.status()).toBe(201);
  await page.goto("/");
  await expect(page.getByText("Aún no tienes currículums")).toBeVisible();
  await page.getByRole("button", { name: "Nuevo currículum" }).click();
  await page.getByLabel("Nombre del currículum").fill("CV prueba de IA");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByLabel("Nombre completo").fill("Nombre de prueba");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Sección del currículum").selectOption("1");
  await page
    .getByLabel("Resumen profesional")
    .fill("Analista de datos que trabaja con SQL y prepara informes.");
  await page.getByRole("button", { name: "Generar propuesta con IA" }).click();
  await expect(
    page.getByRole("button", { name: "Solicitar propuesta" }),
  ).toBeDisabled();
  await page.getByLabel("Autorizo enviar").check();
  await page.getByRole("button", { name: "Solicitar propuesta" }).click();
  await expect(
    page.getByRole("heading", { name: "Perfil propuesto" }),
  ).toBeVisible();
  const proposed =
    "Analista de datos con experiencia en SQL y elaboración de informes.";
  await expect(page.locator(".paper").getByText(proposed)).toHaveCount(0);
  await page.getByRole("button", { name: "Aplicar perfil" }).click();
  await expect(page.locator(".paper").getByText(proposed)).toBeVisible();
  await page.getByRole("button", { name: "Análisis ATS", exact: true }).click();
  await page.getByLabel("Enviar el texto del CV").check();
  await page.getByRole("button", { name: "Analizar currículum" }).click();
  await expect(page.getByText("Revisa la concordancia.")).toBeVisible();

  expect(
    (
      await request.post("/api/auth/forgot", { headers, data: { email } })
    ).status(),
  ).toBe(200);
  const services =
    "http://127.0.0.1:" + (process.env.CV_TEST_SERVICES_PORT || "4179");
  const mail = await request.get(
    services + "/mail?email=" + encodeURIComponent(email),
  );
  expect(mail.status()).toBe(200);
  const { token } = await mail.json();
  await page.goto("/recuperar#" + token);
  await expect(
    page.getByRole("heading", { name: "Elige una contraseña nueva" }),
  ).toBeVisible();
  await page.getByLabel("Contraseña", { exact: true }).fill(replacement);
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByText("Tu contraseña se actualizó.")).toBeVisible();
  expect((await page.request.get("/api/resumes")).status()).toBe(401);
  expect(
    (
      await request.post("/api/auth/reset", {
        headers,
        data: { token, password },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/auth/login", {
        headers,
        data: { email, password },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/auth/login", {
        headers,
        data: { email, password: replacement },
      })
    ).status(),
  ).toBe(200);
});
