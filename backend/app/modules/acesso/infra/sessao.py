"""O cookie de sessão: o id do usuário, assinado e datado.

Assinado e não opaco-com-tabela porque o conteúdo é um UUID e nada mais — uma tabela de sessões
só ganharia revogação, e a revogação já vem de outro lugar: o cookie carrega apenas o id, e cada
request relê `usuario.ativo` no banco. Desligar o usuário derruba a sessão no request seguinte."""

import uuid

from itsdangerous import BadSignature, URLSafeTimedSerializer

from app.core.config import get_config
from app.core.exceptions import AppError

COOKIE = "sessao"

_SALT = "sessao-painel"


class LoginNaoConfiguradoError(AppError):
    status_code = 503
    message = "Login indisponível: defina SEGREDO_SESSAO no backend."


def _serializer() -> URLSafeTimedSerializer:
    segredo = get_config().SEGREDO_SESSAO
    if not segredo:
        raise LoginNaoConfiguradoError()

    return URLSafeTimedSerializer(segredo, salt=_SALT)


def assinar(usuario_id: uuid.UUID) -> str:
    return _serializer().dumps(str(usuario_id))


def ler(token: str) -> uuid.UUID | None:
    """O id do cookie, ou `None` se a assinatura não bate, venceu ou o conteúdo não é um UUID.

    `SignatureExpired` é subclasse de `BadSignature`, então o `max_age` estourado cai no mesmo
    ramo — para quem chama, cookie vencido e cookie forjado dão no mesmo: não há sessão."""

    try:
        bruto = _serializer().loads(token, max_age=get_config().SESSAO_DURACAO_HORAS * 3600)
    except BadSignature, LoginNaoConfiguradoError:
        return None

    try:
        return uuid.UUID(str(bruto))
    except ValueError:
        return None
