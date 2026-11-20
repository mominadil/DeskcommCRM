/**
 * A brief's answers as an .xlsx workbook, written by hand: an .xlsx is a zip of a
 * few XML files, and `fflate` is already a dependency, so no spreadsheet library.
 * "Answers" has one row per question, "Files" one row per upload (the name is a
 * link that opens the file after logging in to the CRM), "Summary" the brief.
 */
import { strToU8, zipSync } from "fflate";

import { perguntaRespondida, progressoDoBrief, type RespostaDaSecao, type Secao } from "./schema";

export type DadosDaExportacao = {
  titulo: string;
  cliente: string | null;
  status: string;
  secoes: Secao[];
  respostas: Record<string, RespostaDaSecao | undefined>;
  /** Builds the link that opens one uploaded file in the CRM (staff login required). */
  linkDoArquivo?: (path: string) => string;
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
      const arquivos = (r.files[p.id] ?? []).map((f) => ({ nome: f.name, url: d.linkDoArquivo?.(f.path) ?? null }));
      return {
        secao: `${si + 1}. ${s.t}`,
        numero: `${si + 1}.${qi + 1}`,
        pergunta: p.q,
        tipo: TIPO[p.type] ?? p.type,
        resposta: Array.isArray(a) ? a.join(", ") : String(a ?? "").trim(),
        nota: String(r.v[`${p.id}__note`] ?? "").trim(),
        link: String(r.v[`${p.id}__link`] ?? "").trim(),
        arquivos,
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

type Celula = string | { texto: string; url: string };

/**
 * A worksheet of inline strings. Styles: 1 = bold header, 2 = wrapped text, 3 = link.
 * Links go in the sheet's own relationships file, which has no length limit
 * (the HYPERLINK() formula caps the address at 255 characters).
 */
function planilha(linhas: Celula[][], larguras: number[], comCabecalho: boolean) {
  const links: { ref: string; url: string }[] = [];
  const cols = larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const rows = linhas
    .map((linha, r) => {
      const cells = linha
        .map((v, c) => {
          const ref = `${coluna(c)}${r + 1}`;
          const texto = typeof v === "string" ? v : v.texto;
          const estilo = comCabecalho && r === 0 ? 1 : typeof v === "string" ? 2 : 3;
          if (typeof v !== "string") links.push({ ref, url: v.url });
          return `<c r="${ref}" t="inlineStr" s="${estilo}"><is><t xml:space="preserve">${xml(texto)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join("");
  const congelar = comCabecalho
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : "";
  const hiperlinks = links.length
    ? `<hyperlinks>${links.map((l, i) => `<hyperlink ref="${l.ref}" r:id="rId${i + 1}"/>`).join("")}</hyperlinks>`
    : "";
  const folha =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `${congelar}<cols>${cols}</cols><sheetData>${rows}</sheetData>${hiperlinks}</worksheet>`;
  const relacoes = links.length
    ? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      links
        .map(
          (l, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xml(l.url)}" TargetMode="External"/>`,
        )
        .join("") +
      "</Relationships>"
    : null;
  return { folha, relacoes };
}

export function planilhaDasRespostas(d: DadosDaExportacao, exportadoEm = new Date()): Uint8Array {
  const linhas = linhasDaExportacao(d);
  const { total, respondidas } = progressoDoBrief(d.secoes, d.respostas);

  const respostas = planilha(
    [
      ["Section", "No.", "Question", "Type", "Answer", "Note", "Link", "Files", "What we noted"],
      ...linhas.map((l) => [
        l.secao,
        l.numero,
        l.pergunta,
        l.tipo,
        l.resposta,
        l.nota,
        l.link,
        l.arquivos.length ? `${l.arquivos.length} file(s), see the Files sheet` : "",
        l.anotado,
      ]),
    ],
    [26, 6, 50, 14, 50, 36, 32, 22, 36],
    true,
  );
  const arquivos = planilha(
    [
      ["Section", "No.", "Question", "File (click to open)"],
      ...linhas.flatMap((l) =>
        l.arquivos.map((a): Celula[] => [l.secao, l.numero, l.pergunta, a.url ? { texto: a.nome, url: a.url } : a.nome]),
      ),
    ],
    [26, 6, 50, 50],
    true,
  );
  const resumo = planilha(
    [
      ["Brief", d.titulo],
      ["Client", d.cliente ?? ""],
      ["Status", d.status],
      ["Answered", `${respondidas} of ${total}`],
      ["Files", String(linhas.reduce((n, l) => n + l.arquivos.length, 0))],
      ["Exported", exportadoEm.toISOString().slice(0, 16).replace("T", " ") + " UTC"],
    ],
    [14, 60],
    false,
  );

  const folhas = [
    { nome: "Answers", ...respostas },
    { nome: "Files", ...arquivos },
    { nome: "Summary", ...resumo },
  ];
  const tipoDaFolha = "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";
  const zip: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        folhas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${tipoDaFolha}"/>`).join("") +
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
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
        folhas.map((f, i) => `<sheet name="${f.nome}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
        "</sheets></workbook>",
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        folhas
          .map(
            (_, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join("") +
        `<Relationship Id="rId${folhas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        "</Relationships>",
    ),
    "xl/styles.xml": strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font>' +
        '<font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font></fonts>' +
        '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFF1F1F1"/><bgColor indexed="64"/></patternFill></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
        '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        "</styleSheet>",
    ),
  };
  folhas.forEach((f, i) => {
    zip[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(f.folha);
    if (f.relacoes) zip[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] = strToU8(f.relacoes);
  });
  return zipSync(zip, { level: 6 });
}
