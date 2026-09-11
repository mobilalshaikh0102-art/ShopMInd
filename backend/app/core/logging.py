import logging
import sys
from typing import List


class SecretFilter(logging.Filter):
    """Redacts sensitive strings from log output."""

    def __init__(self, secrets: List[str]):
        super().__init__()
        self._secrets = [s for s in secrets if s]

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        for secret in self._secrets:
            msg = msg.replace(secret, "***REDACTED***")
        record.msg = msg
        record.args = ()
        return True


def setup_logging(log_level: str = "INFO", secret_keys: List[str] = None) -> None:
    level = getattr(logging, log_level.upper(), logging.INFO)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )
    if secret_keys:
        handler.addFilter(SecretFilter(secret_keys))

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)

    # Silence noisy third-party loggers
    for noisy in ["httpx", "httpcore", "urllib3", "passlib"]:
        logging.getLogger(noisy).setLevel(logging.WARNING)
