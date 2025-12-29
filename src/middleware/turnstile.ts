// src/middleware/turnstile.ts
import type { Request, Response, NextFunction } from "express";

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "";
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";

function getIp(req: Request) {
  // Soporta proxies (Easypanel / Nginx / Cloudflare)
  const xf = (req.headers["x-forwarded-for"] as string) || "";
  const xr = (req.headers["x-real-ip"] as string) || "";
  return (
    xf.split(",")[0]?.trim() ||
    xr.trim() ||
    req.socket.remoteAddress ||
    ""
  );
}

export async function verifyTurnstile(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // ✅ En DEV: no bloquees el flujo (login/register) si Turnstile falla o no está
    if (!IS_PROD) {
      (req as any).turnstile = {
        bypass: true,
        success: true,
        reason: "TURNSTILE bypass en development",
      };
      return next();
    }

    // ✅ En PROD: debe existir secret
    if (!TURNSTILE_SECRET_KEY) {
      return res
        .status(500)
        .json({ message: "TURNSTILE_SECRET_KEY no configurado" });
    }

    // ✅ Turnstile puede llegar con estos nombres
    const token =
      String(req.body?.cf_turnstile_response || "").trim() ||
      String(req.body?.["cf-turnstile-response"] || "").trim();

    if (!token) {
      return res.status(400).json({
        message: "Falta token Turnstile",
        hint: "Envía cf_turnstile_response o cf-turnstile-response",
      });
    }

    const form = new URLSearchParams();
    form.append("secret", TURNSTILE_SECRET_KEY);
    form.append("response", token);

    const ip = getIp(req);
    if (ip) form.append("remoteip", ip);

    const r = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      }
    );

    const data: any = await r.json();

    if (!data?.success) {
      return res.status(403).json({
        message: "Captcha inválido",
        codes: data?.["error-codes"] || [],
      });
    }

    (req as any).turnstile = data;
    return next();
  } catch (e) {
    console.error("[turnstile]", e);
    return res.status(500).json({ message: "Error validando Turnstile" });
  }
}
