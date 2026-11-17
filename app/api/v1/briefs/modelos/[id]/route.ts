import { randomUUID } from "node:crypto";

import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail, noContent } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { secoesSchema } from "@/lib/briefs/schema";
import { ehUuid, seBriefsDesligado } from "@/lib/briefs/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

const salvarSchema = z.strictObject({
  nome: z.string().trim().min(1).max(200).optional(),
  descricao: z.string().trim().max(2000).nullish(),
  secoes: secoesSchema.optional(),
});

export async function PATCH(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "brief_templates" });
  if (!authz.ok) return authz.response;
  const desligado = await seBriefsDesligado(requestId);
  if (desligado) return desligado;
  const { id } = await ctx.params;
  if (!ehUuid(id)) return fail("not_found", "Not found.", 404, { requestId });

  const parsed = salvarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", "Modelo inválido.", 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }
  const { data, error } = await createAdminClient()
    .from("brief_templates")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select("id")
    .maybeSingle();
  if (error) return fail("internal_error", "Não foi possível salvar o modelo.", 500, { requestId });
  if (!data) return fail("not_found", "Not found.", 404, { requestId });

  void audit({
    action: "brief_template.saved",
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    requestId,
    resourceType: "brief_template",
    resourceId: id,
    metadata: { secoes: parsed.data.secoes?.length ?? null },
  });
  return ok({ id }, { requestId });
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "brief_templates" });
  if (!authz.ok) return authz.response;
  const desligado = await seBriefsDesligado(requestId);
  if (desligado) return desligado;
  const { id } = await ctx.params;
  if (!ehUuid(id)) return fail("not_found", "Not found.", 404, { requestId });

  // Briefs made from it keep their own copy of the questions (`template_id` goes null).
  const { error } = await createAdminClient()
    .from("brief_templates")
    .delete()
    .eq("id", id)
    .eq("organization_id", authz.org.orgId);
  if (error) return fail("internal_error", "Não foi possível apagar o modelo.", 500, { requestId });

  void audit({
    action: "brief_template.deleted",
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    requestId,
    resourceType: "brief_template",
    resourceId: id,
  });
  return noContent(requestId);
}
