import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { acessoDosBriefs } from "@/lib/briefs/acesso";
import { secoesSchema } from "@/lib/briefs/schema";
import { ehUuid } from "@/lib/briefs/servidor";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

import { TelaDoModelo } from "./_tela";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Modelo de briefing" };

export default async function ModeloPage({ params }: { params: Promise<{ id: string }> }) {
  const acesso = await acessoDosBriefs();
  if (!acesso.ok) redirect(acesso.error === "unauthenticated" ? "/login" : "/app");
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const t = (texto: string) => traduzir(texto, acesso.user.idioma);

  const supabase = await createClient();
  const { data: modelo } = await supabase
    .from("brief_templates")
    .select("id, nome, descricao, secoes")
    .eq("id", id)
    .eq("organization_id", acesso.org.orgId)
    .maybeSingle();
  if (!modelo) notFound();
  const secoes = secoesSchema.safeParse(modelo.secoes);

  return (
    <main className="flex h-full flex-col gap-6 md:p-6">
      <p className="text-sm text-muted-foreground">{t("Modelo de briefing")}</p>
      <TelaDoModelo
        id={modelo.id}
        nome={modelo.nome}
        descricao={modelo.descricao}
        secoes={secoes.success ? secoes.data : []}
        podeGerenciar={acesso.podeGerenciar}
      />
    </main>
  );
}
