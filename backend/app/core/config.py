from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    DATABASE_URL: str
    LOG_LEVEL: str = "INFO"

    CORS_ORIGINS: list[str] = []
    """Origens do painel. Atrás do nginx de borda, front e API compartilham a mesma origem e
    isto pode ficar vazio; só um painel servido de outra origem precisa entrar aqui."""

    SEGREDO_SESSAO: str = ""
    """A chave que assina o cookie de sessão. Vazia = login indisponível (`503`).

    Trocar este valor invalida todas as sessões em aberto — é o botão de "derrubar todo mundo"."""

    SESSAO_DURACAO_HORAS: int = 168
    """Validade do cookie: 7 dias. Painel interno, sessão longa; o custo de errar para mais é
    um cookie roubado durar mais, e o de errar para menos é login toda manhã."""

    COOKIE_SEGURO: bool = True
    """`Secure` no cookie — só viaja em HTTPS. `localhost` é exceção no browser e funciona
    mesmo em HTTP; acessar por IP de rede sem TLS, não. Aí, e só aí, vale `false`."""

    CHAVE_ADMIN: str = ""
    """A chave de quem opera o serviço: cadastra preço, cria usuário e **emite as outras chaves**.

    Separada da de leitura porque a de leitura circula por aí, e uma chave espalhada não pode ser
    a que reescreve a tabela de onde sai todo o custo. E, ao contrário das outras, esta não migrou
    para o banco: ver `requer_admin` em `api/dependencies.py`."""


@lru_cache(maxsize=1)
def get_config() -> Config:
    return Config()  # type: ignore[call-arg]
