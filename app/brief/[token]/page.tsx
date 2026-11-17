import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { registrarFalhaDeToken, tokenFailureLimited } from "@/lib/auth/rate-limit";
import { temPaginaPropria } from "@/lib/briefs/paginas";
import { briefPeloToken } from "@/lib/briefs/servidor";
import { marcaDaSaida } from "@/lib/branding/saida";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";
import { createAdminClient } from "@/lib/supabase/admin";

import { FormularioDoBrief } from "./_formulario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Brief",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * The client's side of a brief: no login, the UUID in the address is the key.
 * Rendered outside `/app`, so neither the app shell nor onboarding touches it,
 * and in the language of the organization that sent it.
 */
export default async function BriefPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (await tokenFailureLimited(token)) notFound();
  const brief = await briefPeloToken(token);
  if (!brief) {
    await registrarFalhaDeToken(token);
    notFound();
  }
  if (temPaginaPropria(brief.id)) redirect(`/brief/${token}/original`);

  const [{ data: organizacao }, marca] = await Promise.all([
    createAdminClient().from("organizations").select("locale").eq("id", brief.organization_id).maybeSingle(),
    marcaDaSaida(brief.organization_id),
  ]);

  return (
    <IdiomaProvider locale={(organizacao?.locale as string | null) ?? null}>
      <FormularioDoBrief
        token={token}
        titulo={brief.titulo}
        cliente={brief.cliente}
        intro={brief.intro}
        secoes={brief.secoes}
        respostasIniciais={brief.respostas}
        concluidoEm={brief.status === "concluido" ? brief.concluido_em : null}
        marca={{ nome: marca.nome, logoUrl: marca.logoUrl, accent: marca.accent }}
      />
    </IdiomaProvider>
  );
}
