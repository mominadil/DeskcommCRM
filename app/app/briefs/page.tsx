import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { acessoDosBriefs } from "@/lib/briefs/acesso";
import { progressoDoBrief, secoesSchema, type RespostaDaSecao } from "@/lib/briefs/schema";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

import { ListaDeBriefs, type BriefNaLista, type ModeloNaLista } from "./_lista";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Briefs" };

export default async function BriefsPage() {
  const acesso = await acessoDosBriefs();
  if (!acesso.ok) redirect(acesso.error === "unauthenticated" ? "/login" : "/app");
  const t = (texto: string) => traduzir(texto, acesso.user.idioma);
  const org = acesso.org.orgId;

  const supabase = await createClient();
  const [{ data: briefs }, { data: modelos }] = await Promise.all([
    supabase
      .from("briefs")
      .select("id, titulo, cliente, status, updated_at, secoes, respostas")
      .eq("organization_id", org)
      .neq("status", "arquivado")
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("brief_templates")
      .select("id, nome, descricao, secoes, updated_at")
      .eq("organization_id", org)
      .order("nome"),
  ]);

  const lista: BriefNaLista[] = (briefs ?? []).map((b) => {
    const secoes = secoesSchema.safeParse(b.secoes);
    const p = progressoDoBrief(secoes.success ? secoes.data : [], (b.respostas ?? {}) as Record<string, RespostaDaSecao>);
    return {
      id: b.id,
      titulo: b.titulo,
      cliente: b.cliente,
      status: b.status,
      updatedAt: b.updated_at,
      respondidas: p.respondidas,
      total: p.total,
    };
  });
  const listaDeModelos: ModeloNaLista[] = (modelos ?? []).map((m) => ({
    id: m.id,
    nome: m.nome,
    descricao: m.descricao,
    perguntas: Array.isArray(m.secoes)
      ? (m.secoes as { q?: unknown[] }[]).reduce((n, s) => n + (s.q?.length ?? 0), 0)
      : 0,
  }));

  return (
    <main className="flex h-full flex-col gap-6 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Briefings")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Questionários de requisitos que o cliente responde por um link, sem login.")}
        </p>
      </header>
      <ListaDeBriefs
        briefs={lista}
        modelos={listaDeModelos}
        podeEditar={acesso.podeEditar}
        podeGerenciar={acesso.podeGerenciar}
      />
    </main>
  );
}
