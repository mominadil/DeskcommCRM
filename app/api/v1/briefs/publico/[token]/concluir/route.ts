import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { abrirBriefPublico, limitarEscrita, SEM_CACHE } from "@/lib/briefs/publico";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ token: string }>;
}

/** The client's "I'm done" button. They can keep editing afterwards; the team sees the brief as complete. */
export async function POST(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { token } = await ctx.params;
  const aberto = await abrirBriefPublico(token, requestId);
  if (!aberto.ok) return aberto.response;
  const { brief } = aberto;
  const limitado = await limitarEscrita(brief, "concluir", 5, requestId);
  if (limitado) return limitado;

  const agora = new Date().toISOString();
  const { error } = await createAdminClient()
    .from("briefs")
    .update({ status: "concluido", concluido_em: brief.concluido_em ?? agora, updated_at: agora })
    .eq("id", brief.id);
  if (error) return fail("internal_error", "That didn’t go through. Please try again in a moment.", 500, { requestId });

  if (brief.status !== "concluido") {
    void audit({
      action: "brief.completed_by_client",
      organizationId: brief.organization_id,
      requestId,
      resourceType: "brief",
      resourceId: brief.id,
      bypassedRls: true,
    });
  }
  return NextResponse.json({ ok: true, concluidoEm: brief.concluido_em ?? agora }, { headers: SEM_CACHE });
}
