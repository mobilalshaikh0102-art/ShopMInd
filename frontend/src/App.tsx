import { useState, useEffect, useRef, useCallback } from 'react'
import './index.css'
import api, { getToken, setToken, clearToken } from './api'
import type { View, Metrics, ChatMessage, Product, Inventory, Order, Shipment, Ticket, Approval, AuditLog, AgentExecution } from './types'

// ─── SVG Icon helper ──────────────────────────────────────────────────────────
function SvgIcon({ children, size = 16, className = '' }: { children: React.ReactNode; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  )
}

// Inline SVG icons as components
const Dashboard = () => <SvgIcon><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></SvgIcon>
const PackageIcon = () => <SvgIcon><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></SvgIcon>
const CartIcon = () => <SvgIcon><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></SvgIcon>
const TruckIcon = () => <SvgIcon><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></SvgIcon>
const TicketIcon = () => <SvgIcon><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></SvgIcon>
const ShieldIcon = () => <SvgIcon><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></SvgIcon>
const ScrollIcon = () => <SvgIcon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></SvgIcon>
const BotIcon = () => <SvgIcon><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></SvgIcon>
const ActivityIcon = () => <SvgIcon><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></SvgIcon>
const BellIcon = () => <SvgIcon><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></SvgIcon>
const UserIcon = () => <SvgIcon><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></SvgIcon>
const SendIcon = () => <SvgIcon><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></SvgIcon>
const CheckIcon = () => <SvgIcon><polyline points="20 6 9 17 4 12"/></SvgIcon>
const XIcon = () => <SvgIcon><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></SvgIcon>
const AlertIcon = () => <SvgIcon><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></SvgIcon>
const ChevronRight = () => <SvgIcon><polyline points="9 18 15 12 9 6"/></SvgIcon>
const RefreshIcon = () => <SvgIcon><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></SvgIcon>
const ZapIcon = () => <SvgIcon><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></SvgIcon>
function LoaderIcon({ className = '' }: { className?: string }) {
  return <SvgIcon className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></SvgIcon>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusBadge(status: string): string {
  const m: Record<string, string> = {
    PENDING: 'badge-warning', PROCESSING: 'badge-info', SHIPPED: 'badge-info',
    DELIVERED: 'badge-success', CANCELLED: 'badge-danger', REFUNDED: 'badge-purple',
    IN_TRANSIT: 'badge-info', DELAYED: 'badge-danger', RETURNED: 'badge-purple', LOST: 'badge-danger',
    OPEN: 'badge-danger', IN_PROGRESS: 'badge-warning', RESOLVED: 'badge-success', CLOSED: 'badge-neutral',
    LOW: 'badge-info', MEDIUM: 'badge-warning', HIGH: 'badge-danger', URGENT: 'badge-danger',
    COMPLETED: 'badge-success', RUNNING: 'badge-info', FAILED: 'badge-danger',
    APPROVED: 'badge-success', REJECTED: 'badge-danger',
  }
  return m[status?.toUpperCase()] || 'badge-neutral'
}

function fmtDate(s: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtTime(s: string) {
  if (!s) return '—'
  return new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
function fmtCurrency(v: number, cur = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v)
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ title, value, sub, trend, icon, iconBg }: {
  title: string; value: any; sub: string; trend: 'up' | 'warn' | 'danger'; icon: React.ReactNode; iconBg: string
}) {
  return (
    <div className="kpi-card fade-in">
      <div className="kpi-icon" style={{ background: iconBg }}>{icon}</div>
      <div className="kpi-label">{title}</div>
      <div className="kpi-value">{value ?? '—'}</div>
      <div className={`kpi-sub ${trend}`}>{sub}</div>
    </div>
  )
}

function Spinner() {
  return <div className="spinner"><LoaderIcon className="spin" /></div>
}

function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div><div className="page-heading">{title}</div>{sub && <div className="page-sub">{sub}</div>}</div>
      {action}
    </div>
  )
}

// ─── Login ─────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (token: string, role: string, name: string) => void }) {
  const [email, setEmail] = useState('admin@shopmind.ai')
  const [password, setPassword] = useState('Admin@123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const DEMO_ACCOUNTS = [
    { role: 'Admin', email: 'admin@shopmind.ai', password: 'Admin@123', color: '#6366f1' },
    { role: 'Ops Manager', email: 'ops@shopmind.ai', password: 'Ops@1234', color: '#10b981' },
    { role: 'Analyst', email: 'analyst@shopmind.ai', password: 'Analyst@1', color: '#f59e0b' },
    { role: 'Support', email: 'support@shopmind.ai', password: 'Support@1', color: '#3b82f6' },
    { role: 'Customer', email: 'customer@shopmind.ai', password: 'Customer@1', color: '#a855f7' },
  ]

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const data = await api.login(email, password)
      setToken(data.access_token)
      onLogin(data.access_token, data.role, data.full_name)
    } catch (err: any) {
      setError(err.message || 'Login failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="login-page">
      <div className="login-card fade-in">
        <div className="login-logo">
          <div className="login-logo-icon">✦</div>
          <div>
            <div className="login-brand">ShopMind</div>
            <div className="login-tagline">AI-Powered E-Commerce Operations Platform</div>
          </div>
        </div>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input value={email} onChange={e => setEmail(e.target.value)} className="form-input" type="email" placeholder="email@shopmind.ai" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input value={password} onChange={e => setPassword(e.target.value)} className="form-input" type="password" placeholder="••••••••" required />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '11px', fontSize: '14px' }}>
            {loading ? <><LoaderIcon className="spin" /> Signing in...</> : 'Sign In →'}
          </button>
        </form>
        <div className="demo-accounts">
          <div className="demo-label">Quick Access — Demo Accounts</div>
          {DEMO_ACCOUNTS.map(a => (
            <button key={a.email} className="demo-btn" onClick={() => { setEmail(a.email); setPassword(a.password) }}>
              <span className="demo-role" style={{ color: a.color }}>● {a.role}</span>
              <span className="demo-email">{a.email}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ view, setView, role, pendingCount }: { view: View; setView: (v: View) => void; role: string; pendingCount: number }) {
  const ALL_LINKS: { id: View; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <Dashboard /> },
    { id: 'inventory', label: 'Inventory', icon: <PackageIcon /> },
    { id: 'orders', label: 'Orders', icon: <CartIcon /> },
    { id: 'shipments', label: 'Shipments', icon: <TruckIcon /> },
    { id: 'tickets', label: 'Support Tickets', icon: <TicketIcon /> },
    { id: 'approvals', label: 'Approvals', icon: <ShieldIcon />, badge: pendingCount },
    { id: 'executions', label: 'Agent Executions', icon: <BotIcon /> },
    { id: 'logs', label: 'Audit Logs', icon: <ScrollIcon /> },
  ]

  const ROLE_LINKS: Record<string, View[]> = {
    CUSTOMER: ['dashboard', 'orders', 'tickets'],
    ANALYST: ['dashboard', 'orders', 'shipments', 'executions'],
    CUSTOMER_SUPPORT: ['dashboard', 'orders', 'tickets', 'shipments'],
    OPS_MANAGER: ['dashboard', 'inventory', 'orders', 'shipments', 'tickets', 'approvals', 'executions'],
    ADMIN: ['dashboard', 'inventory', 'orders', 'shipments', 'tickets', 'approvals', 'executions', 'logs'],
  }

  const allowed = ROLE_LINKS[role] || ALL_LINKS.map(l => l.id)
  const links = ALL_LINKS.filter(l => allowed.includes(l.id))

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">✦</div>
        <div className="sidebar-logo-text">ShopMind</div>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>
        {links.map(link => (
          <button key={link.id} className={`nav-item ${view === link.id ? 'active' : ''}`} onClick={() => setView(link.id)}>
            {link.icon}
            <span>{link.label}</span>
            {link.badge != null && link.badge > 0 && <span className="nav-badge">{link.badge}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="agent-status"><div className="pulse-dot" /><span>7 AI Agents Active</span></div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>Powered by Gemini AI</div>
      </div>
    </aside>
  )
}

// ─── AI Copilot ────────────────────────────────────────────────────────────────
function CopilotPanel({ role }: { role: string }) {
  const isCustomer = role === 'CUSTOMER'
  const [msgs, setMsgs] = useState<ChatMessage[]>([{
    id: '0', role: 'agent',
    agent: isCustomer ? 'Support Copilot' : 'ShopMind Orchestrator',
    content: isCustomer
      ? "Hello! I'm your ShopMind support assistant. Ask me about your orders, returns, or our policies."
      : "Hello! I'm the ShopMind AI Copilot. I automatically route your questions to the best specialized agent.\n\nTry asking about inventory, orders, shipments, pricing, or analytics.",
    ts: new Date()
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(`sess_${Math.random().toString(36).slice(2, 10)}`)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, loading])

  const QUICK_PROMPTS = isCustomer
    ? ['Where is my order?', 'Refund policy?', 'How to cancel?', 'Warranty info']
    : ['Low stock products?', 'Pending orders?', 'Delayed shipments?', 'Business summary']

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    const q = input; setInput(''); setLoading(true)
    setMsgs(prev => [...prev, { id: Date.now().toString(), role: 'user', content: q, ts: new Date() }])
    try {
      const data = await api.chat(q, sessionId)
      setMsgs(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'agent', agent: data.agent || 'Agent', content: data.response, ts: new Date() }])
    } catch {
      setMsgs(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'agent', agent: 'System', content: "I'm having trouble connecting to the backend. Please ensure the server is running.", ts: new Date() }])
    } finally { setLoading(false) }
  }

  return (
    <aside className="copilot-panel">
      <div className="copilot-header">
        <div className="copilot-icon"><BotIcon /></div>
        <div style={{ flex: 1 }}>
          <div className="copilot-title">{isCustomer ? 'Support Copilot' : 'AI Copilot'}</div>
          <div className="copilot-subtitle">{isCustomer ? 'Customer assistant' : '7-agent orchestrator • Gemini'}</div>
        </div>
        <div className="pulse-dot" />
      </div>
      <div className="copilot-messages">
        {msgs.map(msg => (
          <div key={msg.id} className={`chat-msg ${msg.role === 'user' ? 'user' : ''} fade-in`}>
            <div className={`msg-avatar ${msg.role === 'user' ? 'user-av' : 'bot'}`}>
              {msg.role === 'user' ? <UserIcon /> : <BotIcon />}
            </div>
            <div className="msg-body">
              {msg.role === 'agent' && <span className="msg-agent">{msg.agent}</span>}
              <div className={`msg-bubble ${msg.role === 'user' ? 'user-msg' : 'bot'}`}>{msg.content}</div>
              <span className="msg-time">{msg.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-msg fade-in">
            <div className="msg-avatar bot"><BotIcon /></div>
            <div className="msg-body">
              <span className="msg-agent">Thinking...</span>
              <div className="msg-bubble bot">
                <div className="typing-indicator"><div className="typing-dot"/><div className="typing-dot"/><div className="typing-dot"/></div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {msgs.length <= 1 && (
        <div className="quick-prompts">
          {QUICK_PROMPTS.map(p => <button key={p} className="quick-btn" onClick={() => setInput(p)}>{p}</button>)}
        </div>
      )}
      <div className="copilot-input-area">
        <form className="copilot-input-form" onSubmit={send}>
          <input value={input} onChange={e => setInput(e.target.value)} disabled={loading}
            className="copilot-input" placeholder="Ask the AI Copilot..." />
          <button type="submit" className="send-btn" disabled={!input.trim() || loading}><SendIcon /></button>
        </form>
      </div>
    </aside>
  )
}

// ─── Page Views ───────────────────────────────────────────────────────────────
function DashboardView({ metrics, role }: { metrics: Metrics | null; role: string }) {
  const m = metrics || {} as Metrics
  const isCustomer = role === 'CUSTOMER'
  return (
    <div className="fade-in">
      <PageHeader title="Business Dashboard" sub="Real-time operational overview" />
      <div className="kpi-grid">
        <KpiCard title="Total Orders" value={m.total_orders} sub="All time" trend="up" icon={<CartIcon />} iconBg="rgba(99,102,241,0.15)" />
        <KpiCard title="Pending Orders" value={m.pending_orders} sub="Awaiting processing" trend="warn" icon={<ActivityIcon />} iconBg="rgba(245,158,11,0.15)" />
        {!isCustomer && <>
          <KpiCard title="Low Stock Alerts" value={m.low_stock_products} sub="Below threshold" trend="danger" icon={<AlertIcon />} iconBg="rgba(239,68,68,0.15)" />
          <KpiCard title="Delayed Shipments" value={m.delayed_shipments} sub="Logistics exceptions" trend="danger" icon={<TruckIcon />} iconBg="rgba(239,68,68,0.12)" />
        </>}
        <KpiCard title="Open Tickets" value={m.open_support_tickets} sub="Support queue" trend="warn" icon={<TicketIcon />} iconBg="rgba(168,85,247,0.15)" />
        {!isCustomer && <>
          <KpiCard title="Pending Approvals" value={m.pending_approvals} sub="Human review needed" trend="danger" icon={<ShieldIcon />} iconBg="rgba(239,68,68,0.12)" />
          <KpiCard title="Agent Actions" value={m.agent_actions_today} sub="AI-executed today" trend="up" icon={<ZapIcon />} iconBg="rgba(99,102,241,0.15)" />
        </>}
      </div>
      {m.recent_agent_activity && m.recent_agent_activity.length > 0 && (
        <div>
          <div className="section-title"><BotIcon /> Recent Agent Activity</div>
          <div className="data-table-wrapper">
            {m.recent_agent_activity.map((a, i) => (
              <div key={i} className="activity-item">
                <div className="activity-icon" style={{ background: 'rgba(99,102,241,0.15)' }}><BotIcon /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{a.agent}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.event} · {fmtTime(a.started_at)}</div>
                </div>
                <span className={`badge ${statusBadge(a.status)}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InventoryView() {
  const [inventory, setInventory] = useState<Inventory[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { Promise.all([api.listInventory(), api.listProducts()]).then(([inv, prods]) => { setInventory(inv); setProducts(prods) }).finally(() => setLoading(false)) }, [])
  const getProduct = (id: number) => products.find(p => p.id === id)
  if (loading) return <Spinner />
  const lowCount = inventory.filter(i => i.current_stock <= i.reorder_threshold).length
  return (
    <div className="fade-in">
      <PageHeader title="Inventory Management" sub={`${inventory.length} SKUs · ${lowCount} low stock`} />
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr>{['Product', 'SKU', 'Category', 'Stock', 'Threshold', 'Reorder Qty', 'Velocity/30d', 'Status'].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {inventory.map(inv => {
              const p = getProduct(inv.product_id); const isLow = inv.current_stock <= inv.reorder_threshold
              return (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 600 }}>{p?.name || `Product #${inv.product_id}`}</td>
                  <td className="mono">{p?.sku || '—'}</td>
                  <td><span className="badge badge-neutral">{p?.category || '—'}</span></td>
                  <td style={{ color: isLow ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>{inv.current_stock}</td>
                  <td>{inv.reorder_threshold}</td><td>{inv.reorder_quantity}</td><td>{inv.sales_velocity_30d}/mo</td>
                  <td><span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`}>{isLow ? 'LOW STOCK' : 'OK'}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {inventory.length === 0 && <div className="empty-state"><div className="empty-title">No inventory data</div><div className="empty-sub">Seed the database to see inventory.</div></div>}
      </div>
    </div>
  )
}

function OrdersView() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  useEffect(() => { api.listOrders().then(setOrders).finally(() => setLoading(false)) }, [])
  const filtered = filter ? orders.filter(o => o.status === filter) : orders
  if (loading) return <Spinner />
  return (
    <div className="fade-in">
      <PageHeader title="Order Management" sub={`${orders.length} total orders`}
        action={
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 12px', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}>
            <option value="">All Status</option>
            {['PENDING','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        }
      />
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr>{['Order #','Customer ID','Status','Subtotal','Tax','Shipping','Total','Date'].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id}>
                <td className="mono text-accent">{o.order_number}</td>
                <td>#{o.customer_id}</td>
                <td><span className={`badge ${statusBadge(o.status)}`}>{o.status}</span></td>
                <td>{fmtCurrency(o.subtotal, o.currency)}</td>
                <td style={{ color: 'var(--text-muted)' }}>{fmtCurrency(o.tax, o.currency)}</td>
                <td style={{ color: 'var(--text-muted)' }}>{fmtCurrency(o.shipping_fee, o.currency)}</td>
                <td className="fw-bold">{fmtCurrency(o.total, o.currency)}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{fmtDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state"><div className="empty-title">No orders found</div></div>}
      </div>
    </div>
  )
}

function ShipmentsView() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [showDelayed, setShowDelayed] = useState(false)
  useEffect(() => {
    setLoading(true)
    const fn = showDelayed ? api.getDelayedShipments : api.listShipments
    fn().then(setShipments).finally(() => setLoading(false))
  }, [showDelayed])
  if (loading) return <Spinner />
  return (
    <div className="fade-in">
      <PageHeader title="Shipment Tracking" sub={`${shipments.length} shipments`}
        action={<div style={{ display: 'flex', gap: '8px' }}>
          <button className={`btn ${!showDelayed ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowDelayed(false)}>All</button>
          <button className={`btn ${showDelayed ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowDelayed(true)}><AlertIcon /> Delayed</button>
        </div>}
      />
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr>{['Order ID','Tracking #','Carrier','Status','Est. Delivery','Delay Reason','Created'].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {shipments.map(s => (
              <tr key={s.id}>
                <td>#{s.order_id}</td><td className="mono">{s.tracking_number || '—'}</td><td>{s.carrier || '—'}</td>
                <td><span className={`badge ${statusBadge(s.status)}`}>{s.status}</span></td>
                <td style={{ fontSize: '12px' }}>{s.estimated_delivery ? fmtDate(s.estimated_delivery) : '—'}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{s.delay_reason || '—'}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{fmtDate(s.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shipments.length === 0 && <div className="empty-state"><div className="empty-title">No shipments found</div></div>}
      </div>
    </div>
  )
}

function TicketsView() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.listTickets().then(setTickets).finally(() => setLoading(false)) }, [])
  if (loading) return <Spinner />
  return (
    <div className="fade-in">
      <PageHeader title="Support Tickets" sub={`${tickets.length} tickets`} />
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr>{['ID','Customer','Subject','Priority','Status','Assigned To','Created'].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {tickets.map(t => (
              <tr key={t.id}>
                <td className="mono text-muted">#{t.id}</td><td>#{t.customer_id}</td>
                <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</td>
                <td><span className={`badge ${statusBadge(t.priority)}`}>{t.priority}</span></td>
                <td><span className={`badge ${statusBadge(t.status)}`}>{t.status}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{t.assigned_to || '—'}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{fmtDate(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {tickets.length === 0 && <div className="empty-state"><div className="empty-title">No tickets</div></div>}
      </div>
    </div>
  )
}

function ApprovalsView({ onUpdate }: { onUpdate: () => void }) {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [deciding, setDeciding] = useState<number | null>(null)
  const load = () => { api.listPendingApprovals().then(setApprovals).finally(() => setLoading(false)) }
  useEffect(load, [])
  const decide = async (id: number, status: 'APPROVED' | 'REJECTED') => {
    setDeciding(id)
    try { await api.decideApproval(id, status); load(); onUpdate() } catch {} finally { setDeciding(null) }
  }
  if (loading) return <Spinner />
  return (
    <div className="fade-in">
      <PageHeader title="Pending Approvals" sub="High-risk AI actions awaiting human review"
        action={<span className="badge badge-danger">{approvals.length} pending</span>} />
      {approvals.length === 0 ? (
        <div className="data-table-wrapper">
          <div className="empty-state">
            <div className="empty-icon" style={{ background: 'rgba(16,185,129,0.15)' }}><CheckIcon /></div>
            <div className="empty-title">All clear!</div>
            <div className="empty-sub">No actions are awaiting your approval.</div>
          </div>
        </div>
      ) : (
        approvals.map(appr => (
          <div key={appr.id} className="approval-card fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>Action #{appr.action_id}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Requested by <strong style={{ color: 'var(--accent-light)' }}>{appr.requested_by_agent}</strong></div>
              </div>
              <span className="badge badge-danger">HIGH RISK</span>
            </div>
            {appr.reason && <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.6' }}>{appr.reason}</div>}
            {appr.risk_details && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>{appr.risk_details}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-success" style={{ flex: 1 }} disabled={deciding === appr.id} onClick={() => decide(appr.id, 'APPROVED')}>
                {deciding === appr.id ? <LoaderIcon className="spin" /> : <CheckIcon />} Approve
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} disabled={deciding === appr.id} onClick={() => decide(appr.id, 'REJECTED')}>
                <XIcon /> Reject
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function ExecutionsView() {
  const [executions, setExecutions] = useState<AgentExecution[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.listExecutions().then(setExecutions).finally(() => setLoading(false)) }, [])
  if (loading) return <Spinner />
  return (
    <div className="fade-in">
      <PageHeader title="Agent Executions" sub={`${executions.length} recorded`} />
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr>{['Agent','Trigger Event','Status','Duration','Started','Completed'].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {executions.map(e => (
              <tr key={e.id}>
                <td style={{ fontWeight: 600 }}>{e.agent_name}</td>
                <td className="mono">{e.trigger_event}</td>
                <td><span className={`badge ${statusBadge(e.status)}`}>{e.status}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{e.execution_time_ms ? `${e.execution_time_ms}ms` : '—'}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{fmtDate(e.started_at)} {fmtTime(e.started_at)}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{e.completed_at ? fmtTime(e.completed_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {executions.length === 0 && <div className="empty-state"><div className="empty-title">No executions yet</div><div className="empty-sub">Agent activity will appear here.</div></div>}
      </div>
    </div>
  )
}

function AuditLogsView() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.listAuditLogs(100).then(setLogs).finally(() => setLoading(false)) }, [])
  const riskBadge: Record<string, string> = { HIGH: 'badge-danger', MEDIUM: 'badge-warning', LOW: 'badge-success', CRITICAL: 'badge-danger' }
  if (loading) return <Spinner />
  return (
    <div className="fade-in">
      <PageHeader title="Audit Log" sub={`${logs.length} entries`} />
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead><tr>{['Timestamp','Actor','Action','Entity','Risk','Result'].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td className="mono" style={{ fontSize: '11px' }}>{fmtDate(log.timestamp)} {fmtTime(log.timestamp)}</td>
                <td style={{ fontWeight: 600, fontSize: '12px' }}>{log.actor}</td>
                <td className="mono" style={{ color: 'var(--accent-light)', fontSize: '12px' }}>{log.action}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{log.entity_type ? `${log.entity_type} #${log.entity_id}` : '—'}</td>
                <td><span className={`badge ${riskBadge[log.risk_level] || 'badge-neutral'}`}>{log.risk_level}</span></td>
                <td><span className={`badge ${log.result === 'success' ? 'badge-success' : 'badge-danger'}`}>{log.result}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <div className="empty-state"><div className="empty-title">No audit logs yet</div></div>}
      </div>
    </div>
  )
}

// ─── TopBar ───────────────────────────────────────────────────────────────────
function TopBar({ view, role, fullName, onLogout, onRefresh }: { view: View; role: string; fullName: string; onLogout: () => void; onRefresh: () => void }) {
  const titles: Record<View, string> = { dashboard: 'Dashboard', inventory: 'Inventory', orders: 'Orders', shipments: 'Shipments', tickets: 'Support Tickets', approvals: 'Approvals', executions: 'Agent Executions', logs: 'Audit Logs' }
  const initials = fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'US'
  return (
    <header className="topbar">
      <div className="topbar-left"><ChevronRight /><span className="page-title">{titles[view]}</span></div>
      <div className="topbar-right">
        <button className="icon-btn" onClick={onRefresh} title="Refresh"><RefreshIcon /></button>
        <button className="icon-btn" title="Notifications"><BellIcon /></button>
        <div className="user-chip">
          <div className="user-avatar">{initials}</div>
          <div className="user-info"><span className="user-name">{fullName || 'User'}</span><span className="user-role">{role}</span></div>
        </div>
        <button className="signout-btn" onClick={onLogout}>Sign Out</button>
      </div>
    </header>
  )
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [token, setTokenState] = useState(getToken() || '')
  const [role, setRole] = useState('')
  const [fullName, setFullName] = useState('')
  const [view, setView] = useState<View>('dashboard')
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  const loadMetrics = useCallback(() => {
    if (!getToken()) return
    api.dashboardMetrics()
      .then(m => { setMetrics(m); setPendingCount(m.pending_approvals ?? 0) })
      .catch(() => {})
  }, [])

  useEffect(() => { if (token) loadMetrics() }, [token])
  useEffect(() => {
    if (!token) return
    const t = setInterval(loadMetrics, 30000)
    return () => clearInterval(t)
  }, [token])

  const handleLogin = (t: string, r: string, name: string) => { setTokenState(t); setRole(r); setFullName(name) }
  const handleLogout = () => { clearToken(); setTokenState(''); setRole(''); setFullName(''); setMetrics(null) }

  if (!token) return <LoginPage onLogin={handleLogin} />

  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} role={role} pendingCount={pendingCount} />
      <div className="main-content">
        <TopBar view={view} role={role} fullName={fullName} onLogout={handleLogout} onRefresh={loadMetrics} />
        <div className="content-split">
          <main className="page-area">
            {view === 'dashboard'  && <DashboardView metrics={metrics} role={role} />}
            {view === 'inventory'  && <InventoryView />}
            {view === 'orders'     && <OrdersView />}
            {view === 'shipments'  && <ShipmentsView />}
            {view === 'tickets'    && <TicketsView />}
            {view === 'approvals'  && <ApprovalsView onUpdate={loadMetrics} />}
            {view === 'executions' && <ExecutionsView />}
            {view === 'logs'       && <AuditLogsView />}
          </main>
          <CopilotPanel role={role} />
        </div>
      </div>
    </div>
  )
}
