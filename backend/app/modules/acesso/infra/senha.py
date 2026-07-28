"""Hash de senha com Argon2id (`argon2-cffi`, parâmetros padrão da lib)."""

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()

_HASH_DESCARTAVEL = _hasher.hash("nenhum-usuario-tem-esta-senha")
"""Hash de mentira, verificado quando o e-mail não existe.

Sem ele o login responde na hora para e-mail inexistente e depois de ~50ms para e-mail real —
o cronômetro vira uma lista de quem tem conta. Gastar o mesmo tempo nos dois casos fecha isso."""


def gerar_hash(senha: str) -> str:
    return _hasher.hash(senha)


def confere(senha: str, hash_armazenado: str | None) -> bool:
    """`None` em `hash_armazenado` significa "e-mail não existe" — ainda assim roda a verificação
    contra o hash descartável, e só então devolve `False`."""

    try:
        _hasher.verify(hash_armazenado or _HASH_DESCARTAVEL, senha)
    except VerificationError, InvalidHashError:
        return False

    return hash_armazenado is not None
