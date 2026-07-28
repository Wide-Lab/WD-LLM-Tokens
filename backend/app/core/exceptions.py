from typing import Any


class AppError(Exception):
    """Base dos erros da aplicação. Vira o `{"erro": ..., "detalhe": ...}` de `docs/api.md`."""

    status_code = 400
    message = "Ocorreu um erro na aplicação."

    def __init__(
        self,
        message: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message or self.message)
        self.message = message or self.message
        self.details = details


class NotFoundError(AppError):
    status_code = 404
    message = "Recurso não encontrado."


class UnauthorizedError(AppError):
    status_code = 401
    message = "Chave de API ausente ou inválida."


class ForbiddenError(AppError):
    status_code = 403
    message = "Esta chave não tem permissão para esta ação."


class TooManyRequestsError(AppError):
    status_code = 429
    message = "Tentativas demais. Espere alguns minutos."


class ConflictError(AppError):
    status_code = 409
    message = "Conflito de recurso."


class ValidationAppError(AppError):
    status_code = 400
    message = "Payload inválido."
