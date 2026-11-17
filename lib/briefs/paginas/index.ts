/**
 * Briefs that open on a hand-made page instead of the standard one.
 *
 * shortcut: a fixed list keyed by brief id, for the Aumera brief only; move this to a
 * `tema` column on `briefs` when a second client needs a custom page.
 */
import "server-only";

import type { BriefCompleto } from "../servidor";

import { AUMERA_HTML, AUMERA_SCRIPT } from "./aumera";

const PAGINAS: Record<string, { html: string; script: string }> = {
  // Aumèra · Website revamp: getting to know you (17 Nov 2026).
  "dfc1d95e-1cda-488e-baab-918c89cd6ac3": { html: AUMERA_HTML, script: AUMERA_SCRIPT },
};

export function temPaginaPropria(briefId: string): boolean {
  return briefId in PAGINAS;
}

/** The page with the brief's questions and saved answers inlined. `<` is escaped so an answer can never close the script tag. */
export function paginaPropria(brief: BriefCompleto, token: string): string | null {
  const pagina = PAGINAS[brief.id];
  if (!pagina) return null;
  const dados = JSON.stringify({
    token,
    secoes: brief.secoes,
    respostas: brief.respostas,
    concluidoEm: brief.status === "concluido" ? brief.concluido_em : null,
  }).replace(/</g, "\\u003c");
  const script = pagina.script.replace(/<\/script/gi, "<\\/script");
  return pagina.html.replace("<!--BRIEF_SCRIPT-->", `<script>window.__BRIEF__=${dados};</script>\n<script>${script}</script>`);
}
