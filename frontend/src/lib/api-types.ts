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
  provedor: string;
  tokens_entrada: number;
  tokens_saida: number;
  tokens_cache_leitura: number;
  tokens_cache_escrita: number;
  custo: number | null;
  moeda: string;
  metadados: Record<string, unknown>;
}

export interface EventosResponse {
  total: number;
  limite: number;
  offset: number;
  itens: EventoItem[];
}
