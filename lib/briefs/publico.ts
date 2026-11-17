/**
 * The gate every public brief route goes through. The share token is the only
 * credential, so: refuse early when this IP (or this token value) has been
 * guessing, count every miss, and throttle writes per brief so a leaked link
 * cannot be used to fill the bucket.
 */
import "server-only";

import { headers } from "next/headers";

import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { fail } from "@/lib/api/wrappers";
import { registrarFalhaDeToken, tokenFailureLimited } from "@/lib/auth/rate-limit";
import { ipDoCliente } from "@/lib/http/ip-do-cliente";

import { briefPeloToken, type BriefCompleto } from "./servidor";

export const SEM_CACHE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" };

export async function abrirBriefPublico(
  token: string,
  requestId: string,
): Promise<{ ok: true; brief: BriefCompleto } | { ok: false; response: Response }> {
  if (await tokenFailureLimited(token)) {
    return { ok: false, response: fail("rate_limited", "Too many attempts.", 429, { requestId }) };
  }
  const brief = await briefPeloToken(token);
  if (!brief) {
    await registrarFalhaDeToken(token);
    return { ok: false, response: fail("not_found", "Not found.", 404, { requestId }) };
  }
  return { ok: true, brief };
}

/** Caps writes from one link: `limite` per minute per brief and per IP. */
export async function limitarEscrita(brief: BriefCompleto, acao: string, limite: number, requestId: string) {
  try {
    const ip = ipDoCliente(await headers()) ?? "sem-ip";
    const [porBrief, porIp] = await Promise.all([
      checkRateLimit(`brief:${acao}:${brief.id}`, limite, 60),
      checkRateLimit(`brief:${acao}:ip:${ip}`, limite, 60),
    ]);
    if (!porBrief.allowed || !porIp.allowed) {
      return fail("rate_limited", "Too many requests. Wait a moment and try again.", 429, { requestId });
    }
  } catch {
    // The limiter fails open, like the token limiter: a Redis hiccup must not lock the client out.
  }
  return null;
}
