"""Freio de força bruta no login.

O painel fica exposto na internet, e o Argon2 sozinho encarece o palpite mas não o impede — a
uma tentativa por vez, uma senha fraca cai numa noite. Em memória e não no Redis porque é um
container só: se um dia o backend escalar horizontalmente, isto vira uma tabela ou um Redis, e
o efeito de perder a contagem num restart é aceitável (o atacante ganha uma janela, não a
senha)."""

import time
from collections import defaultdict, deque

JANELA_SEGUNDOS = 15 * 60
MAX_TENTATIVAS = 10

_falhas: dict[str, deque[float]] = defaultdict(deque)


def _expirar(chave: str, agora: float) -> deque[float]:
    marcas = _falhas[chave]
    while marcas and agora - marcas[0] > JANELA_SEGUNDOS:
        marcas.popleft()

    return marcas


def bloqueado(chave: str) -> bool:
    return len(_expirar(chave, time.monotonic())) >= MAX_TENTATIVAS


def registrar_falha(chave: str) -> None:
    agora = time.monotonic()
    _expirar(chave, agora).append(agora)


def limpar(chave: str) -> None:
    """Login certo zera a contagem — quem sabe a senha não paga pelos erros de digitação."""

    _falhas.pop(chave, None)
