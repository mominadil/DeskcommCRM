import { randomUUID } from "node:crypto";

import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { MODELO_REVAMP_DE_SITE } from "@/lib/briefs/modelos-iniciais";
import { secoesSchema } from "@/lib/briefs/schema";
import { seBriefsDesligado } from "@/lib/briefs/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const criarSchema = z.strictObject({
  nome: z.string().trim().min(1).max(200).optional(),
  descricao: z.string().trim().max(2000).nullish(),
  secoes: secoesSchema.optional(),
  /** Start from a built-in template instead of a blank one. */
  inicial: z.enum(["revamp_de_site"]).optional(),
});

/** Creates a template: blank, from pasted JSON, or from the built-in website-revamp set. */
export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "brief_templates" });
  if (!authz.ok) return authz.response;
  const desligado = await seBriefsDesligado(requestId);
  if (desligado) return desligado;

  const parsed = criarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", "Modelo inválido.", 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }
  const base = parsed.data.inicial === "revamp_de_site" ? MODELO_REVAMP_DE_SITE : null;
  const linha = {
    organization_id: authz.org.orgId,
    nome: parsed.data.nome ?? base?.nome ?? "Novo modelo",
    descricao: parsed.data.descricao ?? base?.descricao ?? null,
    secoes: parsed.data.secoes ?? base?.secoes ?? [],
    created_by: authz.user.id,
  };
  const { data, error } = await createAdminClient().from("brief_templates").insert(linha).select("id").single();
  if (error) return fail("internal_error", "Não foi possível criar o modelo.", 500, { requestId });

  void audit({
    action: "brief_template.saved",
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    requestId,
    resourceType: "brief_template",
    resourceId: data.id,
    metadata: { criado: true, secoes: linha.secoes.length },
  });
  return ok({ id: data.id }, { requestId });
}
