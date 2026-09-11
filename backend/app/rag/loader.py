"""RAG Knowledge Base Loader — seeds policy documents with embeddings."""
import logging
from typing import List, Dict

logger = logging.getLogger("shopmind.rag.loader")

KNOWLEDGE_DOCUMENTS: List[Dict] = [
    {
        "title": "Return Policy",
        "category": "POLICY",
        "content": """ShopMind Return Policy

We offer a hassle-free 30-day return policy on all products.

Eligibility:
- Items must be returned within 30 days of delivery
- Products must be unused, unwashed, and in original packaging
- All original tags and accessories must be included
- Proof of purchase (order number) is required

Non-Returnable Items:
- Perishable goods (food, flowers, newspapers)
- Downloadable software products
- Personal hygiene items (once opened)
- Customized or personalized products

Return Process:
1. Contact support@shopmind.ai with your order number
2. Our team will review and approve your return request within 24 hours
3. Pack the item securely in its original packaging
4. Drop off at any authorized courier partner
5. Refund will be processed within 5-7 business days after we receive the item

Return Shipping:
- Free return shipping for defective or wrong items
- Customer bears return shipping cost for change-of-mind returns (₹50 flat)"""
    },
    {
        "title": "Refund Policy",
        "category": "POLICY",
        "content": """ShopMind Refund Policy

Refund Timeline:
- Credit/Debit Card: 5-7 business days
- UPI/Wallet: 2-3 business days
- Net Banking: 5-7 business days
- Cash on Delivery: Bank transfer within 7-10 business days

Refund Eligibility:
- Full refund for defective or damaged products
- Full refund if wrong item was delivered
- Full refund for cancellations before shipment
- Partial refund may apply for items returned without original packaging

Large Refunds (> ₹1,000):
- Requires human agent review and approval
- Additional verification may be requested
- Processing time: 3-5 additional business days

Partial Refunds:
- Items returned after 30 days: 50% refund
- Items returned without original packaging: 20% deduction
- Items showing signs of use: Subject to inspection, up to 30% deduction

Cancellation Refunds:
- Before shipment: Full refund within 24 hours
- After shipment: Return the item first, then refund is processed

Contact our support team at support@shopmind.ai for refund status updates."""
    },
    {
        "title": "Shipping Policy",
        "category": "POLICY",
        "content": """ShopMind Shipping Policy

Standard Shipping:
- Delivery within 5-7 business days
- Free for orders above ₹500
- ₹50 flat fee for orders below ₹500
- Available across India (20,000+ pin codes)

Express Shipping:
- Delivery within 1-2 business days
- Available in metro cities (Mumbai, Delhi, Bengaluru, Chennai, Hyderabad, Kolkata, Pune)
- Flat fee of ₹150 per order

Same-Day Delivery:
- Available in select pin codes in Mumbai, Delhi, Bengaluru
- Orders placed before 12:00 PM are eligible
- Fee: ₹200 flat

Tracking:
- Tracking number provided via email and SMS once shipped
- Real-time tracking available on our website
- Delivery updates sent via SMS and email

Delivery Issues:
- If delivery is missed, 2 re-delivery attempts will be made
- After 2 failed attempts, the package will be held at the nearest hub for 3 days
- Unclaimed packages will be returned and a refund issued

International Shipping:
- Currently not available. We ship within India only."""
    },
    {
        "title": "Warranty Policy",
        "category": "POLICY",
        "content": """ShopMind Warranty Policy

Standard Warranty:
- Electronics: 1-year manufacturer warranty
- Appliances: 1-year warranty, extendable to 2 years
- Clothing & Accessories: 30-day warranty against manufacturing defects
- Furniture: 6-month warranty
- Beauty products: 6-month warranty

Warranty Coverage:
- Manufacturing defects
- Component failures during normal use
- Structural defects

Not Covered Under Warranty:
- Physical damage from drops, water, or accidents
- Damage from misuse or unauthorized repairs
- Normal wear and tear
- Cosmetic damage (scratches, dents) not affecting functionality
- Damage from power surges or improper voltage

Warranty Claim Process:
1. Contact support@shopmind.ai with order number and description of issue
2. Attach clear photos/video of the defect
3. Our team will assess within 48 hours
4. Options: Repair, Replacement, or Refund based on assessment
5. For electronics, our technical team may request the product for inspection

Extended Warranty:
- Available for electronics and appliances at purchase
- 1-year extension: 8% of product price
- 2-year extension: 15% of product price"""
    },
    {
        "title": "Cancellation Policy",
        "category": "POLICY",
        "content": """ShopMind Cancellation Policy

Order Cancellation:
- Orders can be cancelled within 2 hours of placement for full refund
- After 2 hours but before shipment: Cancellation allowed, refund processed in 24 hours
- After shipment: Cancellation not allowed — please use our Return Policy

How to Cancel:
1. Log in to your ShopMind account
2. Go to "My Orders"
3. Select the order and click "Cancel Order"
4. Choose a cancellation reason
5. Confirm — you'll receive a confirmation email immediately

Cancellation Reasons Accepted:
- Changed my mind
- Found a better price elsewhere
- Ordered by mistake
- Delivery time too long

Seller-Side Cancellations:
- In rare cases, we may cancel orders if items go out of stock
- Full refund will be issued within 24 hours
- You'll receive priority access to restock notifications

Partial Cancellations:
- Individual items within an order can be cancelled before shipment
- Mixed-status orders: Only unshipped items can be cancelled"""
    },
    {
        "title": "Customer Support FAQ",
        "category": "FAQ",
        "content": """ShopMind Customer Support FAQ

Q: How do I track my order?
A: Once your order is shipped, you'll receive a tracking number via SMS and email. You can also track by logging into your account and visiting "My Orders".

Q: What payment methods are accepted?
A: We accept Credit Cards, Debit Cards, UPI (PhonePe, GPay, Paytm), Net Banking, and Cash on Delivery (COD for orders up to ₹5,000).

Q: Can I change my delivery address after placing an order?
A: Address changes are allowed within 1 hour of placing the order. Contact support immediately at support@shopmind.ai or call 1800-XXX-XXXX.

Q: What should I do if I receive a damaged item?
A: Take photos of the damaged item and packaging, then contact us within 48 hours of delivery at support@shopmind.ai. We'll arrange a replacement or refund.

Q: How long does delivery take?
A: Standard delivery: 5-7 business days. Express delivery: 1-2 business days. Same-day delivery available in select cities.

Q: Is my payment information secure?
A: Yes. All transactions are encrypted with 256-bit SSL. We never store your card details.

Q: How do I contact customer support?
A: Email: support@shopmind.ai | Phone: 1800-XXX-XXXX (9 AM - 8 PM, Mon-Sat) | Live Chat: Available on website

Q: Can I return a sale/discounted item?
A: Yes, sale items follow the same 30-day return policy unless marked as "Final Sale"."""
    },
]


def load_knowledge_base(force_reload: bool = False) -> int:
    """Load knowledge documents into the database with embeddings. Returns count of docs loaded."""
    from app.db.session import engine
    from app.models import KnowledgeDocument
    from app.rag.embedder import embed_text
    from sqlmodel import Session, select

    loaded = 0
    with Session(engine) as db:
        existing_count = len(db.exec(select(KnowledgeDocument)).all())
        if existing_count >= len(KNOWLEDGE_DOCUMENTS) and not force_reload:
            logger.info(f"Knowledge base already loaded ({existing_count} docs). Skipping.")
            return 0

        if force_reload:
            # Clear existing
            for doc in db.exec(select(KnowledgeDocument)).all():
                db.delete(doc)
            db.commit()

        for doc_data in KNOWLEDGE_DOCUMENTS:
            logger.info(f"  Loading: {doc_data['title']}")
            embedding = embed_text(doc_data["content"])
            doc = KnowledgeDocument(
                title=doc_data["title"],
                category=doc_data["category"],
                content=doc_data["content"],
                embedding=embedding,
            )
            db.add(doc)
            loaded += 1

        db.commit()
    logger.info(f"Knowledge base loaded: {loaded} documents.")
    return loaded
