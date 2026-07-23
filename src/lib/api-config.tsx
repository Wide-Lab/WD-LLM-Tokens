import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "llm-token-panel:config";

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
}

interface ApiConfigContextValue {
  config: ApiConfig;
  setConfig: (c: ApiConfig) => void;
  isConfigured: boolean;
}

const ApiConfigContext = createContext<ApiConfigContextValue | null>(null);

function readStored(): ApiConfig {
  if (typeof window === "undefined") return { baseUrl: "", apiKey: "" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { baseUrl: "", apiKey: "" };
    const parsed = JSON.parse(raw);
    return {
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
    };
  } catch {
    return { baseUrl: "", apiKey: "" };
  }
}

export function ApiConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<ApiConfig>({ baseUrl: "", apiKey: "" });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConfigState(readStored());
    setHydrated(true);
  }, []);

  const setConfig = (c: ApiConfig) => {
    setConfigState(c);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    } catch {
      // ignore
    }
  };

  const isConfigured = hydrated && !!config.baseUrl && !!config.apiKey;

  return (
    <ApiConfigContext.Provider value={{ config, setConfig, isConfigured }}>
      {children}
    </ApiConfigContext.Provider>
  );
}

export function useApiConfig() {
  const ctx = useContext(ApiConfigContext);
  if (!ctx) throw new Error("useApiConfig must be inside ApiConfigProvider");
  return ctx;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  config: ApiConfig,
  path: string,
  params?: Record<string, string | number | undefined | null>,
): Promise<T> {
  if (!config.baseUrl || !config.apiKey) {
    throw new ApiError("Configure a URL e a chave da API em Configurações.", 0);
  }
  const base = config.baseUrl.replace(/\/+$/, "");
  const url = new URL(base + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { "X-API-Key": config.apiKey, Accept: "application/json" },
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
