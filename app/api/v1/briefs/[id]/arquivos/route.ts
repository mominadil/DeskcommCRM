import { randomUUID } from "node:crypto";

import { type NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { arquivosNoZip, zipEmStream } from "@/lib/briefs/arquivos-zip";
import { disposicaoDoDownload } from "@/lib/briefs/nome-do-download";
import { BUCKET_DOS_BRIEFS, briefDaOrganizacao, prefixoDosArquivos, seBriefsDesligado } from "@/lib/briefs/servidor";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/** Every file the client uploaded, as one ZIP with a folder per section and question. */
export async function GET(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "briefs" });
  if (!authz.ok) return authz.response;
  const desligado = await seBriefsDesligado(requestId);
  if (desligado) return desligado;
  const { id } = await ctx.params;
  const brief = await briefDaOrganizacao(id, authz.org.orgId);
  if (!brief) return fail("not_found", "Not found.", 404, { requestId });

  // Only files under this brief's own folder: the answers JSON is client-written.
  const prefixo = prefixoDosArquivos(brief);
  const arquivos = arquivosNoZip(brief.secoes, brief.respostas).filter((a) => a.path.startsWith(prefixo));
  if (!arquivos.length) return fail("not_found", "This brief has no uploaded files.", 404, { requestId });

  const storage = createAdminClient().storage.from(BUCKET_DOS_BRIEFS);
  const corpo = zipEmStream(arquivos, async (path) => {
    const { data, error } = await storage.download(path);
    return error || !data ? null : new Uint8Array(await data.arrayBuffer());
  });

  void audit({
    action: "brief.exported",
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    requestId,
    resourceType: "brief",
    resourceId: brief.id,
    metadata: { exportado: "zip", arquivos: arquivos.length },
  });
  return new Response(corpo, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": disposicaoDoDownload(brief.titulo, brief.cliente, "files.zip"),
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}
