import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { fail } from "@/lib/api/wrappers";
import { abrirBriefPublico, limitarEscrita, SEM_CACHE } from "@/lib/briefs/publico";
import { MAX_ARQUIVOS_POR_PERGUNTA } from "@/lib/briefs/schema";
import {
  BUCKET_DOS_BRIEFS,
  MAX_ARQUIVOS_POR_BRIEF,
  contarArquivos,
  prefixoDosArquivos,
} from "@/lib/briefs/servidor";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ token: string }>;
}

const pedidoSchema = z.strictObject({
  secao: z.string().regex(/^[a-z0-9_-]{1,64}$/),
  pergunta: z.string().regex(/^[a-z0-9_-]{1,64}$/),
  nome: z.string().trim().min(1).max(255),
  tamanho: z.number().int().min(1).max(20 * 1024 * 1024),
});

/**
 * Hands the browser a one-time signed upload URL. The file goes straight to
 * Supabase Storage, so 20 MB bodies never pass through the app container; the
 * bucket itself enforces the size and type limits. The page then records the
 * file in the section's answers, where the path prefix is checked again.
 */
export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { token } = await ctx.params;
  const aberto = await abrirBriefPublico(token, requestId);
  if (!aberto.ok) return aberto.response;
  const { brief } = aberto;
  const limitado = await limitarEscrita(brief, "upload", 30, requestId);
  if (limitado) return limitado;

  const parsed = pedidoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Invalid upload request.", 422, { requestId });
  const { secao, pergunta, nome } = parsed.data;
  const definicao = brief.secoes.find((s) => s.id === secao)?.q.find((p) => p.id === pergunta);
  if (!definicao || definicao.type !== "file") return fail("not_found", "Not found.", 404, { requestId });

  const naPergunta = brief.respostas[secao]?.files[pergunta]?.length ?? 0;
  if (naPergunta >= MAX_ARQUIVOS_POR_PERGUNTA || contarArquivos(brief) >= MAX_ARQUIVOS_POR_BRIEF) {
    return fail("limit_reached", "This question already has the maximum number of files. Add a link instead.", 409, { requestId });
  }

  const limpo = nome.normalize("NFKD").replace(/[^\w.-]+/g, "_").replace(/^\.+/, "").slice(-120) || "file";
  const path = `${prefixoDosArquivos(brief)}${secao}/${pergunta}/${randomUUID()}-${limpo}`;
  const { data, error } = await createAdminClient().storage.from(BUCKET_DOS_BRIEFS).createSignedUploadUrl(path);
  if (error || !data) return fail("internal_error", "Could not start the upload.", 500, { requestId });

  return NextResponse.json({ ok: true, path, url: data.signedUrl }, { headers: SEM_CACHE });
}
