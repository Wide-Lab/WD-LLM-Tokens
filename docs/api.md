# API

REST, versionada em `/v1`. JSON em tudo. Datas em ISO 8601 (UTC).

## Autenticação

Duas formas, para dois públicos.

**`X-API-Key`** — máquina falando com máquina. As chaves vivem em variável de ambiente do
backend; só migrar para uma tabela quando cadastrar app virar rotina.

| Chave | Onde vive | Abre |
|---|---|---|
| Escrita (uma por aplicação) | no app de IA | `POST /v1/eventos` |
| Leitura | em quem consome métricas por script | os `GET` |
| Admin | com quem opera o serviço | `POST /v1/precos`, `GET`/`POST /v1/usuarios` |

**Cookie de sessão** — gente no painel. `POST /v1/sessao` devolve um cookie `HttpOnly`,
`SameSite=Lax`, `Secure` (configurável), assinado com `SEGREDO_SESSAO` e válido por
`SESSAO_DURACAO_HORAS`. Ele abre os mesmos `GET` que a chave de leitura, e nada além disso.

Requisição sem chave nem sessão válida → `401`.

> **Por que o painel não usa mais a chave de leitura.** Ele usava: a chave ficava no
> `localStorage` do browser, junto com uma URL de API configurável. Isso deixava o segredo que
> abre todos os dados de custo visível em qualquer aba do DevTools, e fazia da própria chave a
> única tranca de um painel exposto na internet. Hoje o painel é servido pelo mesmo nginx da
> API (`/` e `/api`), então basta o cookie de mesma origem — o browser nunca vê um segredo, e
> quem entra tem nome e e-mail.

O cookie carrega apenas o id do usuário: cada requisição relê a linha em `usuario`, então
`ativo = false` derruba a sessão no request seguinte, sem esperar o cookie vencer. Para
derrubar **todas** as sessões de uma vez, troque `SEGREDO_SESSAO`.

Não há CSRF token: tudo que escreve (`POST /v1/eventos`, `/v1/precos`, `/v1/usuarios`) exige
`X-API-Key`, que o cookie não substitui — não há requisição de escrita que um site de terceiros
consiga forjar só por o navegador mandar o cookie.

## CORS

Atrás do nginx, painel e API compartilham origem: `CORS_ORIGINS` fica vazio e é isso mesmo. A
lista só existe para um cliente externo eventual — e aí precisa ser explícita, porque o cookie
de sessão exige `allow_credentials`, e o navegador recusa `*` junto com credenciais.

---

## `POST /v1/sessao`, `GET /v1/sessao`, `DELETE /v1/sessao`

Login, "quem sou eu" e logout.

**`POST /v1/sessao`** — `{"email": "...", "senha": "..."}`. Responde `200` com o usuário e o
`Set-Cookie`. E-mail inexistente, senha errada e usuário desativado dão a **mesma** resposta
(`401`, "E-mail ou senha inválidos.") e gastam o mesmo tempo: a tela de login não é lugar de
descobrir quem tem conta. Dez falhas em 15 minutos para o mesmo par (IP, e-mail) → `429`.

**`GET /v1/sessao`** — o usuário logado, ou `401`. É o que o painel consulta para escolher
entre o dashboard e a tela de login, então o `401` aqui é resposta normal, não erro.

**`DELETE /v1/sessao`** — apaga o cookie. `204`.

```json
{
  "id": "018f...",
  "email": "ana@empresa.com",
  "nome": "Ana",
  "ativo": true,
  "criado_em": "2026-07-28T12:00:00Z"
}
```

---

## `GET /v1/usuarios`, `POST /v1/usuarios`

Cadastro por `CHAVE_ADMIN`, não por tela — é assim que nasce o primeiro login, sem uma tela de
cadastro aberta ao mundo. `POST` recebe `{"email", "nome", "senha"}` (senha de 12+ caracteres) e
devolve `201`; e-mail repetido → `409`. A senha sai daqui como hash Argon2id e nunca volta.

---

## `POST /v1/eventos`

Ingestão. Aceita **um** objeto ou **um array** (lote). Idempotente por
`(aplicacao, id_externo)`.

**Request:**

```json
{
  "aplicacao": "famossul",
  "ator": "5547999999999",
  "modelo": "gpt-5.6-terra",
  "provedor": "openai",
  "criado_em": "2026-07-23T14:00:00Z",
  "tokens_entrada": 1200,
  "tokens_saida": 300,
  "tokens_cache_leitura": 800,
  "tokens_cache_escrita": 0,
  "id_externo": "resp_abc123",
  "mensagem": "quanto custa o frete para Joinville?",
  "resposta": "O frete para Joinville sai por R$ 32,00.",
  "metadados": { "conversa_id": "c-42" }
}
```

Obrigatórios: `aplicacao`, `ator`, `modelo`, e ao menos um campo de token.
`criado_em` default `now()`. `provedor`, `id_externo`, `mensagem`, `resposta`, `metadados`
opcionais.

`mensagem` (o que o ator mandou) e `resposta` (o que o agente devolveu) são o conteúdo da
chamada, e é o que a tela de detalhe do ator mostra. Omitir dá `null`, que significa "não veio no
evento" — não "veio vazio".

**Response `201`:**

```json
{ "id": "018f...", "duplicado": false }
```

`duplicado: true` (ainda `201`/`200`) quando o `id_externo` já existia — o evento
não foi inserido de novo. Para lote, devolve um array na mesma ordem.

---

## `GET /v1/metricas`

O coração do painel. Um endpoint flexível cobre todos os gráficos e os KPIs.

**Query params:**

| Param | Valores | Efeito |
|---|---|---|
| `grupo` | `modelo` \| `ator` \| `aplicacao` | dimensão do agrupamento; se omitido, agrega tudo |
| `intervalo` | `dia` \| `semana` \| `mes` | bucket temporal; se omitido, sem série temporal |
| `de` | data ISO | início do período (inclusive) |
| `ate` | data ISO | fim do período (inclusive) |
| `aplicacao` | texto | filtro |
| `ator` | texto | filtro |
| `modelo` | texto | filtro |

As combinações de `grupo` × `intervalo` resolvem tudo:

- `grupo=modelo&intervalo=dia` → série temporal por modelo (gráfico de linhas)
- `grupo=modelo` (sem intervalo) → total por modelo (pizza/barra)
- `intervalo=dia` (sem grupo) → série temporal geral (gráfico de custo no tempo)
- sem `grupo` e sem `intervalo` → totais do período (cards de KPI)

**Response** (array de baldes; `grupo` presente só quando `grupo` foi passado,
`periodo` presente só quando `intervalo` foi passado):

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

---

## `GET /v1/eventos`

Lista crua para auditoria. Paginada.

**Query params:** `aplicacao`, `ator`, `modelo`, `de`, `ate`,
`limite` (default 50, máx 500), `offset` (default 0).

**Response:**

```json
{
  "total": 137,
  "limite": 50,
  "offset": 0,
  "itens": [
    {
      "id": "018f...",
      "criado_em": "2026-07-23T14:00:00Z",
      "aplicacao": "famossul",
      "ator": "5547999999999",
      "modelo": "gpt-5.6-terra",
      "provedor": "openai",
      "tokens_entrada": 1200,
      "tokens_saida": 300,
      "tokens_cache_leitura": 800,
      "tokens_cache_escrita": 0,
      "custo": 0.05,
      "moeda": "USD",
      "id_externo": "resp_abc123",
      "mensagem": "quanto custa o frete para Joinville?",
      "resposta": "O frete para Joinville sai por R$ 32,00.",
      "metadados": { "conversa_id": "c-42" }
    }
  ]
}
```

---

## `GET /v1/precos`, `POST /v1/precos`

Cadastro de preço. **Não faz parte do contrato original** — entrou na implementação porque
`preco_modelo` é de onde sai todo o custo do painel, e sem uma porta para preenchê-la o campo
`custo` ficaria `null` para sempre.

`GET` usa a chave de leitura; `POST` usa uma terceira chave (`CHAVE_ADMIN`), separada porque a
de leitura vive exposta no browser e esta reescreve a base de todo o custo.

```json
{
  "modelo": "gpt-5.6-terra",
  "provedor": "openai",
  "vigencia_inicio": "2026-01-01",
  "moeda": "USD",
  "entrada_por_milhao": "1.25",
  "saida_por_milhao": "10.00",
  "cache_leitura_por_milhao": "0.125",
  "cache_escrita_por_milhao": "0"
}
```

`409` quando já existe preço para o mesmo `(modelo, vigencia_inicio)`.

---

## `GET /v1/aplicacoes`, `GET /v1/modelos`

Auxiliares para popular os dropdowns de filtro do painel: devolvem a lista
distinta de valores já vistos.

```json
["famossul", "outro-app"]
```

---

## Erros

Formato uniforme:

```json
{ "erro": "mensagem legível", "detalhe": { } }
```

- `400` payload inválido (ex.: nenhum campo de token)
- `401` chave ou sessão ausente/inválida — inclui e-mail ou senha errados no login
- `403` a chave é válida mas não pode fazer isso — na prática, uma chave de escrita tentando
  reportar evento de **outra** `aplicacao`
- `409` conflito (preço já cadastrado para a mesma vigência, e-mail de usuário repetido)
- `422` validação de tipo (FastAPI)
- `429` tentativas de login demais para o mesmo par (IP, e-mail)
- `500` falha interna
- `503` `SEGREDO_SESSAO` não configurado, então não há como assinar o cookie de login
