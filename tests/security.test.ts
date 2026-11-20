import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../src/server/auth";
import { limitedBody, route } from "../src/server/http";

test("passwords are salted and checked against their stored digest", async () => {
  const a = await hashPassword("Modelo de contraseña 123");
  const b = await hashPassword("Modelo de contraseña 123");
  assert.notEqual(a, b);
  assert.notEqual(a, "Modelo de contraseña 123");
  assert.ok(await verifyPassword("Modelo de contraseña 123", a));
  assert.ok(!(await verifyPassword("Modelo de contraseña 456", a)));
  assert.ok(!(await verifyPassword("Modelo de contraseña 123")));
});

test("a cross-origin state change and an oversized streamed body are rejected", async () => {
  const response = await route(async () => new Response("unexpected"))(
    new Request("http://localhost:3000/api/resumes", {
      method: "POST",
      headers: { Origin: "https://external.test" },
    }),
    { params: Promise.resolve({ path: ["resumes"] }) },
  );
  assert.equal(response.status, 403);
  const req = new Request("http://localhost:3000", {
    method: "POST",
    body: "abcdefghijklmnop",
  });
  await assert.rejects(limitedBody(req, 8), { status: 413 });
});
