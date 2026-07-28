import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.acesso.domain.entities import NovoUsuario


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
