"""O segredo da chave de API: como nasce e o que sobra dele na tabela.

Formato: `ltc_<prefixo>_<segredo>` — `ltc` de *llm tokens control*, para quem achar a string
solta num `.env` saber de onde ela é; `prefixo` de 8 hex, que fica em claro na tabela e é como a
listagem diz *qual* chave é qual; `segredo` de 32 bytes sorteados (`secrets`, não `random`).

**SHA-256 e não Argon2**, ao contrário da senha logo ao lado. A diferença não é descuido: senha é
escolhida por gente, tem entropia baixa e por isso precisa de um hash caro que torne o dicionário
inviável. Aqui os 256 bits são sorteados — não existe palpite a encarecer, e o Argon2 só entregaria
seus ~50ms de propósito a **cada** `POST /v1/llm/eventos`. O que se quer do hash neste caso é só
que o dump da tabela não devolva a chave, e SHA-256 dá conta disso."""

import hashlib
import secrets

_MARCA = "ltc"
_BYTES_PREFIXO = 4
_BYTES_SEGREDO = 32


def gerar() -> tuple[str, str]:
    """Sorteia uma chave nova. Devolve `(chave em texto puro, prefixo)`."""

    prefixo = secrets.token_hex(_BYTES_PREFIXO)
    return f"{_MARCA}_{prefixo}_{secrets.token_urlsafe(_BYTES_SEGREDO)}", prefixo


def impressao(chave: str) -> str:
    """O que vai para o banco no lugar da chave.

    É a busca também: a autenticação procura pela impressão, num índice único, em vez de varrer a
    tabela comparando. Isso mata de graça o problema de tempo que o `hmac.compare_digest` resolve
    nas chaves de ambiente — o servidor nunca compara a chave recebida com nada, só pergunta ao
    índice se aquele hash existe."""

    return hashlib.sha256(chave.encode()).hexdigest()
