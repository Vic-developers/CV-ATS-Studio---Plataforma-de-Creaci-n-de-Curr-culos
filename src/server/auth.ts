import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { z } from "@/domain/validation";
import nodemailer from "nodemailer";
import { db } from "./db";
import { body, HttpError, json } from "./http";

const derive = promisify(scrypt);
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("base64url");
const sessionName = () =>
  process.env.NODE_ENV === "production" ? "__Host-cv_session" : "cv_session";
const cookieOptions = () => ({
  path: "/",
  secure: process.env.NODE_ENV === "production",
  httpOnly: true,
  sameSite: "lax" as const,
});
const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((x) => x.toLowerCase());
const password = z.string().min(12).max(128);
const credentials = z.object({ email, password });
const days = 1000 * 60 * 60 * 24;
const noUserSalt = "ef92aa25a2c6b5195a06cd20d4608e01";
export async function hashPassword(value: string) {
  const salt = randomBytes(16).toString("hex");
  return (
    salt + ":" + ((await derive(value, salt, 64)) as Buffer).toString("hex")
  );
}
export async function verifyPassword(value: string, stored?: string) {
  const [salt, hex] = stored?.split(":") ?? [noUserSalt, "00".repeat(64)];
  const expected = Buffer.from(hex, "hex");
  const actual = (await derive(value, salt, 64)) as Buffer;
  return Boolean(
    stored &&
      expected.length === actual.length &&
      timingSafeEqual(actual, expected),
  );
}
export async function currentUser() {
  const token = (await cookies()).get(sessionName())?.value;
  if (!token || !/^[\w-]{43}$/.test(token)) return null;
  const session = await db.session.findUnique({
    where: { token: digest(token) },
    include: { user: { select: { id: true, email: true } } },
  });
  return session && session.expires > new Date() ? session.user : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Inicia sesión para continuar.");
  return user;
}
async function issueSession(userId: string) {
  const jar = await cookies();
  const previous = jar.get(sessionName())?.value;
  const value = secret();
  const expires = new Date(Date.now() + 14 * days);
  await db.$transaction(async (tx) => {
    if (previous)
      await tx.session.deleteMany({ where: { token: digest(previous) } });
    await tx.session.create({
      data: { userId, token: digest(value), expires },
    });
  });
  jar.set(sessionName(), value, { ...cookieOptions(), expires });
}
export async function rate(key: string, maximum: number, windowMs: number) {
  const start = Math.floor(Date.now() / windowMs);
  const id = digest(key + ":" + start);
  const result = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("id", "count", "expires") VALUES (${id}, 1, ${new Date((start + 1) * windowMs)})
    ON CONFLICT ("id") DO UPDATE SET "count" = "RateLimit"."count" + 1 RETURNING "count"`;
  if (result[0].count > maximum)
    throw new HttpError(429, "Demasiados intentos. Inténtalo más tarde.");
}
export async function auth(req: Request, action: string) {
  if (req.method === "GET" && action === "session")
    return json({ user: await currentUser() });
  if (req.method !== "POST") throw new HttpError(405, "Método no permitido.");
  if (action === "logout") {
    const jar = await cookies(),
      token = jar.get(sessionName())?.value;
    if (token) await db.session.deleteMany({ where: { token: digest(token) } });
    jar.set(sessionName(), "", { ...cookieOptions(), maxAge: 0 });
    return json({ ok: true });
  }
  const network =
    process.env.TRUST_PROXY === "true"
      ? (req.headers.get("x-real-ip")?.slice(0, 80) ?? "default")
      : "default";
  await rate(
    "auth:" + action + ":" + network,
    network === "default" ? 150 : 40,
    15 * 60_000,
  );
  const input = await body(req);
  if (action === "register" || action === "login") {
    const parsed = credentials.parse(input);
    await rate(action + ":" + parsed.email, 10, 15 * 60_000);
    let user;
    if (action === "register") {
      const hashed = await hashPassword(parsed.password);
      try {
        user = await db.user.create({
          data: { email: parsed.email, password: hashed },
        });
      } catch (error) {
        if ((error as { code?: string }).code === "P2002")
          throw new HttpError(409, "No se pudo registrar ese correo.");
        throw error;
      }
    } else {
      user = await db.user.findUnique({ where: { email: parsed.email } });
      if (!(await verifyPassword(parsed.password, user?.password)) || !user)
        throw new HttpError(401, "Correo o contraseña incorrectos.");
    }
    await issueSession(user.id);
    return json(
      { user: { id: user.id, email: user.email } },
      action === "register" ? 201 : 200,
    );
  }
  if (action === "forgot") {
    const parsed = z.object({ email }).parse(input);
    if (
      !process.env.SMTP_URL ||
      !process.env.SMTP_FROM ||
      !process.env.APP_ORIGIN
    )
      throw new HttpError(
        503,
        "La recuperación por correo aún no está configurada.",
      );
    await rate("reset:" + parsed.email, 4, 60 * 60_000);
    const user = await db.user.findUnique({ where: { email: parsed.email } });
    if (user) {
      const token = secret();
      await db.passwordReset.create({
        data: {
          userId: user.id,
          token: digest(token),
          expires: new Date(Date.now() + 30 * 60_000),
        },
      });
      const url = new URL("/recuperar", process.env.APP_ORIGIN);
      url.hash = token;
      await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: "Restablece tu contraseña de CV ATS Studio",
        text:
          "Abre este enlace dentro de 30 minutos para elegir una contraseña nueva:\n" +
          url,
      });
    }
    return json({ ok: true });
  }
  if (action === "reset") {
    const parsed = z
      .object({ token: z.string().regex(/^[\w-]{43}$/), password })
      .parse(input);
    const hash = digest(parsed.token);
    const reset = await db.passwordReset.findUnique({ where: { token: hash } });
    if (!reset || reset.expires <= new Date())
      throw new HttpError(400, "El enlace no es válido o venció.");
    const replacement = await hashPassword(parsed.password);
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: reset.userId },
        data: { password: replacement },
      });
      const claim = await tx.passwordReset.deleteMany({
        where: { token: hash, expires: { gt: new Date() } },
      });
      if (!claim.count)
        throw new HttpError(400, "El enlace ya no está disponible.");
      await tx.passwordReset.deleteMany({ where: { userId: reset.userId } });
      await tx.session.deleteMany({ where: { userId: reset.userId } });
    });
    return json({ ok: true });
  }
  throw new HttpError(404, "Operación no encontrada.");
}
