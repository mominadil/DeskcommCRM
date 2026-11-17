import { randomUUID } from "node:crypto";

import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, noContent } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { secoesSchema } from "@/lib/briefs/schema";
import { BUCKET_DOS_BRIEFS, briefDaOrganizacao, prefixoDosArquivos, seBriefsDesligado } from "@/lib/briefs/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

const salvarSchema = z.strictObject({
  titulo: z.string().trim().min(1).max(200).optional(),
  cliente: z.string().trim().max(200).nullish(),
  intro: z.string().trim().max(4000).nullish(),
  secoes: secoesSchema.optional(),
  status: z.enum(["rascunho", "enviado", "em_andamento", "concluido", "arquivado"]).optional(),
  /** Replaces the share token: the old link stops working at once. */
  renovar_link: z.literal(true).optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "briefs" });
  if (!authz.ok) return authz.response;
  const desligado = await seBriefsDesligado(requestId);
  if (desligado) return desligado;
  const { id } = await ctx.params;

  const parsed = salvarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", "Briefing inválido.", 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }
  const brief = await briefDaOrganizacao(id, authz.org.orgId);
  if (!brief) return fail("not_found", "Not found.", 404, { requestId });

  const { renovar_link, ...campos } = parsed.data;
  const mudanca: Record<string, unknown> = { ...campos, updated_at: new Date().toISOString() };
  if (renovar_link) mudanca.share_token = randomUUID();
  if (campos.status === "concluido" && brief.status !== "concluido") mudanca.concluido_em = new Date().toISOString();
  if (campos.status && campos.status !== "concluido") mudanca.concluido_em = null;

  const { data, error } = await createAdminClient()
    .from("briefs")
    .update(mudanca)
    .eq("id", brief.id)
    .eq("organization_id", authz.org.orgId)
    .select("share_token, status")
    .single();
  if (error) return fail("internal_error", "Não foi possível salvar o briefing.", 500, { requestId });

  void audit({
    action: renovar_link ? "brief.link_renewed" : "brief.updated",
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    requestId,
    resourceType: "brief",
    resourceId: brief.id,
    metadata: { campos: Object.keys(campos), status: campos.status ?? null },
  });
  return ok({ share_token: data.share_token, status: data.status }, { requestId });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "briefs" });
  if (!authz.ok) return authz.response;
  const desligado = await seBriefsDesligado(requestId);
  if (desligado) return desligado;
  const { id } = await ctx.params;
  const brief = await briefDaOrganizacao(id, authz.org.orgId);
  if (!brief) return fail("not_found", "Not found.", 404, { requestId });

  const admin = createAdminClient();
  // The client's files go with the brief: nothing else points at them.
  const caminhos = Object.values(brief.respostas).flatMap((r) =>
    Object.values(r?.files ?? {}).flatMap((lista) => lista.map((a) => a.path)),
  );
  const prefixo = prefixoDosArquivos(brief);
  const doBrief = caminhos.filter((c) => c.startsWith(prefixo));
  if (doBrief.length) await admin.storage.from(BUCKET_DOS_BRIEFS).remove(doBrief);

  const { error } = await admin.from("briefs").delete().eq("id", brief.id).eq("organization_id", authz.org.orgId);
  if (error) return fail("internal_error", "Não foi possível apagar o briefing.", 500, { requestId });

  void audit({
    action: "brief.deleted",
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    requestId,
    resourceType: "brief",
    resourceId: brief.id,
    metadata: { arquivos: doBrief.length },
  });
  return noContent(requestId);
}
