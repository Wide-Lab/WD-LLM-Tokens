import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Eye, EyeOff } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useApiConfig, apiFetch, ApiError } from "@/lib/api-config";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Painel LLM" },
      {
        name: "description",
        content: "Configure a URL e a chave da API para conectar ao seu painel de uso de tokens.",
      },
      { property: "og:title", content: "Configurações — Painel LLM" },
      {
        property: "og:description",
        content: "Ajuste a conexão com a API de métricas de uso de LLMs.",
      },
    ],
  }),
  component: Configuracoes,
});

function Configuracoes() {
  const { config, setConfig } = useApiConfig();
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: boolean; message: string } | null
  >(null);

  const save = () => {
    setConfig({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() });
    toast.success("Configurações salvas");
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await apiFetch({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() }, "/v1/metricas");
      setTestResult({ ok: true, message: "Conexão bem-sucedida." });
      toast.success("Conexão bem-sucedida");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Falha";
      setTestResult({ ok: false, message: msg });
      toast.error("Falha na conexão", { description: msg });
    } finally {
      setTesting(false);
    }
  };

  const dirty = baseUrl !== config.baseUrl || apiKey !== config.apiKey;

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Configurações da API</CardTitle>
          <CardDescription>
            Informe a URL base e a chave de acesso. Os dados ficam salvos apenas neste
            navegador (localStorage).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="base-url">URL da API</Label>
            <Input
              id="base-url"
              placeholder="https://api.exemplo.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Sem barra no final. Os endpoints são anexados como <code>/v1/metricas</code>.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">Chave de API</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? "text" : "password"}
                placeholder="cole sua chave aqui"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={showKey ? "Ocultar chave" : "Mostrar chave"}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enviada em cada requisição no header <code>X-API-Key</code>.
            </p>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                testResult.ok
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={save} disabled={!dirty}>
              Salvar
            </Button>
            <Button
              variant="outline"
              onClick={test}
              disabled={testing || !baseUrl.trim() || !apiKey.trim()}
            >
              {testing && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Testar conexão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
