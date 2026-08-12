import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Lock, Search, SquarePen } from "lucide-react";

import { AvisoDeMock } from "@/components/aviso-mock";
import { DialogoVinculo } from "@/components/dialogo-vinculo";
import { EmptyBox, ErrorBox } from "@/components/empty-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  bloqueio,
  buscar,
  clientesPorRegua,
  reguaDoCliente,
  reguaPadrao,
  vinculoVazio,
  FLAGS,
  type Cliente,
} from "@/lib/clientes";
import { listarCarteira } from "@/lib/clientes-mock";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

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
 * O desenho da tela é uma costura, e ela é literal: à esquerda o que vem do portal, à direita o que
 * é nosso, com uma borda entre os dois. Cliente **não é cadastro nosso** — razão social, títulos em
 * aberto e as flags que suprimem são consulta, não registro editável, e uma tabela que misturasse as
 * duas metades convidaria alguém a corrigir um CNPJ aqui e esperar que o portal soubesse.
 *
 * Sem `<GlobalFilters>` de propósito, pelo mesmo motivo de `/precos` e `/whatsapp/templates`:
 * carteira é cadastro, não leitura de período. Recortar clientes por data de nada responderia.
 */
function Clientes() {
  const [termo, setTermo] = useState("");
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const q = useQuery({ queryKey: CHAVE, queryFn: listarCarteira });

  const clientes = useMemo(() => q.data?.clientes ?? [], [q.data]);
  const reguas = q.data?.reguas ?? [];
  const vinculos = q.data?.vinculos ?? {};

  const lista = useMemo(() => buscar(clientes, termo), [clientes, termo]);

  // O cliente aberto vem sempre da lista, e não do estado: depois de salvar, o objeto guardado no
  // clique é a versão anterior, e o diálogo seguiria mostrando o vínculo de antes da escrita.
  const aberto = abertoId ? (clientes.find((c) => c.id === abertoId) ?? null) : null;

  if (q.error) return <ErrorBox error={q.error} />;

  const padrao = reguas.length > 0 ? reguaPadrao(reguas) : null;
  const contagem = padrao ? clientesPorRegua(clientes, vinculos, reguas)[padrao.id] : 0;

  return (
    <div className="flex flex-col gap-4">
      <AvisoDeMock>
        Esta aba ainda não fala com o backend: a carteira vive em memória e volta ao início a cada
        recarga. No serviço real o cliente vem por consulta ao portal a cada abertura, e só o
        vínculo é nosso para gravar.
      </AvisoDeMock>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
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
        <p className="etiqueta">
          {formatNumber(lista.length)} de {formatNumber(clientes.length)}{" "}
          {clientes.length === 1 ? "cliente" : "clientes"}
        </p>
      </div>

      {q.isLoading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <EmptyBox
          message={
            clientes.length === 0
              ? "Nenhum cliente na carteira. Sem destinatário verificado, nenhuma régua tem para quem disparar."
              : "Nenhum cliente com esse termo. A busca é no portal, não numa lista nossa."
          }
        />
      ) : (
        <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
          <Table>
            <TableHeader>
              {/* A costura é o desenho: à esquerda o portal, à direita nós. */}
              <TableRow className="hover:bg-transparent">
                <TableHead colSpan={4} className="etiqueta bg-muted/50 py-2">
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3 shrink-0" aria-hidden />
                    Do portal
                  </span>
                </TableHead>
                <TableHead colSpan={4} className="etiqueta border-l-2 py-2">
                  Nosso
                </TableHead>
              </TableRow>
              <TableRow className="hover:bg-transparent">
                <TableHead className="etiqueta bg-muted/50 py-3">Cliente</TableHead>
                <TableHead className="etiqueta bg-muted/50 py-3">Cidade</TableHead>
                <TableHead className="etiqueta bg-muted/50 py-3 text-right">Em aberto</TableHead>
                <TableHead className="etiqueta bg-muted/50 py-3">Situação</TableHead>
                <TableHead className="etiqueta border-l-2 py-3">Régua</TableHead>
                <TableHead className="etiqueta py-3">Vínculo</TableHead>
                <TableHead className="etiqueta py-3">Gerente</TableHead>
                <TableHead className="w-10 pr-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((cliente) => (
                <Linha
                  key={cliente.id}
                  cliente={cliente}
                  regua={reguaDoCliente(reguas, (vinculos[cliente.id] ?? null)?.reguaId ?? null)}
                  vinculo={vinculos[cliente.id] ?? vinculoVazio(cliente.id)}
                  onAbrir={() => setAbertoId(cliente.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {padrao && (
        <p className="text-muted-foreground text-xs">
          A régua padrão é <strong>{padrao.nome}</strong>, e {formatNumber(contagem)} dos{" "}
          {formatNumber(clientes.length)} clientes caem nela — mexer nas etapas dela mexe em todo
          mundo que aparece como <em>herdada</em>. No serviço real esta lista é paginada e vem do
          portal a cada abertura.
        </p>
      )}

      <DialogoVinculo
        cliente={aberto}
        vinculo={aberto ? (vinculos[aberto.id] ?? vinculoVazio(aberto.id)) : null}
        reguas={reguas}
        aberto={aberto !== null}
        onOpenChange={(v) => !v && setAbertoId(null)}
      />
    </div>
  );
}

function Carregando() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

/**
 * Uma linha: o cliente do portal e o vínculo nosso, separados pela borda.
 *
 * O valor em aberto é a única quantia da tela e sai em mono **sem o violeta de custo**. Violeta
 * neste painel quer dizer "quanto nós gastamos" (`styles.css`), e aqui a quantia é dívida do cliente
 * no portal: reusar o tom faria o único número violeta da tela significar outra coisa.
 */
function Linha({
  cliente,
  regua,
  vinculo,
  onAbrir,
}: {
  cliente: Cliente;
  regua: { id: string; nome: string };
  vinculo: ReturnType<typeof vinculoVazio>;
  onAbrir: () => void;
}) {
  const barrado = bloqueio(cliente, vinculo);

  return (
    <TableRow
      // A linha inteira abre o vínculo porque é o motivo de estar aqui — mas o controle focável
      // continua sendo o botão do fim, que também abre e por isso segura o clique.
      onClick={onAbrir}
      className="cursor-pointer"
    >
      <TableCell className="bg-muted/40 py-3">
        <div className="text-sm font-medium">{cliente.razaoSocial}</div>
        <div className="text-muted-foreground mt-0.5 font-mono text-xs">{cliente.documento}</div>
      </TableCell>
      <TableCell className="bg-muted/40 text-muted-foreground text-xs whitespace-nowrap">
        {cliente.cidade}
      </TableCell>
      <TableCell className="bg-muted/40 text-right whitespace-nowrap">
        <span className="leitura text-sm">{formatCurrency(cliente.valorAberto, "BRL")}</span>
        <span className="text-muted-foreground ml-1.5 text-xs">
          {formatNumber(cliente.titulosAbertos)} tít.
        </span>
      </TableCell>
      <TableCell className="bg-muted/40 text-xs">
        {cliente.flags.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          cliente.flags.map((f) => FLAGS[f]).join(" · ")
        )}
      </TableCell>

      <TableCell className="border-l-2">
        <div className={cn("text-sm", vinculo.reguaId ? "font-medium" : "text-muted-foreground")}>
          {regua.nome}
        </div>
        {/* Herdada é o caso comum, e precisa ser lido como escolha e não como campo em branco. */}
        {!vinculo.reguaId && <div className="etiqueta mt-1">herdada</div>}
      </TableCell>
      <TableCell className="text-xs">
        {vinculo.numeroVinculado ? (
          <span className="font-mono whitespace-nowrap">{vinculo.numeroVinculado}</span>
        ) : (
          <span className="text-muted-foreground">sem número</span>
        )}
        {barrado && <div className="text-destructive mt-1">não recebe · {barrado}</div>}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
        {vinculo.gerenteDaConta ?? "—"}
      </TableCell>
      <TableCell className="pr-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onAbrir();
          }}
          aria-label={`Editar vínculo de ${cliente.razaoSocial}`}
        >
          <SquarePen className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
