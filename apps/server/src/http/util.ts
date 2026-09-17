/**
 * Small HTTP helpers shared by all routes.
 */
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodSchema } from "zod";
import { ProviderError } from "../providers/types";

/** Error carrying an HTTP status. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, "bad-request", message);
}

/** Wrap an async route so rejections reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** Validate a request body against a zod schema; throws a friendly 400. */
export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.length ? `${first.path.join(".")}: ` : "";
    throw badRequest(`${where}${first?.message ?? "Invalid request body"}`);
  }
  return result.data;
}

/** Central error middleware: ProviderError / HttpError / ZodError / unknown. */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ProviderError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const where = first?.path.length ? `${first.path.join(".")}: ` : "";
    res.status(400).json({ error: { code: "bad-request", message: `${where}${first?.message ?? "Invalid request"}` } });
    return;
  }
  console.error("[unlawyered] unhandled error:", err);
  res.status(500).json({ error: { code: "internal", message: "Something went wrong on the server." } });
}
