import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { abrirBriefPublico, limitarEscrita, SEM_CACHE } from "@/lib/briefs/publico";
import { validarRespostaDaSecao } from "@/lib/briefs/schema";
import { prefixoDosArquivos } from "@/lib/briefs/servidor";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ token: string; secao: string }>;
}

/** Saves one section of the client's answers. The page calls this ~1s after the client stops typing. */
export async function PUT(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { token, secao } = await ctx.params;
  const aberto = await abrirBriefPublico(token, requestId);
  if (!aberto.ok) return aberto.response;
  // Still editable after "I'm done", as the page promises; only archived briefs are closed.
  const { brief } = aberto;
  const limitado = await limitarEscrita(brief, "secao", 60, requestId);
  if (limitado) return limitado;

  const definicao = brief.secoes.find((s) => s.id === secao);
  if (!definicao) return fail("not_found", "Not found.", 404, { requestId });

  const validado = validarRespostaDaSecao(definicao, await req.json().catch(() => null), prefixoDosArquivos(brief));
  if (!validado.ok) return fail("validation_failed", validado.erro, 422, { requestId });

  const { data, error } = await createAdminClient().rpc("fn_brief_salvar_secao", {
    p_token: token,
    p_secao: secao,
    p_dados: validado.resposta,
  });
  if (error || data !== true) return fail("internal_error", "Could not save.", 500, { requestId });
  return NextResponse.json({ ok: true, updatedAt: validado.resposta.updatedAt }, { headers: SEM_CACHE });
}
