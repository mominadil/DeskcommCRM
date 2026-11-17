import "server-only";

import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK, type Role } from "@/lib/auth/types";

/**
 * Who is looking at the Briefs screens and what they may do. Viewers read;
 * agents create and edit briefs; managers also build templates and delete.
 * The API enforces the same ranks with `requireRole`; this only shapes the screen.
 */
export async function acessoDosBriefs() {
  const user = await loadAuthUser();
  if (!user) return { ok: false as const, error: "unauthenticated" as const };
  const org = await resolveActiveOrg(user);
  if (!org) return { ok: false as const, error: "no_org" as const };
  const rank = ROLE_RANK[org.role as Role] ?? 0;
  return {
    ok: true as const,
    user,
    org,
    podeEditar: rank >= ROLE_RANK.agent,
    podeGerenciar: rank >= ROLE_RANK.manager,
  };
}
