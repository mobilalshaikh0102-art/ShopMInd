"""Third-Party Integration Services — Shopify, Razorpay/Stripe, WhatsApp, Email."""
import logging
import smtplib
import ssl
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger("shopmind.integrations")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _is_configured(*values: str) -> bool:
    return all(bool(v and v.strip()) for v in values)


# ─────────────────────────────────────────────────────────────────────────────
# Shopify Service
# ─────────────────────────────────────────────────────────────────────────────

class ShopifyService:
    """Sync products and orders from a Shopify store via Admin REST API."""

    def is_connected(self) -> bool:
        return _is_configured(
            getattr(settings, "SHOPIFY_SHOP_DOMAIN", ""),
            getattr(settings, "SHOPIFY_ACCESS_TOKEN", ""),
        )

    def get_status(self) -> Dict:
        return {
            "connected": self.is_connected(),
            "shop": getattr(settings, "SHOPIFY_SHOP_DOMAIN", "") or None,
        }

    def sync_products(self) -> Dict:
        if not self.is_connected():
            return self._demo_products()
        try:
            import urllib.request, json as _json
            domain = settings.SHOPIFY_SHOP_DOMAIN  # type: ignore
            token = settings.SHOPIFY_ACCESS_TOKEN  # type: ignore
            url = f"https://{domain}/admin/api/2024-01/products.json?limit=20"
            req = urllib.request.Request(url, headers={"X-Shopify-Access-Token": token})
            with urllib.request.urlopen(req, timeout=10) as r:
                data = _json.loads(r.read())
            products = data.get("products", [])
            return {
                "source": "shopify",
                "synced_at": datetime.utcnow().isoformat(),
                "count": len(products),
                "products": [
                    {
                        "id": str(p["id"]),
                        "title": p["title"],
                        "vendor": p.get("vendor"),
                        "product_type": p.get("product_type"),
                        "status": p.get("status"),
                        "variants_count": len(p.get("variants", [])),
                    }
                    for p in products
                ],
            }
        except Exception as e:
            logger.error(f"Shopify sync failed: {e}")
            return {"error": str(e), "source": "shopify"}

    def sync_orders(self) -> Dict:
        if not self.is_connected():
            return self._demo_orders()
        try:
            import urllib.request, json as _json
            domain = settings.SHOPIFY_SHOP_DOMAIN  # type: ignore
            token = settings.SHOPIFY_ACCESS_TOKEN  # type: ignore
            url = f"https://{domain}/admin/api/2024-01/orders.json?limit=20&status=any"
            req = urllib.request.Request(url, headers={"X-Shopify-Access-Token": token})
            with urllib.request.urlopen(req, timeout=10) as r:
                data = _json.loads(r.read())
            orders = data.get("orders", [])
            return {
                "source": "shopify",
                "synced_at": datetime.utcnow().isoformat(),
                "count": len(orders),
                "orders": [
                    {
                        "id": str(o["id"]),
                        "order_number": o.get("order_number"),
                        "financial_status": o.get("financial_status"),
                        "fulfillment_status": o.get("fulfillment_status"),
                        "total_price": o.get("total_price"),
                        "currency": o.get("currency"),
                        "created_at": o.get("created_at"),
                    }
                    for o in orders
                ],
            }
        except Exception as e:
            logger.error(f"Shopify order sync failed: {e}")
            return {"error": str(e), "source": "shopify"}

    def _demo_products(self) -> Dict:
        return {
            "source": "shopify_demo",
            "synced_at": datetime.utcnow().isoformat(),
            "note": "Demo data — connect your Shopify store to see real products.",
            "count": 5,
            "products": [
                {"id": "SHP-001", "title": "Premium Yoga Mat", "vendor": "FitGear", "product_type": "Sports", "status": "active", "variants_count": 3},
                {"id": "SHP-002", "title": "Wireless Earbuds Pro", "vendor": "TechSound", "product_type": "Electronics", "status": "active", "variants_count": 2},
                {"id": "SHP-003", "title": "Organic Green Tea", "vendor": "PureLeaf", "product_type": "Food", "status": "active", "variants_count": 4},
                {"id": "SHP-004", "title": "Leather Wallet", "vendor": "UrbanCraft", "product_type": "Accessories", "status": "active", "variants_count": 1},
                {"id": "SHP-005", "title": "Smart Water Bottle", "vendor": "HydroTech", "product_type": "Home", "status": "draft", "variants_count": 2},
            ],
        }

    def _demo_orders(self) -> Dict:
        return {
            "source": "shopify_demo",
            "synced_at": datetime.utcnow().isoformat(),
            "note": "Demo data — connect your Shopify store to see real orders.",
            "count": 5,
            "orders": [
                {"id": "SHP-ORD-1001", "order_number": 1001, "financial_status": "paid", "fulfillment_status": "fulfilled", "total_price": "2499.00", "currency": "INR", "created_at": "2026-09-10T10:30:00"},
                {"id": "SHP-ORD-1002", "order_number": 1002, "financial_status": "paid", "fulfillment_status": None, "total_price": "5999.00", "currency": "INR", "created_at": "2026-09-11T14:22:00"},
                {"id": "SHP-ORD-1003", "order_number": 1003, "financial_status": "pending", "fulfillment_status": None, "total_price": "1299.00", "currency": "INR", "created_at": "2026-09-12T09:10:00"},
                {"id": "SHP-ORD-1004", "order_number": 1004, "financial_status": "refunded", "fulfillment_status": "restocked", "total_price": "3499.00", "currency": "INR", "created_at": "2026-09-08T16:45:00"},
                {"id": "SHP-ORD-1005", "order_number": 1005, "financial_status": "paid", "fulfillment_status": "partial", "total_price": "8799.00", "currency": "INR", "created_at": "2026-09-12T11:05:00"},
            ],
        }


# ─────────────────────────────────────────────────────────────────────────────
# Payment Service (Razorpay + Stripe)
# ─────────────────────────────────────────────────────────────────────────────

class PaymentService:
    """Aggregate payment analytics from Razorpay and/or Stripe."""

    def razorpay_connected(self) -> bool:
        return _is_configured(
            getattr(settings, "RAZORPAY_KEY_ID", ""),
            getattr(settings, "RAZORPAY_KEY_SECRET", ""),
        )

    def stripe_connected(self) -> bool:
        return _is_configured(getattr(settings, "STRIPE_SECRET_KEY", ""))

    def get_status(self) -> Dict:
        return {
            "razorpay": {"connected": self.razorpay_connected()},
            "stripe": {"connected": self.stripe_connected()},
        }

    def get_razorpay_stats(self) -> Dict:
        if not self.razorpay_connected():
            return self._demo_payment_stats("razorpay")
        try:
            import base64, urllib.request, json as _json
            creds = base64.b64encode(
                f"{settings.RAZORPAY_KEY_ID}:{settings.RAZORPAY_KEY_SECRET}".encode()  # type: ignore
            ).decode()
            req = urllib.request.Request(
                "https://api.razorpay.com/v1/payments?count=50",
                headers={"Authorization": f"Basic {creds}"},
            )
            with urllib.request.urlopen(req, timeout=10) as r:
                data = _json.loads(r.read())
            payments = data.get("items", [])
            total = sum(p.get("amount", 0) for p in payments if p.get("status") == "captured") / 100
            failed = sum(1 for p in payments if p.get("status") == "failed")
            refunded = sum(1 for p in payments if p.get("status") == "refunded")
            captured = sum(1 for p in payments if p.get("status") == "captured")
            return {
                "source": "razorpay",
                "total_revenue": round(total, 2),
                "total_payments": len(payments),
                "captured": captured,
                "failed": failed,
                "refunded": refunded,
                "success_rate": round(captured / len(payments) * 100, 1) if payments else 0,
                "currency": "INR",
                "methods": self._count_methods(payments, "method"),
            }
        except Exception as e:
            return {"error": str(e), "source": "razorpay"}

    def get_stripe_stats(self) -> Dict:
        if not self.stripe_connected():
            return self._demo_payment_stats("stripe")
        try:
            import urllib.request, json as _json
            req = urllib.request.Request(
                "https://api.stripe.com/v1/charges?limit=50",
                headers={"Authorization": f"Bearer {settings.STRIPE_SECRET_KEY}"},  # type: ignore
            )
            with urllib.request.urlopen(req, timeout=10) as r:
                data = _json.loads(r.read())
            charges = data.get("data", [])
            total = sum(c.get("amount", 0) for c in charges if c.get("paid")) / 100
            failed = sum(1 for c in charges if c.get("failure_code"))
            refunded = sum(1 for c in charges if c.get("refunded"))
            captured = sum(1 for c in charges if c.get("captured") and not c.get("refunded"))
            return {
                "source": "stripe",
                "total_revenue": round(total, 2),
                "total_payments": len(charges),
                "captured": captured,
                "failed": failed,
                "refunded": refunded,
                "success_rate": round(captured / len(charges) * 100, 1) if charges else 0,
                "currency": "USD",
                "methods": {},
            }
        except Exception as e:
            return {"error": str(e), "source": "stripe"}

    def _demo_payment_stats(self, source: str) -> Dict:
        return {
            "source": f"{source}_demo",
            "note": f"Demo data — add your {source.title()} API keys to see real stats.",
            "total_revenue": 1171040.26,
            "total_payments": 84,
            "captured": 67,
            "failed": 11,
            "refunded": 6,
            "success_rate": 79.8,
            "currency": "INR",
            "methods": {"upi": 32, "card": 25, "wallet": 10, "netbanking": 5, "cod": 12},
            "trend": [
                {"date": "2026-09-06", "revenue": 17574.92, "count": 1},
                {"date": "2026-09-07", "revenue": 52000.0, "count": 3},
                {"date": "2026-09-08", "revenue": 38900.0, "count": 2},
                {"date": "2026-09-09", "revenue": 33031.74, "count": 2},
                {"date": "2026-09-10", "revenue": 89500.0, "count": 5},
                {"date": "2026-09-11", "revenue": 61200.0, "count": 4},
                {"date": "2026-09-12", "revenue": 44000.0, "count": 3},
            ],
        }

    def _count_methods(self, payments: list, key: str) -> Dict:
        counts: Dict[str, int] = {}
        for p in payments:
            m = p.get(key, "other")
            counts[m] = counts.get(m, 0) + 1
        return counts


# ─────────────────────────────────────────────────────────────────────────────
# WhatsApp Service (Twilio)
# ─────────────────────────────────────────────────────────────────────────────

class WhatsAppService:
    """Send WhatsApp notifications via Twilio's WhatsApp Business API."""

    def is_connected(self) -> bool:
        return _is_configured(
            getattr(settings, "TWILIO_ACCOUNT_SID", ""),
            getattr(settings, "TWILIO_AUTH_TOKEN", ""),
        )

    def get_status(self) -> Dict:
        return {"connected": self.is_connected()}

    def send_message(self, to: str, message: str) -> Dict:
        """Send a WhatsApp message. `to` must be in format '+91XXXXXXXXXX'."""
        if not self.is_connected():
            logger.info(f"[WhatsApp DEMO] To: {to} | Message: {message[:80]}")
            return {
                "status": "demo",
                "to": to,
                "message": message,
                "note": "Connect Twilio to send real WhatsApp messages.",
                "sid": "DEMO_SID_" + datetime.utcnow().strftime("%H%M%S"),
            }
        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)  # type: ignore
            wa_from = getattr(settings, "TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
            msg = client.messages.create(
                from_=wa_from,
                body=message,
                to=f"whatsapp:{to}" if not to.startswith("whatsapp:") else to,
            )
            return {"status": "sent", "sid": msg.sid, "to": to}
        except ImportError:
            return {"status": "error", "error": "twilio package not installed. Run: pip install twilio"}
        except Exception as e:
            logger.error(f"WhatsApp send failed: {e}")
            return {"status": "error", "error": str(e)}

    def send_order_update(self, phone: str, order_number: str, status: str) -> Dict:
        msg = (
            f"🛍️ *ShopMind Order Update*\n\n"
            f"Order #{order_number} has been updated to: *{status}*\n\n"
            f"Thank you for shopping with us! 🙏"
        )
        return self.send_message(phone, msg)

    def send_shipment_alert(self, phone: str, order_number: str, delay_reason: str) -> Dict:
        msg = (
            f"⚠️ *Shipment Delay Notice*\n\n"
            f"Your order #{order_number} has been delayed.\n"
            f"Reason: {delay_reason}\n\n"
            f"We apologize for the inconvenience. Our team is working to resolve this. 🙏"
        )
        return self.send_message(phone, msg)

    def send_low_stock_alert(self, phone: str, product_name: str, stock: int) -> Dict:
        msg = (
            f"🚨 *Low Stock Alert — ShopMind*\n\n"
            f"Product: *{product_name}*\n"
            f"Current Stock: *{stock} units*\n\n"
            f"Please review inventory and initiate restock. ⚡"
        )
        return self.send_message(phone, msg)


# ─────────────────────────────────────────────────────────────────────────────
# Email Service (SMTP)
# ─────────────────────────────────────────────────────────────────────────────

class EmailService:
    """Send HTML emails via SMTP (Gmail, Outlook, SendGrid, etc.)."""

    def is_connected(self) -> bool:
        return _is_configured(
            getattr(settings, "SMTP_USERNAME", ""),
            getattr(settings, "SMTP_PASSWORD", ""),
            getattr(settings, "SMTP_FROM_EMAIL", ""),
        )

    def get_status(self) -> Dict:
        return {
            "connected": self.is_connected(),
            "host": getattr(settings, "SMTP_HOST", "smtp.gmail.com"),
            "from": getattr(settings, "SMTP_FROM_EMAIL", "") or None,
        }

    def send_email(self, to: str, subject: str, html_body: str, plain_body: str = "") -> Dict:
        if not self.is_connected():
            logger.info(f"[Email DEMO] To: {to} | Subject: {subject}")
            return {
                "status": "demo",
                "to": to,
                "subject": subject,
                "note": "Configure SMTP credentials to send real emails.",
            }
        try:
            host = getattr(settings, "SMTP_HOST", "smtp.gmail.com")
            port = int(getattr(settings, "SMTP_PORT", 587))
            username = settings.SMTP_USERNAME  # type: ignore
            password = settings.SMTP_PASSWORD  # type: ignore
            from_name = getattr(settings, "SMTP_FROM_NAME", "ShopMind")
            from_email = settings.SMTP_FROM_EMAIL  # type: ignore

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{from_name} <{from_email}>"
            msg["To"] = to
            if plain_body:
                msg.attach(MIMEText(plain_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            ctx = ssl.create_default_context()
            with smtplib.SMTP(host, port) as server:
                server.ehlo()
                server.starttls(context=ctx)
                server.login(username, password)
                server.sendmail(from_email, to, msg.as_string())

            return {"status": "sent", "to": to, "subject": subject}
        except Exception as e:
            logger.error(f"Email send failed: {e}")
            return {"status": "error", "error": str(e)}

    def send_ticket_reply(self, customer_email: str, ticket_subject: str, reply_body: str) -> Dict:
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#6366f1;padding:20px;border-radius:8px 8px 0 0">
            <h2 style="color:white;margin:0">🛍️ ShopMind Support</h2>
          </div>
          <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb">
            <p style="color:#374151">Re: <strong>{ticket_subject}</strong></p>
            <hr style="border-color:#e5e7eb"/>
            <div style="color:#374151;line-height:1.6">{reply_body.replace(chr(10), '<br>')}</div>
          </div>
          <div style="background:#f3f4f6;padding:16px;text-align:center;font-size:12px;color:#9ca3af;border-radius:0 0 8px 8px">
            ShopMind AI-Powered E-Commerce Platform
          </div>
        </div>
        """
        return self.send_email(customer_email, f"Re: {ticket_subject}", html, reply_body)

    def send_order_confirmation(self, customer_email: str, order_number: str, total: float) -> Dict:
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#10b981;padding:20px;border-radius:8px 8px 0 0">
            <h2 style="color:white;margin:0">✅ Order Confirmed!</h2>
          </div>
          <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb">
            <p style="color:#374151;font-size:16px">Thank you for your order!</p>
            <p style="color:#374151">Order Number: <strong>#{order_number}</strong></p>
            <p style="color:#374151">Total Amount: <strong>₹{total:,.2f}</strong></p>
            <p style="color:#6b7280;font-size:14px">We'll send you a shipping update once your order is on its way.</p>
          </div>
        </div>
        """
        return self.send_email(customer_email, f"Order Confirmed — #{order_number}", html)

    def send_low_stock_report(self, manager_email: str, products: List[Dict]) -> Dict:
        rows = "".join(
            f"<tr><td style='padding:8px;border-bottom:1px solid #e5e7eb'>{p['name']}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e5e7eb;color:#ef4444;font-weight:bold'>{p['stock']}</td>"
            f"<td style='padding:8px;border-bottom:1px solid #e5e7eb'>{p['threshold']}</td></tr>"
            for p in products
        )
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
          <div style="background:#ef4444;padding:20px;border-radius:8px 8px 0 0">
            <h2 style="color:white;margin:0">🚨 Low Stock Alert Report</h2>
          </div>
          <div style="background:#f9fafb;padding:24px">
            <table style="width:100%;border-collapse:collapse">
              <thead><tr style="background:#f3f4f6">
                <th style="padding:10px;text-align:left">Product</th>
                <th style="padding:10px;text-align:left">Current Stock</th>
                <th style="padding:10px;text-align:left">Threshold</th>
              </tr></thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        </div>
        """
        return self.send_email(manager_email, f"🚨 Low Stock Alert — {len(products)} Products", html)


# ─── Singletons ───────────────────────────────────────────────────────────────
shopify_service = ShopifyService()
payment_service = PaymentService()
whatsapp_service = WhatsAppService()
email_service = EmailService()
