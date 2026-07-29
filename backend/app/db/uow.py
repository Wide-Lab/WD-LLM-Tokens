"""A transação, num objeto só.

Antes cada serviço chamava `session.commit()` quando achava que tinha terminado — oito pontos
espalhados, e toda operação nova tinha que lembrar de repetir. Aqui o commit é do fim do bloco:
saiu limpo, grava; saiu por exceção, desfaz. Quem escreve não decide mais quando gravar.

**Não guarda repositório nenhum, de propósito.** A UoW de manual expõe `uow.usuarios`,
`uow.precos`, `uow.registros` — e isso faria deste arquivo o lugar que importa todos os módulos
de uma vez, justo num backend que conta a dedo os imports que cruzam módulo (ver
`backend/README.md`). O que ela oferece é a sessão; quem monta repositório continua sendo o
serviço do próprio módulo."""

from collections.abc import AsyncGenerator
from types import TracebackType
from typing import Annotated, Self

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session_maker


class UnitOfWork:
    """Uma transação. `async with` abre a sessão, a saída escolhe entre commit e rollback."""

    def __init__(self) -> None:
        self._session: AsyncSession | None = None

    @property
    def session(self) -> AsyncSession:
        """A sessão de dentro da transação — é com ela que o serviço monta os repositórios.

        Fora do `async with` não existe sessão, e devolver `None` aqui só adiaria o erro para
        alguma linha distante de quem esqueceu o bloco."""

        if self._session is None:
            raise RuntimeError("A UnitOfWork só tem sessão dentro do `async with`.")

        return self._session

    async def __aenter__(self) -> Self:
        self._session = get_session_maker()()
        return self

    async def __aexit__(
        self,
        tipo: type[BaseException] | None,
        erro: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        """Devolve `None` (falso) de propósito: a exceção que abortou a transação segue subindo
        até virar resposta HTTP — desfazer a escrita não é o mesmo que engolir o erro."""

        sessao = self.session
        self._session = None

        try:
            if erro is None:
                await sessao.commit()
            else:
                await sessao.rollback()
        finally:
            await sessao.close()


async def get_uow() -> AsyncGenerator[UnitOfWork]:
    """Uma transação por request.

    O FastAPI relança no `yield` a exceção que a rota levantou, então um `409` de e-mail repetido
    ou um `404` de chave inexistente chegam ao `__aexit__` como erro e desfazem o que veio antes
    deles no mesmo request.

    Os `GET` entram aqui igual aos `POST`: commit de transação que não escreveu nada é
    encerramento, não escrita, e não vale um segundo jeito de pegar sessão só para eles."""

    async with UnitOfWork() as uow:
        yield uow


UowDep = Annotated[UnitOfWork, Depends(get_uow)]
"""A transação do request. O FastAPI resolve `get_uow` uma vez só por request, então a
autenticação em `api/dependencies.py` e a rota que ela protege compartilham a mesma."""
