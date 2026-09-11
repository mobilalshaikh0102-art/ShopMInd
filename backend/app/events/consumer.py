"""Redis event consumer — background thread subscribing to domain events."""
import json
import logging
import threading
from typing import Callable, Dict

logger = logging.getLogger("shopmind.events.consumer")

_handlers: Dict[str, Callable] = {}
_consumer_thread: threading.Thread = None
CHANNEL = "shopmind:events"


def register_handler(event_type: str, handler: Callable):
    _handlers[event_type] = handler
    logger.info(f"Registered handler for event: {event_type}")


def _consume():
    try:
        from app.core.redis import redis_client
        pubsub = redis_client.pubsub()
        pubsub.subscribe(CHANNEL)
        logger.info(f"Event consumer listening on channel: {CHANNEL}")
        for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    data = json.loads(message["data"])
                    event_type = data.get("type")
                    payload = data.get("payload", {})
                    handler = _handlers.get(event_type)
                    if handler:
                        logger.info(f"Handling event: {event_type}")
                        handler(payload)
                    else:
                        logger.debug(f"No handler for event: {event_type}")
                except Exception as e:
                    logger.error(f"Error processing event: {e}")
    except Exception as e:
        logger.error(f"Event consumer error: {e}")


def start_consumer():
    global _consumer_thread
    if _consumer_thread and _consumer_thread.is_alive():
        return
    _consumer_thread = threading.Thread(target=_consume, daemon=True, name="EventConsumer")
    _consumer_thread.start()
    logger.info("Event consumer thread started.")
