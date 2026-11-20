/**
 * A brief's answers as a PDF, with the same `@react-pdf/renderer` the proposals and
 * conversation exports use. Noto Sans (public/fonts/briefs, OFL) instead of the
 * built-in Helvetica, which has no ₹ and drops many non-Latin characters.
 */
import path from "node:path";

import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

import { linhasDaExportacao, type DadosDaExportacao } from "./exportar-xlsx";
import { progressoDoBrief } from "./schema";

let fontesRegistradas = false;
function registrarFontes() {
  if (fontesRegistradas) return;
  const pasta = path.join(process.cwd(), "public", "fonts", "briefs");
  Font.register({
    family: "Noto Sans",
    fonts: [
      { src: path.join(pasta, "NotoSans-Regular.ttf") },
      { src: path.join(pasta, "NotoSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Long URLs and answers without spaces must still wrap instead of running off the page.
  Font.registerHyphenationCallback((palavra) => (palavra.length > 30 ? palavra.match(/.{1,20}/g) ?? [palavra] : [palavra]));
  fontesRegistradas = true;
}

const estilo = StyleSheet.create({
  pagina: { fontFamily: "Noto Sans", fontSize: 10, paddingTop: 40, paddingBottom: 48, paddingHorizontal: 44, color: "#1f1f1f" },
  titulo: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 9, color: "#666", marginBottom: 2 },
  secao: { fontSize: 13, fontWeight: 700, marginTop: 18, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: "#ddd" },
  pergunta: { marginBottom: 9 },
  enunciado: { fontWeight: 700, marginBottom: 2 },
  rotulo: { fontWeight: 700 },
  vazio: { color: "#999" },
  anotado: { fontSize: 9, color: "#666", marginBottom: 2 },
  rodape: { position: "absolute", bottom: 22, left: 44, right: 44, fontSize: 8, color: "#999", flexDirection: "row", justifyContent: "space-between" },
});

function DocumentoDoBrief({ d, exportadoEm }: { d: DadosDaExportacao; exportadoEm: Date }) {
  const linhas = linhasDaExportacao(d);
  const { total, respondidas } = progressoDoBrief(d.secoes, d.respostas);
  let secaoAtual = "";
  return (
    <Document title={d.titulo} author={d.cliente ?? undefined}>
      <Page size="A4" style={estilo.pagina} wrap>
        <Text style={estilo.titulo}>{d.titulo}</Text>
        {d.cliente ? <Text style={estilo.meta}>Client: {d.cliente}</Text> : null}
        <Text style={estilo.meta}>
          {respondidas} of {total} answered · Status: {d.status} · Exported {exportadoEm.toISOString().slice(0, 10)}
        </Text>

        {linhas.map((l) => {
          const novaSecao = l.secao !== secaoAtual;
          secaoAtual = l.secao;
          return (
            <View key={l.numero} wrap={false}>
              {novaSecao ? <Text style={estilo.secao}>{l.secao}</Text> : null}
              <View style={estilo.pergunta}>
                <Text style={estilo.enunciado}>
                  {l.numero} {l.pergunta}
                </Text>
                {l.anotado ? <Text style={estilo.anotado}>What we noted: {l.anotado}</Text> : null}
                {l.respondida ? null : <Text style={estilo.vazio}>Not answered</Text>}
                {l.resposta ? <Text>{l.resposta}</Text> : null}
                {l.nota ? (
                  <Text>
                    <Text style={estilo.rotulo}>Note: </Text>
                    {l.nota}
                  </Text>
                ) : null}
                {l.link ? (
                  <Text>
                    <Text style={estilo.rotulo}>Link: </Text>
                    {l.link}
                  </Text>
                ) : null}
                {l.arquivos ? (
                  <Text>
                    <Text style={estilo.rotulo}>Files: </Text>
                    {l.arquivos}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}

        <View style={estilo.rodape} fixed>
          <Text>{d.titulo}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function pdfDasRespostas(d: DadosDaExportacao, exportadoEm = new Date()): Promise<Buffer> {
  registrarFontes();
  return renderToBuffer(<DocumentoDoBrief d={d} exportadoEm={exportadoEm} />);
}
