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
}

export default api
