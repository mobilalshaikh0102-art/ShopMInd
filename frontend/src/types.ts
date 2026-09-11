export type View =
  | 'dashboard' | 'inventory' | 'orders' | 'shipments'
  | 'tickets' | 'approvals' | 'logs' | 'executions'

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
