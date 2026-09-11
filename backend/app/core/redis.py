import redis as _redis
from app.core.config import settings

_pool = _redis.ConnectionPool.from_url(settings.REDIS_URL, decode_responses=True, max_connections=20)


def get_redis_client() -> _redis.Redis:
    return _redis.Redis(connection_pool=_pool)


redis_client = get_redis_client()
