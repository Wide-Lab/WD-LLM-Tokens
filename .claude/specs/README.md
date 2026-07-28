# Specs — contabilizar WhatsApp junto com LLM

Estes documentos descrevem o que ainda **não existe**. `docs/api.md` e `docs/modelo-de-dados.md`
descrevem o que existe: cada etapa daqui atualiza os dois no seu próprio commit, e quando a
última tiver sido implementada esta pasta pode sumir.

## O problema

O serviço contabiliza chamada de LLM. As mesmas aplicações também gastam com a WhatsApp Business
Platform, e hoje esse custo não aparece em lugar nenhum — a pergunta "quanto custou atender este
cliente" tem metade da resposta.

## A decisão

**Duas tabelas de fato, uma casa para o dinheiro, um modelo de leitura por cima.** Não é uma
tabela genérica com `tipo`.

Os quatro baldes de token não-sobrepostos são convenção com dente (`docs/modelo-de-dados.md`), e
a chave do preço é outra: `preco_modelo` casa por `modelo`; WhatsApp cobra por
`(categoria, país do destinatário)`. Uma tabela com metade das colunas nula em cada linha são
duas tabelas fingindo ser uma.

| Módulo | Papel | Tabelas |
|---|---|---|
| `llm` (hoje `uso`) | fatos de chamada ao LLM | `registro_llm` |
| `whatsapp` | fatos de mensagem | `registro_mensagem` |
| `precos` | **todo** o dinheiro: as duas tabelas de preço e as duas fórmulas | `preco_modelo`, `preco_mensagem` |
| `consolidado` | modelo de leitura: soma o custo das duas origens | nenhuma |
| `acesso` | inalterado | `usuario`, `chave_api` |

Preço fica no `precos`, e não dentro de cada módulo de fato, porque é o que preserva o invariante
mais forte do projeto: dinheiro mora num lugar só. Os imports entre módulos passam de dois para
quatro, todos na mesma direção, e continuam documentados em `backend/README.md`:

```
llm/infra/repository.py       → precos/infra/custo.py
whatsapp/infra/repository.py  → precos/infra/custo_mensagem.py
consolidado/infra/repository.py → llm/infra/projecao.py, whatsapp/infra/projecao.py
api/dependencies.py           → acesso/{infra,application,domain}
```

**Ninguém importa o `consolidado`.** Ele é folha do grafo; é isso que impede a soma de virar
dependência de quem produz os números.

## A regra que faz o consolidado funcionar

**O consolidado fala só dinheiro, tempo e quem.** Token não soma com mensagem — um `requisicoes`
somado a um `mensagens` é um número sem significado, e um painel que mostra um número sem
significado ensina o leitor a desconfiar dos outros. Cada módulo de fato expõe uma projeção com
as mesmas colunas, o consolidado faz `UNION ALL` e agrega. Tokens ficam no painel de LLM,
categorias no de WhatsApp.

Uma terceira origem depois (transcrição, TTS, o que for) é uma implementação de `projecao.py` a
mais, não uma reescrita do painel.

## Onde o dinheiro do WhatsApp é decidido

Na Meta, não aqui. Vocês vão direto na Cloud API — sem BSP, sem markup, sem assinatura mensal:
o custo é 100% variável, por mensagem cobrável, e o número do painel bate com a fatura a menos de
impostos e conversão de moeda.

O webhook de status traz um objeto `pricing` que já diz se aquela mensagem é cobrável e em que
categoria. Ele leva em conta janela de atendimento aberta, free entry point e as isenções que a
Meta foi criando ao longo de 2024–2025. **Não reimplementamos nada disso.** Recalcular a regra de
cobrança de outra empresa é errar em silêncio quando ela mudar.

Duas consequências:

- O objeto `pricing` cru vai inteiro para `metadados`. Só o que a fórmula e os filtros precisam
  vira coluna (`cobravel`, `categoria`, `pais`). A Meta já mexeu nesse payload na virada para
  per-message pricing e vai mexer de novo — guardar o original faz de qualquer reconciliação
  futura uma consulta, e não uma migration.
- Na hora de implementar a etapa 3, **confira os nomes dos campos na doc atual da Meta**. Esta
  spec descreve o contrato da *nossa* API, que é o que controlamos; o mapeamento webhook → nosso
  evento é de quem reporta.

## Convenções que valem para todas as etapas

- **`ator` é o mesmo texto nos dois lados.** E.164 só dígitos, sem `+`, sem espaço, sem
  pontuação: `5547999999999`. É o único acoplamento real entre os módulos e não tem constraint
  que o garanta — se o agente reportar num formato e o webhook noutro, o consolidado por ator
  produz duas meias-verdades sem erro nenhum. Vale uma nota em `docs/api.md`.
- **`pais` é ISO-3166 alfa-2 maiúsculo** (`BR`, `US`, `PT`), derivado pelo lado de quem reporta.
- **`custo: null` continua sendo "não sei quanto custou"**, distinto de `0` = "não custou nada".
  No WhatsApp isso vira: `cobravel = false` → `0`; cobrável sem preço cadastrado → `null`.
- **Moeda USD em toda linha de preço.** Misturar moedas na mesma agregação é o único jeito de o
  número sair errado sem ninguém notar.
- Um commit por etapa, docs junto. Sem `Co-Authored-By`. Português em tudo.
- Não há suíte de testes: cada spec fecha com **critérios de pronto** verificáveis à mão.

## Etapas

| # | Spec | Resumo |
|---|---|---|
| 1 | [`01-renomear-modulo-llm.md`](01-renomear-modulo-llm.md) | `uso` → `llm`, `registro_uso` → `registro_llm`, rotas em `/v1/llm/*` com alias legado |
| 2 | [`02-preco-de-mensagem.md`](02-preco-de-mensagem.md) | `preco_mensagem` e a segunda fórmula de custo, dentro de `precos` |
| 3 | [`03-modulo-whatsapp.md`](03-modulo-whatsapp.md) | `registro_mensagem`, ingestão por `wamid`, listagem e métricas |
| 4 | [`04-consolidado.md`](04-consolidado.md) | projeções de custo e `GET /v1/consolidado/metricas` |
| 5 | [`05-painel-reorganizacao.md`](05-painel-reorganizacao.md) | `/` vira o consolidado, o painel de hoje desce para `/llm` |
| 6 | [`06-painel-whatsapp.md`](06-painel-whatsapp.md) | o painel de WhatsApp e a lista de mensagens |

A ordem importa: 2 antes de 3 (o repositório de mensagem importa a fórmula), 3 antes de 4 (a
projeção precisa da tabela), backend inteiro antes do frontend.

## Fora de escopo, de propósito

- **Tela unificada por ator** (LLM + WhatsApp na mesma conversa). É o melhor argumento do desenho
  todo, mas depende do `ator` estar normalizado igual dos dois lados. Fica para depois que houver
  dado real das duas origens para conferir — vira spec própria.
- **Preço por mercado com curinga.** O preço casa por país exato. Se aparecer `custo: null` num
  país não cadastrado, cadastra-se o país; o painel já denuncia o buraco sozinho.
- **Custo fixo.** Não existe na Cloud API direta. Se um dia entrar BSP, `preco_mensagem` ganha
  uma segunda coluna de valor e o painel passa a somar as duas.
- **Rollup, cache, materialização.** O volume não justifica, e o dia de materializar é o dia em
  que a consulta não rodar mais — não antes.
