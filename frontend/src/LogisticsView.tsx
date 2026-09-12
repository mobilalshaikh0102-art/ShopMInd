import { useState, useEffect, useRef } from 'react'
import jsQR from 'jsqr'
import api from './api'
import type { TrackingResult, Vendor, PurchaseOrder, RestockSuggestion } from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  DELIVERED: '#10b981', IN_TRANSIT: '#3b82f6', OUT_FOR_DELIVERY: '#6366f1',
  PICKED_UP: '#8b5cf6', PROCESSING: '#f59e0b', PENDING: '#64748b',
  RECEIVED: '#10b981', ORDERED: '#3b82f6', CANCELLED: '#ef4444', CRITICAL: '#ef4444',
  HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#10b981',
}

function Badge({ text, color }: { text: string; color?: string }) {
  const c = color || STATUS_COLOR[text] || '#64748b'
  return (
    <span style={{ background: `${c}22`, color: c, padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px 24px' }}>
      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '16px' }}>{title}</div>
      {children}
    </div>
  )
}

// ─── Shipment Tracker ─────────────────────────────────────────────────────────
function ShipmentTracker() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<TrackingResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'awb' | 'order'>('awb')

  const track = async () => {
    if (!query.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const data = mode === 'awb'
        ? await api.trackShipment(query.trim())
        : await api.trackByOrder(Number(query.trim()))
      setResult(data)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <Card title="🚚 Live Shipment Tracker">
      {/* Mode + Input */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['awb', 'order'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: mode === m ? '#6366f1' : 'transparent', color: mode === m ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all .2s', textTransform: 'capitalize' }}>
              {m === 'awb' ? 'AWB / Tracking #' : 'Order ID'}
            </button>
          ))}
        </div>
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && track()}
          placeholder={mode === 'awb' ? 'Enter AWB number…' : 'Enter Order ID…'}
          style={{ flex: 1, minWidth: 200, padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '13px' }} />
        <button onClick={track} disabled={loading} style={{ padding: '8px 20px', borderRadius: '8px', background: '#6366f1', border: 'none', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Tracking…' : '🔍 Track'}
        </button>
      </div>
      {error && <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>❌ {error}</div>}

      {/* Result */}
      {result && (
        <div style={{ animation: 'fadeIn .3s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{result.awb}</div>
            <Badge text={result.status} />
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Carrier: {result.carrier}</span>
            {result.estimated_delivery && <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>ETA: {result.estimated_delivery}</span>}
            {result.note && <span style={{ fontSize: '11px', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '6px' }}>⚡ {result.note}</span>}
          </div>
          {/* Timeline */}
          <div style={{ position: 'relative', paddingLeft: '24px' }}>
            {result.events.map((ev, i) => (
              <div key={i} style={{ position: 'relative', paddingBottom: '16px' }}>
                <div style={{ position: 'absolute', left: -20, top: 4, width: 10, height: 10, borderRadius: '50%', background: i === 0 ? '#6366f1' : 'var(--border)', border: '2px solid var(--bg-card)' }} />
                {i < result.events.length - 1 && <div style={{ position: 'absolute', left: -16, top: 14, width: 2, height: '100%', background: 'var(--border)' }} />}
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{ev.description}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{ev.timestamp} {ev.location && `• ${ev.location}`}</div>
              </div>
            ))}
            {result.events.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No tracking events yet.</div>}
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Barcode Scanner ──────────────────────────────────────────────────────────
function BarcodeScanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const intervalRef = useRef<any>(null)

  const startScan = async () => {
    setError(''); setResult('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setScanning(true)
        intervalRef.current = setInterval(captureFrame, 200)
      }
    } catch {
      setError('Camera access denied. Please allow camera permissions.')
    }
  }

  const stopScan = () => {
    clearInterval(intervalRef.current)
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
    setScanning(false)
  }

  const captureFrame = async () => {
    const video = videoRef.current; const canvas = canvasRef.current
    if (!video || !canvas || video.readyState !== 4) return
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height)
    if (!imageData) return
    try {
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code) {
        setResult(code.data)
        stopScan()
      }
    } catch { /* jsQR not available */ }
  }

  return (
    <Card title="📷 Barcode / QR Scanner">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
        <div>
          <div style={{ position: 'relative', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', overflow: 'hidden', minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video ref={videoRef} style={{ width: '100%', display: scanning ? 'block' : 'none', borderRadius: '12px' }} playsInline muted />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            {!scanning && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>📷</div>
                <div style={{ fontSize: '12px' }}>Camera preview</div>
              </div>
            )}
            {scanning && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, border: '3px solid #6366f1', borderRadius: '12px', animation: 'pulse 1.5s ease-in-out infinite', pointerEvents: 'none' }} />}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            {!scanning
              ? <button onClick={startScan} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: '#6366f1', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>▶ Start Camera</button>
              : <button onClick={stopScan} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: '#ef4444', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>⏹ Stop</button>
            }
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px' }}>{error}</div>}
        </div>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 600 }}>Scan Result / Manual Entry</div>
          <input value={result} onChange={e => setResult(e.target.value)} placeholder="Barcode value will appear here…"
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
          {result && (
            <div style={{ marginTop: '12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '12px', color: '#818cf8', fontWeight: 700, marginBottom: '6px' }}>✅ Detected</div>
              <div style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{result}</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button onClick={() => navigator.clipboard.writeText(result)}
                  style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px' }}>📋 Copy</button>
                <button onClick={() => { setResult(''); setError('') }}
                  style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px' }}>🗑 Clear</button>
              </div>
            </div>
          )}
          <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Supported Formats</div>
            <div>QR Code, Code 128, EAN-13, EAN-8, UPC-A, Code 39, Data Matrix</div>
            <div style={{ marginTop: '8px', color: '#f59e0b' }}>💡 Tip: Make sure there's good lighting and hold steady for best results.</div>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── Vendor Portal ────────────────────────────────────────────────────────────
function VendorPortal() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', contact: '', email: '', phone: '', category: 'Electronics', lead_time_days: 7, rating: 4.0 })

  const load = () => api.listVendors().then(setVendors)
  useEffect(() => { load() }, [])

  const save = async () => {
    await api.createVendor(form)
    setShowForm(false)
    setForm({ name: '', contact: '', email: '', phone: '', category: 'Electronics', lead_time_days: 7, rating: 4.0 })
    load()
  }

  const del = async (id: number) => {
    if (!confirm('Deactivate this vendor?')) return
    await api.deleteVendor(id); load()
  }

  return (
    <Card title="🏭 Vendor / Supplier Portal">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button onClick={() => setShowForm(s => !s)} style={{ padding: '7px 16px', borderRadius: '8px', background: showForm ? 'transparent' : '#6366f1', border: showForm ? '1px solid var(--border)' : 'none', color: showForm ? 'var(--text-secondary)' : '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
          {showForm ? '✕ Cancel' : '+ Add Vendor'}
        </button>
      </div>
      {showForm && (
        <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[['name', 'Company Name'], ['contact', 'Contact Person'], ['email', 'Email'], ['phone', 'Phone']].map(([k, label]) => (
            <div key={k}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>{label}</label>
              <input value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={label}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '12px', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px' }}>
              {['Electronics', 'Home & Kitchen', 'Sports', 'Clothing', 'Beauty', 'Toys', 'Food', 'Books'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Lead Time (days)</label>
            <input type="number" value={form.lead_time_days} onChange={e => setForm(f => ({ ...f, lead_time_days: Number(e.target.value) }))}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '12px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={save} style={{ padding: '7px 20px', borderRadius: '8px', background: '#10b981', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>✓ Save Vendor</button>
          </div>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Vendor', 'Contact', 'Category', 'Lead Time', 'Rating', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vendors.map(v => (
              <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '10px' }}><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v.name}</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{v.email}</div></td>
                <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{v.contact}</td>
                <td style={{ padding: '10px' }}><Badge text={v.category} color="#6366f1" /></td>
                <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{v.lead_time_days}d</td>
                <td style={{ padding: '10px' }}><span style={{ color: '#f59e0b' }}>{'★'.repeat(Math.floor(v.rating))}</span> {v.rating}</td>
                <td style={{ padding: '10px' }}><Badge text={v.active ? 'Active' : 'Inactive'} color={v.active ? '#10b981' : '#64748b'} /></td>
                <td style={{ padding: '10px' }}><button onClick={() => del(v.id)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ─── Purchase Orders ──────────────────────────────────────────────────────────
function PurchaseOrders() {
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [suggestions, setSuggestions] = useState<RestockSuggestion[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [tab, setTab] = useState<'orders' | 'suggestions'>('orders')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ vendor_id: 1, product_name: '', sku: '', quantity: 10, unit_cost: 0, notes: '' })

  const loadAll = () => Promise.all([api.listPurchaseOrders().then(setPos), api.restockSuggestions().then(setSuggestions), api.listVendors().then(setVendors)])
  useEffect(() => { loadAll() }, [])

  const createPO = async () => {
    await api.createPurchaseOrder(form); setShowForm(false); loadAll()
  }

  const createFromSuggestion = async (s: RestockSuggestion) => {
    await api.createPurchaseOrder({ vendor_id: s.vendor_id, product_name: s.product_name, sku: s.sku, quantity: s.suggested_qty, unit_cost: s.estimated_cost / s.suggested_qty, notes: 'AI-triggered restock' })
    loadAll()
    alert(`✅ PO created for ${s.product_name}`)
  }

  const PO_STATUS_OPTIONS = ['PENDING', 'ORDERED', 'RECEIVED', 'CANCELLED']

  return (
    <Card title="📋 Purchase Orders & Restock Suggestions">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {(['orders', 'suggestions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: tab === t ? '#6366f1' : 'transparent', color: tab === t ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize', transition: 'all .2s' }}>
            {t === 'orders' ? `Purchase Orders (${pos.length})` : `⚠️ Restock Needed (${suggestions.length})`}
          </button>
        ))}
        {tab === 'orders' && <button onClick={() => setShowForm(s => !s)} style={{ marginLeft: 'auto', padding: '6px 16px', borderRadius: '8px', background: showForm ? 'transparent' : '#6366f1', border: showForm ? '1px solid var(--border)' : 'none', color: showForm ? 'var(--text-secondary)' : '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
          {showForm ? '✕' : '+ New PO'}
        </button>}
      </div>

      {showForm && tab === 'orders' && (
        <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Vendor</label>
            <select value={form.vendor_id} onChange={e => setForm(f => ({ ...f, vendor_id: Number(e.target.value) }))} style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px' }}>
              {vendors.filter(v => v.active).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          {[['product_name', 'Product Name'], ['sku', 'SKU']].map(([k, label]) => (
            <div key={k}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>{label}</label>
              <input value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={label}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '12px', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Quantity</label>
            <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '12px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Unit Cost (₹)</label>
            <input type="number" step="0.01" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: Number(e.target.value) }))} style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '12px', boxSizing: 'border-box' }} />
          </div>
          <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
            <button onClick={createPO} style={{ padding: '7px 20px', borderRadius: '8px', background: '#10b981', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>✓ Create PO</button>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['ID', 'Product', 'Vendor', 'Qty', 'Total Cost', 'Status', 'Expected', ''].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {pos.map(po => (
                <tr key={po.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px', fontWeight: 700, color: '#6366f1' }}>PO-{po.id}</td>
                  <td style={{ padding: '10px' }}><div style={{ fontWeight: 600 }}>{po.product_name}</div><div style={{ fontSize: '11px', color: '#6366f1', fontFamily: 'monospace' }}>{po.sku}</div></td>
                  <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{po.vendor_name}</td>
                  <td style={{ padding: '10px' }}>{po.quantity}</td>
                  <td style={{ padding: '10px', fontWeight: 700, color: '#10b981' }}>₹{po.total_cost.toLocaleString()}</td>
                  <td style={{ padding: '10px' }}>
                    <select value={po.status} onChange={e => api.updatePOStatus(po.id, e.target.value).then(loadAll)}
                      style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: STATUS_COLOR[po.status] || 'var(--text-primary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                      {PO_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '11px' }}>{po.expected_date?.slice(0, 10)}</td>
                  <td style={{ padding: '10px' }}><button onClick={() => api.deletePO(po.id).then(loadAll)} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'suggestions' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Product', 'Stock', 'Threshold', 'Suggested Qty', 'Est. Cost', 'Vendor', 'Urgency', ''].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {suggestions.length === 0 && <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>✅ All products are adequately stocked!</td></tr>}
              {suggestions.map(s => (
                <tr key={s.product_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px' }}><div style={{ fontWeight: 600 }}>{s.product_name}</div><div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#6366f1' }}>{s.sku}</div></td>
                  <td style={{ padding: '10px', color: '#ef4444', fontWeight: 700 }}>{s.current_stock}</td>
                  <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{s.reorder_threshold}</td>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{s.suggested_qty}</td>
                  <td style={{ padding: '10px', color: '#10b981', fontWeight: 700 }}>₹{s.estimated_cost.toLocaleString()}</td>
                  <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{s.suggested_vendor}</td>
                  <td style={{ padding: '10px' }}><Badge text={s.urgency} /></td>
                  <td style={{ padding: '10px' }}><button onClick={() => createFromSuggestion(s)} style={{ padding: '5px 12px', borderRadius: '7px', background: '#6366f1', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>+ Create PO</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ─── Main Logistics View ──────────────────────────────────────────────────────
export default function LogisticsView() {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <div className="page-heading">Logistics & Supply Chain</div>
          <div className="page-sub">Track shipments, manage vendors, scan barcodes & raise purchase orders</div>
        </div>
      </div>
      <ShipmentTracker />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <BarcodeScanner />
        <VendorPortal />
      </div>
      <PurchaseOrders />
    </div>
  )
}
