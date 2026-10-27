import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";

import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateOnly } from "@/lib/format";
import { cn, haTextoSelecionado } from "@/lib/utils";

/** Uma vigência já formatada para a tela: a data em que passou a valer e as tarifas dela. */
export interface Vigencia {
  id: string;
  /** ISO sem hora, como vem do backend. */
  desde: string;
  leituras: { rotulo: string; valor: string }[];
}

/** Uma linha da tabela de preços: o que está sendo precificado, com todas as vigências dele. */
export interface ItemDePreco {
  chave: string;
  titulo: string;
  /** Fato secundário (o provedor do modelo) — vai na linha meta, e não numa coluna a mais. */
  meta?: string | null;
  /** Todas as vigências deste item, da mais nova para a mais antiga (a ordem do backend). */
  vigencias: Vigencia[];
  onNovoPreco: () => void;
}

/**
 * As palavras que mudam de uma aba para a outra: modelo tem "preço", mensagem tem "tarifa". Cada
 * aba fala uma só — o botão do cabeçalho, a ação da linha e o diálogo dizem a mesma coisa.
 */
export interface TermosDePreco {
  /** A ação de cadastrar: "Novo preço", "Nova tarifa". */
  acao: string;
  /** Sujeito da frase de quando nada vale ainda: "O primeiro preço", "A primeira tarifa". */
  primeiro: string;
  /** Prefixo da data do reajuste agendado: "novo preço em", "nova tarifa em". */
  proximo: string;
}

/** Dias desde a época, a partir da string ISO — sem `new Date(iso)`, que desloca o fuso. */
function emDias(iso: string): number {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return Date.UTC(ano, mes - 1, dia) / 86_400_000;
}

function hojeEmDias(): number {
  const hoje = new Date();
  return Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) / 86_400_000;
}

interface Situacao {
  /** A que vale hoje. Sem ela, só há preço agendado e o custo fica em branco até ele começar. */
  atual: Vigencia | undefined;
  futuras: Vigencia[];
  anteriores: Vigencia[];
  /** As que já começaram (a atual e as anteriores), da mais nova para a mais antiga. */
  valendo: Vigencia[];
}

/**
 * "Vigente" é a de maior `desde` que já começou — a mesma regra do `LEFT JOIN LATERAL` que calcula
 * o custo. Pegar simplesmente a mais recente mostraria um preço agendado para o mês que vem como se
 * ele já estivesse valendo.
 */
function situacaoDe(vigencias: Vigencia[]): Situacao {
  const hoje = hojeEmDias();
  const futuras = vigencias.filter((v) => emDias(v.desde) > hoje);
  const valendo = vigencias.filter((v) => emDias(v.desde) <= hoje);
  return { atual: valendo[0], futuras, anteriores: valendo.slice(1), valendo };
}

/** A primeira data em que algum preço deste item passa a valer, quando nenhum vale ainda. */
function primeiroInicio(s: Situacao): string | null {
  return s.futuras.length > 0 ? s.futuras[s.futuras.length - 1].desde : null;
}

/** A data do próximo reajuste, quando há preço vigente e outro já agendado para depois. */
function proximoInicio(s: Situacao): string | null {
  return s.atual && s.futuras.length > 0 ? s.futuras[s.futuras.length - 1].desde : null;
}

/**
 * O provedor e quantas vigências ficaram para trás — o que pode sair truncado sem perder nada vital.
 * As datas (do primeiro preço, do reajuste agendado) não entram aqui: na tabela elas têm lugar
 * próprio, e no cartão são somadas à parte.
 */
function linhaMeta(item: ItemDePreco, s: Situacao): string {
  return [
    item.meta,
    s.anteriores.length === 1
      ? "1 vigência anterior"
      : s.anteriores.length > 1
        ? `${s.anteriores.length} vigências anteriores`
        : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * A situação do preço como pílula. "Sem preço vigente" é `pending`, o mesmo tom do "Sem preço" das
 * mensagens do WhatsApp: é o mesmo buraco visto do outro lado — custo em branco até haver preço.
 */
function PilulasDeSituacao({ s, className }: { s: Situacao; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {s.atual ? (
        <StatusPill tom="done">Vigente</StatusPill>
      ) : (
        <StatusPill tom="pending">Sem preço vigente</StatusPill>
      )}
      {s.atual && s.futuras.length > 0 && <StatusPill tom="progress">Agendado</StatusPill>}
    </div>
  );
}

/**
 * A régua de vigência: as vigências como faixas proporcionais ao tempo que cada uma valeu.
 *
 * Ela existe porque `preco_modelo` é a única tabela do painel em que uma linha não é um fato, é um
 * **trecho de tempo** — e é o trecho, não o valor, que decide qual evento sai por quanto. A régua
 * responde de relance há quanto tempo o preço atual vale, e se o anterior valeu uma semana ou dois
 * anos. Só aparece com duas vigências ou mais: com uma só, uma faixa cheia não compara nada.
 */
function ReguaDeVigencia({ vigencias }: { vigencias: Vigencia[] }) {
  const fim = hojeEmDias();

  return (
    <div>
      <div className="flex h-1.5 w-full gap-px" aria-hidden="true">
        {vigencias.map((v, i) => {
          const proxima = i + 1 < vigencias.length ? emDias(vigencias[i + 1].desde) : fim;
          const duracao = Math.max(proxima - emDias(v.desde), 1);
          const atual = i === vigencias.length - 1;

          return (
            <span
              key={v.id}
              // `flexBasis: 0` com `flexGrow` proporcional: a largura sai da duração, não do
              // conteúdo. O mínimo em pixel evita que uma vigência de um dia suma da régua.
              style={{ flexGrow: duracao, flexBasis: 0, minWidth: "0.375rem" }}
              className={cn("rounded-[1px]", atual ? "bg-foreground" : "bg-line-strong")}
            />
          );
        })}
      </div>
      <div className="text-subtle mt-1.5 flex justify-between text-xs">
        <span>{formatDateOnly(vigencias[0].desde)}</span>
        <span>hoje</span>
      </div>
      <span className="sr-only">
        {vigencias.length} vigências, da mais antiga em {formatDateOnly(vigencias[0].desde)} até a
        atual, que vale desde {formatDateOnly(vigencias[vigencias.length - 1].desde)}.
      </span>
    </div>
  );
}

/**
 * O histórico de um item, aberto na própria linha: todas as vigências da mais nova para a mais
 * antiga, a agendada e a vigente marcadas, e a régua quando há o que comparar.
 */
function Historico({ s, termos }: { s: Situacao; termos: TermosDePreco }) {
  const inicio = primeiroInicio(s);
  const todas = [...s.futuras, ...s.valendo];

  return (
    <div className="flex flex-col gap-3 pt-2">
      {!s.atual && inicio && (
        <p className="text-muted-foreground text-[13px]">
          {termos.primeiro} só começa em {formatDateOnly(inicio)}. Até lá, o custo fica em branco no
          painel.
        </p>
      )}
      {s.valendo.length >= 2 && <ReguaDeVigencia vigencias={[...s.valendo].reverse()} />}
      <ol className="border-line bg-card divide-line divide-y rounded-[var(--wu-radius)] border">
        {todas.map((v) => (
          <li
            key={v.id}
            className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-3 py-2.5 text-[13px]"
          >
            <span className="text-muted-foreground w-[5.5rem] shrink-0">
              {formatDateOnly(v.desde)}
            </span>
            <span className="w-[5.5rem] shrink-0">
              {v === s.atual ? (
                <StatusPill tom="done">Vigente</StatusPill>
              ) : s.futuras.includes(v) ? (
                <StatusPill tom="progress">Agendado</StatusPill>
              ) : null}
            </span>
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              {v.leituras.map((l) => (
                <span key={l.rotulo} className="flex items-baseline gap-1.5">
                  <span className="text-subtle text-[12.5px]">{l.rotulo}</span>
                  <span className="text-foreground font-medium">{l.valor}</span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * O botão que abre o histórico. A linha inteira também abre, mas uma `<tr>` com `onClick` não é
 * focável: o botão é o caminho do teclado, e segura o próprio clique para a linha não alternar duas
 * vezes. `comRotulo` é a forma do cartão, em que o ícone sozinho não diz o que abre.
 */
function BotaoDeHistorico({
  aberto,
  onClick,
  comRotulo,
}: {
  aberto: boolean;
  onClick: () => void;
  comRotulo?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size={comRotulo ? "sm" : "icon"}
      className={comRotulo ? "-ml-2 h-8 px-2" : "h-8 w-8"}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-expanded={aberto}
      aria-label={aberto ? "Ocultar histórico" : "Ver histórico"}
    >
      <ChevronDown className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")} />
      {comRotulo && (aberto ? "Ocultar histórico" : "Ver histórico")}
    </Button>
  );
}

/**
 * A tabela de preços: uma linha por **o que está sendo precificado** (um modelo, um par
 * categoria/país), com as tarifas que valem hoje — e o histórico de vigências dentro da linha,
 * aberto sob demanda.
 *
 * Não é a lista crua de `preco_modelo`: ela repetiria o mesmo modelo em cada reajuste e enterraria
 * a pergunta que se faz aqui ("quanto custa hoje?") no meio do histórico, que é a pergunta rara.
 * Abaixo de 700px vira lista de cartões, com as mesmas informações e sem rolagem lateral.
 */
export function TabelaDePrecos({
  itens,
  rotuloDoItem,
  colunas,
  termos,
}: {
  itens: ItemDePreco[];
  /** O nome da primeira coluna: "Modelo", "Tarifa". */
  rotuloDoItem: string;
  /** Os rótulos das leituras de cada vigência, na ordem em que vêm em `leituras`. */
  colunas: string[];
  termos: TermosDePreco;
}) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const alternar = (chave: string) =>
    setAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });

  return (
    <>
      <ul className="divide-line divide-y min-[700px]:hidden">
        {itens.map((item) => (
          <PrecoCartao
            key={item.chave}
            item={item}
            termos={termos}
            aberto={abertos.has(item.chave)}
            onAlternar={alternar}
          />
        ))}
      </ul>
      <div className="hidden min-[700px]:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-3">
                <span className="sr-only">Histórico</span>
              </TableHead>
              <TableHead>{rotuloDoItem}</TableHead>
              <TableHead>Situação</TableHead>
              {colunas.map((c) => (
                <TableHead key={c} className="text-right">
                  {c}
                </TableHead>
              ))}
              <TableHead className="text-right">Desde</TableHead>
              <TableHead className="w-12 pr-4">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((item) => (
              <PrecoLinha
                key={item.chave}
                item={item}
                colunas={colunas}
                termos={termos}
                aberto={abertos.has(item.chave)}
                onAlternar={alternar}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function PrecoLinha({
  item,
  colunas,
  termos,
  aberto,
  onAlternar,
}: {
  item: ItemDePreco;
  colunas: string[];
  termos: TermosDePreco;
  aberto: boolean;
  onAlternar: (chave: string) => void;
}) {
  const s = situacaoDe(item.vigencias);
  const meta = linhaMeta(item, s);
  const inicio = primeiroInicio(s);
  const proximo = proximoInicio(s);

  return (
    <>
      <TableRow
        onClick={() => {
          if (haTextoSelecionado()) return;
          onAlternar(item.chave);
        }}
        className={cn("group cursor-pointer", aberto && "bg-raised hover:bg-raised border-b-0")}
      >
        <TableCell className="pr-0 pl-3">
          <BotaoDeHistorico aberto={aberto} onClick={() => onAlternar(item.chave)} />
        </TableCell>
        {/* Teto e piso da coluna no `div` interno, que é onde o `truncate` dos nomes corta. */}
        <TableCell>
          <div className="max-w-[11rem] min-w-[8rem]">
            <div className="text-foreground truncate font-medium" title={item.titulo}>
              {item.titulo}
            </div>
            {meta && (
              <div className="text-subtle truncate text-xs" title={meta}>
                {meta}
              </div>
            )}
            {/* A data do reajuste agendado vai numa linha própria, fora do `truncate`: é o que a
                pílula "Agendado" não diz, e cortada ela perderia o ano. */}
            {proximo && (
              <div className="text-subtle text-xs whitespace-nowrap">
                {termos.proximo} {formatDateOnly(proximo)}
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <PilulasDeSituacao s={s} className="flex-col items-start" />
        </TableCell>
        {colunas.map((c, i) => (
          <TableCell key={c} className="text-foreground text-right whitespace-nowrap">
            {s.atual ? (s.atual.leituras[i]?.valor ?? "—") : <span className="text-subtle">—</span>}
          </TableCell>
        ))}
        <TableCell className="text-muted-foreground text-right whitespace-nowrap">
          {/* Sem preço vigente, "Desde" mostra quando o primeiro começa — é a única data útil da
              linha —, no tom apagado que a separa de uma vigência que já vale. */}
          {s.atual ? (
            formatDateOnly(s.atual.desde)
          ) : (
            <span className="text-subtle">{inicio ? formatDateOnly(inicio) : "—"}</span>
          )}
        </TableCell>
        <TableCell className="pr-4 text-right">
          {/* Ação de linha do wide-ui: só ícone, aparece no hover ou no foco; sem hover (toque), fica. */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              item.onNovoPreco();
            }}
            aria-label={`${termos.acao} para ${item.titulo}`}
            title={termos.acao}
          >
            <Plus />
          </Button>
        </TableCell>
      </TableRow>

      {aberto && (
        <TableRow className="bg-raised hover:bg-raised">
          <TableCell colSpan={colunas.length + 5} className="h-auto px-4 pt-0 pb-4">
            <Historico s={s} termos={termos} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/** A mesma linha abaixo de 700px: nome e situação em cima, as tarifas, e as duas ações. */
function PrecoCartao({
  item,
  termos,
  aberto,
  onAlternar,
}: {
  item: ItemDePreco;
  termos: TermosDePreco;
  aberto: boolean;
  onAlternar: (chave: string) => void;
}) {
  const s = situacaoDe(item.vigencias);
  const inicio = primeiroInicio(s);
  const proximo = proximoInicio(s);
  // No cartão a meta não trunca e não há coluna "Desde": as datas entram nela.
  const meta = [
    linhaMeta(item, s) || null,
    s.atual ? `desde ${formatDateOnly(s.atual.desde)}` : null,
    proximo ? `${termos.proximo} ${formatDateOnly(proximo)}` : null,
    !s.atual && inicio
      ? `${termos.primeiro.toLowerCase()} começa em ${formatDateOnly(inicio)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    // O cartão inteiro abre o histórico, como a linha da tabela; o botão é o caminho do teclado.
    <li
      onClick={() => {
        if (haTextoSelecionado()) return;
        onAlternar(item.chave);
      }}
      className="flex cursor-pointer flex-col gap-2 px-4 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-foreground truncate font-medium" title={item.titulo}>
            {item.titulo}
          </div>
          {meta && <div className="text-subtle text-xs">{meta}</div>}
        </div>
        <PilulasDeSituacao s={s} className="shrink-0 justify-end" />
      </div>

      {s.atual && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {s.atual.leituras.map((l) => (
            <div key={l.rotulo} className="min-w-0">
              <dt className="text-subtle text-xs">{l.rotulo}</dt>
              <dd className="text-foreground text-[13.5px] font-medium">{l.valor}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex items-center justify-between gap-2">
        <BotaoDeHistorico aberto={aberto} onClick={() => onAlternar(item.chave)} comRotulo />
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            item.onNovoPreco();
          }}
          aria-label={`${termos.acao} para ${item.titulo}`}
        >
          <Plus />
          {termos.acao}
        </Button>
      </div>

      {/* O clique dentro do histórico não sobe ao `<li>`: ler e tocar numa vigência não o fecha. */}
      {aberto && (
        <div onClick={(e) => e.stopPropagation()}>
          <Historico s={s} termos={termos} />
        </div>
      )}
    </li>
  );
}
