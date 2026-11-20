import { randomUUID } from "node:crypto";

import { type NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { pdfDasRespostas } from "@/lib/briefs/exportar-pdf";
import { planilhaDasRespostas, type DadosDaExportacao } from "@/lib/briefs/exportar-xlsx";
import { briefDaOrganizacao, seBriefsDesligado } from "@/lib/briefs/servidor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

const STATUS: Record<string, string> = {
  rascunho: "Draft",
  enviado: "Sent",
  em_andamento: "In progress",
  concluido: "Complete",
  arquivado: "Archived",
};

/** The client's answers as a download: `?formato=pdf` or `?formato=xlsx`. */
export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "briefs" });
  if (!authz.ok) return authz.response;
  const desligado = await seBriefsDesligado(requestId);
  if (desligado) return desligado;
  const formato = req.nextUrl.searchParams.get("formato");
  if (formato !== "pdf" && formato !== "xlsx") return fail("validation_failed", "Use formato=pdf or formato=xlsx.", 422, { requestId });

  const { id } = await ctx.params;
  const brief = await briefDaOrganizacao(id, authz.org.orgId);
  if (!brief) return fail("not_found", "Not found.", 404, { requestId });

  const dados: DadosDaExportacao = {
    titulo: brief.titulo,
    cliente: brief.cliente,
    status: STATUS[brief.status] ?? brief.status,
    secoes: brief.secoes,
    respostas: brief.respostas,
  };
  const nome = `${brief.titulo}${brief.cliente ? ` - ${brief.cliente}` : ""}`.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "brief";

  let corpo: Uint8Array;
  try {
    corpo = formato === "pdf" ? await pdfDasRespostas(dados) : planilhaDasRespostas(dados);
  } catch {
    return fail("internal_error", "Could not create the file.", 500, { requestId });
  }

  void audit({
    action: "brief.exported",
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    requestId,
    resourceType: "brief",
    resourceId: brief.id,
    metadata: { exportado: formato },
  });
  return new Response(new Uint8Array(corpo), {
    headers: {
      "Content-Type":
        formato === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}-answers.${formato}"`,
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}
