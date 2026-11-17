"use client";

/**
 * The client's questionnaire. A port of the Aumera brief page: one card per
 * question, a progress index, answers saved per section ~1s after the last
 * edit (and kept in this browser too, so a dropped connection loses nothing),
 * files uploaded straight to storage through a signed URL.
 */
import { Check, CircleDot, FileText, Minus, Plus, Sun, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useT } from "@/lib/i18n/IdiomaProvider";
import {
  OPCOES_DE_CONFIRMACAO,
  perguntaRespondida,
  progressoDoBrief,
  type ArquivoDoBrief,
  type Pergunta,
  type RespostaDaSecao,
  type Secao,
} from "@/lib/briefs/schema";

type Respostas = Record<string, RespostaDaSecao>;
type EstadoDoSalvar = "salvo" | "salvando" | "local" | "erro";

const vazia = (): RespostaDaSecao => ({ v: {}, files: {} });

export function FormularioDoBrief(props: {
  token: string;
  titulo: string;
  cliente: string | null;
  intro: string | null;
  secoes: Secao[];
  respostasIniciais: Record<string, RespostaDaSecao | undefined>;
  concluidoEm: string | null;
  marca: { nome: string; logoUrl: string | null; accent: string };
}) {
  const t = useT();
  const { token, secoes } = props;
  const chaveLocal = `brief-${token}`;
  const [respostas, setRespostas] = useState<Respostas>(() => {
    const base: Respostas = {};
    for (const s of secoes) base[s.id] = props.respostasIniciais[s.id] ?? vazia();
    return base;
  });
  const [salvar, setSalvar] = useState<EstadoDoSalvar>("salvo");
  const [concluido, setConcluido] = useState<string | null>(props.concluidoEm);
  const [enviandoFim, setEnviandoFim] = useState(false);
  const [erroFim, setErroFim] = useState<string | null>(null);
  const pendentes = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const ultima = useRef(respostas);
  ultima.current = respostas;

  // A copy in this browser, so a lost connection or a closed tab never loses an answer.
  useEffect(() => {
    try {
      localStorage.setItem(chaveLocal, JSON.stringify(respostas));
    } catch {
      /* private mode: the server copy is the only one */
    }
  }, [chaveLocal, respostas]);

  const enviarSecao = useCallback(
    async (secaoId: string) => {
      const dados = ultima.current[secaoId] ?? vazia();
      try {
        const r = await fetch(`/api/v1/briefs/publico/${token}/secoes/${secaoId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ v: dados.v, files: dados.files }),
        });
        if (!r.ok) throw new Error(String(r.status));
        if (pendentes.current.size === 0) setSalvar("salvo");
      } catch {
        setSalvar("local");
      }
    },
    [token],
  );

  const mudou = useCallback(
    (secaoId: string, alterar: (r: RespostaDaSecao) => RespostaDaSecao) => {
      setRespostas((atual) => ({ ...atual, [secaoId]: alterar(atual[secaoId] ?? vazia()) }));
      setSalvar("salvando");
      const timers = pendentes.current;
      clearTimeout(timers.get(secaoId));
      timers.set(
        secaoId,
        setTimeout(() => {
          timers.delete(secaoId);
          void enviarSecao(secaoId);
        }, 900),
      );
    },
    [enviarSecao],
  );

  const { total, respondidas } = useMemo(() => progressoDoBrief(secoes, respostas), [secoes, respostas]);

  async function terminar() {
    setEnviandoFim(true);
    setErroFim(null);
    // Flush anything still waiting, so "done" never races the last answer.
    const esperando = [...pendentes.current.keys()];
    for (const id of esperando) {
      clearTimeout(pendentes.current.get(id));
      pendentes.current.delete(id);
    }
    await Promise.all(esperando.map((id) => enviarSecao(id)));
    try {
      const r = await fetch(`/api/v1/briefs/publico/${token}/concluir`, { method: "POST" });
      if (!r.ok) throw new Error(String(r.status));
      const corpo = (await r.json()) as { concluidoEm?: string };
      setConcluido(corpo.concluidoEm ?? new Date().toISOString());
    } catch {
      setErroFim(t("Não foi possível enviar. Tente de novo em instantes."));
    } finally {
      setEnviandoFim(false);
    }
  }

  const rotuloSalvar: Record<EstadoDoSalvar, string> = {
    salvo: t("Salvo"),
    salvando: t("Salvando"),
    local: t("Salvo neste aparelho"),
    erro: t("Não foi possível salvar"),
  };

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ ["--brief-accent" as string]: props.marca.accent }}>
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          {props.marca.logoUrl ? (
            // <img> rather than next/image: the logo URL belongs to whoever hosts this, not a build-time allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.marca.logoUrl} alt={props.marca.nome} className="h-7 w-auto max-w-[120px] object-contain" />
          ) : (
            <span className="text-sm font-semibold">{props.marca.nome}</span>
          )}
          <span className="truncate text-sm text-muted-foreground">{props.titulo}</span>
          <span className="ml-auto text-xs text-muted-foreground" role="status">
            {respondidas} {t("de")} {total} · {rotuloSalvar[salvar]}
          </span>
        </div>
        <div className="h-1 w-full bg-muted">
          <div
            className="h-1 transition-all"
            style={{ width: `${total ? (respondidas / total) * 100 : 0}%`, background: "var(--brief-accent)" }}
          />
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-[220px_1fr]">
        <nav aria-label={t("Seções")} className="hidden md:block">
          <ol className="sticky top-20 space-y-1 text-sm">
            {secoes.map((s, i) => {
              const r = respostas[s.id] ?? vazia();
              const feitas = s.q.filter((p) => perguntaRespondida(p, r)).length;
              const completa = s.q.length > 0 && feitas === s.q.length;
              return (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted">
                    {completa ? (
                      <Check className="size-4" style={{ color: "var(--brief-accent)" }} aria-hidden />
                    ) : (
                      <CircleDot className="size-4 text-muted-foreground" aria-hidden />
                    )}
                    <span className="truncate">
                      {String(i + 1).padStart(2, "0")} {s.t}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        <main className="space-y-12">
          <section className="space-y-3">
            {props.cliente ? <p className="text-sm uppercase tracking-wide text-muted-foreground">{props.cliente}</p> : null}
            <h1 className="text-3xl font-semibold tracking-tight">{props.titulo}</h1>
            {props.intro ? <p className="whitespace-pre-line text-muted-foreground">{props.intro}</p> : null}
            <p className="text-sm text-muted-foreground">
              {t("Responda no seu ritmo: tudo é salvo enquanto você escreve. Pule o que não souber.")}
            </p>
          </section>

          {secoes.map((s, si) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{String(si + 1).padStart(2, "0")}</p>
                <h2 className="text-xl font-semibold">{s.t}</h2>
                {s.d ? <p className="text-sm text-muted-foreground">{s.d}</p> : null}
              </div>
              {s.q.map((p, qi) => (
                <CartaoDaPergunta
                  key={p.id}
                  token={token}
                  secao={s}
                  pergunta={p}
                  numero={`${si + 1}.${qi + 1}`}
                  resposta={respostas[s.id] ?? vazia()}
                  mudar={(alterar) => mudou(s.id, alterar)}
                  aoFalharEnvio={() => setSalvar("erro")}
                />
              ))}
            </section>
          ))}

          <section className="space-y-3 rounded-lg border p-6 text-center">
            <h2 className="text-xl font-semibold">{t("É tudo o que precisamos para começar.")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("Suas respostas já estão salvas. Avise que terminou; você ainda pode voltar e editar depois.")}
            </p>
            <button
              type="button"
              onClick={terminar}
              disabled={enviandoFim}
              className="inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
              style={{ background: "var(--brief-accent)" }}
            >
              {concluido ? t("Enviado") : t("Terminei por agora")}
              <Check className="size-4" aria-hidden />
            </button>
            <p className="text-sm text-muted-foreground" role="status">
              {erroFim ??
                (concluido
                  ? `${t("Enviado em")} ${new Date(concluido).toLocaleDateString()}. ${t("Você ainda pode editar qualquer resposta.")}`
                  : "")}
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}

function CartaoDaPergunta(props: {
  token: string;
  secao: Secao;
  pergunta: Pergunta;
  numero: string;
  resposta: RespostaDaSecao;
  mudar: (alterar: (r: RespostaDaSecao) => RespostaDaSecao) => void;
  aoFalharEnvio: () => void;
}) {
  const t = useT();
  const { pergunta: p, resposta: r, mudar } = props;
  const respondida = perguntaRespondida(p, r);
  const nota = String(r.v[`${p.id}__note`] ?? "");
  const [notaAberta, setNotaAberta] = useState(!!nota.trim());
  const rotuloId = `l-${props.secao.id}-${p.id}`;

  const definir = (chave: string, valor: string | string[]) => mudar((x) => ({ ...x, v: { ...x.v, [chave]: valor } }));

  function escolher(opcao: string) {
    if (p.type === "many") {
      const atual = Array.isArray(r.v[p.id]) ? (r.v[p.id] as string[]) : [];
      definir(p.id, atual.includes(opcao) ? atual.filter((o) => o !== opcao) : [...atual, opcao]);
    } else {
      definir(p.id, r.v[p.id] === opcao ? "" : opcao);
      if (p.type === "confirm" && opcao !== OPCOES_DE_CONFIRMACAO[0]) setNotaAberta(true);
    }
  }

  const selecionadas = Array.isArray(r.v[p.id]) ? (r.v[p.id] as string[]) : r.v[p.id] ? [r.v[p.id] as string] : [];
  const opcoes = p.type === "confirm" ? [...OPCOES_DE_CONFIRMACAO] : (p.opts ?? []);
  const iconeDaConfirmacao = [Check, Minus, X];
  // The stored value stays the fixed English constant; only the label follows the language.
  const rotuloDaConfirmacao = [t("Sim, está certo"), t("Em parte"), t("Não exatamente")];

  return (
    <div className={`space-y-3 rounded-lg border p-5 ${respondida ? "border-[color:var(--brief-accent)]/40" : ""}`}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{props.numero}</span>
        {respondida ? (
          <span className="inline-flex items-center gap-1" style={{ color: "var(--brief-accent)" }}>
            <Check className="size-3" aria-hidden /> {t("Respondida")}
          </span>
        ) : null}
      </div>
      <p id={rotuloId} className="font-medium">
        {p.q}
      </p>
      {p.hint ? <p className="text-sm text-muted-foreground">{p.hint}</p> : null}
      {p.found ? (
        <div className="flex gap-2 rounded-md bg-muted p-3 text-sm">
          <Sun className="mt-0.5 size-4 shrink-0" style={{ color: "var(--brief-accent)" }} aria-hidden />
          <div>
            <b className="block">{t("O que anotamos")}</b>
            <span>{p.found}</span>
          </div>
        </div>
      ) : null}

      {p.type === "text" ? (
        <input
          aria-labelledby={rotuloId}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder={t("Escreva aqui")}
          value={String(r.v[p.id] ?? "")}
          onChange={(e) => definir(p.id, e.target.value)}
        />
      ) : null}
      {p.type === "long" ? (
        <textarea
          aria-labelledby={rotuloId}
          className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder={t("Escreva aqui")}
          value={String(r.v[p.id] ?? "")}
          onChange={(e) => definir(p.id, e.target.value)}
        />
      ) : null}

      {p.type === "confirm" || p.type === "one" || p.type === "many" ? (
        <>
          <div role="group" aria-labelledby={rotuloId} className="flex flex-wrap gap-2">
            {opcoes.map((o, i) => {
              const marcada = selecionadas.includes(o);
              const Icone = p.type === "confirm" ? iconeDaConfirmacao[i] ?? Check : Check;
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={marcada}
                  onClick={() => escolher(o)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
                    marcada ? "text-white" : "hover:bg-muted"
                  }`}
                  style={marcada ? { background: "var(--brief-accent)", borderColor: "var(--brief-accent)" } : undefined}
                >
                  {marcada || p.type === "confirm" ? <Icone className="size-3.5" aria-hidden /> : null}
                  {p.type === "confirm" ? rotuloDaConfirmacao[i] : o}
                </button>
              );
            })}
          </div>
          {notaAberta ? (
            <input
              aria-label={`${t("Observação para")}: ${p.q}`}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder={p.type === "confirm" ? t("O que devemos corrigir ou acrescentar?") : t("Outra coisa, ou uma observação")}
              value={nota}
              onChange={(e) => definir(`${p.id}__note`, e.target.value)}
              autoFocus={!nota}
            />
          ) : (
            <button
              type="button"
              onClick={() => setNotaAberta(true)}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" aria-hidden /> {t("Adicionar uma observação")}
            </button>
          )}
        </>
      ) : null}

      {p.type === "file" ? (
        <CampoDeArquivo
          token={props.token}
          secaoId={props.secao.id}
          pergunta={p}
          rotuloId={rotuloId}
          arquivos={r.files[p.id] ?? []}
          link={String(r.v[`${p.id}__link`] ?? "")}
          aoMudarLink={(valor) => definir(`${p.id}__link`, valor)}
          aoAdicionar={(a) => mudar((x) => ({ ...x, files: { ...x.files, [p.id]: [...(x.files[p.id] ?? []), a] } }))}
          aoRemover={(path) =>
            mudar((x) => ({ ...x, files: { ...x.files, [p.id]: (x.files[p.id] ?? []).filter((a) => a.path !== path) } }))
          }
          aoFalhar={props.aoFalharEnvio}
        />
      ) : null}
    </div>
  );
}

function CampoDeArquivo(props: {
  token: string;
  secaoId: string;
  pergunta: Pergunta;
  rotuloId: string;
  arquivos: ArquivoDoBrief[];
  link: string;
  aoMudarLink: (valor: string) => void;
  aoAdicionar: (a: ArquivoDoBrief) => void;
  aoRemover: (path: string) => void;
  aoFalhar: () => void;
}) {
  const t = useT();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState<string[]>([]);
  const [sobre, setSobre] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar(lista: File[]) {
    setAviso(null);
    for (const arquivo of lista) {
      if (arquivo.size > 20 * 1024 * 1024) {
        setAviso(`${arquivo.name}: ${t("maior que 20 MB. Cole um link do Google Drive ou Dropbox abaixo.")}`);
        continue;
      }
      setEnviando((e) => [...e, arquivo.name]);
      try {
        const pedido = await fetch(`/api/v1/briefs/publico/${props.token}/upload`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ secao: props.secaoId, pergunta: props.pergunta.id, nome: arquivo.name, tamanho: arquivo.size }),
        });
        if (!pedido.ok) throw new Error(String(pedido.status));
        const { path, url } = (await pedido.json()) as { path: string; url: string };
        const envio = await fetch(url, {
          method: "PUT",
          headers: { "content-type": arquivo.type || "application/octet-stream", "x-upsert": "false" },
          body: arquivo,
        });
        if (!envio.ok) throw new Error(String(envio.status));
        props.aoAdicionar({ path, name: arquivo.name, type: arquivo.type, size: arquivo.size });
      } catch {
        setAviso(`${t("Não foi possível enviar")} ${arquivo.name}. ${t("Tente um arquivo menor ou cole um link.")}`);
        props.aoFalhar();
      } finally {
        setEnviando((e) => e.filter((n) => n !== arquivo.name));
      }
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={entrada}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          void enviar([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={0}
        aria-labelledby={props.rotuloId}
        onClick={() => entrada.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            entrada.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobre(false);
          void enviar([...e.dataTransfer.files]);
        }}
        className={`flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-4 text-sm ${sobre ? "bg-muted" : ""}`}
      >
        <Upload className="size-5 text-muted-foreground" aria-hidden />
        <div>
          <strong className="block">{t("Solte os arquivos aqui ou clique para enviar")}</strong>
          <span className="text-muted-foreground">{t("Imagens, PDFs ou vídeos, até 20 MB cada")}</span>
        </div>
      </div>
      {aviso ? <p className="text-sm text-destructive">{aviso}</p> : null}
      {props.arquivos.length || enviando.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {props.arquivos.map((a) => (
            <li key={a.path} className="group relative overflow-hidden rounded-md border">
              <a
                href={`/api/v1/briefs/publico/${props.token}/arquivo?path=${encodeURIComponent(a.path)}`}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                {a.type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/v1/briefs/publico/${props.token}/arquivo?path=${encodeURIComponent(a.path)}`}
                    alt={a.name}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <span className="flex aspect-square items-center justify-center bg-muted">
                    <FileText className="size-8 text-muted-foreground" aria-hidden />
                  </span>
                )}
                <span className="block truncate px-2 py-1 text-xs" title={a.name}>
                  {a.name}
                </span>
              </a>
              <button
                type="button"
                onClick={() => props.aoRemover(a.path)}
                aria-label={`${t("Remover")} ${a.name}`}
                className="absolute right-1 top-1 rounded-full bg-background/90 p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
          {enviando.map((n) => (
            <li key={n} className="flex aspect-square items-center justify-center rounded-md border text-xs text-muted-foreground">
              {t("Enviando")}…
            </li>
          ))}
        </ul>
      ) : null}
      <input
        aria-label={`${t("Link para")}: ${props.pergunta.q}`}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        placeholder={t("Ou cole um link do Google Drive ou Dropbox")}
        value={props.link}
        onChange={(e) => props.aoMudarLink(e.target.value)}
      />
    </div>
  );
}
