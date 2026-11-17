import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { abrirBriefPublico } from "@/lib/briefs/publico";
import { arquivoPertenceAoBrief, linkDoArquivo } from "@/lib/briefs/servidor";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ token: string }>;
}

/** Thumbnail or download of a file the client already uploaded to this brief. */
export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { token } = await ctx.params;
  const aberto = await abrirBriefPublico(token, requestId);
  if (!aberto.ok) return aberto.response;
  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!arquivoPertenceAoBrief(aberto.brief, path)) return fail("not_found", "Not found.", 404, { requestId });
  const url = await linkDoArquivo(path, 300);
  if (!url) return fail("internal_error", "Could not open the file.", 500, { requestId });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
