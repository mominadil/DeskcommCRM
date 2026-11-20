/**
 * A brief's answers as an .xlsx workbook, written by hand: an .xlsx is a zip of a
 * few XML files, and `fflate` is already a dependency, so no spreadsheet library.
 * Sheet "Answers" has one row per question; sheet "Summary" has the brief itself.
 */
import { strToU8, zipSync } from "fflate";

import { perguntaRespondida, progressoDoBrief, type RespostaDaSecao, type Secao } from "./schema";

export type DadosDaExportacao = {
  titulo: string;
  cliente: string | null;
  status: string;
  secoes: Secao[];
  respostas: Record<string, RespostaDaSecao | undefined>;
};

const TIPO: Record<string, string> = {
  confirm: "Confirm",
  one: "Single choice",
  many: "Multiple choice",
  text: "Short text",
  long: "Long text",
  file: "Files or link",
};

/** One row per question, in the order of the brief. Shared by the PDF and the workbook. */
export function linhasDaExportacao(d: DadosDaExportacao) {
  return d.secoes.flatMap((s, si) => {
    const r = d.respostas[s.id] ?? { v: {}, files: {} };
    return s.q.map((p, qi) => {
      const a = r.v[p.id];
      return {
        secao: `${si + 1}. ${s.t}`,
        numero: `${si + 1}.${qi + 1}`,
        pergunta: p.q,
        tipo: TIPO[p.type] ?? p.type,
        resposta: Array.isArray(a) ? a.join(", ") : String(a ?? "").trim(),
        nota: String(r.v[`${p.id}__note`] ?? "").trim(),
        link: String(r.v[`${p.id}__link`] ?? "").trim(),
        arquivos: (r.files[p.id] ?? []).map((f) => f.name).join(", "),
        anotado: p.found ?? "",
        respondida: perguntaRespondida(p, r),
      };
    });
  });
}

// XML 1.0 forbids most control characters; Excel refuses a file that has them.
const INVALIDOS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const xml = (s: string) =>
  s
    .replace(INVALIDOS, "")
    .slice(0, 32000) // Excel's cell limit is 32,767 characters.
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const coluna = (i: number) => {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/** A worksheet of inline strings. Style 1 = bold header, style 2 = wrapped body text. */
function planilha(linhas: string[][], larguras: number[], comCabecalho: boolean): string {
  const cols = larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const rows = linhas
    .map((linha, r) => {
      const estilo = comCabecalho && r === 0 ? 1 : 2;
      const cells = linha
        .map((v, c) => `<c r="${coluna(c)}${r + 1}" t="inlineStr" s="${estilo}"><is><t xml:space="preserve">${xml(v)}</t></is></c>`)
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  const congelar = comCabecalho
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : "";
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `${congelar}<cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`
  );
}

export function planilhaDasRespostas(d: DadosDaExportacao, exportadoEm = new Date()): Uint8Array {
  const linhas = linhasDaExportacao(d);
  const { total, respondidas } = progressoDoBrief(d.secoes, d.respostas);

  const respostas = planilha(
    [
      ["Section", "No.", "Question", "Type", "Answer", "Note", "Link", "Files", "What we noted"],
      ...linhas.map((l) => [l.secao, l.numero, l.pergunta, l.tipo, l.resposta, l.nota, l.link, l.arquivos, l.anotado]),
    ],
    [26, 6, 50, 14, 50, 36, 32, 30, 36],
    true,
  );
  const resumo = planilha(
    [
      ["Brief", d.titulo],
      ["Client", d.cliente ?? ""],
      ["Status", d.status],
      ["Answered", `${respondidas} of ${total}`],
      ["Exported", exportadoEm.toISOString().slice(0, 16).replace("T", " ") + " UTC"],
    ],
    [14, 60],
    false,
  );

  const arquivos: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        "</Types>",
    ),
    "_rels/.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
    ),
    "xl/workbook.xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Answers" sheetId="1" r:id="rId1"/><sheet name="Summary" sheetId="2" r:id="rId2"/></sheets></workbook>',
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        "</Relationships>",
    ),
    "xl/styles.xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F1F1"/><bgColor indexed="64"/></patternFill></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        "</styleSheet>",
    ),
    "xl/worksheets/sheet1.xml": strToU8(respostas),
    "xl/worksheets/sheet2.xml": strToU8(resumo),
  };
  return zipSync(arquivos, { level: 6 });
}
