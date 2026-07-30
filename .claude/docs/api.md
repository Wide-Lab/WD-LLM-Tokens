# API

REST, versionada em `/v1`. JSON em tudo. Datas em ISO 8601 (UTC).

As rotas de LLM vivem sob `/v1/llm/*` e as de WhatsApp sob `/v1/whatsapp/*` — uma origem de fato,
um prefixo. A soma das duas vive sob `/v1/consolidado/*`. Os caminhos de LLM **sem** o prefixo
(`/v1/eventos`, `/v1/metricas`, `/v1/modelos`) continuam valendo e respondem igual: são de quando
o LLM era a única origem de fato, e há aplicação em produção reportando por eles. Não aparecem no
`/api/docs` — uma lista com cada rota duplicada é o tipo de ruído que faz ninguém mais ler a doc.
Integração nova usa o caminho com prefixo. O WhatsApp nasceu com prefixo e não tem alias.

`/v1/aplicacoes` é a exceção que **não** é alias: ele mudou de dono, saiu do `llm` e virou rota do
consolidado. O caminho é o mesmo de sempre (é o que o painel chama), e o que mudou é que a lista
agora vem das duas origens. `/v1/llm/aplicacoes` responde `404`.

> **`ator` é o mesmo texto nos dois lados.** E.164 só dígitos, sem `+`, sem espaço, sem
> pontuação: `5547999999999`. É o único acoplamento entre as duas origens e não há constraint que
> o garanta — se o agente reportar num formato e o webhook noutro, qualquer visão por ator produz
> duas meias-verdades sem erro nenhum. `pais` é ISO-3166 alfa-2 (`BR`, `US`, `PT`) e sobe para
> maiúsculas na entrada.

## Autenticação

Duas formas, para dois públicos.

**`X-API-Key`** — máquina falando com máquina.

| Chave | Onde nasce | Abre |
|---|---|---|
| Escrita (uma por aplicação) | `POST /v1/chaves` | `POST /v1/llm/eventos`, `POST /v1/whatsapp/mensagens` |
| Leitura | `POST /v1/chaves` | os `GET` |
| Admin | `CHAVE_ADMIN`, no `.env` | `/v1/chaves`, `/v1/precos`, `/v1/usuarios` |

A mesma chave de escrita ingere os dois tipos de fato: ela é a identidade de **quem reporta**, não
do que se reporta. Reportar `aplicacao` que não é a dona dela dá `403` nas duas rotas.

As de escrita e leitura viviam em variável de ambiente (`CHAVES_ESCRITA`, `CHAVE_LEITURA`) e hoje
só existem no banco — o backend não lê mais o ambiente para elas. As variáveis continuam sendo
aceitas pelo `.env` sem reclamar, porque a config ignora o que não conhece, mas não abrem nada.

A de admin não seguiu para o banco: é ela que emite e revoga as outras, e uma admin criável por
`POST /v1/chaves` poderia cunhar substitutas para si mesma — quem roubasse uma continuaria
entrando depois de revogada. Trocá-la exige acesso ao servidor, e é esse o ponto.

**Cookie de sessão** — gente no painel. `POST /v1/sessao` devolve um cookie `HttpOnly`,
`SameSite=Lax`, `Secure` (configurável), assinado com `SEGREDO_SESSAO` e válido por
`SESSAO_DURACAO_HORAS`. Ele abre os mesmos `GET` que a chave de leitura, e uma escrita só:
`POST /v1/precos` e `POST /v1/precos/mensagem`, que são a tela de preços do painel.

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

Não há CSRF token. Quase tudo que escreve (`POST /v1/llm/eventos`, `/v1/whatsapp/mensagens`,
`/v1/usuarios`, `/v1/chaves`) exige `X-API-Key`, que o cookie não substitui — para essas, não há
requisição que um site de terceiros consiga forjar só por o navegador mandar o cookie.

A exceção é `POST /v1/precos` (e `/v1/precos/mensagem`), que o cookie abre. Quem segura ali é o
`SameSite=Lax`: o navegador não manda o cookie de sessão num `POST` partido de outra origem, então
o formulário hostil chega sem sessão e leva `401`. É proteção do navegador e não do servidor —
trocar o cookie para `SameSite=None` (por exemplo, para servir o painel de outro domínio que não o
da API) derruba essa garantia e aí o token passa a ser necessário.

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

## `GET /v1/chaves`, `POST /v1/chaves`, `DELETE /v1/chaves/{id}`

Emissão de chave de API, por `CHAVE_ADMIN`.

**`POST`** — `{"nome", "escopo", "aplicacao"}`. `escopo` é `escrita` ou `leitura`; `aplicacao` é
obrigatória na de escrita (a chave **é** a identidade de quem reporta) e recusada na de leitura
(os `GET` enxergam tudo). `400` nos dois desencontros.

```json
{
  "id": "018f...",
  "nome": "famossul produção",
  "escopo": "escrita",
  "aplicacao": "famossul",
  "prefixo": "a976245f",
  "chave": "ltc_a976245f_eQEUEx9OX76QM93xdntp0pYJab6nN1TVp7H8nWzdsqM",
  "criada_em": "2026-07-28T18:16:25Z",
  "ultimo_uso_em": null,
  "revogada_em": null
}
```

**O campo `chave` só existe nesta resposta.** O banco guarda o SHA-256 dela, então não há
endpoint que a mostre de novo: quem perder emite outra e revoga esta. SHA-256 e não Argon2id
(como a senha) porque os 256 bits do segredo são sorteados — não há dicionário a encarecer, e o
custo do Argon2 entraria em cada `POST /v1/eventos`.

**`GET`** — as emitidas, ativas primeiro, sem o segredo de nenhuma. `prefixo` é o pedaço em claro
que serve para reconhecer qual é qual. `ultimo_uso_em` é carimbado no máximo de hora em hora, o
bastante para responder "isso ainda está em uso?" sem uma escrita a mais por evento ingerido. As
chaves de variável de ambiente não aparecem aqui.

**`DELETE`** — revoga: a próxima requisição com ela leva `401`. A linha fica na tabela com nome e
data, para a pergunta que vem depois ("quem usava a chave que vazou?"). `404` se o id não existe.

---

## `POST /v1/llm/eventos`

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

## `GET /v1/llm/metricas`

O coração do painel de LLM. Um endpoint flexível cobre todos os gráficos e os KPIs.

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

## `GET /v1/llm/eventos`

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

## `POST /v1/whatsapp/mensagens`

Ingestão de mensagem. Aceita **um** objeto ou **um array**, com a **mesma** chave de escrita da
aplicação. Idempotente por `(aplicacao, id_externo)`, com o `wamid` no `id_externo`.

**Request:**

```json
{
  "aplicacao": "famossul",
  "ator": "5547999999999",
  "direcao": "enviada",
  "categoria": "utility",
  "pais": "BR",
  "cobravel": true,
  "criado_em": "2026-07-28T14:00:00Z",
  "id_externo": "wamid.HBgNNTU0Nzk5OTk5OTk5ORUCABEYEjc...",
  "conteudo": "Seu pedido #4312 saiu para entrega.",
  "metadados": {
    "pricing": { "billable": true, "category": "utility", "pricing_model": "PMP" },
    "conversa_id": "d1f2...",
    "template": "pedido_em_transito"
  }
}
```

Obrigatórios: `aplicacao`, `ator`, `direcao` (`enviada` \| `recebida`) e `pais`. `categoria` é
`marketing`, `utility`, `authentication` ou `service`. `criado_em` default `now()`; o resto é
opcional.

> **`categoria` e `cobravel` vêm da Meta, não de regra nossa.** São cópias de `pricing.category` e
> `pricing.billable` do webhook de status, que já leva em conta janela de atendimento aberta, free
> entry point e as isenções que ela foi criando. Este serviço **não** reimplementa nada disso:
> recalcular a regra de cobrança de outra empresa é errar em silêncio no dia em que ela mudar.
> Mande o que ela mandou, inclusive quando contrariar o que a gente acha que ela cobra — e mande o
> objeto `pricing` cru inteiro em `metadados`, para que qualquer conferência futura seja uma
> consulta e não uma migration.

**Quem reporta ingere no status que traz o `pricing`** (o `sent`). O mapeamento webhook → este
contrato é de quem reporta, e vale conferir os nomes dos campos na doc atual da Meta: o contrato
estável é o **daqui**. Mensagem `failed` não deve ser reportada — a Meta não cobra, e a tabela é
append-only.

Duas recusas, e só duas, com `400`:

| Regra | Motivo |
|---|---|
| `direcao: "recebida"` com `cobravel: true` | a Meta não cobra entrada, em hipótese nenhuma |
| `cobravel: true` sem `categoria` | sem categoria não há linha de preço para casar |

Nada além disso: `service` cobrável entra, combinação estranha entra. Se a Meta disse que cobra,
quem está errado é a nossa suposição.

**Response `201`:** igual à do LLM — `{"id": "018f...", "duplicado": false}`, array para lote, na
mesma ordem. `duplicado: true` quando o `wamid` já existia: mandar `sent`, `delivered` e `read`
não conta a mensagem três vezes.

---

## `GET /v1/whatsapp/metricas`

O coração do painel de WhatsApp, com a mesma mecânica de `grupo` × `intervalo` do LLM.

**Query params:**

| Param | Valores | Efeito |
|---|---|---|
| `grupo` | `categoria` \| `ator` \| `aplicacao` \| `pais` \| `direcao` | dimensão do agrupamento |
| `intervalo` | `dia` \| `semana` \| `mes` | bucket temporal |
| `de` / `ate` | data ISO | período, os dois extremos inteiros |
| `aplicacao`, `ator`, `categoria`, `pais`, `direcao` | texto | filtros |

```json
[
  {
    "grupo": "utility",
    "periodo": "2026-07-28",
    "mensagens": 120,
    "cobraveis": 84,
    "custo": 0.672,
    "moeda": "USD"
  }
]
```

`cobraveis` é quantas das `mensagens` foram pagas — a diferença entre as duas é o que a janela de
atendimento e as isenções da Meta pouparam. `custo: null` continua sendo "não sei quanto custou"
(cobrável sem preço cadastrado para o país), distinto de `0`, "não custou nada".

Em `grupo=categoria`, as recebidas caem num balde `"sem categoria"` — elas não têm uma, e um
`grupo: null` no meio de uma lista de totais por categoria seria indistinguível de um total geral.

---

## `GET /v1/whatsapp/mensagens`

A lista crua, paginada, com os mesmos filtros mais `limite` (default 50, máx 500) e `offset`.

Com `conteudo` e `direcao`, ela é um registro de conversa, e não só uma auditoria de contagem:
uma linha por fala, e `direcao` diz de quem.

```json
{
  "total": 137,
  "limite": 50,
  "offset": 0,
  "itens": [
    {
      "id": "018f...",
      "criado_em": "2026-07-28T14:00:00Z",
      "aplicacao": "famossul",
      "ator": "5547999999999",
      "direcao": "enviada",
      "categoria": "utility",
      "pais": "BR",
      "cobravel": true,
      "custo": 0.008,
      "moeda": "USD",
      "id_externo": "wamid.HBgNNTU0Nzk5OTk5OTk5ORUCABEYEjc...",
      "conteudo": "Seu pedido #4312 saiu para entrega.",
      "metadados": { "pricing": { "billable": true, "category": "utility" } }
    }
  ]
}
```

---

## `GET /v1/whatsapp/paises`

Popula o dropdown de filtro: os países que já apareceram em alguma mensagem.

```json
["BR", "US"]
```

Não há `/v1/whatsapp/categorias` ao lado: a lista é fixa em quatro valores e cabe no frontend. Um
endpoint para isso seria uma ida ao banco para descobrir o que já se sabe.

---

## `GET /v1/consolidado/metricas`

O custo das duas origens somado — a resposta inteira para "quanto custou atender este cliente".

**Query params:**

| Param | Valores | Efeito |
|---|---|---|
| `grupo` | `origem` \| `aplicacao` \| `ator` | dimensão do agrupamento; se omitido, agrega tudo |
| `intervalo` | `dia` \| `semana` \| `mes` | bucket temporal; se omitido, sem série temporal |
| `por_origem` | `true` \| `false` | reparte cada balde entre as origens, num campo `origem` à parte |
| `de` / `ate` | data ISO | período, os dois extremos inteiros |
| `aplicacao`, `ator` | texto | filtros |

```json
[
  { "grupo": "llm", "periodo": "2026-07-28", "lancamentos": 42, "custo": 1.23, "moeda": "USD" },
  { "grupo": "whatsapp", "periodo": "2026-07-28", "lancamentos": 120, "custo": 0.67, "moeda": "USD" }
]
```

`por_origem` é dimensão à parte, e não um quarto valor de `grupo`, porque origem não concorre com
as outras — ela **acompanha**. "Custo por aplicação" e "custo por aplicação repartido entre LLM e
WhatsApp" são a mesma pergunta com e sem o recorte, e gastar o `grupo` com origem obrigaria a
escolher uma das duas. É o mesmo arranjo de `intervalo`:

```
GET /v1/consolidado/metricas?grupo=aplicacao&por_origem=true
[
  { "grupo": "famossul", "origem": "llm", "lancamentos": 42, "custo": 1.23, "moeda": "USD" },
  { "grupo": "famossul", "origem": "whatsapp", "lancamentos": 120, "custo": 0.67, "moeda": "USD" }
]
```

`grupo=origem` continua respondendo a pergunta sem recorte, e é a forma certa quando origem é a
pergunta inteira — é o que os cartões de KPI do painel usam.

> **O consolidado fala só dinheiro, tempo e quem.** Sem `tokens_*`, sem `mensagens`, sem
> `requisicoes`: volume tem unidade, e as unidades não se somam — um `requisicoes` somado a um
> `mensagens` é um número sem significado, e um painel que mostra um número sem significado ensina
> o leitor a desconfiar dos outros. Token fica em `/v1/llm/metricas`, mensagem em
> `/v1/whatsapp/metricas`.

`lancamentos` é a contagem dos fatos que entraram na soma. Serve para responder "está chegando
dado?" e, de propósito, não tem pretensão de ser indicador de volume.

Os filtros e os agrupamentos são só os que existem **nos dois lados**. Não há `modelo` nem
`categoria`, e a ausência é o contrato: um filtro de uma origem só, aplicado à soma das duas,
devolveria um total que parece completo e não é. Quem quer recortar por modelo está perguntando
sobre LLM, e a pergunta tem endereço.

`custo: null` num balde significa que **nenhuma** linha dele tinha preço cadastrado — uma origem
sem preço não zera o total da outra, porque a soma ignora o `null` em vez de tratá-lo como zero. E
como um dos agrupamentos é por `ator`, o número só é verdade se `ator` for o mesmo texto nas duas
origens: ver a nota no topo desta página.

A soma acontece no banco, e não no browser, porque ela tem semântica: `custo: null` não pode virar
zero ao encontrar um número, as moedas precisam concordar antes de somar e o período precisa ser
recortado igual dos dois lados. As três regras já existem uma vez no backend, e a segunda cópia
seria a que ninguém lembraria de atualizar.

---

## `GET /v1/precos`, `POST /v1/precos`

Cadastro de preço. **Não faz parte do contrato original** — entrou na implementação porque
`preco_modelo` é de onde sai todo o custo do painel, e sem uma porta para preenchê-la o campo
`custo` ficaria `null` para sempre.

`GET` aceita chave de leitura ou sessão. **`POST` aceita sessão do painel ou `CHAVE_ADMIN`** — é
a única escrita do serviço que um cookie abre, e a única que tem tela (`/precos`, no painel). Ela
abriu porque a `CHAVE_ADMIN` não desce para o browser por definição, e sem tela a tabela de que
todo o custo depende só se preencheria por `curl`. Não há papel de usuário: qualquer sessão
válida cadastra preço.

> **Preço se acrescenta, não se edita — e a vigência é quem decide o estrago.** Não existe `PUT`
> nem `DELETE` aqui. O custo é derivado na leitura pelo preço com o maior `vigencia_inicio <=`
> data do evento, então **`vigencia_inicio` no passado recalcula o histórico**: todo evento
> daquela data em diante passa a valer o preço novo na próxima vez que alguém abrir o painel.
> Com vigência de hoje em diante, o histórico fica intacto — é esse o caso do reajuste. Uma
> vigência retroativa cadastrada por engano só sai com `SQL` na mão.

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

## `GET /v1/precos/mensagem`, `POST /v1/precos/mensagem`

A tarifa da mensagem de WhatsApp, com a mesma autenticação da de modelo: sessão do painel ou
`CHAVE_ADMIN` para escrever, chave de leitura ou sessão para ler. A ressalva da vigência
retroativa vale igual aqui.

**Query params do `GET`:** `categoria`, `pais` — os dois opcionais.

```json
{
  "categoria": "utility",
  "pais": "BR",
  "vigencia_inicio": "2026-01-01",
  "moeda": "USD",
  "por_mensagem": "0.0080"
}
```

`categoria` é `marketing`, `utility` ou `authentication`. **`service` é recusada com `400`**: a
mensagem de serviço não é cobrada, e isso entra como `cobravel = false` no evento — não como um
preço zero cadastrado aqui.

`pais` é o ISO-3166 alfa-2 do destinatário e sobe para maiúsculas na entrada (`br` vira `BR`).
Ele casa por igualdade exata com o país da mensagem: país não cadastrado dá custo `null`, e é
assim que o painel denuncia o buraco em vez de somar zero.

`409` quando já existe preço para o mesmo `(categoria, pais, vigencia_inicio)`.

`GET`/`POST /v1/precos` continuam sendo os de **modelo**, sem alias e sem renomeação: renomear
agora quebraria o `curl` de quem já cadastra por fora, em troca de simetria.

---

## `GET /v1/aplicacoes`, `GET /v1/llm/modelos`

Auxiliares para popular os dropdowns de filtro do painel: devolvem a lista
distinta de valores já vistos.

```json
["famossul", "outro-app"]
```

`/v1/aplicacoes` é do **consolidado** e une as duas origens — uma aplicação que só reportou
WhatsApp precisa aparecer no dropdown. Era rota do `llm`, e **`/v1/llm/aplicacoes` deixou de
existir** (`404`). Não virou alias de propósito: dois caminhos para a lista de aplicações seriam
duas listas divergindo em silêncio.

`/v1/llm/modelos` fica onde está, com o alias legado `/v1/modelos`: modelo é dimensão de uma
origem só.

---

## Erros

Formato uniforme:

```json
{ "erro": "mensagem legível", "detalhe": { } }
```

- `400` payload inválido (nenhum campo de token; mensagem recebida marcada como cobrável)
- `401` chave ou sessão ausente/inválida — inclui e-mail ou senha errados no login
- `403` a chave é válida mas não pode fazer isso — na prática, uma chave de escrita tentando
  reportar evento ou mensagem de **outra** `aplicacao`
- `404` recurso inexistente (revogar uma chave que não está na tabela)
- `409` conflito (preço já cadastrado para a mesma vigência, e-mail de usuário repetido)
- `422` validação de tipo (FastAPI)
- `429` tentativas de login demais para o mesmo par (IP, e-mail)
- `500` falha interna
- `503` `SEGREDO_SESSAO` não configurado, então não há como assinar o cookie de login
