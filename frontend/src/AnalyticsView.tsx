import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import api from './api'
import type {
  SalesTrendPoint, CategoryRevenue, OrderStatusBreakdown,
  TopProduct, HeatmapCell, ForecastItem, KpiSummary,
} from './types'

// ─── Colour palettes ──────────────────────────────────────────────────────────
const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#a855f7', '#ef4444', '#14b8a6', '#f97316']
const STATUS_COLORS: Record<string, string> = {
  DELIVERED: '#10b981', PENDING: '#f59e0b', PROCESSING: '#3b82f6',
  SHIPPED: '#6366f1', CANCELLED: '#ef4444', REFUNDED: '#a855f7',
}
const RISK_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#10b981',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(v: number) {
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`
  return `₹${v.toFixed(0)}`
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '13px', gap: '10px' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      Loading…
    </div>
  )
}

function SectionCard({ title, children, fullWidth = false }: { title: string; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '16px',
      padding: '20px 24px',
      gridColumn: fullWidth ? '1 / -1' : undefined,
    }}>
      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '18px', letterSpacing: '0.02em' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

// ─── KPI Banner ───────────────────────────────────────────────────────────────
function KpiBanner({ kpi }: { kpi: KpiSummary }) {
  const items = [
    { label: 'Total Revenue', value: fmt(kpi.total_revenue), sub: `${kpi.revenue_growth_pct >= 0 ? '+' : ''}${kpi.revenue_growth_pct}% vs last month`, positive: kpi.revenue_growth_pct >= 0 },
    { label: 'This Month', value: fmt(kpi.this_month_revenue), sub: `${kpi.this_month_orders} orders`, positive: true },
    { label: 'Avg Order Value', value: fmt(kpi.avg_order_value), sub: `${kpi.total_orders} total orders`, positive: true },
    { label: 'Total Customers', value: kpi.total_customers.toLocaleString(), sub: 'registered users', positive: true },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
      {items.map(item => (
        <div key={item.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px 22px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '6px' }}>{item.value}</div>
          <div style={{ fontSize: '12px', color: item.positive ? 'var(--success)' : 'var(--danger)' }}>{item.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Sales Trend Chart ────────────────────────────────────────────────────────
function SalesTrendChart({ data }: { data: SalesTrendPoint[] }) {
  const [period, setPeriod] = useState(30)
  const slice = data.slice(-period)
  return (
    <SectionCard title="📈 Revenue & Orders Trend" fullWidth>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[7, 14, 30].map(d => (
          <button key={d} onClick={() => setPeriod(d)}
            style={{ padding: '5px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: period === d ? '#6366f1' : 'transparent', color: period === d ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.2s' }}>
            {d}d
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={slice} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradOrd" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => v.slice(5)} />
          <YAxis yAxisId="rev" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={fmt} width={56} />
          <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 10, fill: '#64748b' }} width={36} />
          <Tooltip
            contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: '12px' }}
            labelStyle={{ color: '#a0aec0' }}
            formatter={(v: any, name: any) => [name === 'revenue' ? fmt(v) : v, name === 'revenue' ? 'Revenue' : 'Orders']}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Area yAxisId="rev" type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#gradRev)" strokeWidth={2} name="revenue" dot={false} />
          <Area yAxisId="ord" type="monotone" dataKey="orders" stroke="#10b981" fill="url(#gradOrd)" strokeWidth={2} name="orders" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </SectionCard>
  )
}

// ─── Revenue by Category ──────────────────────────────────────────────────────
function CategoryRevenueChart({ data }: { data: CategoryRevenue[] }) {
  return (
    <SectionCard title="🏷️ Revenue by Category">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={fmt} />
          <YAxis dataKey="category" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={90} />
          <Tooltip
            contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: '12px' }}
            formatter={(v: any) => [fmt(v), 'Revenue']}
          />
          <Bar dataKey="revenue" radius={[0, 6, 6, 0]} maxBarSize={24}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </SectionCard>
  )
}

// ─── Order Status Pie ─────────────────────────────────────────────────────────
function OrderStatusPie({ data }: { data: OrderStatusBreakdown[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <SectionCard title="🔄 Order Status Distribution">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={3} strokeWidth={0}>
            {data.map((d, i) => <Cell key={i} fill={STATUS_COLORS[d.status] || PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: '12px' }}
            formatter={(v: any, name: any) => [`${v} (${((v / total) * 100).toFixed(1)}%)`, name]}
          />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
        </PieChart>
      </ResponsiveContainer>
    </SectionCard>
  )
}

// ─── Top Products Table ───────────────────────────────────────────────────────
function TopProductsTable({ data }: { data: TopProduct[] }) {
  return (
    <SectionCard title="🏆 Top Products by Revenue" fullWidth>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['#', 'Product', 'SKU', 'Category', 'Units Sold', 'Revenue'].map(h => (
                <th key={h} style={{ textAlign: h === '#' || h === 'Units Sold' || h === 'Revenue' ? 'right' : 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '12px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 700 }}>{i + 1}</td>
                <td style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</td>
                <td style={{ padding: '12px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#6366f1' }}>{p.sku}</td>
                <td style={{ padding: '12px 12px' }}>
                  <span style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: '6px', fontSize: '11px' }}>{p.category}</span>
                </td>
                <td style={{ padding: '12px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{p.units_sold.toLocaleString()}</td>
                <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{fmt(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  )
}

// ─── Revenue Heatmap ──────────────────────────────────────────────────────────
function RevenueHeatmap({ data }: { data: HeatmapCell[] }) {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const HOURS = Array.from({ length: 24 }, (_, i) => i)
  const maxRev = Math.max(...data.map(d => d.revenue), 1)

  const getCell = (day: string, hour: number) => data.find(d => d.day === day && d.hour === hour)

  function cellColor(revenue: number) {
    const intensity = revenue / maxRev
    if (intensity === 0) return 'rgba(99,102,241,0.04)'
    if (intensity < 0.2) return 'rgba(99,102,241,0.15)'
    if (intensity < 0.4) return 'rgba(99,102,241,0.35)'
    if (intensity < 0.6) return 'rgba(99,102,241,0.55)'
    if (intensity < 0.8) return 'rgba(99,102,241,0.75)'
    return '#6366f1'
  }

  return (
    <SectionCard title="🌡️ Revenue Heatmap — Hour × Day of Week" fullWidth>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: '700px' }}>
          {/* Hour labels */}
          <div style={{ display: 'flex', marginLeft: '44px', marginBottom: '4px' }}>
            {HOURS.map(h => (
              <div key={h} style={{ flex: 1, textAlign: 'center', fontSize: '9px', color: 'var(--text-muted)' }}>
                {h % 4 === 0 ? `${h}h` : ''}
              </div>
            ))}
          </div>
          {DAYS.map(day => (
            <div key={day} style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ width: '40px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>{day}</div>
              {HOURS.map(hour => {
                const cell = getCell(day, hour)
                const rev = cell?.revenue || 0
                return (
                  <div
                    key={hour}
                    title={`${day} ${hour}:00 — ${fmt(rev)}`}
                    style={{
                      flex: 1, height: '24px', margin: '1px',
                      background: cellColor(rev),
                      borderRadius: '4px',
                      transition: 'transform 0.1s',
                      cursor: 'default',
                    }}
                    onMouseEnter={e => ((e.target as HTMLElement).style.transform = 'scale(1.3)')}
                    onMouseLeave={e => ((e.target as HTMLElement).style.transform = 'scale(1)')}
                  />
                )
              })}
            </div>
          ))}
          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Low</span>
            {[0.04, 0.15, 0.35, 0.55, 0.75, 1].map((op, i) => (
              <div key={i} style={{ width: '16px', height: '16px', borderRadius: '3px', background: `rgba(99,102,241,${op})` }} />
            ))}
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>High</span>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}

// ─── Demand Forecast Table ────────────────────────────────────────────────────
function DemandForecastTable({ data }: { data: ForecastItem[] }) {
  return (
    <SectionCard title="🔮 Demand Forecast — Top 15 Products (30-Day)" fullWidth>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Product', 'Category', 'Current Stock', 'Velocity/30d', 'Forecasted Demand', 'Days of Stock', 'Restock Qty', 'Risk'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(f => (
              <tr key={f.product_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '11px 12px', fontWeight: 600 }}>{f.name}</td>
                <td style={{ padding: '11px 12px' }}>
                  <span style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', padding: '2px 8px', borderRadius: '6px', fontSize: '11px' }}>{f.category}</span>
                </td>
                <td style={{ padding: '11px 12px', color: f.current_stock <= f.reorder_threshold ? '#ef4444' : '#10b981', fontWeight: 700 }}>{f.current_stock}</td>
                <td style={{ padding: '11px 12px', color: 'var(--text-secondary)' }}>{f.sales_velocity_30d.toFixed(1)}/mo</td>
                <td style={{ padding: '11px 12px', fontWeight: 600 }}>{Math.round(f.forecasted_demand)}</td>
                <td style={{ padding: '11px 12px', color: f.days_of_stock < 14 ? '#f97316' : 'var(--text-secondary)' }}>{Math.round(f.days_of_stock)} days</td>
                <td style={{ padding: '11px 12px', color: '#6366f1', fontWeight: 700 }}>{f.recommended_restock}</td>
                <td style={{ padding: '11px 12px' }}>
                  <span style={{ background: `${RISK_COLORS[f.risk_level]}22`, color: RISK_COLORS[f.risk_level], padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                    {f.risk_level}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No forecast data available</div>}
      </div>
    </SectionCard>
  )
}

// ─── Main Analytics View ──────────────────────────────────────────────────────
export default function AnalyticsView() {
  const [loading, setLoading] = useState(true)
  const [kpi, setKpi] = useState<KpiSummary | null>(null)
  const [salesTrend, setSalesTrend] = useState<SalesTrendPoint[]>([])
  const [categoryRevenue, setCategoryRevenue] = useState<CategoryRevenue[]>([])
  const [orderStatus, setOrderStatus] = useState<OrderStatusBreakdown[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([])
  const [forecast, setForecast] = useState<ForecastItem[]>([])

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([
      api.analyticsKpiSummary().then(setKpi),
      api.analyticsSalesTrend(30).then(setSalesTrend),
      api.analyticsRevenueByCategory().then(setCategoryRevenue),
      api.analyticsOrderStatusBreakdown().then(setOrderStatus),
      api.analyticsTopProducts(10).then(setTopProducts),
      api.analyticsRevenueHeatmap().then(setHeatmap),
      api.analyticsDemandForecast().then(setForecast),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontWeight: 800, fontSize: '22px', color: 'var(--text-primary)' }}>Analytics & Reporting</div>
      <Spinner />
    </div>
  )

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-heading">Analytics & Reporting</div>
          <div className="page-sub">Real-time business intelligence — revenue, demand forecasting & insights</div>
        </div>
        <button className="btn btn-ghost" onClick={() => window.location.reload()} style={{ gap: '6px', display: 'flex', alignItems: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>
          Refresh
        </button>
      </div>

      {/* KPI Banner */}
      {kpi && <KpiBanner kpi={kpi} />}

      {/* Main Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        {/* Sales Trend — Full Width */}
        {salesTrend.length > 0 && <SalesTrendChart data={salesTrend} />}

        {/* Category + Status — 2 Col */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {categoryRevenue.length > 0 && <CategoryRevenueChart data={categoryRevenue} />}
          {orderStatus.length > 0 && <OrderStatusPie data={orderStatus} />}
        </div>

        {/* Top Products — Full Width */}
        {topProducts.length > 0 && <TopProductsTable data={topProducts} />}

        {/* Revenue Heatmap — Full Width */}
        {heatmap.length > 0 && <RevenueHeatmap data={heatmap} />}

        {/* Demand Forecast — Full Width */}
        <DemandForecastTable data={forecast} />
      </div>
    </div>
  )
}
