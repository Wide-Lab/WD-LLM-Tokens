import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Search, TriangleAlert } from "lucide-react";

import { CabecalhoDaPagina } from "@/components/cabecalho-da-pagina";
import { DialogoVinculo } from "@/components/dialogo-vinculo";
import { ErrorBox } from "@/components/empty-states";
import { PainelCard } from "@/components/painel-card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { bloqueio, buscar, vinculoVazio, type Cliente, type Vinculo } from "@/lib/clientes";
import { listarCarteira } from "@/lib/clientes-mock";
import { reguaDoCliente, type Regua } from "@/lib/reguas";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn, haTextoSelecionado } from "@/lib/utils";

export const Route = createFileRoute("/disparos/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Painel de custos" },
      {
        name: "description",
        content: "Carteira de disparo: quem recebe, por qual régua e em que número verificado.",
      },
      { property: "og:title", content: "Clientes — Painel de custos" },
      {
        property: "og:description",
        content: "O que vem do portal e o que é nosso, na mesma linha.",
      },
    ],
  }),
  component: Clientes,
});

const CHAVE = ["carteira-disparos"];

/**
 * A carteira de disparo — a primeira aba de Disparos, e a outra metade do "antes".
 *
 * O painel inteiro lê fato. `Templates` foi a primeira exceção: o texto que existe antes da
 * mensagem. Esta é a segunda, pelo outro lado: o texto aprovado não dispara sozinho, precisa de um
 * destinatário verificado e de um ritmo. Mexer aqui muda o gasto de amanhã pelo **volume**, como
 * mexer no template muda pela tarifa — e é por isso que Disparos é uma seção própria, e não uma
 * quarta aba do WhatsApp: o WhatsApp é o canal, o disparo é a decisão de usar o canal.
 *
 * Cliente **não é cadastro nosso** — razão social e títulos em aberto são consulta, não registro
 * editável. O que se edita aqui é só o vínculo: a régua atribuída, o número verificado e o gerente.
 *
 * Sem `<GlobalFilters>` de propósito, pelo mesmo motivo de `/precos` e `/whatsapp/templates`:
 * carteira é cadastro, não leitura de período. Recortar clientes por data de nada responderia.
 */
function Clientes() {
  const [termo, setTermo] = useState("");
  const [abertoId, setAbertoId] = useState<string | null>(null);

  // Quem abriu o diálogo — o nome do cliente, a linha —, para o foco voltar a ele ao fechar. O
  // diálogo não tem `DialogTrigger`, e sem isto o foco cairia no `<body>`.
  const origemDoFoco = useRef<HTMLElement | null>(null);
  const abrir = (c: Cliente) => {
    origemDoFoco.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAbertoId(c.id);
  };

  const q = useQuery({ queryKey: CHAVE, queryFn: listarCarteira });

  const clientes = useMemo(() => q.data?.clientes ?? [], [q.data]);
  const reguas = q.data?.reguas ?? [];
  const vinculos = q.data?.vinculos ?? {};

  const lista = useMemo(() => buscar(clientes, termo), [clientes, termo]);

  // O cliente aberto vem sempre da lista, e não do estado: depois de salvar, o objeto guardado no
  // clique é a versão anterior, e o diálogo seguiria mostrando o vínculo de antes da escrita.
  const aberto = abertoId ? (clientes.find((c) => c.id === abertoId) ?? null) : null;

  // As duas metades da linha, lidas uma vez: o vínculo ausente vira o vazio, e a régua já vem
  // resolvida (vínculo sem régua é a padrão).
  const linhas = lista.map((cliente) => {
    const vinculo = vinculos[cliente.id] ?? vinculoVazio(cliente.id);
    return { cliente, vinculo, regua: reguaDoCliente(reguas, vinculo.reguaId) };
  });

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDaPagina
        titulo="Clientes"
        subtitulo="Quem recebe o disparo, por qual régua e em que número verificado"
      />

      {q.error ? (
        <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <div className="relative w-full max-w-sm">
            <Search
              className="text-subtle pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              className="pl-9"
              placeholder="Buscar por razão social, CNPJ ou cidade"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              aria-label="Buscar cliente"
            />
          </div>

          <PainelCard
            title="Carteira"
            hint={
              q.isLoading
                ? undefined
                : `${formatNumber(lista.length)} de ${formatNumber(clientes.length)} ${clientes.length === 1 ? "cliente" : "clientes"}`
            }
            bleed
            loading={q.isLoading}
            empty={lista.length === 0}
            emptyMessage={
              clientes.length === 0
                ? "Nenhum cliente na carteira."
                : "Nenhum cliente com esse termo."
            }
          >
            {/* Abaixo de 700px a tabela vira lista de cartões: os mesmos fatos, sem rolagem lateral. */}
            <ul className="divide-line divide-y min-[700px]:hidden">
              {linhas.map((l) => (
                <ClienteCartao key={l.cliente.id} {...l} onAbrir={abrir} />
              ))}
            </ul>
            <div className="hidden min-[700px]:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Cliente</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead className="text-right">Em aberto</TableHead>
                    <TableHead>Régua</TableHead>
                    <TableHead>Vínculo</TableHead>
                    <TableHead className="pr-4">Gerente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l) => (
                    <ClienteLinha key={l.cliente.id} {...l} onAbrir={abrir} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </PainelCard>
        </>
      )}

      <DialogoVinculo
        cliente={aberto}
        vinculo={aberto ? (vinculos[aberto.id] ?? vinculoVazio(aberto.id)) : null}
        reguas={reguas}
        aberto={aberto !== null}
        onOpenChange={(v) => !v && setAbertoId(null)}
        origemDoFoco={origemDoFoco}
      />
    </div>
  );
}

/**
 * O que identifica o cliente numa linha: razão social e documento.
 *
 * A razão social é o botão que abre o vínculo: a linha inteira abre, mas uma `<tr>` com `onClick` não
 * é focável, e este é o caminho do teclado e do leitor de tela.
 */
function Identificacao({
  cliente,
  comCidade,
  onAbrir,
}: {
  cliente: Cliente;
  /** No cartão a cidade não tem coluna e vai na linha do documento. */
  comCidade?: boolean;
  onAbrir: (c: Cliente) => void;
}) {
  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={(e) => {
          // Para aqui: o resto da linha também abre, e sem isto o clique abriria duas vezes.
          e.stopPropagation();
          onAbrir(cliente);
        }}
        className="text-foreground min-w-0 cursor-pointer rounded-[var(--wu-radius-sm)] text-left text-[13.5px] font-medium [overflow-wrap:anywhere] hover:underline"
      >
        {cliente.razaoSocial}
      </button>
      <div className="text-subtle mt-0.5 text-xs tabular-nums">
        {cliente.documento}
        {comCidade && ` · ${cliente.cidade}`}
      </div>
    </div>
  );
}

/**
 * O valor em aberto é a única quantia da tela, e sai em `fg` como o resto: é dívida do cliente no
 * portal, não gasto nosso, e por isso não leva o tratamento de custo de nenhum outro número.
 */
function EmAberto({ cliente }: { cliente: Cliente }) {
  return (
    <>
      <span className="text-foreground tabular-nums">
        {formatCurrency(cliente.valorAberto, "BRL")}
      </span>
      <span className="text-subtle ml-1.5 text-xs">
        {formatNumber(cliente.titulosAbertos)} tít.
      </span>
    </>
  );
}

/** A régua que vale para o cliente. Sem atribuição ela é a padrão, e precisa ler-se como escolha. */
function CelulaDeRegua({ regua, vinculo }: { regua: Regua; vinculo: Vinculo }) {
  return (
    <>
      <span
        className={cn(
          "text-[13.5px]",
          vinculo.reguaId ? "text-foreground font-medium" : "text-muted-foreground",
        )}
      >
        {regua.nome}
      </span>
      {!vinculo.reguaId && <span className="text-subtle ml-1.5 text-xs">herdada</span>}
    </>
  );
}

/**
 * O número verificado e, quando a régua não vai rodar para ele, o porquê. O bloqueio sai em `danger`
 * e sem pílula: o mapeamento de status do painel não cobre "não recebe", e ele é condição que
 * bloqueia, como o "Sem versão aprovada" do template.
 */
function CelulaDeVinculo({ cliente, vinculo }: { cliente: Cliente; vinculo: Vinculo }) {
  const barrado = bloqueio(cliente, vinculo);

  return (
    <>
      {vinculo.numeroVinculado ? (
        <span className="text-foreground text-xs tabular-nums">{vinculo.numeroVinculado}</span>
      ) : (
        <span className="text-subtle text-xs">sem número</span>
      )}
      {barrado && (
        <p className="text-danger mt-1 flex items-start gap-1.5 text-xs">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          não recebe · {barrado}
        </p>
      )}
    </>
  );
}

interface PropsDaLinha {
  cliente: Cliente;
  vinculo: Vinculo;
  regua: Regua;
  onAbrir: (c: Cliente) => void;
}

/** Uma linha: o cliente do portal e o vínculo nosso, na mesma tabela. */
function ClienteLinha({ cliente, vinculo, regua, onAbrir }: PropsDaLinha) {
  return (
    // A linha inteira abre o vínculo, porque é o motivo de estar aqui. Clique que terminou uma
    // seleção de texto é cópia, não pedido de abrir.
    <TableRow
      onClick={() => {
        if (haTextoSelecionado()) return;
        onAbrir(cliente);
      }}
      className="cursor-pointer"
    >
      <TableCell className="pl-4">
        <Identificacao cliente={cliente} onAbrir={onAbrir} />
      </TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{cliente.cidade}</TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <EmAberto cliente={cliente} />
      </TableCell>
      <TableCell>
        <CelulaDeRegua regua={regua} vinculo={vinculo} />
      </TableCell>
      <TableCell>
        <CelulaDeVinculo cliente={cliente} vinculo={vinculo} />
      </TableCell>
      <TableCell className="text-muted-foreground pr-4 whitespace-nowrap">
        {vinculo.gerenteDaConta ?? "—"}
      </TableCell>
    </TableRow>
  );
}

/** O mesmo cliente abaixo de 700px: o portal em cima e o que é nosso embaixo. */
function ClienteCartao({ cliente, vinculo, regua, onAbrir }: PropsDaLinha) {
  return (
    // O cartão inteiro abre, como a linha da tabela; o botão do nome continua sendo o caminho do
    // teclado.
    <li
      onClick={() => {
        if (haTextoSelecionado()) return;
        onAbrir(cliente);
      }}
      className="flex cursor-pointer flex-col gap-2 px-4 py-3"
    >
      <Identificacao cliente={cliente} comCidade onAbrir={onAbrir} />
      <div className="text-[13px]">
        <EmAberto cliente={cliente} />
      </div>
      <div className="flex flex-col gap-1 pt-2">
        <div>
          <CelulaDeRegua regua={regua} vinculo={vinculo} />
        </div>
        <div>
          <CelulaDeVinculo cliente={cliente} vinculo={vinculo} />
        </div>
        <div className="text-muted-foreground text-xs">
          Gerente · {vinculo.gerenteDaConta ?? "—"}
        </div>
      </div>
    </li>
  );
}
