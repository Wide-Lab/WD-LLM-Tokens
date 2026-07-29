export interface MetricaBucket {
  grupo?: string;
  periodo?: string;
  requisicoes: number;
  tokens_entrada: number;
  tokens_saida: number;
  tokens_cache_leitura: number;
  tokens_cache_escrita: number;
  custo: number | null;
  moeda: string;
}

/**
 * Um balde de `/v1/consolidado/metricas`.
 *
 * **Sem `tokens_*`, sem `requisicoes`** — e a ausência é o contrato, não um esquecimento: token não
 * soma com mensagem. Volume fica no painel de cada origem.
 *
 * `origem` só vem quando a chamada pediu `por_origem`; `grupo` e `periodo`, quando pediu `grupo` e
 * `intervalo`. São três dimensões independentes, e é por isso que as três são opcionais.
 */
export interface ConsolidadoBucket {
  grupo?: string;
  periodo?: string;
  origem?: string;
  lancamentos: number;
  custo: number | null;
  moeda: string;
}

/**
 * Um balde de `/v1/whatsapp/metricas`.
 *
 * `mensagens` e `cobraveis` são o par que o painel mais usa: a diferença entre os dois é quanto do
 * atendimento caiu fora da janela gratuita. Ficam aqui e não no `ConsolidadoBucket` pela mesma
 * razão que os `tokens_*` ficam no do LLM — mensagem não soma com token.
 */
export interface MensagemBucket {
  grupo?: string;
  periodo?: string;
  mensagens: number;
  cobraveis: number;
  custo: number | null;
  moeda: string;
}

export interface MensagemItem {
  id: string;
  criado_em: string;
  aplicacao: string;
  ator: string;
  direcao: "enviada" | "recebida";
  /** `null` nas recebidas: a Meta categoriza o que sai, não o que entra. */
  categoria: "marketing" | "utility" | "authentication" | "service" | null;
  pais: string;
  cobravel: boolean;
  /** `0` quando não é cobrável, `null` quando é cobrável e falta preço para `(categoria, país)`. */
  custo: number | null;
  moeda: string;
  id_externo: string | null;
  /** O texto da mensagem — um campo só; `direcao` diz de quem é. `null` = não veio no evento. */
  conteudo: string | null;
  metadados: Record<string, unknown>;
}

export interface MensagensResponse {
  total: number;
  limite: number;
  offset: number;
  itens: MensagemItem[];
}

export interface EventoItem {
  id: string;
  criado_em: string;
  aplicacao: string;
  ator: string;
  modelo: string;
  provedor: string | null;
  tokens_entrada: number;
  tokens_saida: number;
  tokens_cache_leitura: number;
  tokens_cache_escrita: number;
  custo: number | null;
  moeda: string;
  id_externo: string | null;
  /** O que o ator mandou. `null` = não veio no evento (ou é anterior ao campo existir). */
  mensagem: string | null;
  /** O que o agente devolveu. */
  resposta: string | null;
  metadados: Record<string, unknown>;
}

export interface EventosResponse {
  total: number;
  limite: number;
  offset: number;
  itens: EventoItem[];
}
