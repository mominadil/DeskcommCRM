import { describe, expect, it } from "vitest";

import { MODELO_REVAMP_DE_SITE } from "./modelos-iniciais";
import { progressoDoBrief, respostasEmTexto, secoesSchema, validarRespostaDaSecao, type Secao } from "./schema";

const secao: Secao = {
  id: "brand",
  t: "Look and feel",
  q: [
    { id: "ok", type: "confirm", q: "Is this right?" },
    { id: "name", type: "one", q: "Name?", opts: ["A", "B"] },
    { id: "feel", type: "many", q: "Feel?", opts: ["Calm", "Warm"] },
    { id: "notes", type: "long", q: "Anything else?" },
    { id: "logo", type: "file", q: "Logo" },
  ],
};
const PREFIXO = "org-1/brief-1/";

describe("validarRespostaDaSecao: what the public link may save", () => {
  it("accepts answers that match the brief's own questions", () => {
    const r = validarRespostaDaSecao(
      secao,
      {
        v: { ok: "Partly", ok__note: "Spelling", name: "A", feel: ["Calm"], notes: "Hi", logo__link: "https://x" },
        files: { logo: [{ path: `${PREFIXO}brand/logo/1-a.png`, name: "a.png", type: "image/png", size: 10 }] },
      },
      PREFIXO,
    );
    expect(r.ok).toBe(true);
  });

  it("refuses a question id the brief does not have", () => {
    expect(validarRespostaDaSecao(secao, { v: { injected: "x" } }, PREFIXO)).toEqual({ ok: false, erro: "unknown_question:injected" });
  });

  it("refuses a choice that is not one of the options", () => {
    expect(validarRespostaDaSecao(secao, { v: { name: "C" } }, PREFIXO).ok).toBe(false);
    expect(validarRespostaDaSecao(secao, { v: { feel: ["Calm", "Loud"] } }, PREFIXO).ok).toBe(false);
    expect(validarRespostaDaSecao(secao, { v: { ok: "Maybe" } }, PREFIXO).ok).toBe(false);
  });

  it("refuses a file outside this brief's folder, or a path that climbs out", () => {
    const fora = { files: { logo: [{ path: "org-2/other/x.png", name: "x.png", type: "image/png", size: 1 }] } };
    const sobe = { files: { logo: [{ path: `${PREFIXO}../../x.png`, name: "x.png", type: "image/png", size: 1 }] } };
    expect(validarRespostaDaSecao(secao, fora, PREFIXO).ok).toBe(false);
    expect(validarRespostaDaSecao(secao, sobe, PREFIXO).ok).toBe(false);
  });

  it("refuses files on a question that is not a file question, and links on one that is not", () => {
    const naPerguntaErrada = { files: { notes: [{ path: `${PREFIXO}a`, name: "a", type: "", size: 1 }] } };
    expect(validarRespostaDaSecao(secao, naPerguntaErrada, PREFIXO).ok).toBe(false);
    expect(validarRespostaDaSecao(secao, { v: { notes__link: "https://x" } }, PREFIXO).ok).toBe(false);
  });

  it("refuses extra top-level keys and wrong shapes", () => {
    expect(validarRespostaDaSecao(secao, { v: {}, status: "concluido" }, PREFIXO).ok).toBe(false);
    expect(validarRespostaDaSecao(secao, null, PREFIXO).ok).toBe(false);
  });
});

describe("question format", () => {
  it("the built-in website-revamp template is valid", () => {
    expect(secoesSchema.safeParse(MODELO_REVAMP_DE_SITE.secoes).success).toBe(true);
  });

  it("a choice question needs two options, and ids must be unique", () => {
    expect(secoesSchema.safeParse([{ id: "s", t: "S", q: [{ id: "a", type: "one", q: "?", opts: ["x"] }] }]).success).toBe(false);
    const dup = [{ id: "s", t: "S", q: [{ id: "a", type: "long", q: "?" }, { id: "a", type: "long", q: "?" }] }];
    expect(secoesSchema.safeParse(dup).success).toBe(false);
  });

  it("progress counts a note or a link as an answer", () => {
    const p = progressoDoBrief([secao], { brand: { v: { ok__note: "fix", logo__link: "https://x" }, files: {} } });
    expect(p).toEqual({ total: 5, respondidas: 2 });
  });

  it("the export marks unanswered questions as skipped", () => {
    const texto = respostasEmTexto("Brief", [secao], { brand: { v: { notes: "Hello" }, files: {} } });
    expect(texto).toContain("1.4 Anything else?\nHello");
    expect(texto).toContain("1.1 Is this right?\n(skipped)");
  });
});
