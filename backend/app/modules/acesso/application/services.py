import uuid

from app.core.exceptions import TooManyRequestsError, UnauthorizedError
from app.db.uow import UnitOfWork
from app.modules.acesso.application import limite
from app.modules.acesso.domain.entities import (
    ChaveApi,
    ChaveCriada,
    EscopoChave,
    NovaChave,
    NovoUsuario,
    Usuario,
    normalizar_email,
)
from app.modules.acesso.infra.repository import ChaveApiRepository, UsuarioRepository
from app.modules.acesso.infra.senha import confere


class AcessoService:
    def __init__(self, uow: UnitOfWork) -> None:
        self._usuarios = UsuarioRepository(uow.session)

    async def autenticar(self, email: str, senha: str, origem: str) -> Usuario:
        """O login. `origem` é o IP de quem tentou — entra na chave do freio junto com o e-mail
        para que um atacante martelando uma conta não tranque o dono dela fora do painel."""

        chave = f"{origem}|{normalizar_email(email)}"
        if limite.bloqueado(chave):
            raise TooManyRequestsError()

        credenciais = await self._usuarios.credenciais(email)
        usuario, senha_hash = credenciais if credenciais else (None, None)

        # `confere` roda mesmo com `senha_hash` nulo (gasta o mesmo tempo), e usuário desativado
        # cai no mesmo erro de senha errada: a resposta do login não diz quais e-mails existem.
        if not confere(senha, senha_hash) or usuario is None or not usuario.ativo:
            limite.registrar_falha(chave)
            raise UnauthorizedError("E-mail ou senha inválidos.")

        limite.limpar(chave)
        return usuario

    async def por_id(self, usuario_id: uuid.UUID) -> Usuario | None:
        """Quem o cookie diz ser — desde que ainda esteja ativo."""

        usuario = await self._usuarios.por_id(usuario_id)
        return usuario if usuario and usuario.ativo else None

    async def listar(self) -> list[Usuario]:
        return await self._usuarios.listar()

    async def criar(self, novo: NovoUsuario) -> Usuario:
        return await self._usuarios.criar(novo)


class ChaveApiService:
    """Emissão, listagem, revogação e conferência das chaves de API."""

    def __init__(self, uow: UnitOfWork) -> None:
        self._chaves = ChaveApiRepository(uow.session)

    async def criar(self, nova: NovaChave) -> ChaveCriada:
        chave, segredo = await self._chaves.criar(nova)
        return ChaveCriada(chave=chave, segredo=segredo)

    async def listar(self) -> list[ChaveApi]:
        return await self._chaves.listar()

    async def revogar(self, chave_id: uuid.UUID) -> ChaveApi:
        return await self._chaves.revogar(chave_id)

    async def autenticar(self, segredo: str, escopo: EscopoChave) -> ChaveApi | None:
        """A chave por trás daquele texto, se estiver ativa **e** for do escopo pedido.

        Escopo errado devolve `None`, e não um erro próprio: para quem está do lado de fora,
        "esta chave não abre isto" e "esta chave não existe" precisam ser a mesma resposta — a
        diferença só serviria para alguém mapear o que tem em mãos.

        O carimbo de uso vai numa transação própria, e não na do request: ele é fato sobre a
        chave, não sobre a operação que ela autorizou. Um `GET` que termina em `404` continua
        sendo um uso — na transação do request, o rollback do `404` levaria o carimbo junto."""

        chave = await self._chaves.ativa_por_segredo(segredo)
        if chave is None or chave.escopo is not escopo:
            return None

        async with UnitOfWork() as uow:
            await ChaveApiRepository(uow.session).marcar_uso(chave.id)

        return chave
