import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from './api'
import type { AllIntegrationStatus, ShopifySync, PaymentStats } from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(v: number, currency = '₹') {
  if (v >= 100000) return `${currency}${(v / 100000).toFixed(1)}L`
  if (v >= 1000) return `${currency}${(v / 1000).toFixed(1)}K`
  return `${currency}${v.toFixed(0)}`
}

const PAYMENT_COLORS = { captured: '#10b981', failed: '#ef4444', refunded: '#f59e0b' }
const METHOD_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#a855f7', '#ef4444']

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
      background: connected ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
      color: connected ? '#10b981' : '#64748b',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#10b981' : '#64748b', display: 'inline-block' }} />
      {connected ? 'Connected' : 'Not Connected'}
    </span>
  )
}

// ─── Integration Card Shell ───────────────────────────────────────────────────
function IntegrationCard({ icon, name, description, connected, children, accentColor = '#6366f1' }: {
  icon: string; name: string; description: string; connected: boolean
  children?: React.ReactNode; accentColor?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${open ? accentColor + '44' : 'var(--border)'}`,
      borderRadius: '16px', overflow: 'hidden', transition: 'border-color 0.2s',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '12px', background: `${accentColor}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0,
        }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>{name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{description}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <StatusBadge connected={connected} />
          {children && (
            <button onClick={() => setOpen(o => !o)} style={{
              padding: '7px 16px', borderRadius: '8px', border: `1px solid ${accentColor}55`,
              background: open ? accentColor : 'transparent',
              color: open ? '#fff' : accentColor, cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              transition: 'all 0.2s',
            }}>
              {open ? 'Collapse ▲' : 'View Details ▼'}
            </button>
          )}
        </div>
      </div>
      {/* Expandable Content */}
      {open && children && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', background: 'rgba(0,0,0,0.15)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Connect Banner ───────────────────────────────────────────────────────────
function ConnectBanner({ envKey, docsUrl, example }: { envKey: string; docsUrl: string; example: string }) {
  return (
    <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px dashed rgba(99,102,241,0.4)', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px' }}>
      <div style={{ fontWeight: 600, color: '#818cf8', marginBottom: '6px', fontSize: '13px' }}>🔌 How to Connect</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        Add your API key to <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px', color: '#6366f1' }}>backend/.env</code>:
        <br />
        <code style={{ color: '#10b981' }}>{envKey}</code>
        <br />
        <a href={docsUrl} target="_blank" rel="noreferrer" style={{ color: '#6366f1', fontSize: '11px' }}>📖 View API Docs →</a>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}> &nbsp;|&nbsp; Example: <em>{example}</em></span>
      </div>
    </div>
  )
}

// ─── Shopify Panel ────────────────────────────────────────────────────────────
function ShopifyPanel({ connected }: { connected: boolean }) {
  const [tab, setTab] = useState<'products' | 'orders'>('products')
  const [data, setData] = useState<ShopifySync | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async (t: 'products' | 'orders') => {
    setLoading(true); setTab(t)
    try {
      const res = t === 'products' ? await api.shopifyProducts() : await api.shopifyOrders()
      setData(res)
    } finally { setLoading(false) }
  }

  useEffect(() => { load('products') }, [])

  return (
    <div>
      {!connected && <ConnectBanner
        envKey="SHOPIFY_SHOP_DOMAIN=mystore.myshopify.com&#10;SHOPIFY_ACCESS_TOKEN=shpat_xxx"
        docsUrl="https://shopify.dev/docs/api/admin-rest"
        example="mystore.myshopify.com"
      />}
      {data?.note && <div style={{ fontSize: '12px', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px' }}>⚡ {data.note}</div>}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {(['products', 'orders'] as const).map(t => (
          <button key={t} onClick={() => load(t)}
            style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: tab === t ? '#6366f1' : 'transparent', color: tab === t ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.2s', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
        {data && <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>Synced: {data.synced_at?.slice(0, 16).replace('T', ' ')} UTC</span>}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Syncing…</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {tab === 'products'
                  ? ['ID', 'Title', 'Vendor', 'Type', 'Status', 'Variants'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>)
                  : ['Order #', 'Payment', 'Fulfillment', 'Total', 'Currency', 'Date'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>)
                }
              </tr>
            </thead>
            <tbody>
              {tab === 'products' && data?.products?.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '11px', color: '#6366f1' }}>{p.id}</td>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{p.title}</td>
                  <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{p.vendor}</td>
                  <td style={{ padding: '10px' }}><span style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', padding: '2px 8px', borderRadius: '6px', fontSize: '11px' }}>{p.product_type}</span></td>
                  <td style={{ padding: '10px' }}><span style={{ color: p.status === 'active' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{p.status}</span></td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{p.variants_count}</td>
                </tr>
              ))}
              {tab === 'orders' && data?.orders?.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px', fontWeight: 700, color: '#6366f1' }}>#{o.order_number}</td>
                  <td style={{ padding: '10px' }}><span style={{ color: o.financial_status === 'paid' ? '#10b981' : o.financial_status === 'refunded' ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>{o.financial_status}</span></td>
                  <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{o.fulfillment_status || '—'}</td>
                  <td style={{ padding: '10px', fontWeight: 600 }}>₹{parseFloat(o.total_price).toLocaleString()}</td>
                  <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{o.currency}</td>
                  <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '11px' }}>{o.created_at?.slice(0, 16).replace('T', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Payment Panel ────────────────────────────────────────────────────────────
function PaymentPanel({ source, connected }: { source: 'razorpay' | 'stripe'; connected: boolean }) {
  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fn = source === 'razorpay' ? api.razorpayStats : api.stripeStats
    fn().then(setStats).finally(() => setLoading(false))
  }, [source])

  if (loading) return <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading…</div>
  if (!stats) return null

  const pieData = [
    { name: 'Captured', value: stats.captured },
    { name: 'Failed', value: stats.failed },
    { name: 'Refunded', value: stats.refunded },
  ].filter(d => d.value > 0)

  const methodData = stats.methods
    ? Object.entries(stats.methods).map(([name, count]) => ({ name: name.toUpperCase(), count }))
    : []

  return (
    <div>
      {!connected && <ConnectBanner
        envKey={source === 'razorpay' ? 'RAZORPAY_KEY_ID=rzp_live_xxx\nRAZORPAY_KEY_SECRET=xxx' : 'STRIPE_SECRET_KEY=sk_live_xxx'}
        docsUrl={source === 'razorpay' ? 'https://razorpay.com/docs/api' : 'https://stripe.com/docs/api'}
        example={source === 'razorpay' ? 'rzp_live_XXXXXXXX' : 'sk_live_XXXXXXXX'}
      />}
      {stats.note && <div style={{ fontSize: '12px', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '8px 12px', borderRadius: '8px', marginBottom: '16px' }}>⚡ {stats.note}</div>}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Revenue', value: fmt(stats.total_revenue, stats.currency === 'USD' ? '$' : '₹'), color: '#10b981' },
          { label: 'Success Rate', value: `${stats.success_rate}%`, color: '#6366f1' },
          { label: 'Captured', value: stats.captured, color: '#10b981' },
          { label: 'Failed', value: stats.failed, color: '#ef4444' },
        ].map(k => (
          <div key={k.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>{k.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Pie Chart */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Payment Breakdown</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                {pieData.map((d, i) => <Cell key={i} fill={PAYMENT_COLORS[d.name.toLowerCase() as keyof typeof PAYMENT_COLORS] || '#6366f1'} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Methods Bar */}
        {methodData.length > 0 && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Payment Methods</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={methodData} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {methodData.map((_, i) => <Cell key={i} fill={METHOD_COLORS[i % METHOD_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── WhatsApp Panel ───────────────────────────────────────────────────────────
function WhatsAppPanel({ connected }: { connected: boolean }) {
  const [phone, setPhone] = useState('+91')
  const [message, setMessage] = useState('Your order #1234 has been shipped! 🚀')
  const [result, setResult] = useState<any>(null)
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!phone || !message) return
    setSending(true)
    try { setResult(await api.whatsappSend(phone, message)) }
    catch (e: any) { setResult({ status: 'error', error: e.message }) }
    finally { setSending(false) }
  }

  return (
    <div>
      {!connected && <ConnectBanner
        envKey="TWILIO_ACCOUNT_SID=ACxxxxxxxxxx\nTWILIO_AUTH_TOKEN=your_auth_token"
        docsUrl="https://www.twilio.com/docs/whatsapp"
        example="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>Send Test Message</div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Phone Number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <button onClick={send} disabled={sending}
            style={{ padding: '9px 20px', borderRadius: '8px', background: '#25D366', border: 'none', color: '#fff', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: sending ? 0.7 : 1 }}>
            {sending ? 'Sending…' : '📤 Send WhatsApp'}
          </button>
        </div>
        <div>
          {result && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>Result</div>
              <div style={{ background: result.status === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${result.status === 'error' ? '#ef444444' : '#10b98144'}`, borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '12px', color: result.status === 'error' ? '#ef4444' : '#10b981', fontWeight: 700, marginBottom: '8px' }}>
                  {result.status === 'error' ? '❌ Error' : result.status === 'demo' ? '⚡ Demo Mode' : '✅ Sent'}
                </div>
                {result.sid && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SID: {result.sid}</div>}
                {result.note && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{result.note}</div>}
                {result.error && <div style={{ fontSize: '11px', color: '#ef4444' }}>{result.error}</div>}
              </div>
            </div>
          )}
          <div style={{ marginTop: result ? '16px' : '0' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Quick Templates</div>
            {[
              { label: '📦 Order Update', msg: 'Your order #ORD-001 status: SHIPPED 🚀' },
              { label: '⚠️ Shipment Delay', msg: 'Your order #ORD-001 is delayed due to weather conditions. We apologize! 🙏' },
              { label: '🚨 Low Stock', msg: 'Alert: Product "Smart Air Purifier" is critically low (5 units left).' },
            ].map(t => (
              <button key={t.label} onClick={() => setMessage(t.msg)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', marginBottom: '6px', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Email Panel ──────────────────────────────────────────────────────────────
function EmailPanel({ connected }: { connected: boolean }) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('Your Order Has Been Confirmed!')
  const [body, setBody] = useState('Thank you for your order. We will process it shortly.')
  const [result, setResult] = useState<any>(null)
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!to || !subject || !body) return
    setSending(true)
    try { setResult(await api.emailSend(to, subject, body)) }
    catch (e: any) { setResult({ status: 'error', error: e.message }) }
    finally { setSending(false) }
  }

  return (
    <div>
      {!connected && <ConnectBanner
        envKey="SMTP_USERNAME=you@gmail.com\nSMTP_PASSWORD=your_app_password\nSMTP_FROM_EMAIL=you@gmail.com"
        docsUrl="https://support.google.com/mail/answer/185833"
        example="Use Gmail App Password for SMTP"
      />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>Send Test Email</div>
          {[
            { label: 'To', value: to, set: setTo, placeholder: 'customer@example.com', type: 'email' },
            { label: 'Subject', value: subject, set: setSubject, placeholder: 'Email subject' },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>{f.label}</label>
              <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} type={(f as any).type || 'text'}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          <button onClick={send} disabled={sending}
            style={{ padding: '9px 20px', borderRadius: '8px', background: '#6366f1', border: 'none', color: '#fff', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: sending ? 0.7 : 1 }}>
            {sending ? 'Sending…' : '✉️ Send Email'}
          </button>
        </div>
        <div>
          {result && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>Result</div>
              <div style={{ background: result.status === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${result.status === 'error' ? '#ef444444' : '#10b98144'}`, borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '12px', color: result.status === 'error' ? '#ef4444' : '#10b981', fontWeight: 700, marginBottom: '4px' }}>
                  {result.status === 'error' ? '❌ Error' : result.status === 'demo' ? '⚡ Demo Mode' : '✅ Sent'}
                </div>
                {result.note && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{result.note}</div>}
                {result.error && <div style={{ fontSize: '11px', color: '#ef4444' }}>{result.error}</div>}
              </div>
            </div>
          )}
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>SMTP Providers</div>
          {[
            { name: 'Gmail', host: 'smtp.gmail.com', port: '587', note: 'Use App Password' },
            { name: 'Outlook', host: 'smtp.office365.com', port: '587', note: 'Use account password' },
            { name: 'SendGrid', host: 'smtp.sendgrid.net', port: '587', note: 'Use API Key as password' },
          ].map(p => (
            <div key={p.name} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px', fontSize: '12px' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>{p.host}:{p.port} — {p.note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Integrations View ───────────────────────────────────────────────────
export default function IntegrationsView() {
  const [status, setStatus] = useState<AllIntegrationStatus | null>(null)

  useEffect(() => {
    api.integrationsStatus().then(setStatus).catch(() => {})
  }, [])

  const s = status

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-heading">Third-Party Integrations</div>
          <div className="page-sub">Connect external services — Shopify, payments, WhatsApp & email</div>
        </div>
        <button className="btn btn-ghost" onClick={() => api.integrationsStatus().then(setStatus)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
          Refresh Status
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Shopify */}
        <IntegrationCard icon="🛍️" name="Shopify" description="Sync products and orders from your Shopify store in real-time" connected={s?.shopify.connected ?? false} accentColor="#96bf48">
          <ShopifyPanel connected={s?.shopify.connected ?? false} />
        </IntegrationCard>

        {/* Razorpay */}
        <IntegrationCard icon="💳" name="Razorpay" description="View payment success rates, refund trends and method breakdown" connected={s?.razorpay.connected ?? false} accentColor="#3395ff">
          <PaymentPanel source="razorpay" connected={s?.razorpay.connected ?? false} />
        </IntegrationCard>

        {/* Stripe */}
        <IntegrationCard icon="⚡" name="Stripe" description="International payment analytics and charge monitoring" connected={s?.stripe.connected ?? false} accentColor="#635bff">
          <PaymentPanel source="stripe" connected={s?.stripe.connected ?? false} />
        </IntegrationCard>

        {/* WhatsApp */}
        <IntegrationCard icon="💬" name="WhatsApp Business" description="Send order updates, shipment alerts and low-stock notifications via WhatsApp" connected={s?.whatsapp.connected ?? false} accentColor="#25D366">
          <WhatsAppPanel connected={s?.whatsapp.connected ?? false} />
        </IntegrationCard>

        {/* Email */}
        <IntegrationCard icon="✉️" name="Email / SMTP" description="Auto-send order confirmations and support ticket replies via SMTP" connected={s?.email.connected ?? false} accentColor="#6366f1">
          <EmailPanel connected={s?.email.connected ?? false} />
        </IntegrationCard>
      </div>
    </div>
  )
}
