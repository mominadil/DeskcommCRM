"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/IdiomaProvider";

export type BriefNaLista = {
  id: string;
  titulo: string;
  cliente: string | null;
  status: string;
  updatedAt: string;
  respondidas: number;
  total: number;
};
export type ModeloNaLista = { id: string; nome: string; descricao: string | null; perguntas: number };

export const ROTULO_DO_STATUS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  arquivado: "Arquivado",
};

async function postar(url: string, corpo: unknown): Promise<{ id: string } | null> {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
  if (!r.ok) return null;
  const json = (await r.json()) as { data?: { id: string } };
  return json.data ?? null;
}

export function ListaDeBriefs(props: {
  briefs: BriefNaLista[];
  modelos: ModeloNaLista[];
  podeEditar: boolean;
  podeGerenciar: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [titulo, setTitulo] = useState("");
  const [cliente, setCliente] = useState("");
  const [modelo, setModelo] = useState(props.modelos[0]?.id ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [json, setJson] = useState("");
  const [importando, setImportando] = useState(false);

  async function criarBrief() {
    if (!titulo.trim()) return;
    setOcupado(true);
    const criado = await postar("/api/v1/briefs", { titulo, cliente: cliente || null, template_id: modelo || null });
    setOcupado(false);
    if (!criado) return void toast.error(t("Não foi possível criar o briefing."));
    router.push(`/app/briefs/${criado.id}`);
  }

  async function criarModelo(corpo: Record<string, unknown>) {
    setOcupado(true);
    const criado = await postar("/api/v1/briefs/modelos", corpo);
    setOcupado(false);
    if (!criado) return void toast.error(t("Não foi possível criar o modelo."));
    router.push(`/app/briefs/modelos/${criado.id}`);
  }

  function importarJson() {
    try {
      const dados = JSON.parse(json) as unknown;
      const secoes = Array.isArray(dados) ? dados : (dados as { secoes?: unknown; SECTIONS?: unknown }).secoes;
      if (!Array.isArray(secoes)) throw new Error("formato");
      void criarModelo({ nome: t("Modelo importado"), secoes });
    } catch {
      toast.error(t("Cole uma lista de seções no formato do briefing (JSON)."));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-4">
        {props.podeEditar ? (
          <Card className="space-y-3 p-4">
            <h2 className="font-medium">{t("Novo briefing")}</h2>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input placeholder={t("Projeto, ex.: Novo site da Aumera")} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              <Input placeholder={t("Cliente")} value={cliente} onChange={(e) => setCliente(e.target.value)} />
              <select
                aria-label={t("Modelo")}
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
              >
                <option value="">{t("Em branco")}</option>
                {props.modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={criarBrief} disabled={ocupado || !titulo.trim()}>
              {t("Criar briefing")}
            </Button>
          </Card>
        ) : null}

        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Briefing")}</TableHead>
                <TableHead>{t("Situação")}</TableHead>
                <TableHead className="text-right">{t("Respondidas")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.briefs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    {t("Nenhum briefing ainda.")}
                  </TableCell>
                </TableRow>
              ) : (
                props.briefs.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link href={`/app/briefs/${b.id}`} className="font-medium hover:underline">
                        {b.titulo}
                      </Link>
                      {b.cliente ? <span className="block text-xs text-muted-foreground">{b.cliente}</span> : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={b.status === "concluido" ? "default" : "secondary"}>
                        {t(ROTULO_DO_STATUS[b.status] ?? b.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {b.respondidas} / {b.total}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      <aside className="space-y-4">
        <Card className="space-y-3 p-4">
          <h2 className="font-medium">{t("Modelos")}</h2>
          {props.modelos.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Nenhum modelo ainda.")}</p>
          ) : (
            <ul className="space-y-2">
              {props.modelos.map((m) => (
                <li key={m.id}>
                  <Link href={`/app/briefs/modelos/${m.id}`} className="text-sm font-medium hover:underline">
                    {m.nome}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {m.perguntas} {t("perguntas")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {props.podeGerenciar ? (
            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" disabled={ocupado} onClick={() => criarModelo({ nome: t("Novo modelo") })}>
                {t("Novo modelo em branco")}
              </Button>
              <Button variant="outline" disabled={ocupado} onClick={() => criarModelo({ inicial: "revamp_de_site" })}>
                {t("Adicionar modelo: reformulação de site")}
              </Button>
              {importando ? (
                <div className="space-y-2">
                  <Textarea
                    aria-label={t("Seções em JSON")}
                    placeholder='[{"id":"brand","t":"Look and feel","q":[...]}]'
                    className="min-h-32 font-mono text-xs"
                    value={json}
                    onChange={(e) => setJson(e.target.value)}
                  />
                  <Button size="sm" disabled={ocupado || !json.trim()} onClick={importarJson}>
                    {t("Importar")}
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setImportando(true)}>
                  {t("Importar de JSON")}
                </Button>
              )}
            </div>
          ) : null}
        </Card>
      </aside>
    </div>
  );
}
