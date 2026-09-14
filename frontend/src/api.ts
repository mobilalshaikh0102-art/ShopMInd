const API_BASE = '/api/v1'
const TOKEN_KEY = 'sm_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

async function apiFetch<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => apiFetch('/auth/me'),
  dashboardMetrics: () => apiFetch('/dashboard/metrics'),
  listCustomers: () => apiFetch('/customers'),
  listProducts: () => apiFetch('/products'),
  listInventory: () => apiFetch('/inventory'),
  getLowStock: () => apiFetch('/inventory/low-stock'),
  listOrders: (status?: string) => apiFetch(`/orders${status ? `?status=${status}` : ''}`),
  getOrder: (id: number) => apiFetch(`/orders/${id}`),
  listShipments: () => apiFetch('/shipments'),
  getDelayedShipments: () => apiFetch('/shipments/delayed'),
  listTickets: (status?: string) => apiFetch(`/support/tickets${status ? `?status=${status}` : ''}`),
  listPendingApprovals: () => apiFetch('/approvals/pending'),
  decideApproval: (id: number, status: 'APPROVED' | 'REJECTED', notes?: string) =>
    apiFetch(`/approvals/${id}/decide`, { method: 'POST', body: JSON.stringify({ status, decision_notes: notes }) }),
  listExecutions: () => apiFetch('/agents/executions'),
  listAuditLogs: (limit = 50) => apiFetch(`/audit/logs?limit=${limit}`),
  chat: (message: string, sessionId?: string) =>
    apiFetch('/agents/chat', { method: 'POST', body: JSON.stringify({ message, session_id: sessionId }) }),

  // Analytics
  analyticsSalesTrend: (days = 30) => apiFetch(`/analytics/sales-trend?days=${days}`),
  analyticsRevenueByCategory: () => apiFetch('/analytics/revenue-by-category'),
  analyticsOrderStatusBreakdown: () => apiFetch('/analytics/order-status-breakdown'),
  analyticsTopProducts: (limit = 10) => apiFetch(`/analytics/top-products?limit=${limit}`),
  analyticsRevenueHeatmap: () => apiFetch('/analytics/revenue-heatmap'),
  analyticsDemandForecast: () => apiFetch('/analytics/demand-forecast-summary'),
  analyticsKpiSummary: () => apiFetch('/analytics/kpi-summary'),

  // Integrations
  integrationsStatus: () => apiFetch('/integrations/status'),
  shopifyProducts: () => apiFetch('/integrations/shopify/products'),
  shopifyOrders: () => apiFetch('/integrations/shopify/orders'),
  razorpayStats: () => apiFetch('/integrations/payments/razorpay'),
  stripeStats: () => apiFetch('/integrations/payments/stripe'),
  whatsappSend: (to: string, message: string) =>
    apiFetch('/integrations/whatsapp/send', { method: 'POST', body: JSON.stringify({ to, message }) }),
  whatsappOrderUpdate: (phone: string, order_number: string, status: string) =>
    apiFetch('/integrations/whatsapp/order-update', { method: 'POST', body: JSON.stringify({ phone, order_number, status }) }),
  emailSend: (to: string, subject: string, body: string) =>
    apiFetch('/integrations/email/send', { method: 'POST', body: JSON.stringify({ to, subject, body }) }),
  emailTicketReply: (customer_email: string, ticket_subject: string, reply_body: string) =>
    apiFetch('/integrations/email/ticket-reply', { method: 'POST', body: JSON.stringify({ customer_email, ticket_subject, reply_body }) }),

  // Logistics
  trackShipment: (awb: string) => apiFetch(`/logistics/track/${awb}`),
  trackByOrder: (orderId: number) => apiFetch(`/logistics/track-by-order/${orderId}`),
  listVendors: () => apiFetch('/logistics/vendors'),
  createVendor: (data: any) => apiFetch('/logistics/vendors', { method: 'POST', body: JSON.stringify(data) }),
  deleteVendor: (id: number) => apiFetch(`/logistics/vendors/${id}`, { method: 'DELETE' }),
  listPurchaseOrders: () => apiFetch('/logistics/purchase-orders'),
  createPurchaseOrder: (data: any) => apiFetch('/logistics/purchase-orders', { method: 'POST', body: JSON.stringify(data) }),
  updatePOStatus: (id: number, status: string) => apiFetch(`/logistics/purchase-orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deletePO: (id: number) => apiFetch(`/logistics/purchase-orders/${id}`, { method: 'DELETE' }),
  restockSuggestions: () => apiFetch('/logistics/restock-suggestions'),

  // AI Tools
  generateReport: (period: string, focus?: string) => apiFetch('/ai-tools/report', { method: 'POST', body: JSON.stringify({ period, focus }) }),
  analyzeTicketSentiment: (ticketId: number) => apiFetch(`/ai-tools/sentiment/${ticketId}`, { method: 'POST' }),
  bulkSentiment: () => apiFetch('/ai-tools/bulk-sentiment', { method: 'POST' }),
  generateDescription: (data: any) => apiFetch('/ai-tools/generate-description', { method: 'POST', body: JSON.stringify(data) }),
  generateDescriptionFromDB: (productId: number) => apiFetch(`/ai-tools/generate-description/${productId}`, { method: 'POST' }),

  // CRM
  crmOverview: () => apiFetch('/crm/overview'),
  crmSegments: () => apiFetch('/crm/segments'),
  crmCustomers: (params?: { search?: string; segment?: string; page?: number }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.segment && params.segment !== 'ALL') q.set('segment', params.segment)
    if (params?.page) q.set('page', String(params.page))
    return apiFetch(`/crm/customers?${q.toString()}`)
  },
  crmCustomerProfile: (id: number) => apiFetch(`/crm/customers/${id}`),
  crmAddNote: (id: number, text: string) => apiFetch(`/crm/customers/${id}/notes`, { method: 'POST', body: JSON.stringify({ text }) }),

  // Security
  securitySessions: () => apiFetch('/security/sessions'),
  securityRevokeSession: (jti: string) => apiFetch(`/security/sessions/${jti}`, { method: 'DELETE' }),
  securityRevokeAll: () => apiFetch('/security/sessions', { method: 'DELETE' }),
  securityChangePassword: (current_password: string, new_password: string) =>
    apiFetch('/security/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
  securityAuditEvents: (event_type?: string) => apiFetch(`/security/audit-events${event_type ? `?event_type=${event_type}` : ''}`),
  securityExportData: () => apiFetch('/security/export-data'),
  securityListUsers: () => apiFetch('/security/users'),
  securityCreateUser: (data: any) => apiFetch('/security/users', { method: 'POST', body: JSON.stringify(data) }),
  securityUpdateUserStatus: (id: number, is_active: boolean) =>
    apiFetch(`/security/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),
}

export default api
