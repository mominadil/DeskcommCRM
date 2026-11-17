import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { acessoDosBriefs } from "@/lib/briefs/acesso";
import { briefDaOrganizacao } from "@/lib/briefs/servidor";

import { TelaDoBrief } from "./_tela";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Briefing" };

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const acesso = await acessoDosBriefs();
  if (!acesso.ok) redirect(acesso.error === "unauthenticated" ? "/login" : "/app");
  const { id } = await params;
  // Read with the admin client, scoped to the session's organization (the role gate is `acessoDosBriefs`).
  const brief = await briefDaOrganizacao(id, acesso.org.orgId);
  if (!brief) notFound();

  return (
    <main className="flex h-full flex-col gap-6 md:p-6">
      <TelaDoBrief brief={brief} podeEditar={acesso.podeEditar} podeGerenciar={acesso.podeGerenciar} />
    </main>
  );
}
