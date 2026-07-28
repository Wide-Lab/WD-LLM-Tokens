import uuid
from dataclasses import asdict
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.acesso.domain.entities import (
    ChaveCriada,
    EscopoChave,
    NovaChave,
    NovoUsuario,
)


class LoginIn(BaseModel):
    email: EmailStr
    senha: str


class UsuarioIn(BaseModel):
    email: EmailStr
    nome: str = Field(min_length=1)
    senha: str = Field(min_length=12)
    """Doze caracteres porque o painel está exposto e o freio do login segura o martelo, não o
    palpite sortudo. Sem regra de "um símbolo e um número" — comprimento é o que conta."""

    def para_dominio(self) -> NovoUsuario:
        return NovoUsuario(email=str(self.email), nome=self.nome, senha=self.senha)


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    nome: str
    ativo: bool
    criado_em: datetime


class ChaveIn(BaseModel):
    nome: str = Field(min_length=1, description='Para gente: "famossul produção".')
    escopo: EscopoChave
    aplicacao: str | None = Field(
        default=None, description="Obrigatória no escopo `escrita`, proibida no `leitura`."
    )

    def para_dominio(self) -> NovaChave:
        return NovaChave(nome=self.nome, escopo=self.escopo, aplicacao=self.aplicacao)


class ChaveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nome: str
    escopo: EscopoChave
    aplicacao: str | None
    prefixo: str
    criada_em: datetime
    ultimo_uso_em: datetime | None
    revogada_em: datetime | None


class ChaveCriadaOut(ChaveOut):
    """A resposta da emissão — a única em que o campo `chave` existe."""

    chave: str
    """A chave em texto puro. **Só aparece aqui.** O banco guarda o hash, então não há endpoint
    que a mostre de novo: perdeu, emite outra e revoga esta."""

    @classmethod
    def de(cls, criada: ChaveCriada) -> ChaveCriadaOut:
        return cls(chave=criada.segredo, **asdict(criada.chave))
