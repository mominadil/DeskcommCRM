// @vitest-environment node
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { arquivosNoZip, zipEmStream } from "./arquivos-zip";
import { disposicaoDoDownload } from "./nome-do-download";
import type { Secao } from "./schema";

const secoes: Secao[] = [
  { id: "brand", t: "Look and feel", q: [{ id: "x", type: "long", q: "?" }] },
  {
    id: "photos",
    t: "Photos and files",
    q: [{ id: "logo", type: "file", q: "Logo in high quality (AI, SVG or PDF if you have it)." }],
  },
];
const arquivo = (path: string, name: string) => ({ path, name, type: "image/png", size: 1 });
const respostas = {
  photos: {
    v: {},
    files: { logo: [arquivo("o/b/p/1", "IMG_7838.png"), arquivo("o/b/p/2", "img_7838.PNG"), arquivo("o/b/p/3", 'bad:/na*me?.jpeg')] },
  },
};

describe("ZIP of uploaded files", () => {
  it("files each upload under its section and question, numbering duplicate names", () => {
    expect(arquivosNoZip(secoes, respostas).map((a) => a.nome)).toEqual([
      "02 Photos and files/2.1 Logo in high quality (AI, SVG or PDF if you have it)/IMG_7838.png",
      "02 Photos and files/2.1 Logo in high quality (AI, SVG or PDF if you have it)/img_7838 (2).PNG",
      "02 Photos and files/2.1 Logo in high quality (AI, SVG or PDF if you have it)/bad na me .jpeg",
    ]);
  });

  it("streams a valid ZIP, and notes files storage could not return", async () => {
    const lista = arquivosNoZip(secoes, respostas);
    const fluxo = zipEmStream(lista, async (path) => (path === "o/b/p/2" ? null : new TextEncoder().encode(`bytes of ${path}`)));
    const bytes = new Uint8Array(await new Response(fluxo).arrayBuffer());
    const zip = unzipSync(bytes);
    expect(strFromU8(zip[lista[0]!.nome]!)).toBe("bytes of o/b/p/1");
    expect(zip[lista[1]!.nome]).toBeUndefined();
    expect(strFromU8(zip["MISSING FILES.txt"]!)).toContain("img_7838 (2).PNG");
  });
});

describe("download names", () => {
  it("keeps accents through filename* and gives old clients an ASCII name", () => {
    const h = disposicaoDoDownload("Website revamp", "Aumèra", "answers.pdf");
    expect(h).toContain('filename="Website revamp - Aumera answers.pdf"');
    expect(h).toContain("filename*=UTF-8''Website%20revamp%20-%20Aum%C3%A8ra%20answers.pdf");
  });
});
