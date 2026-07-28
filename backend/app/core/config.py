from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    DATABASE_URL: str
    LOG_LEVEL: str = "INFO"

    CORS_ORIGINS: list[str] = []
    """Origens do painel. Atrás do nginx de borda, front e API compartilham a mesma origem e
    isto pode ficar vazio; o painel hospedado no Lovable (outra origem) precisa entrar aqui."""

    CHAVES_ESCRITA: dict[str, str] = {}
    """Uma chave por aplicação: `{"famossul": "chave-secreta"}`.

    O mapa é aplicação → chave (e não o contrário) porque é assim que a chave passa a **dizer
    quem está reportando**: o `POST /v1/eventos` recusa um evento cuja `aplicacao` não seja a
    dona da chave. Sem isso, a chave de qualquer app poderia escrever no nome de outro, e o
    painel por aplicação viraria ficção.

    Hoje as chaves nascem em `POST /v1/chaves`, na tabela `chave_api`. Estas continuam valendo
    junto com as de lá — para migrar sem derrubar app — e podem ficar vazias quando cada
    aplicação já estiver com a sua emitida."""

    CHAVE_LEITURA: str = ""
    """Chave de integração para os `GET`, para quem consome as métricas por script.

    O painel **não** a usa: quem entra nele tem sessão (cookie), e é por isso que a chave saiu
    do browser. Vazia = só a sessão e as chaves de leitura emitidas abrem os `GET`."""

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
