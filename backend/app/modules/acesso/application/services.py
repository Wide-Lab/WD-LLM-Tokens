import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import TooManyRequestsError, UnauthorizedError
from app.modules.acesso.application import limite
from app.modules.acesso.domain.entities import NovoUsuario, Usuario, normalizar_email
from app.modules.acesso.infra.repository import UsuarioRepository
from app.modules.acesso.infra.senha import confere


class AcessoService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._usuarios = UsuarioRepository(session)

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
        usuario = await self._usuarios.criar(novo)
        await self._session.commit()
        return usuario
