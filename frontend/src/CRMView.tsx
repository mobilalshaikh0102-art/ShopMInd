import { useState, useEffect, useCallback } from 'react'
import api from './api'
import type { CRMOverview, SegmentCounts, CustomerSummary, CustomerProfile } from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SEGMENT_COLOR: Record<string, string> = {
  VIP: '#f59e0b', REGULAR: '#6366f1', AT_RISK: '#ef4444', NEW: '#10b981',
}
const SEGMENT_ICON: Record<string, string> = { VIP: '👑', REGULAR: '👤', AT_RISK: '⚠️', NEW: '🌱' }
const CHURN_COLOR: Record<string, string> = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' }

function fmt(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`
  return `₹${v.toFixed(0)}`
}

function Badge({ text, color }: { text: string; color?: string }) {
  const c = color || SEGMENT_COLOR[text] || '#64748b'
  return <span style={{ background: `${c}22`, color: c, padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>{SEGMENT_ICON[text] || ''} {text}</span>
}

// ─── Overview KPIs ────────────────────────────────────────────────────────────
function OverviewCards({ data, segments }: { data: CRMOverview; segments: SegmentCounts }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
      {[
        { label: 'Total Customers', value: data.total_customers, icon: '👥', color: '#6366f1' },
        { label: 'Total Revenue', value: fmt(data.total_revenue), icon: '💰', color: '#10b981' },
        { label: 'Avg. Lifetime Value', value: fmt(data.avg_customer_lifetime_value), icon: '📈', color: '#8b5cf6' },
        { label: 'Repeat Purchase Rate', value: `${data.repeat_purchase_rate}%`, icon: '🔁', color: '#f59e0b' },
        { label: 'VIP Customers', value: segments.VIP, icon: '👑', color: '#f59e0b' },
        { label: 'At-Risk Customers', value: segments.AT_RISK, icon: '⚠️', color: '#ef4444' },
        { label: 'New Customers', value: segments.NEW, icon: '🌱', color: '#10b981' },
        { label: 'Open Tickets', value: data.open_tickets, icon: '🎫', color: '#64748b' },
      ].map(k => (
        <div key={k.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 18px' }}>
          <div style={{ fontSize: '20px', marginBottom: '6px' }}>{k.icon}</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: k.color }}>{k.value}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase' }}>{k.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Customer Profile Drawer ──────────────────────────────────────────────────
function ProfileDrawer({ customerId, onClose }: { customerId: number; onClose: () => void }) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  useEffect(() => {
    api.crmCustomerProfile(customerId).then(setProfile).finally(() => setLoading(false))
  }, [customerId])

  const submitNote = async () => {
    if (!note.trim()) return
    setAddingNote(true)
    await api.crmAddNote(customerId, note)
    const updated = await api.crmCustomerProfile(customerId)
    setProfile(updated)
    setNote('')
    setAddingNote(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div style={{ width: 520, height: '100%', background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', overflowY: 'auto', animation: 'slideIn .25s ease' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>Customer Profile</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>
        {loading && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}
        {profile && (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${SEGMENT_COLOR[profile.rfm.segment]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                {SEGMENT_ICON[profile.rfm.segment]}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '17px', color: 'var(--text-primary)' }}>{profile.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{profile.email}</div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  <Badge text={profile.rfm.segment} />
                  <span style={{ background: `${CHURN_COLOR[profile.rfm.churn_risk]}22`, color: CHURN_COLOR[profile.rfm.churn_risk], padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>Churn: {profile.rfm.churn_risk}</span>
                </div>
              </div>
            </div>

            {/* RFM Scores */}
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>RFM Score — {profile.rfm.rfm_score}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[
                  { label: 'Recency', value: profile.rfm.recency_days !== null ? `${profile.rfm.recency_days}d ago` : 'Never', score: profile.rfm.r_score, color: '#6366f1' },
                  { label: 'Frequency', value: `${profile.rfm.frequency} orders`, score: profile.rfm.f_score, color: '#10b981' },
                  { label: 'Monetary', value: fmt(profile.rfm.monetary), score: profile.rfm.m_score, color: '#f59e0b' },
                ].map(r => (
                  <div key={r.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 8px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: r.color }}>{r.score}/5</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0' }}>{r.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>{r.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Contact Info</div>
              {[
                ['📞', profile.phone || '—'],
                ['📍', [profile.city, profile.state, profile.country].filter(Boolean).join(', ')],
                ['🗓', `Customer since ${profile.created_at.slice(0, 10)}`],
              ].map(([icon, val], i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '13px' }}>
                  <span>{icon}</span><span style={{ color: 'var(--text-secondary)' }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Recent Orders */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Recent Orders</div>
              {profile.orders.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No orders yet</div>}
              {profile.orders.map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '13px' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: '#6366f1' }}>{o.order_number}</span>
                    <span style={{ marginLeft: 8, fontSize: '11px', color: 'var(--text-muted)' }}>{o.created_at.slice(0, 10)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>{fmt(o.total)}</span>
                    <Badge text={o.status} color={o.status === 'DELIVERED' ? '#10b981' : o.status === 'CANCELLED' ? '#ef4444' : '#6366f1'} />
                  </div>
                </div>
              ))}
            </div>

            {/* CRM Notes */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>CRM Notes</div>
              {profile.notes.map(n => (
                <div key={n.id} style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{n.text}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>— {n.author} · {n.created_at.slice(0, 16).replace('T', ' ')}</div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a CRM note…" onKeyDown={e => e.key === 'Enter' && submitNote()}
                  style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '12px' }} />
                <button onClick={submitNote} disabled={addingNote} style={{ padding: '7px 14px', borderRadius: '8px', background: '#6366f1', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main CRM View ────────────────────────────────────────────────────────────
export default function CRMView() {
  const [overview, setOverview] = useState<CRMOverview | null>(null)
  const [segments, setSegments] = useState<SegmentCounts | null>(null)
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeSegment, setActiveSegment] = useState('ALL')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, seg, cust] = await Promise.all([
        api.crmOverview(),
        api.crmSegments(),
        api.crmCustomers({ search, segment: activeSegment, page }),
      ])
      setOverview(ov)
      setSegments(seg)
      setCustomers(cust.customers)
      setTotal(cust.total)
    } finally { setLoading(false) }
  }, [search, activeSegment, page])

  useEffect(() => { load() }, [load])

  const SEGMENT_TABS = ['ALL', 'VIP', 'REGULAR', 'AT_RISK', 'NEW']

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-heading">Customer CRM</div>
          <div className="page-sub">RFM scoring, lifetime value, segmentation & customer 360° profiles</div>
        </div>
        <button className="btn btn-ghost" onClick={load}>↻ Refresh</button>
      </div>

      {overview && segments && <OverviewCards data={overview} segments={segments} />}

      {/* Search + Segment Tabs */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="🔍  Search by name, email or phone…"
            style={{ flex: 1, minWidth: 220, padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '13px' }} />
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {SEGMENT_TABS.map(s => (
              <button key={s} onClick={() => { setActiveSegment(s); setPage(1) }}
                style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: activeSegment === s ? (SEGMENT_COLOR[s] || '#6366f1') : 'transparent', color: activeSegment === s ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all .2s' }}>
                {s === 'ALL' ? '👥 All' : `${SEGMENT_ICON[s]} ${s}`} {segments ? `(${segments[s as keyof SegmentCounts]})` : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Customer Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                {['Customer', 'Location', 'Orders', 'Lifetime Value', 'Recency', 'RFM Score', 'Segment', 'Churn Risk', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading customers…</td></tr>}
              {!loading && customers.length === 0 && <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No customers found</td></tr>}
              {customers.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background .15s' }}
                  onClick={() => setSelectedId(c.id)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.email}</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '12px' }}>{c.city || '—'}, {c.country}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#6366f1', textAlign: 'center' }}>{c.order_count}</td>
                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#10b981' }}>{fmt(c.lifetime_value)}</td>
                  <td style={{ padding: '12px 14px', color: c.recency_days !== null && c.recency_days > 90 ? '#ef4444' : 'var(--text-secondary)', fontSize: '12px' }}>
                    {c.recency_days !== null ? `${c.recency_days}d ago` : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 800, color: SEGMENT_COLOR[c.segment] || '#64748b', fontFamily: 'monospace' }}>{c.rfm_score}</td>
                  <td style={{ padding: '12px 14px' }}><Badge text={c.segment} /></td>
                  <td style={{ padding: '12px 14px' }}><span style={{ color: CHURN_COLOR[c.churn_risk], fontWeight: 700, fontSize: '12px' }}>● {c.churn_risk}</span></td>
                  <td style={{ padding: '12px 14px' }}><button style={{ padding: '4px 12px', borderRadius: '6px', background: 'rgba(99,102,241,0.15)', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>View →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>{total} customers found</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>← Prev</button>
            <span style={{ padding: '4px 10px' }}>Page {page}</span>
            <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: page * 20 >= total ? 'not-allowed' : 'pointer', opacity: page * 20 >= total ? 0.5 : 1 }}>Next →</button>
          </div>
        </div>
      </div>

      {selectedId && <ProfileDrawer customerId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
