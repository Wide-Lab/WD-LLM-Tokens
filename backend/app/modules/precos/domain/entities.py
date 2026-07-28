import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from enum import StrEnum

from app.core.exceptions import ValidationAppError


@dataclass(frozen=True, slots=True)
class PrecoModelo:
    """O preço de um modelo a partir de uma data.

    Preço tem vigência para que um reajuste do provedor não reescreva o custo histórico: o evento
    de março continua valendo o preço de março depois que o de abril entra."""

    id: uuid.UUID
    provedor: str | None
    modelo: str
    vigencia_inicio: date
    moeda: str
    entrada_por_milhao: Decimal
    saida_por_milhao: Decimal
    cache_leitura_por_milhao: Decimal
    cache_escrita_por_milhao: Decimal


@dataclass(frozen=True, slots=True)
class NovoPreco:
    modelo: str
    vigencia_inicio: date
    entrada_por_milhao: Decimal
    saida_por_milhao: Decimal
    provedor: str | None = None
    moeda: str = "USD"
    cache_leitura_por_milhao: Decimal = Decimal(0)
    cache_escrita_por_milhao: Decimal = Decimal(0)


class CategoriaMensagem(StrEnum):
    """As categorias de mensagem do WhatsApp que **têm preço**.

    `service` não está aqui de propósito: mensagem de serviço não é cobrada, e quem resolve isso
    é o `cobravel = false` do evento. Cadastrá-la com valor zero seria dizer a mesma coisa em dois
    lugares que podem discordar — e o dia em que discordassem, o painel mostraria um total
    confortável e errado.

    O módulo que guarda o fato da mensagem tem o enum dele, que inclui `service`. As duas listas
    não são a mesma e não devem ser um import: aqui a lista restringe o que se pode **cobrar**,
    lá o que se pode **reportar**."""

    MARKETING = "marketing"
    UTILITY = "utility"
    AUTHENTICATION = "authentication"

    @classmethod
    def de(cls, valor: str) -> CategoriaMensagem:
        """O texto que veio no payload, recusado com o motivo quando não é uma das três."""

        try:
            return cls(valor)
        except ValueError as erro:
            if valor == "service":
                raise ValidationAppError(
                    "Mensagem de serviço não é cobrada: isso é `cobravel = false` no evento, "
                    "não um preço zero cadastrado aqui."
                ) from erro
            raise ValidationAppError(
                f"Categoria de mensagem desconhecida: {valor}. "
                "Use marketing, utility ou authentication."
            ) from erro


@dataclass(frozen=True, slots=True)
class PrecoMensagem:
    """O preço de uma mensagem cobrável a partir de uma data.

    Mesma vigência de `PrecoModelo`, e pelo mesmo motivo: reajuste da Meta não reescreve o que
    já foi cobrado."""

    id: uuid.UUID
    categoria: CategoriaMensagem
    pais: str
    vigencia_inicio: date
    moeda: str
    por_mensagem: Decimal


@dataclass(frozen=True, slots=True)
class NovoPrecoMensagem:
    categoria: CategoriaMensagem
    pais: str
    vigencia_inicio: date
    por_mensagem: Decimal
    moeda: str = "USD"

    def __post_init__(self) -> None:
        """Preço não é negativo, e `pais` sobe para maiúsculas.

        A normalização não é cosmética: o preço casa com a mensagem por igualdade de texto no
        `pais`. Cadastrar `br` e receber `BR` do webhook não dá erro nenhum — dá custo `null`
        para sempre, num país que a pessoa jura ter cadastrado."""

        if self.por_mensagem < 0:
            raise ValidationAppError("O preço por mensagem não pode ser negativo.")

        pais = self.pais.strip().upper()
        if len(pais) != 2 or not pais.isalpha():
            raise ValidationAppError(
                f"`pais` é o ISO-3166 alfa-2 do destinatário (BR, US, PT), não {self.pais!r}."
            )
        object.__setattr__(self, "pais", pais)
