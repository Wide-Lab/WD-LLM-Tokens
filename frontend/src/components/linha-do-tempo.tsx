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
 * Sem cor semântica de propósito: neste painel violeta é dinheiro e petróleo é token (`styles.css`),
 * e pintar "preventivo" de água aqui gastaria um sinal que a tela ao lado usa para outra coisa. O
 * que separa antes e depois do vencimento já é a posição no eixo, que é o dado literal.
 */
export function LinhaDoTempo({ regua, padrao }: { regua: Regua; padrao: Regua }) {
  const comparando = regua.id !== padrao.id;
  const ativas = ordenar(regua.etapas).filter((e) => e.ativa);
  const sombra = comparando ? ordenar(padrao.etapas).filter((e) => e.ativa) : [];

  if (ativas.length === 0 && sombra.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border border-dashed px-8 py-10 text-center text-sm">
        Nenhuma etapa ativa: esta régua não dispara nada.
      </div>
    );
  }

  // O eixo abre em pelo menos ±5 dias para que uma régua curta não apareça esticada de ponta a
  // ponta, o que faria D-1 e D+1 parecerem semanas de distância.
  const limite = Math.max(5, ...[...ativas, ...sombra].map((e) => Math.abs(e.deslocamento)));
  const posicao = (d: number) => ((d + limite) / (limite * 2)) * 100;

  return (
    <div
      className={cn(
        "bg-card overflow-hidden rounded-xl border px-8 pt-16 shadow-sm",
        comparando ? "pb-5" : "pb-10",
      )}
    >
      <div className={cn("bg-border relative h-px", comparando && "mb-24")}>
        <div
          className="bg-foreground absolute -top-2 h-4 w-px"
          style={{ left: `${posicao(0)}%` }}
          aria-hidden
        />
        <div
          className="etiqueta absolute top-3 -translate-x-1/2"
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
              <span className="text-xs font-medium whitespace-nowrap">{etapa.nome}</span>
              <span className="leitura bg-secondary text-secondary-foreground rounded-sm px-1.5 py-0.5 text-xs">
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
                  <span className="bg-border h-2 w-px" />
                  <span className="border-border grow border-t border-dashed" />
                  <span className="bg-border h-2 w-px" />
                  <span
                    className="leitura bg-card text-muted-foreground absolute -top-3.5 left-1/2 -translate-x-1/2 px-1 text-[0.625rem]"
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
                    desligada ? "border-muted-foreground/50 border-dashed" : "border-foreground",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "leitura text-muted-foreground mt-1 block text-[0.625rem] whitespace-nowrap",
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
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
          <span className="border-foreground h-2 w-2 rounded-full border" aria-hidden />
          posição na régua padrão
          <span
            className="border-muted-foreground/50 ml-2 h-2 w-2 rounded-full border border-dashed"
            aria-hidden
          />
          <span className="line-through">desligada aqui</span>
        </p>
      )}
    </div>
  );
}
