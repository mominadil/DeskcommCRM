// @vitest-environment node
import { writeFileSync } from "node:fs";

import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { pdfDasRespostas } from "./exportar-pdf";
import { planilhaDasRespostas, type DadosDaExportacao } from "./exportar-xlsx";

const dados: DadosDaExportacao = {
  titulo: "Website revamp",
  cliente: "Aumèra",
  status: "In progress",
  secoes: [
    {
      id: "theon",
      t: "THEON · for you",
      q: [
        { id: "price", type: "one", q: "Keep the current price?", opts: ["Yes", "No"], found: "₹1,999 (MRP ₹3,499)" },
        { id: "notes", type: "long", q: "Describe the scents" },
        { id: "photos", type: "file", q: "Product photos" },
      ],
    },
  ],
  respostas: {
    theon: {
      v: { price: "Yes", price__note: "Use <b>bold</b> & keep ₹", notes: "Warm\u0007 woody", photos__link: "https://drive.google.com/x" },
      files: { photos: [{ path: "o/b/theon/photos/1-a.png", name: "a.png", type: "image/png", size: 10 }] },
    },
  },
  linkDoArquivo: (path) => `https://crm.example/api/v1/briefs/b/arquivo?path=${encodeURIComponent(path)}`,
};

describe("Excel export", () => {
  const zip = unzipSync(planilhaDasRespostas(dados, new Date("2026-11-20T10:00:00Z")));

  it("is a workbook with Answers, Files and Summary sheets", () => {
    expect(Object.keys(zip)).toEqual(
      expect.arrayContaining(["[Content_Types].xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet3.xml", "xl/styles.xml"]),
    );
    const libro = strFromU8(zip["xl/workbook.xml"]!);
    expect(libro).toContain('name="Answers"');
    expect(libro).toContain('name="Files"');
  });

  it("lists each file with a clickable link in the Files sheet", () => {
    expect(strFromU8(zip["xl/worksheets/sheet2.xml"]!)).toMatch(/<hyperlink ref="D2" r:id="rId1"\/>/);
    expect(strFromU8(zip["xl/worksheets/sheet2.xml"]!)).toContain("a.png");
    expect(strFromU8(zip["xl/worksheets/_rels/sheet2.xml.rels"]!)).toContain(
      'Target="https://crm.example/api/v1/briefs/b/arquivo?path=o%2Fb%2Ftheon%2Fphotos%2F1-a.png" TargetMode="External"',
    );
  });

  it("has one row per question, with answer, note, link, files and what we noted", () => {
    const folha = strFromU8(zip["xl/worksheets/sheet1.xml"]!);
    expect(folha.match(/<row /g)).toHaveLength(4); // header + 3 questions
    expect(folha).toContain("₹1,999 (MRP ₹3,499)");
    expect(folha).toContain("https://drive.google.com/x");
    expect(folha).toContain("1 file(s), see the Files sheet");
  });

  it("escapes markup and drops control characters Excel would reject", () => {
    const folha = strFromU8(zip["xl/worksheets/sheet1.xml"]!);
    expect(folha).toContain("Use &lt;b&gt;bold&lt;/b&gt; &amp; keep ₹");
    expect(folha).toContain("Warm woody");
    expect(folha).not.toContain("\u0007");
  });

  it("the summary counts answered questions", () => {
    const resumo = strFromU8(zip["xl/worksheets/sheet3.xml"]!);
    expect(resumo).toContain("3 of 3");
    expect(resumo).toContain("Aumèra");
    if (process.env.BRIEF_EXPORT_SAMPLE) writeFileSync(`${process.env.BRIEF_EXPORT_SAMPLE}.xlsx`, planilhaDasRespostas(dados));
  });
});

describe("PDF export", () => {
  it("renders a PDF with the Noto fonts (₹ and accents included)", async () => {
    const pdf = await pdfDasRespostas(dados, new Date("2026-11-20T10:00:00Z"));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain("NotoSans");
    if (process.env.BRIEF_EXPORT_SAMPLE) writeFileSync(`${process.env.BRIEF_EXPORT_SAMPLE}.pdf`, pdf);
  }, 30000);
});
