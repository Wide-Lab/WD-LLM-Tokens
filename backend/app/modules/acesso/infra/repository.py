import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError
from app.modules.acesso.domain.entities import NovoUsuario, Usuario, normalizar_email
from app.modules.acesso.infra.models import Usuario as UsuarioRow
from app.modules.acesso.infra.senha import gerar_hash


def _para_dominio(linha: UsuarioRow) -> Usuario:
    return Usuario(
        id=linha.id,
        email=linha.email,
        nome=linha.nome,
        ativo=linha.ativo,
        criado_em=linha.criado_em,
    )


class UsuarioRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def credenciais(self, email: str) -> tuple[Usuario, str] | None:
        """O usuário e o hash da senha dele — o único ponto onde o hash sai da tabela.

        Devolve o par mesmo quando `ativo` é `False`: quem decide o que fazer com um usuário
        desligado é o serviço, e a resposta de login precisa ser a mesma para não virar sonda de
        quem tem conta."""

        linha = await self._session.scalar(
            select(UsuarioRow).where(UsuarioRow.email == normalizar_email(email))
        )
        if linha is None:
            return None

        return _para_dominio(linha), linha.senha_hash

    async def por_id(self, usuario_id: uuid.UUID) -> Usuario | None:
        linha = await self._session.scalar(select(UsuarioRow).where(UsuarioRow.id == usuario_id))
        return _para_dominio(linha) if linha else None

    async def listar(self) -> list[Usuario]:
        stmt = select(UsuarioRow).order_by(UsuarioRow.email)
        return [_para_dominio(linha) for linha in (await self._session.scalars(stmt))]

    async def criar(self, novo: NovoUsuario) -> Usuario:
        """Quem detecta o e-mail repetido é o `UNIQUE`, e não um `SELECT` antes: entre a leitura
        e a escrita cabe outro cadastro."""

        linha = UsuarioRow(
            id=uuid.uuid4(),
            email=normalizar_email(novo.email),
            nome=novo.nome.strip(),
            senha_hash=gerar_hash(novo.senha),
        )
        self._session.add(linha)

        try:
            await self._session.flush()
        except IntegrityError as erro:
            raise ConflictError(f"Já existe usuário com o e-mail {novo.email}.") from erro

        return _para_dominio(linha)
