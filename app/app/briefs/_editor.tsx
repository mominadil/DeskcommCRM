"use client";

/**
 * The question builder, shared by templates and by a single client's brief.
 * IDs are random slugs made here (`novoIdDoBuilder`), never derived from the
 * text, so renaming a question keeps the answers already given to it.
 */
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/IdiomaProvider";
import { novoIdDoBuilder, secoesSchema, TIPOS_DE_PERGUNTA, type Pergunta, type Secao, type TipoDePergunta } from "@/lib/briefs/schema";

const ROTULO_DO_TIPO: Record<TipoDePergunta, string> = {
  confirm: "Confirmação (Sim / Em parte / Não)",
  one: "Escolha única",
  many: "Múltipla escolha",
  text: "Texto curto",
  long: "Texto longo",
  file: "Arquivos ou link",
};

function mover<T>(lista: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (j < 0 || j >= lista.length) return lista;
  const copia = [...lista];
  [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  return copia;
}

export function EditorDeSecoes(props: {
  inicial: Secao[];
  /** Show the "What we noted" field: on a client's brief, not on a reusable template. */
  comAnotacoes: boolean;
  somenteLeitura: boolean;
  aoSalvar: (secoes: Secao[]) => Promise<boolean>;
}) {
  const t = useT();
  const [secoes, setSecoes] = useState<Secao[]>(props.inicial);
  const [sujo, setSujo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const ro = props.somenteLeitura;

  const alterar = (nova: Secao[]) => {
    setSecoes(nova);
    setSujo(true);
  };
  const alterarSecao = (i: number, s: Partial<Secao>) => alterar(secoes.map((x, k) => (k === i ? { ...x, ...s } : x)));
  const alterarPergunta = (i: number, j: number, p: Partial<Pergunta>) =>
    alterarSecao(i, { q: secoes[i]!.q.map((x, k) => (k === j ? ({ ...x, ...p } as Pergunta) : x)) });

  async function salvar() {
    // Empty optional fields go away, so the stored JSON stays the Aumera shape.
    const limpas = secoes.map((s) => ({
      ...s,
      d: s.d?.trim() || undefined,
      q: s.q.map((p) => ({
        ...p,
        hint: p.hint?.trim() || undefined,
        found: p.found?.trim() || undefined,
        opts: p.type === "one" || p.type === "many" ? (p.opts ?? []).map((o) => o.trim()).filter(Boolean) : undefined,
      })),
    }));
    const valido = secoesSchema.safeParse(limpas);
    if (!valido.success) {
      setErro(t("Confira: toda seção e pergunta precisa de texto, e escolhas precisam de ao menos duas opções."));
      return;
    }
    setErro(null);
    setSalvando(true);
    const ok = await props.aoSalvar(valido.data);
    setSalvando(false);
    if (ok) setSujo(false);
    else setErro(t("Não foi possível salvar."));
  }

  return (
    <div className="space-y-4">
      {secoes.map((s, i) => (
        <Card key={s.id} className="space-y-3 p-4">
          <div className="flex items-start gap-2">
            <span className="pt-2 text-xs font-medium text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
            <div className="flex-1 space-y-2">
              <Input aria-label={t("Título da seção")} value={s.t} disabled={ro} onChange={(e) => alterarSecao(i, { t: e.target.value })} />
              <Input
                aria-label={t("Descrição da seção")}
                placeholder={t("Descrição (opcional)")}
                value={s.d ?? ""}
                disabled={ro}
                onChange={(e) => alterarSecao(i, { d: e.target.value })}
              />
            </div>
            {ro ? null : (
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" aria-label={t("Subir seção")} onClick={() => alterar(mover(secoes, i, -1))}>
                  <ArrowUp className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label={t("Descer seção")} onClick={() => alterar(mover(secoes, i, 1))}>
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t("Apagar seção")}
                  onClick={() => alterar(secoes.filter((_, k) => k !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </div>

          <ol className="space-y-3 border-l pl-4">
            {s.q.map((p, j) => (
              <li key={p.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-start gap-2">
                  <span className="pt-2 text-xs text-muted-foreground">
                    {i + 1}.{j + 1}
                  </span>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      aria-label={t("Pergunta")}
                      className="min-h-14"
                      value={p.q}
                      disabled={ro}
                      onChange={(e) => alterarPergunta(i, j, { q: e.target.value })}
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        aria-label={t("Tipo de pergunta")}
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                        value={p.type}
                        disabled={ro}
                        onChange={(e) => alterarPergunta(i, j, { type: e.target.value as TipoDePergunta })}
                      >
                        {TIPOS_DE_PERGUNTA.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {t(ROTULO_DO_TIPO[tipo])}
                          </option>
                        ))}
                      </select>
                      <Input
                        aria-label={t("Dica")}
                        placeholder={t("Dica para o cliente (opcional)")}
                        value={p.hint ?? ""}
                        disabled={ro}
                        onChange={(e) => alterarPergunta(i, j, { hint: e.target.value })}
                      />
                    </div>
                    {p.type === "one" || p.type === "many" ? (
                      <Textarea
                        aria-label={t("Opções")}
                        placeholder={t("Uma opção por linha")}
                        className="min-h-20 text-sm"
                        value={(p.opts ?? []).join("\n")}
                        disabled={ro}
                        onChange={(e) => alterarPergunta(i, j, { opts: e.target.value.split("\n") })}
                      />
                    ) : null}
                    {props.comAnotacoes || p.found ? (
                      <Input
                        aria-label={t("O que anotamos")}
                        placeholder={t("O que anotamos (o cliente confirma ou corrige)")}
                        value={p.found ?? ""}
                        disabled={ro}
                        onChange={(e) => alterarPergunta(i, j, { found: e.target.value })}
                      />
                    ) : null}
                  </div>
                  {ro ? null : (
                    <div className="flex flex-col gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t("Subir pergunta")}
                        onClick={() => alterarSecao(i, { q: mover(s.q, j, -1) })}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t("Descer pergunta")}
                        onClick={() => alterarSecao(i, { q: mover(s.q, j, 1) })}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t("Apagar pergunta")}
                        onClick={() => alterarSecao(i, { q: s.q.filter((_, k) => k !== j) })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {ro ? null : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => alterarSecao(i, { q: [...s.q, { id: novoIdDoBuilder("q"), type: "long", q: "" }] })}
            >
              <Plus className="size-4" /> {t("Adicionar pergunta")}
            </Button>
          )}
        </Card>
      ))}

      {ro ? null : (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-background py-3">
          <Button variant="outline" onClick={() => alterar([...secoes, { id: novoIdDoBuilder("s"), t: "", q: [] }])}>
            <Plus className="size-4" /> {t("Adicionar seção")}
          </Button>
          <Button onClick={salvar} disabled={!sujo || salvando}>
            {salvando ? t("Salvando") : sujo ? t("Salvar perguntas") : t("Salvo")}
          </Button>
          {erro ? <span className="text-sm text-destructive">{erro}</span> : null}
        </div>
      )}
    </div>
  );
}
