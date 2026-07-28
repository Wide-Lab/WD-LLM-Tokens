/**
 * O cliente da API.
 *
 * Sem URL configurável e sem chave: o painel e a API são servidos pelo mesmo nginx (o painel na
 * raiz, a API sob `/api`), então a base é sempre relativa e o cookie de sessão — `HttpOnly`, de
 * mesma origem — viaja sozinho. Antes daqui a chave de leitura morava no `localStorage`, o que
 * significava expor no browser o segredo que abre todos os dados de custo.
 */

const BASE = "/api";

export type Params = Record<string, string | number | undefined | null>;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function montarUrl(path: string, params?: Params): string {
  // String e não `new URL(...)`: o SSR não tem `window.location` para servir de base.
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params ?? {})) {
    if (valor === undefined || valor === null || valor === "") continue;
    query.set(chave, String(valor));
  }

  const sufixo = query.toString();
  return sufixo ? `${BASE}${path}?${sufixo}` : `${BASE}${path}`;
}

async function requisitar<T>(
  method: string,
  path: string,
  { params, body }: { params?: Params; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(montarUrl(path, params), {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new ApiError(
      e instanceof Error ? `Falha de rede: ${e.message}` : "Falha de rede",
      0,
    );
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "erro" in data && typeof (data as { erro: unknown }).erro === "string"
        ? (data as { erro: string }).erro
        : null) ?? `Erro ${res.status}`;
    throw new ApiError(msg, res.status);
  }

  return data as T;
}

export function apiGet<T>(path: string, params?: Params): Promise<T> {
  return requisitar<T>("GET", path, { params });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return requisitar<T>("POST", path, { body });
}

export function apiDelete<T>(path: string): Promise<T> {
  return requisitar<T>("DELETE", path);
}
