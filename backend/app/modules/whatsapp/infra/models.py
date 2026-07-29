import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Index, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RegistroMensagem(Base):
    """Uma linha por mensagem de WhatsApp. Append-only, como tudo que é fato consumado.

    `COUNT(*)` = mensagens, do mesmo jeito que em `registro_llm` é requisições.

    Mensagem que falhou no envio (`failed`) **não vira evento**: a Meta não cobra, e um evento
    gravado que depois deixasse de valer exigiria `UPDATE` numa tabela append-only."""

    __tablename__ = "registro_mensagem"

    __table_args__ = (
        # Idempotência pelo `wamid`, parcial pelo mesmo motivo do `registro_llm`: `id_externo` é
        # opcional, e no Postgres `NULL` não colide com `NULL`.
        Index(
            "uq_registro_mensagem_aplicacao_id_externo",
            "aplicacao",
            "id_externo",
            unique=True,
            postgresql_where=text("id_externo IS NOT NULL"),
        ),
        # Os eixos do painel. `aplicacao` na frente em todos, como no LLM.
        Index("ix_registro_mensagem_aplicacao_criado", "aplicacao", "criado_em"),
        Index("ix_registro_mensagem_aplicacao_ator_criado", "aplicacao", "ator", "criado_em"),
        Index(
            "ix_registro_mensagem_aplicacao_categoria_criado",
            "aplicacao",
            "categoria",
            "criado_em",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid7)

    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    """A hora da mensagem. É esta que manda na tarifa vigente e nos gráficos."""

    recebido_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    """A hora em que o servidor recebeu. Aqui ela tende a ficar bem atrás de `criado_em`: quem
    reporta ingere no status que traz o `pricing`, que chega depois do envio."""

    aplicacao: Mapped[str] = mapped_column(Text)

    ator: Mapped[str] = mapped_column(Text)
    """O `wa_id` do cliente, E.164 só dígitos — o **mesmo texto** do `ator` de `registro_llm`.
    É o único acoplamento entre os dois módulos, e não há constraint que o garanta: se o agente
    reportar num formato e o webhook noutro, o consolidado por ator produz duas meias-verdades
    sem erro nenhum."""

    direcao: Mapped[str] = mapped_column(Text)
    """`enviada` ou `recebida`. `Text` e não `ENUM` do banco, como em `chave_api.escopo`."""

    categoria: Mapped[str | None] = mapped_column(Text, nullable=True)
    """`marketing`, `utility`, `authentication` ou `service`, vinda de `pricing.category`.
    `NULL` nas recebidas. `Text` porque categoria nova da Meta não pode depender de um
    `ALTER TYPE` em janela de manutenção."""

    pais: Mapped[str] = mapped_column(Text)
    """ISO-3166 alfa-2 maiúsculo do destinatário. Casa por igualdade exata com `preco_mensagem`."""

    cobravel: Mapped[bool] = mapped_column(Boolean, server_default="false")
    """Cópia de `pricing.billable`. Quem decide é a Meta — ela já leva em conta janela de
    atendimento, free entry point e as isenções que foi criando. Recalcular a regra de cobrança de
    outra empresa é errar em silêncio no dia em que ela mudar."""

    id_externo: Mapped[str | None] = mapped_column(Text, nullable=True)
    """O `wamid`. É a chave da idempotência."""

    conteudo: Mapped[str | None] = mapped_column(Text, nullable=True)
    """O texto da mensagem. Um campo só, e `direcao` diz de quem é a fala — é o que torna a lista
    de WhatsApp um registro de conversa mais fiel que o do LLM."""

    metadados: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default="{}")
    """O objeto `pricing` cru vai inteiro aqui, com o id da conversa e o nome do template. A Meta
    já mexeu nesse payload na virada para per-message pricing e vai mexer de novo: guardar o
    original faz de qualquer reconciliação futura uma consulta, e não uma migration."""
