import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { arquivoPertenceAoBrief, briefDaOrganizacao, linkDoArquivo, seBriefsDesligado } from "@/lib/briefs/servidor";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/** Staff download of one file the client uploaded: a 60-second signed link, only for files recorded on this brief. */
export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "briefs" });
  if (!authz.ok) return authz.response;
  const desligado = await seBriefsDesligado(requestId);
  if (desligado) return desligado;
  const { id } = await ctx.params;
  const path = req.nextUrl.searchParams.get("path") ?? "";
  const brief = await briefDaOrganizacao(id, authz.org.orgId);
  if (!brief || !arquivoPertenceAoBrief(brief, path)) return fail("not_found", "Not found.", 404, { requestId });

  const url = await linkDoArquivo(path, 60);
  if (!url) return fail("internal_error", "Não foi possível abrir o arquivo.", 500, { requestId });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
