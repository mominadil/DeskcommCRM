import { randomUUID } from "node:crypto";

import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { secoesSchema } from "@/lib/briefs/schema";
import { seBriefsDesligado } from "@/lib/briefs/servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const criarSchema = z.strictObject({
  titulo: z.string().trim().min(1).max(200),
  cliente: z.string().trim().max(200).nullish(),
  template_id: z.uuid().nullish(),
});

/** Creates a brief for a client project, copying the template's questions so later template edits don't change it. */
export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "briefs" });
  if (!authz.ok) return authz.response;
  const desligado = await seBriefsDesligado(requestId);
  if (desligado) return desligado;

  const parsed = criarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", "Dê um título ao briefing.", 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }
  const admin = createAdminClient();
  let secoes: unknown = [];
  if (parsed.data.template_id) {
    const { data: modelo } = await admin
      .from("brief_templates")
      .select("secoes")
      .eq("id", parsed.data.template_id)
      .eq("organization_id", authz.org.orgId)
      .maybeSingle();
    if (!modelo) return fail("not_found", "Modelo não encontrado.", 404, { requestId });
    secoes = modelo.secoes;
  }
  const validas = secoesSchema.safeParse(secoes);
  const { data, error } = await admin
    .from("briefs")
    .insert({
      organization_id: authz.org.orgId,
      template_id: parsed.data.template_id ?? null,
      titulo: parsed.data.titulo,
      cliente: parsed.data.cliente ?? null,
      secoes: validas.success ? validas.data : [],
      created_by: authz.user.id,
    })
    .select("id")
    .single();
  if (error) return fail("internal_error", "Não foi possível criar o briefing.", 500, { requestId });

  void audit({
    action: "brief.created",
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    requestId,
    resourceType: "brief",
    resourceId: data.id,
    metadata: { template_id: parsed.data.template_id ?? null },
  });
  return ok({ id: data.id }, { requestId });
}
