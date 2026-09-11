from fastapi import Request
from fastapi.responses import JSONResponse


class ShopMindException(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


async def shopmind_exception_handler(request: Request, exc: ShopMindException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail, "path": str(request.url)},
    )
