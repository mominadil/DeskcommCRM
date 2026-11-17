"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Secao } from "@/lib/briefs/schema";
import { useT } from "@/lib/i18n/IdiomaProvider";

import { EditorDeSecoes } from "../../_editor";

async function salvarModelo(id: string, corpo: Record<string, unknown>): Promise<boolean> {
  const r = await fetch(`/api/v1/briefs/modelos/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  return r.ok;
}

export function TelaDoModelo(props: {
  id: string;
  nome: string;
  descricao: string | null;
  secoes: Secao[];
  podeGerenciar: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [nome, setNome] = useState(props.nome);
  const [descricao, setDescricao] = useState(props.descricao ?? "");

  async function salvarCabecalho() {
    if (!(await salvarModelo(props.id, { nome, descricao: descricao || null }))) toast.error(t("Não foi possível salvar."));
    else toast.success(t("Salvo"));
  }

  async function apagar() {
    if (!window.confirm(t("Apagar este modelo? Os briefings já criados com ele continuam iguais."))) return;
    const r = await fetch(`/api/v1/briefs/modelos/${props.id}`, { method: "DELETE" });
    if (!r.ok) return void toast.error(t("Não foi possível apagar."));
    router.push("/app/briefs");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/app/briefs" className="text-sm text-muted-foreground hover:underline">
          ← {t("Briefings")}
        </Link>
        <Input
          aria-label={t("Nome do modelo")}
          className="text-lg font-semibold"
          value={nome}
          disabled={!props.podeGerenciar}
          onChange={(e) => setNome(e.target.value)}
        />
        <Input
          aria-label={t("Descrição do modelo")}
          placeholder={t("Para que tipo de projeto este modelo serve")}
          value={descricao}
          disabled={!props.podeGerenciar}
          onChange={(e) => setDescricao(e.target.value)}
        />
        {props.podeGerenciar ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={salvarCabecalho} disabled={!nome.trim()}>
              {t("Salvar nome e descrição")}
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={apagar}>
              {t("Apagar modelo")}
            </Button>
          </div>
        ) : null}
      </div>
      <EditorDeSecoes
        inicial={props.secoes}
        comAnotacoes={false}
        somenteLeitura={!props.podeGerenciar}
        aoSalvar={(secoes) => salvarModelo(props.id, { secoes })}
      />
    </div>
  );
}
