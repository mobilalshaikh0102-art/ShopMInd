export type View =
  | 'dashboard' | 'inventory' | 'orders' | 'shipments'
  | 'tickets' | 'approvals' | 'logs' | 'executions' | 'analytics' | 'integrations' | 'logistics' | 'aitools' | 'crm' | 'security'

export interface Metrics {
  total_orders: number
  pending_orders: number
  low_stock_products?: number
  delayed_shipments?: number
  open_support_tickets: number
  pending_approvals?: number
  agent_actions_today?: number
  is_customer?: boolean
  recent_agent_activity?: { agent: string; event: string; status: string; started_at: string }[]
}

export interface Product { id: number; sku: string; name: string; category: string; price: number; cost_price: number; currency: string; brand?: string; is_active: boolean }
export interface Inventory { id: number; product_id: number; current_stock: number; reserved_stock: number; reorder_threshold: number; reorder_quantity: number; sales_velocity_30d: number; warehouse_location?: string; last_restocked_at?: string }
export interface OrderItem { id: number; product_id: number; quantity: number; unit_price: number; total_price: number }
export interface Order { id: number; order_number: string; customer_id: number; status: string; subtotal: number; tax: number; shipping_fee: number; discount: number; total: number; currency: string; shipping_address?: string; notes?: string; items: OrderItem[]; created_at: string }
export interface Shipment { id: number; order_id: number; tracking_number?: string; carrier?: string; status: string; shipped_at?: string; estimated_delivery?: string; actual_delivery?: string; delay_reason?: string; created_at: string }
export interface Ticket { id: number; customer_id: number; order_id?: number; subject: string; description: string; priority: string; status: string; assigned_to?: string; resolution_notes?: string; created_at: string }
export interface Approval { id: number; action_id: number; requested_by_agent: string; reason?: string; risk_details?: string; status: string; created_at: string }
export interface AuditLog { id: number; trace_id?: string; timestamp: string; actor: string; action: string; entity_type?: string; entity_id?: number; risk_level: string; result: string }
export interface AgentExecution { id: number; trace_id: string; agent_name: string; trigger_event: string; status: string; execution_time_ms?: number; started_at: string; completed_at?: string }
export interface ChatMessage { id: string; role: 'user' | 'agent'; content: string; agent?: string; ts: Date }

// Analytics types
export interface SalesTrendPoint { date: string; revenue: number; orders: number }
export interface CategoryRevenue { category: string; revenue: number; units: number }
export interface OrderStatusBreakdown { status: string; count: number }
export interface TopProduct { id: number; name: string; category: string; sku: string; revenue: number; units_sold: number }
export interface HeatmapCell { day: string; day_index: number; hour: number; revenue: number }
export interface ForecastItem { product_id: number; name: string; sku: string; category: string; current_stock: number; reorder_threshold: number; sales_velocity_30d: number; forecast_days: number; forecasted_demand: number; days_of_stock: number; recommended_restock: number; risk_level: string }
export interface KpiSummary { total_revenue: number; total_orders: number; avg_order_value: number; total_customers: number; this_month_revenue: number; last_month_revenue: number; revenue_growth_pct: number; this_month_orders: number; last_month_orders: number }

// Integration types
export interface IntegrationStatus { connected: boolean; shop?: string; host?: string; from?: string }
export interface AllIntegrationStatus { shopify: IntegrationStatus; razorpay: IntegrationStatus; stripe: IntegrationStatus; whatsapp: IntegrationStatus; email: IntegrationStatus }
export interface ShopifyProduct { id: string; title: string; vendor?: string; product_type?: string; status: string; variants_count: number }
export interface ShopifyOrder { id: string; order_number: number; financial_status: string; fulfillment_status?: string; total_price: string; currency: string; created_at: string }
export interface ShopifySync { source: string; synced_at: string; count: number; note?: string; products?: ShopifyProduct[]; orders?: ShopifyOrder[] }
export interface PaymentStats { source: string; total_revenue: number; total_payments: number; captured: number; failed: number; refunded: number; success_rate: number; currency: string; methods?: Record<string, number>; note?: string; trend?: { date: string; revenue: number; count: number }[] }

// Logistics types
export interface TrackingEvent { timestamp: string; location: string; description: string }
export interface TrackingResult { awb: string; source: string; carrier: string; status: string; estimated_delivery: string; events: TrackingEvent[]; note?: string; order_id?: number }
export interface Vendor { id: number; name: string; contact: string; email: string; phone: string; category: string; lead_time_days: number; rating: number; active: boolean }
export interface PurchaseOrder { id: number; vendor_id: number; vendor_name: string; product_name: string; sku: string; quantity: number; unit_cost: number; total_cost: number; status: string; created_at: string; expected_date: string; notes: string }
export interface RestockSuggestion { product_id: number; product_name: string; sku: string; category: string; current_stock: number; reorder_threshold: number; suggested_qty: number; suggested_vendor: string; vendor_id: number; estimated_cost: number; urgency: string }

// AI Tools types
export interface SentimentResult { ticket_id: number; subject: string; sentiment: string; score: number; urgency: string; emotion: string; summary?: string; suggested_priority?: string }
export interface BulkSentimentResponse { results: SentimentResult[]; summary: { total: number; sentiment_breakdown: Record<string, number>; critical_count: number; avg_score: number } }
export interface ReportResponse { period: string; generated_at: string; metrics_snapshot: Record<string, number>; report: string }
export interface DescriptionResponse { product_name: string; category: string; tone: string; generated_at: string; description: string; product_id?: number }

// CRM types
export interface CustomerRFM { recency_days: number | null; frequency: number; monetary: number; r_score: number; f_score: number; m_score: number; rfm_score: number; segment: string; churn_risk: string }
export interface CustomerSummary { id: number; name: string; email: string; phone?: string; city?: string; country: string; created_at: string; order_count: number; lifetime_value: number; segment: string; churn_risk: string; rfm_score: number; recency_days: number | null; ticket_count: number; notes_count: number }
export interface CustomerProfile { id: number; name: string; email: string; phone?: string; address?: string; city?: string; state?: string; country: string; pincode?: string; created_at: string; rfm: CustomerRFM; orders: { id: number; order_number: string; status: string; total: number; created_at: string }[]; tickets: { id: number; subject: string; status: string; priority: string; created_at: string }[]; notes: { id: number; text: string; author: string; created_at: string }[] }
export interface CRMOverview { total_customers: number; total_revenue: number; avg_customer_lifetime_value: number; vip_count: number; at_risk_count: number; new_count: number; regular_count: number; open_tickets: number; repeat_purchase_rate: number }
export interface SegmentCounts { ALL: number; VIP: number; REGULAR: number; AT_RISK: number; NEW: number }

// Security types
export interface SessionInfo { jti: string; user_id: number; email: string; full_name: string; ip: string; user_agent: string; created_at: string; last_active: string; is_current: boolean }
export interface SecurityEvent { id: number; type: string; email: string; ip: string; ts: string; detail: string }
export interface PlatformUser { id: number; email: string; full_name: string; role: string; is_active: boolean; created_at: string; last_login: string | null }
