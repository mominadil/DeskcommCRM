/**
 * Every file a client uploaded to a brief, as one ZIP filed by question:
 * `08 Photos and files/8.1 Logo in high quality/IMG_7838.png`. Streamed one file
 * at a time (stored, not recompressed: photos and PDFs are already compressed),
 * so a brief with hundreds of MB of photos never sits in the app's memory at once.
 */
import { Zip, ZipPassThrough } from "fflate";

import type { RespostaDaSecao, Secao } from "./schema";

export type ArquivoNoZip = { path: string; nome: string };

// Characters Windows and macOS refuse in a file or folder name, plus control characters.
const PROIBIDOS = /[\u0000-\u001F<>:"/\\|?*]+/g;
const limpo = (s: string, max: number) =>
  s.replace(PROIBIDOS, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "").slice(0, max).trim() || "file";

/** Where each uploaded file goes inside the ZIP, in brief order, with duplicate names numbered. */
export function arquivosNoZip(secoes: Secao[], respostas: Record<string, RespostaDaSecao | undefined>): ArquivoNoZip[] {
  const lista: ArquivoNoZip[] = [];
  secoes.forEach((s, si) => {
    const pastaDaSecao = `${String(si + 1).padStart(2, "0")} ${limpo(s.t, 50)}`;
    s.q.forEach((p, qi) => {
      const arquivos = respostas[s.id]?.files[p.id] ?? [];
      if (!arquivos.length) return;
      const pasta = `${pastaDaSecao}/${si + 1}.${qi + 1} ${limpo(p.q, 60)}`;
      const usados = new Set<string>();
      for (const a of arquivos) {
        const nome = limpo(a.name, 120);
        const ponto = nome.lastIndexOf(".");
        const [base, ext] = ponto > 0 ? [nome.slice(0, ponto), nome.slice(ponto)] : [nome, ""];
        let candidato = nome;
        for (let n = 2; usados.has(candidato.toLowerCase()); n++) candidato = `${base} (${n})${ext}`;
        usados.add(candidato.toLowerCase());
        lista.push({ path: a.path, nome: `${pasta}/${candidato}` });
      }
    });
  });
  return lista;
}

/**
 * The ZIP as a stream. `baixar` fetches one file's bytes; a file that cannot be
 * fetched is replaced by a short note instead of failing the whole download.
 */
export function zipEmStream(
  arquivos: ArquivoNoZip[],
  baixar: (path: string) => Promise<Uint8Array | null>,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>(
    {
    async start(controle) {
      const zip = new Zip((erro, pedaco, fim) => {
        if (erro) return controle.error(erro);
        controle.enqueue(pedaco);
        if (fim) controle.close();
      });
      const faltando: string[] = [];
      for (const a of arquivos) {
        // Back-pressure: a slow download must not let finished files pile up in memory.
        while ((controle.desiredSize ?? 1) <= 0) await new Promise((r) => setTimeout(r, 50));
        const bytes = await baixar(a.path).catch(() => null);
        if (!bytes) {
          faltando.push(a.nome);
          continue;
        }
        const entrada = new ZipPassThrough(a.nome);
        zip.add(entrada);
        entrada.push(bytes, true);
      }
      if (faltando.length) {
        const nota = new ZipPassThrough("MISSING FILES.txt");
        zip.add(nota);
        nota.push(new TextEncoder().encode(`These files could not be read from storage:\n${faltando.join("\n")}\n`), true);
      }
      zip.end();
    },
    },
    new ByteLengthQueuingStrategy({ highWaterMark: 8 * 1024 * 1024 }),
  );
}
