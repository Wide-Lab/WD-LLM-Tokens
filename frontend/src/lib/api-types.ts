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
