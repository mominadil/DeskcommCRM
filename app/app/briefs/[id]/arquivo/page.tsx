import { notFound, redirect } from "next/navigation";

import { acessoDosBriefs } from "@/lib/briefs/acesso";
import { arquivoPertenceAoBrief, briefDaOrganizacao, linkDoArquivo } from "@/lib/briefs/servidor";

export const dynamic = "force-dynamic";

/**
 * Where the file links in a PDF or Excel export point. A page, not an API route,
 * so someone logged out is sent to the login screen and comes straight back here;
 * then a 60-second signed link opens the file.
 */
export default async function ArquivoDoBriefPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ path?: string }>;
}) {
  const acesso = await acessoDosBriefs();
  const { id } = await params;
  const { path = "" } = await searchParams;
  if (!acesso.ok) {
    redirect(`/login?next=${encodeURIComponent(`/app/briefs/${id}/arquivo?path=${encodeURIComponent(path)}`)}`);
  }
  const brief = await briefDaOrganizacao(id, acesso.org.orgId);
  if (!brief || !arquivoPertenceAoBrief(brief, path)) notFound();
  const url = await linkDoArquivo(path, 60);
  if (!url) notFound();
  redirect(url);
}
