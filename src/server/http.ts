import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const route =
  (handler: (req: Request, path: string[]) => Promise<Response>) =>
  async (req: Request, ctx: { params: Promise<{ path: string[] }> }) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const expected = process.env.APP_ORIGIN
          ? new URL(process.env.APP_ORIGIN).origin
          : new URL(req.url).origin;
        if (req.headers.get("origin") !== expected)
          throw new HttpError(403, "Origen de la solicitud inválido.");
      }
      return await handler(req, (await ctx.params).path);
    } catch (error) {
      if (error instanceof HttpError)
        return json({ error: error.message }, error.status);
      if (error instanceof ZodError)
        return json(
          {
            error: "Revisa los campos indicados.",
            fields: error.issues.map((e) => ({
              path: e.path.join("."),
              message: e.message,
            })),
          },
          422,
        );
      if (error instanceof SyntaxError)
        return json({ error: "La solicitud no es válida." }, 400);
      console.error(
        "Error de servidor",
        error instanceof Error ? error.name : "UnknownError",
      );
      return json(
        {
          error:
            "El servicio no pudo completar la operación. Inténtalo de nuevo.",
        },
        500,
      );
    }
  };

export async function limitedBody(req: Request, maxBytes: number) {
  if (Number(req.headers.get("content-length")) > maxBytes)
    throw new HttpError(413, "La solicitud supera el límite de tamaño.");
  if (!req.body) return Buffer.alloc(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "La solicitud supera el límite de tamaño.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function body(req: Request) {
  if (req.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw new HttpError(415, "Usa application/json.");
  return JSON.parse(
    (await limitedBody(req, 256 * 1024)).toString("utf8"),
  ) as unknown;
}
