"use client";

import { Copy, Download, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { progressoDoBrief, respostasEmTexto, type RespostaDaSecao, type Secao } from "@/lib/briefs/schema";
import type { BriefCompleto } from "@/lib/briefs/servidor";
import { useT } from "@/lib/i18n/IdiomaProvider";

import { EditorDeSecoes } from "../_editor";
import { ROTULO_DO_STATUS } from "../_lista";

async function salvarBrief(id: string, corpo: Record<string, unknown>) {
  const r = await fetch(`/api/v1/briefs/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) return null;
  return ((await r.json()) as { data: { share_token: string; status: string } }).data;
}

export function TelaDoBrief(props: { brief: BriefCompleto; podeEditar: boolean; podeGerenciar: boolean }) {
  const t = useT();
  const router = useRouter();
  const b = props.brief;
  const [titulo, setTitulo] = useState(b.titulo);
  const [cliente, setCliente] = useState(b.cliente ?? "");
  const [intro, setIntro] = useState(b.intro ?? "");
  const [token, setToken] = useState(b.share_token);
  const [status, setStatus] = useState(b.status as string);
  const [origem, setOrigem] = useState("");
  useEffect(() => setOrigem(window.location.origin), []);
  const link = `${origem}/brief/${token}`;
  const { total, respondidas } = progressoDoBrief(b.secoes, b.respostas);

  async function salvarCabecalho() {
    const r = await salvarBrief(b.id, { titulo, cliente: cliente || null, intro: intro || null });
    if (r) toast.success(t("Salvo"));
    else toast.error(t("Não foi possível salvar."));
  }

  async function mudarStatus(novo: string) {
    const r = await salvarBrief(b.id, { status: novo });
    if (!r) return void toast.error(t("Não foi possível salvar."));
    setStatus(r.status);
    router.refresh();
  }

  async function renovarLink() {
    if (!window.confirm(t("Gerar um link novo? O link atual para de funcionar na hora."))) return;
    const r = await salvarBrief(b.id, { renovar_link: true });
    if (!r) return void toast.error(t("Não foi possível gerar o link."));
    setToken(r.share_token);
    toast.success(t("Link novo gerado."));
  }

  async function copiar() {
    await navigator.clipboard.writeText(link);
    toast.success(t("Link copiado."));
    if (status === "rascunho") void mudarStatus("enviado");
  }

  function exportar() {
    const texto = respostasEmTexto(b.cliente ? `${b.titulo} · ${b.cliente}` : b.titulo, b.secoes, b.respostas);
    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${b.titulo.replace(/[^\w-]+/g, "-")}-answers.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function apagar() {
    if (!window.confirm(t("Apagar este briefing e os arquivos enviados pelo cliente? Não dá para desfazer."))) return;
    const r = await fetch(`/api/v1/briefs/${b.id}`, { method: "DELETE" });
    if (!r.ok) return void toast.error(t("Não foi possível apagar."));
    router.push("/app/briefs");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/app/briefs" className="text-sm text-muted-foreground hover:underline">
          ← {t("Briefings")}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          <Badge variant={status === "concluido" ? "default" : "secondary"}>{t(ROTULO_DO_STATUS[status] ?? status)}</Badge>
          <span className="text-sm text-muted-foreground">
            {respondidas} / {total} {t("respondidas")}
          </span>
        </div>
      </div>

      <Card className="space-y-3 p-4">
        <h2 className="font-medium">{t("Link do cliente")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("Quem tiver este link responde sem login. Gere um novo se ele vazar.")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Input readOnly value={link} aria-label={t("Link do cliente")} className="min-w-64 flex-1 font-mono text-xs" />
          <Button variant="outline" onClick={copiar}>
            <Copy className="size-4" /> {t("Copiar")}
          </Button>
          <Button variant="outline" asChild>
            <a href={link} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" /> {t("Abrir")}
            </a>
          </Button>
          {props.podeEditar ? (
            <Button variant="ghost" onClick={renovarLink}>
              <RefreshCw className="size-4" /> {t("Gerar link novo")}
            </Button>
          ) : null}
        </div>
      </Card>

      <Tabs defaultValue="respostas">
        <TabsList>
          <TabsTrigger value="respostas">{t("Respostas")}</TabsTrigger>
          <TabsTrigger value="perguntas">{t("Perguntas")}</TabsTrigger>
          <TabsTrigger value="detalhes">{t("Detalhes")}</TabsTrigger>
        </TabsList>

        <TabsContent value="respostas" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportar}>
              <Download className="size-4" /> {t("Exportar respostas")}
            </Button>
            {props.podeEditar && status !== "concluido" ? (
              <Button variant="outline" onClick={() => mudarStatus("concluido")}>
                {t("Marcar como concluído")}
              </Button>
            ) : null}
          </div>
          {b.secoes.map((s, si) => (
            <SecaoRespondida key={s.id} briefId={b.id} secao={s} numero={si + 1} resposta={b.respostas[s.id]} />
          ))}
        </TabsContent>

        <TabsContent value="perguntas">
          <p className="mb-3 text-sm text-muted-foreground">
            {t("Estas perguntas são só deste briefing. Use “O que anotamos” para o que você já sabe da conversa: o cliente confirma ou corrige.")}
          </p>
          <EditorDeSecoes
            inicial={b.secoes}
            comAnotacoes
            somenteLeitura={!props.podeEditar}
            aoSalvar={async (secoes) => !!(await salvarBrief(b.id, { secoes }))}
          />
        </TabsContent>

        <TabsContent value="detalhes" className="space-y-3">
          <Input aria-label={t("Título")} value={titulo} disabled={!props.podeEditar} onChange={(e) => setTitulo(e.target.value)} />
          <Input
            aria-label={t("Cliente")}
            placeholder={t("Cliente")}
            value={cliente}
            disabled={!props.podeEditar}
            onChange={(e) => setCliente(e.target.value)}
          />
          <Textarea
            aria-label={t("Introdução")}
            placeholder={t("Uma mensagem de abertura para o cliente (opcional)")}
            className="min-h-24"
            value={intro}
            disabled={!props.podeEditar}
            onChange={(e) => setIntro(e.target.value)}
          />
          {props.podeEditar ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={salvarCabecalho} disabled={!titulo.trim()}>
                {t("Salvar")}
              </Button>
              <Button variant="outline" onClick={() => mudarStatus("arquivado")}>
                {t("Arquivar")}
              </Button>
              {props.podeGerenciar ? (
                <Button variant="ghost" className="text-destructive" onClick={apagar}>
                  {t("Apagar briefing")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SecaoRespondida(props: { briefId: string; secao: Secao; numero: number; resposta: RespostaDaSecao | undefined }) {
  const t = useT();
  const r = props.resposta ?? { v: {}, files: {} };
  return (
    <Card className="space-y-4 p-4">
      <h3 className="font-medium">
        {String(props.numero).padStart(2, "0")} · {props.secao.t}
      </h3>
      <dl className="space-y-4">
        {props.secao.q.map((p, qi) => {
          const a = r.v[p.id];
          const valor = Array.isArray(a) ? a.join(", ") : String(a ?? "").trim();
          const nota = String(r.v[`${p.id}__note`] ?? "").trim();
          const link = String(r.v[`${p.id}__link`] ?? "").trim();
          const arquivos = r.files[p.id] ?? [];
          const vazio = !valor && !nota && !link && arquivos.length === 0;
          return (
            <div key={p.id} className="space-y-1">
              <dt className="text-sm text-muted-foreground">
                {props.numero}.{qi + 1} {p.q}
              </dt>
              <dd className="space-y-1 text-sm">
                {vazio ? <span className="italic text-muted-foreground">{t("Sem resposta")}</span> : null}
                {valor ? <p className="whitespace-pre-line">{valor}</p> : null}
                {nota ? (
                  <p className="whitespace-pre-line">
                    <b>{t("Observação")}:</b> {nota}
                  </p>
                ) : null}
                {link ? (
                  <p>
                    <b>{t("Link")}:</b>{" "}
                    <a href={link} target="_blank" rel="noreferrer noopener" className="underline">
                      {link}
                    </a>
                  </p>
                ) : null}
                {arquivos.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {arquivos.map((f) => (
                      <li key={f.path}>
                        <a
                          href={`/api/v1/briefs/${props.briefId}/arquivo?path=${encodeURIComponent(f.path)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"
                        >
                          <Download className="size-3" /> {f.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
    </Card>
  );
}
