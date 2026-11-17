import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { paginaPropria, temPaginaPropria } from "./index";
import type { BriefCompleto } from "../servidor";

const ID = "dfc1d95e-1cda-488e-baab-918c89cd6ac3";
const brief = (respostas: BriefCompleto["respostas"]): BriefCompleto => ({
  id: ID,
  organization_id: "org",
  titulo: "t",
  cliente: null,
  intro: null,
  secoes: [{ id: "s", t: "S", q: [{ id: "a", type: "long", q: "?" }] }],
  respostas,
  status: "em_andamento",
  share_token: "tok",
  concluido_em: null,
  updated_at: "",
});

describe("hand-made brief pages", () => {
  it("only the listed brief has one", () => {
    expect(temPaginaPropria(ID)).toBe(true);
    expect(temPaginaPropria("00000000-0000-4000-8000-000000000000")).toBe(false);
  });

  it("an answer containing </script> cannot close the data script", () => {
    const html = paginaPropria(brief({ s: { v: { a: "</script><script>alert(1)</script>" }, files: {} } }), "tok")!;
    const dados = html.slice(html.indexOf("window.__BRIEF__="), html.indexOf(";</script>", html.indexOf("window.__BRIEF__=")));
    expect(dados).not.toContain("</script");
    expect(dados).toContain("\\u003c/script>");
  });

  it("keeps the original design and swaps only the script", () => {
    const html = paginaPropria(brief({}), "tok")!;
    expect(html).toContain('id="heroLogo"');
    expect(html).toContain("/api/v1/briefs/publico/");
    expect(html).not.toContain("<!--BRIEF_SCRIPT-->");
    expect(html).not.toContain("window.claude");
  });
});
