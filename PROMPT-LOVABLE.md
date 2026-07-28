# Prompt para o Lovable

Cole o bloco abaixo no Lovable para gerar o painel. Ele já descreve a API que o
backend expõe.

> **Atualizado depois da primeira geração.** A versão original pedia uma tela de
> Configurações com URL da API e chave no `localStorage`. Isso caiu: o painel é
> servido pelo mesmo nginx da API, então a base é `/api` na própria origem, e o
> acesso passou a ser login com sessão em cookie `HttpOnly` — nenhum segredo no
> browser. Regerar com o texto antigo traria a tela de volta.

---

Construa um **painel web de controle de uso de tokens de LLM**. É um dashboard de
leitura que consome uma API REST já existente (não crie backend nem banco; apenas
consuma a API). Interface em **português do Brasil**, moderna, responsiva, com
tema claro/escuro.

## Integração com a API

- URL base fixa: `/api`, na própria origem. Nada de configurar, nada de chave no
  cliente — as requisições vão com `credentials: "same-origin"` e o cookie de
  sessão viaja sozinho.
- Autenticação por login: `POST /v1/sessao` com e-mail e senha, `GET /v1/sessao`
  para saber quem está logado (o `401` aqui é a resposta normal de visitante) e
  `DELETE /v1/sessao` para sair.
- Sem sessão, a única tela acessível é a de login; qualquer `401` em outra
  requisição volta para ela.
- Sempre trate estados de **carregando**, **vazio** e **erro** (mostre a mensagem
  do campo `erro` da resposta).

### Endpoints

**`GET /v1/metricas`** — fonte de todos os números e gráficos. Query params:
`grupo` (`modelo` | `ator` | `aplicacao`, opcional), `intervalo` (`dia` |
`semana` | `mes`, opcional), `de`, `ate` (datas ISO), e filtros opcionais
`aplicacao`, `ator`, `modelo`.

Resposta: array de baldes. `grupo` aparece só quando o param `grupo` foi enviado;
`periodo` aparece só quando `intervalo` foi enviado.

```json
[
  {
    "grupo": "gpt-5.6-terra",
    "periodo": "2026-07-23",
    "requisicoes": 42,
    "tokens_entrada": 50000,
    "tokens_saida": 12000,
    "tokens_cache_leitura": 30000,
    "tokens_cache_escrita": 0,
    "custo": 1.23,
    "moeda": "USD"
  }
]
```

Use as combinações assim:
- KPIs do topo: chamar **sem** `grupo` e **sem** `intervalo` → um objeto com os totais.
- Gráfico de série temporal: **sem** `grupo`, **com** `intervalo` → uma linha por período.
- Gráfico por modelo/ator/aplicação: **com** `grupo`, **sem** `intervalo` → um por dimensão.
- Séries por dimensão (opcional): `grupo` + `intervalo` juntos.

**`GET /v1/eventos`** — tabela de auditoria. Params: `aplicacao`, `ator`,
`modelo`, `de`, `ate`, `limite` (default 50), `offset`. Resposta:

```json
{ "total": 137, "limite": 50, "offset": 0, "itens": [ { "id": "...", "criado_em": "...", "aplicacao": "...", "ator": "...", "modelo": "...", "provedor": "...", "tokens_entrada": 1200, "tokens_saida": 300, "tokens_cache_leitura": 800, "tokens_cache_escrita": 0, "custo": 0.05, "moeda": "USD", "metadados": {} } ] }
```

**`GET /v1/aplicacoes`** e **`GET /v1/modelos`** — retornam array de strings para
popular os dropdowns de filtro.

## Filtros globais (barra no topo, valem para todas as telas)

- Seletor de **intervalo de datas** (com atalhos: hoje, 7 dias, 30 dias, mês atual).
- Dropdown **Aplicação** (de `GET /v1/aplicacoes`, com opção "Todas").
- Dropdown **Modelo** (de `GET /v1/modelos`, com opção "Todos").
- Campo de busca **Ator** (texto livre).
- Seletor de **granularidade**: Dia / Semana / Mês (afeta os gráficos temporais).

Ao mudar qualquer filtro, recarregar os dados.

## Tela 1 — Visão geral (dashboard)

**Cards de KPI** (do endpoint sem `grupo`/`intervalo`), grandes e legíveis:
- Requisições (total)
- Custo total (formatado como moeda, com o código de `moeda`)
- Tokens de entrada, de saída, de cache (leitura + escrita)

**Gráficos:**
- **Custo ao longo do tempo** — barras ou linha, usando `intervalo`.
- **Tokens ao longo do tempo** — barras **empilhadas** por tipo (entrada, saída,
  cache leitura, cache escrita).
- **Custo por modelo** — barra horizontal ou rosca (`grupo=modelo`).
- **Top atores por custo** — barra horizontal ou tabela ordenada (`grupo=ator`),
  mostrando os maiores consumidores.
- **Uso por aplicação** — barra (`grupo=aplicacao`); esconder se só há uma aplicação.

## Tela 2 — Eventos

Tabela paginada de `GET /v1/eventos` para auditoria. Colunas: data/hora,
aplicação, ator, modelo, tokens (entrada / saída / cache), custo. Paginação por
`limite`/`offset` mostrando `total`. Respeita os filtros globais.

## Tela 3 — Login

E-mail e senha, sem sidebar e sem link para cadastro (contas são criadas fora do
painel). Erro do login vem no campo `erro` da resposta e cobre igualmente e-mail
inexistente e senha errada — não diferencie os dois na tela.

## Formatação e detalhes

- Números grandes com separador de milhar; tokens podem ser abreviados (`1.2k`,
  `3.4M`) nos gráficos, mas completos nas tabelas.
- Custo sempre com o código de moeda vindo da API (`USD`).
- Quando `custo` vier `null` (modelo sem preço cadastrado), mostrar "—" e não
  quebrar; tokens continuam aparecendo.
- Paleta consistente por tipo de token nos gráficos empilhados.
- Layout responsivo (funciona em celular), com sidebar de navegação entre as telas do painel
  (visão geral e eventos), mostrando quem está logado e um botão de sair.
