"""Redis event publisher."""
import json
import logging

logger = logging.getLogger("shopmind.events.producer")

CHANNEL = "shopmind:events"


def publish_event(event_type: str, payload: dict) -> bool:
    """Publish an event to the Redis channel."""
    try:
        from app.core.redis import redis_client
        message = json.dumps({"type": event_type, "payload": payload})
        redis_client.publish(CHANNEL, message)
        logger.info(f"Published event: {event_type}")
        return True
    except Exception as e:
        logger.error(f"Failed to publish event {event_type}: {e}")
        return False


def emit_stock_low(product_id: int, current_stock: int, threshold: int):
    return publish_event("STOCK_LOW", {"product_id": product_id, "current_stock": current_stock, "threshold": threshold})


def emit_order_created(order_id: int, order_number: str, customer_id: int):
    return publish_event("ORDER_CREATED", {"order_id": order_id, "order_number": order_number, "customer_id": customer_id})


def emit_shipment_delayed(shipment_id: int, order_id: int, delay_reason: str):
    return publish_event("SHIPMENT_DELAYED", {"shipment_id": shipment_id, "order_id": order_id, "delay_reason": delay_reason})
