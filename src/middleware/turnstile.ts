import type { Request, Response, NextFunction } from "express";

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "";

function getIp(req: Request) {
  const xf = (req.headers["x-forwarded-for"] as string) || "";
  return xf.split(",")[0]?.trim() || req.socket.remoteAddress || "";
}

export async function verifyTurnstile(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!TURNSTILE_SECRET_KEY) {
      return res
        .status(500)
        .json({ message: "TURNSTILE_SECRET_KEY no configurado" });
    }

    const token = String(req.body?.cf_turnstile_response || "").trim();
    if (!token) {
      return res.status(400).json({ message: "Falta cf_turnstile_response" });
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

    const data = await r.json();

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
