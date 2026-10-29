import { PainelCard } from "@/components/painel-card";
import { comSinal, ordenar, rotuloDe, type Regua } from "@/lib/reguas";
import { cn } from "@/lib/utils";

/**
 * A régua inteira numa linha, com a padrão por baixo quando há o que comparar.
 *
 * Uma tabela de etapas responde "o que está configurado"; ela não responde "quanto tempo o cliente
 * fica sem ouvir nada", que é a pergunta de quem mexe numa régua. O eixo responde: a distância
 * entre dois pontos é a distância entre dois disparos, e o vencimento é a marca que dá sentido ao
 * sinal do deslocamento.
 *
 * Numa régua personalizada, as posições da padrão aparecem como círculos vazados abaixo do eixo,
 * ligadas por um traço à posição nova — um desvio só quer dizer alguma coisa em relação ao que ele
 * substitui, e é essa distância, não a lista de etapas, que a pessoa veio conferir.
 *
 * Sem cor semântica de propósito: cor de dado tem papel fixo (`lib/grafico.ts` — origem, categoria,
 * baldes), e pintar "preventivo" de uma série gastaria um sinal que o resto do painel usa para outra
 * coisa. O que separa antes e depois do vencimento já é a posição no eixo, que é o dado literal.
 * O desenho é todo em `fg` e nos cinzas do tema, e o accent não entra: ele marca ação, não dado.
 */
export function LinhaDoTempo({ regua, padrao }: { regua: Regua; padrao: Regua }) {
  const comparando = regua.id !== padrao.id;
  const ativas = ordenar(regua.etapas).filter((e) => e.ativa);
  const sombra = comparando ? ordenar(padrao.etapas).filter((e) => e.ativa) : [];
  const vazia = ativas.length === 0 && sombra.length === 0;

  // O eixo abre em pelo menos ±5 dias para que uma régua curta não apareça esticada de ponta a
  // ponta, o que faria D-1 e D+1 parecerem semanas de distância.
  const limite = Math.max(5, ...[...ativas, ...sombra].map((e) => Math.abs(e.deslocamento)));
  const posicao = (d: number) => ((d + limite) / (limite * 2)) * 100;

  return (
    <PainelCard
      title="Linha do tempo"
      hint={comparando ? `sobre a padrão, ${padrao.nome}` : "dias a partir do vencimento"}
      bleed
      empty={vazia}
      emptyMessage="Nenhuma etapa ativa: esta régua não dispara nada."
    >
      <div className={cn("overflow-hidden px-8 pt-16", comparando ? "pb-5" : "pb-10")}>
        <div className={cn("bg-line relative h-px", comparando && "mb-24")}>
          <div
            className="bg-foreground absolute -top-2 h-4 w-px"
            style={{ left: `${posicao(0)}%` }}
            aria-hidden
          />
          <div
            className="text-subtle absolute top-3 -translate-x-1/2 text-xs"
            style={{ left: `${posicao(0)}%` }}
          >
            venc.
          </div>

          {ativas.map((etapa) => (
            <div
              key={etapa.id}
              className="absolute -translate-x-1/2"
              style={{ left: `${posicao(etapa.deslocamento)}%`, top: "-3.75rem" }}
            >
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-foreground text-xs font-medium whitespace-nowrap">
                  {etapa.nome}
                </span>
                <span className="bg-sel text-foreground rounded-[var(--wu-radius-sm)] px-1.5 py-0.5 text-xs font-medium tabular-nums">
                  {rotuloDe(etapa)}
                </span>
                <span className="bg-foreground mt-1 h-2 w-2 rounded-full" aria-hidden />
              </div>
            </div>
          ))}

          {sombra.map((origem) => {
            const atual = regua.etapas.find((e) => e.origemId === origem.id);
            const desligada = !atual || !atual.ativa;
            const moveu = !desligada && atual.deslocamento !== origem.deslocamento;
            const de = posicao(origem.deslocamento);
            const para = moveu ? posicao(atual.deslocamento) : de;

            return (
              <div key={origem.id}>
                {moveu && (
                  <div
                    className="absolute top-9 flex items-center"
                    style={{ left: `${Math.min(de, para)}%`, width: `${Math.abs(para - de)}%` }}
                  >
                    <span className="bg-line-strong h-2 w-px" />
                    <span className="border-line-strong grow border-t border-dashed" />
                    <span className="bg-line-strong h-2 w-px" />
                    <span
                      className="bg-card text-subtle absolute -top-3.5 left-1/2 -translate-x-1/2 px-1 text-xs tabular-nums"
                      title="diferença em relação à régua padrão"
                    >
                      {comSinal(atual.deslocamento - origem.deslocamento)} d
                    </span>
                  </div>
                )}
                <div
                  className="absolute top-14 -translate-x-1/2 text-center"
                  style={{ left: `${de}%` }}
                >
                  <span
                    className={cn(
                      "mx-auto block h-2 w-2 rounded-full border",
                      desligada ? "border-subtle border-dashed" : "border-foreground",
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      "text-subtle mt-1 block text-xs whitespace-nowrap tabular-nums",
                      desligada && "line-through",
                    )}
                  >
                    {rotuloDe(origem)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {comparando && (
          <p className="border-line text-subtle flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
            <span className="border-foreground h-2 w-2 rounded-full border" aria-hidden />
            posição na régua padrão
            <span
              className="border-subtle ml-2 h-2 w-2 rounded-full border border-dashed"
              aria-hidden
            />
            <span className="line-through">desligada aqui</span>
          </p>
        )}
      </div>
    </PainelCard>
  );
}
