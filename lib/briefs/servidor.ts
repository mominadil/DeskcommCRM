/**
 * Server-side helpers shared by the staff routes, the public link and the pages.
 * Everything that reads a brief by its share token uses the admin client: the
 * person on the other end has no session, and the token is the only key.
 */
import "server-only";

import { fail } from "@/lib/api/wrappers";
import { moduloLigado } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";

import { secoesSchema, type RespostaDaSecao, type Secao } from "./schema";

export const BUCKET_DOS_BRIEFS = "briefs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StatusDoBrief = "rascunho" | "enviado" | "em_andamento" | "concluido" | "arquivado";

export type BriefCompleto = {
  id: string;
  organization_id: string;
  titulo: string;
  cliente: string | null;
  intro: string | null;
  secoes: Secao[];
  respostas: Record<string, RespostaDaSecao | undefined>;
  status: StatusDoBrief;
  share_token: string;
  concluido_em: string | null;
  updated_at: string;
};

const COLUNAS = "id, organization_id, titulo, cliente, intro, secoes, respostas, status, share_token, concluido_em, updated_at";

export async function briefsLigado(): Promise<boolean> {
  return moduloLigado(createAdminClient(), "briefs");
}

/** 404 for every staff route while the module is not installed. */
export async function seBriefsDesligado(requestId: string): Promise<Response | null> {
  if (await briefsLigado()) return null;
  return fail("not_found", "Not found.", 404, { requestId });
}

export function ehUuid(valor: string | null | undefined): valor is string {
  return !!valor && UUID.test(valor);
}

function normalizar(linha: Record<string, unknown>): BriefCompleto {
  const secoes = secoesSchema.safeParse(linha.secoes);
  return {
    ...(linha as unknown as BriefCompleto),
    secoes: secoes.success ? secoes.data : [],
    respostas: (linha.respostas as BriefCompleto["respostas"]) ?? {},
  };
}

/** The brief behind a public link, or null when the token is unknown or the brief is archived. */
export async function briefPeloToken(token: string): Promise<BriefCompleto | null> {
  if (!ehUuid(token) || !(await briefsLigado())) return null;
  const { data, error } = await createAdminClient()
    .from("briefs")
    .select(COLUNAS)
    .eq("share_token", token)
    .neq("status", "arquivado")
    .maybeSingle();
  if (error || !data) return null;
  return normalizar(data);
}

/** A brief of the given organization, read with the admin client after the caller checked the role. */
export async function briefDaOrganizacao(id: string, orgId: string): Promise<BriefCompleto | null> {
  if (!ehUuid(id)) return null;
  const { data, error } = await createAdminClient()
    .from("briefs")
    .select(COLUNAS)
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error || !data) return null;
  return normalizar(data);
}

/** Every upload of a brief lives under `<org>/<brief>/`; the answer validator holds files to it. */
export function prefixoDosArquivos(brief: Pick<BriefCompleto, "organization_id" | "id">): string {
  return `${brief.organization_id}/${brief.id}/`;
}

/** A short-lived link to download one uploaded file. */
export async function linkDoArquivo(path: string, segundos = 600): Promise<string | null> {
  const { data, error } = await createAdminClient().storage.from(BUCKET_DOS_BRIEFS).createSignedUrl(path, segundos);
  return error ? null : data.signedUrl;
}

/** True when the path is one of the files recorded in the brief's answers. */
export function arquivoPertenceAoBrief(brief: BriefCompleto, path: string): boolean {
  return Object.values(brief.respostas).some((r) =>
    Object.values(r?.files ?? {}).some((lista) => lista.some((a) => a.path === path)),
  );
}

export function contarArquivos(brief: BriefCompleto): number {
  return Object.values(brief.respostas).reduce(
    (n, r) => n + Object.values(r?.files ?? {}).reduce((m, lista) => m + lista.length, 0),
    0,
  );
}

export const MAX_ARQUIVOS_POR_BRIEF = 300;
