import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from sqlalchemy import CursorResult, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.modules.acesso.domain.entities import (
    ChaveApi,
    EscopoChave,
    NovaChave,
    NovoUsuario,
    Usuario,
    normalizar_email,
)
from app.modules.acesso.infra import chave as chave_infra
from app.modules.acesso.infra.models import ChaveApi as ChaveApiRow
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


_JANELA_USO = timedelta(hours=1)
"""De quanto em quanto tempo `ultimo_uso_em` é reescrito. Ver `marcar_uso`."""


def _chave_para_dominio(linha: ChaveApiRow) -> ChaveApi:
    return ChaveApi(
        id=linha.id,
        nome=linha.nome,
        escopo=EscopoChave(linha.escopo),
        aplicacao=linha.aplicacao,
        prefixo=linha.prefixo,
        criada_em=linha.criada_em,
        ultimo_uso_em=linha.ultimo_uso_em,
        revogada_em=linha.revogada_em,
    )


class ChaveApiRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def criar(self, nova: NovaChave) -> tuple[ChaveApi, str]:
        """Emite a chave e devolve `(chave, segredo em texto puro)`.

        O sorteio acontece aqui, e não na camada de cima, porque o segredo em claro não deve
        existir fora do `infra` mais tempo do que o necessário — o serviço só o repassa para a
        resposta."""

        segredo, prefixo = chave_infra.gerar()

        linha = ChaveApiRow(
            id=uuid.uuid4(),
            nome=nova.nome.strip(),
            escopo=nova.escopo.value,
            aplicacao=nova.aplicacao.strip() if nova.aplicacao else None,
            prefixo=prefixo,
            impressao=chave_infra.impressao(segredo),
        )
        self._session.add(linha)
        await self._session.flush()

        return _chave_para_dominio(linha), segredo

    async def listar(self) -> list[ChaveApi]:
        """As ativas primeiro, e dentro de cada grupo a mais nova no topo — quem abre a listagem
        quer ver o que está valendo, não o cemitério."""

        stmt = select(ChaveApiRow).order_by(
            ChaveApiRow.revogada_em.is_not(None), ChaveApiRow.criada_em.desc()
        )
        return [_chave_para_dominio(linha) for linha in (await self._session.scalars(stmt))]

    async def ativa_por_segredo(self, segredo: str) -> ChaveApi | None:
        """A chave que aquele texto abre, se ainda vale.

        Busca pela impressão no índice único: o servidor não compara a chave recebida com nenhuma
        outra, então não há tempo de comparação a cronometrar."""

        linha = await self._session.scalar(
            select(ChaveApiRow).where(
                ChaveApiRow.impressao == chave_infra.impressao(segredo),
                ChaveApiRow.revogada_em.is_(None),
            )
        )
        return _chave_para_dominio(linha) if linha else None

    async def marcar_uso(self, chave_id: uuid.UUID) -> bool:
        """Carimba `ultimo_uso_em`, no máximo uma vez por hora. Devolve se escreveu.

        A janela no `WHERE` é o que segura o custo: sem ela, cada evento ingerido viraria um
        `UPDATE` na mesma linha, e o caminho quente da ingestão pagaria uma escrita a mais por
        chamada só para saber uma coisa que muda devagar. Hora é granularidade de sobra para a
        pergunta que o campo responde — "isso ainda está em uso?"."""

        agora = datetime.now(UTC)
        stmt = (
            update(ChaveApiRow)
            .where(
                ChaveApiRow.id == chave_id,
                or_(
                    ChaveApiRow.ultimo_uso_em.is_(None),
                    ChaveApiRow.ultimo_uso_em < agora - _JANELA_USO,
                ),
            )
            .values(ultimo_uso_em=agora)
        )

        # `execute` é tipado como `Result`; quem tem `rowcount` é o `CursorResult` que todo DML
        # devolve na prática. O `cast` é só para o mypy.
        resultado = cast(CursorResult[Any], await self._session.execute(stmt))
        return bool(resultado.rowcount)

    async def revogar(self, chave_id: uuid.UUID) -> ChaveApi:
        """Carimba `revogada_em`. Revogar duas vezes não mexe na data da primeira: a hora em que
        a chave deixou de valer é a hora em que alguém a desligou."""

        linha = await self._session.scalar(select(ChaveApiRow).where(ChaveApiRow.id == chave_id))
        if linha is None:
            raise NotFoundError("Chave não encontrada.")

        if linha.revogada_em is None:
            linha.revogada_em = datetime.now(UTC)
            await self._session.flush()

        return _chave_para_dominio(linha)
