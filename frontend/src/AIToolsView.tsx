import { useState, useEffect, useRef } from 'react'
import api from './api'
import type { ReportResponse, BulkSentimentResponse, SentimentResult, DescriptionResponse } from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SENTIMENT_COLOR: Record<string, string> = {
  POSITIVE: '#10b981', NEUTRAL: '#64748b', NEGATIVE: '#f97316', ANGRY: '#ef4444',
}
const URGENCY_COLOR: Record<string, string> = {
  LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#f97316', CRITICAL: '#ef4444',
}
const SENTIMENT_EMOJI: Record<string, string> = {
  POSITIVE: '😊', NEUTRAL: '😐', NEGATIVE: '😟', ANGRY: '😡',
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
        <span style={{ fontSize: '20px' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function Spinner({ text = 'Generating…' }: { text?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '13px', padding: '24px 0' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      {text}
    </div>
  )
}

// ─── Markdown renderer (simple, no library needed) ─────────────────────────
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div style={{ lineHeight: 1.75, fontSize: '13.5px', color: 'var(--text-secondary)' }}>
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
          return <h3 key={i} style={{ color: 'var(--text-primary)', fontWeight: 700, margin: '14px 0 4px', fontSize: '14px' }}>{line.slice(2, -2)}</h3>
        }
        if (/^\*\*(.+?)\*\*/.test(line)) {
          const html = line.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
          return <p key={i} dangerouslySetInnerHTML={{ __html: html }} style={{ margin: '4px 0' }} />
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return <li key={i} style={{ marginLeft: '16px', marginBottom: '2px', color: 'var(--text-secondary)' }}>{line.slice(2)}</li>
        }
        if (line.startsWith('# ')) return <h2 key={i} style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '16px', margin: '8px 0' }}>{line.slice(2)}</h2>
        if (line.startsWith('## ')) return <h3 key={i} style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '14px', margin: '10px 0 4px' }}>{line.slice(3)}</h3>
        if (line.trim() === '') return <div key={i} style={{ height: '6px' }} />
        return <p key={i} style={{ margin: '3px 0' }}>{line}</p>
      })}
    </div>
  )
}

// ─── 1. AI Report Generator ───────────────────────────────────────────────────
function ReportGenerator() {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly')
  const [focus, setFocus] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportResponse | null>(null)

  const generate = async () => {
    setLoading(true); setReport(null)
    try { setReport(await api.generateReport(period, focus || undefined)) }
    catch (e: any) { alert('Generation failed: ' + e.message) }
    finally { setLoading(false) }
  }

  return (
    <Card title="AI Business Report Generator" icon="📄">
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Period</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['weekly', 'monthly'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: period === p ? '#6366f1' : 'transparent', color: period === p ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize', transition: 'all .2s' }}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Focus Area (optional)</label>
          <input value={focus} onChange={e => setFocus(e.target.value)} placeholder="e.g. inventory health, revenue growth…"
            style={{ width: '100%', padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '12px', boxSizing: 'border-box' }} />
        </div>
        <button onClick={generate} disabled={loading} style={{ padding: '8px 20px', borderRadius: '8px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: loading ? 0.7 : 1, flexShrink: 0 }}>
          ✨ Generate Report
        </button>
      </div>

      {loading && <Spinner text="Gemini is analyzing your business data…" />}

      {report && (
        <div>
          {/* Metrics snapshot */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '18px' }}>
            {[
              { label: 'Revenue', value: `₹${(report.metrics_snapshot.total_revenue / 100000).toFixed(1)}L` },
              { label: 'Orders', value: report.metrics_snapshot.total_orders },
              { label: 'Low Stock', value: report.metrics_snapshot.low_stock_count },
              { label: 'Open Tickets', value: report.metrics_snapshot.open_tickets },
            ].map(m => (
              <div key={m.label} style={{ background: 'rgba(99,102,241,0.08)', borderRadius: '10px', padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>{m.label}</div>
                <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-primary)' }}>{m.value}</div>
              </div>
            ))}
          </div>
          {/* Report body */}
          <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Generated {report.generated_at.slice(0, 16).replace('T', ' ')} UTC</span>
              <button onClick={() => navigator.clipboard.writeText(report.report)}
                style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px' }}>📋 Copy</button>
            </div>
            <SimpleMarkdown text={report.report} />
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── 2. Sentiment Analysis ────────────────────────────────────────────────────
function SentimentAnalyzer() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<BulkSentimentResponse | null>(null)
  const [ticketId, setTicketId] = useState('')
  const [single, setSingle] = useState<SentimentResult | null>(null)
  const [singleLoading, setSingleLoading] = useState(false)

  const runBulk = async () => {
    setLoading(true); setData(null)
    try { setData(await api.bulkSentiment()) }
    catch (e: any) { alert('Analysis failed: ' + e.message) }
    finally { setLoading(false) }
  }

  const runSingle = async () => {
    const id = Number(ticketId)
    if (!id) return
    setSingleLoading(true); setSingle(null)
    try { setSingle(await api.analyzeTicketSentiment(id)) }
    catch (e: any) { alert('Analysis failed: ' + e.message) }
    finally { setSingleLoading(false) }
  }

  return (
    <Card title="Ticket Sentiment Analysis" icon="🧠">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Bulk */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>Bulk Analysis — All Open Tickets</div>
          <button onClick={runBulk} disabled={loading} style={{ padding: '8px 18px', borderRadius: '8px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: loading ? 0.7 : 1 }}>
            🔍 Analyze All Open Tickets
          </button>
          {loading && <Spinner text="Gemini is reading your tickets…" />}
          {data && (
            <div style={{ marginTop: '14px' }}>
              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: 800 }}>{data.summary.total}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tickets Analyzed</div>
                </div>
                <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#ef4444' }}>{data.summary.critical_count}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Critical Urgency</div>
                </div>
              </div>
              {/* Sentiment breakdown */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {Object.entries(data.summary.sentiment_breakdown).map(([s, count]) => (
                  <div key={s} style={{ background: `${SENTIMENT_COLOR[s]}22`, border: `1px solid ${SENTIMENT_COLOR[s]}44`, borderRadius: '8px', padding: '6px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '16px' }}>{SENTIMENT_EMOJI[s]}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: SENTIMENT_COLOR[s] }}>{count}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s}</div>
                  </div>
                ))}
              </div>
              {/* Ticket list */}
              <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {data.results.map(r => (
                  <div key={r.ticket_id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px 12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '18px' }}>{SENTIMENT_EMOJI[r.sentiment]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>#{r.ticket_id} {r.subject}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.emotion} • score {r.score.toFixed(2)}</div>
                    </div>
                    <span style={{ background: `${URGENCY_COLOR[r.urgency]}22`, color: URGENCY_COLOR[r.urgency], padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>{r.urgency}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Single */}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>Single Ticket Deep Analysis</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input value={ticketId} onChange={e => setTicketId(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSingle()} placeholder="Ticket ID"
              style={{ width: 90, padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '13px' }} />
            <button onClick={runSingle} disabled={singleLoading} style={{ padding: '7px 14px', borderRadius: '8px', background: '#6366f1', border: 'none', color: '#fff', fontWeight: 700, cursor: singleLoading ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: singleLoading ? 0.7 : 1 }}>
              Analyze
            </button>
          </div>
          {singleLoading && <Spinner text="Analyzing ticket sentiment…" />}
          {single && (
            <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <span style={{ fontSize: '36px' }}>{SENTIMENT_EMOJI[single.sentiment]}</span>
                <div>
                  <div style={{ fontWeight: 700, color: SENTIMENT_COLOR[single.sentiment], fontSize: '15px' }}>{single.sentiment}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>#{single.ticket_id} · {single.emotion}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                {[
                  { label: 'Score', value: single.score.toFixed(2), color: single.score > 0 ? '#10b981' : '#ef4444' },
                  { label: 'Urgency', value: single.urgency, color: URGENCY_COLOR[single.urgency] },
                  { label: 'Priority', value: single.suggested_priority || 'N/A', color: '#6366f1' },
                  { label: 'Emotion', value: single.emotion, color: 'var(--text-secondary)' },
                ].map(m => (
                  <div key={m.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 12px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>{m.label}</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>
              {single.summary && <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: '10px' }}>{single.summary}</div>}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── 3. Product Description Generator ────────────────────────────────────────
function DescriptionGenerator() {
  const [form, setForm] = useState({ product_name: '', category: 'Electronics', sku: '', key_features: '', target_audience: '', tone: 'professional' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DescriptionResponse | null>(null)

  const generate = async () => {
    if (!form.product_name) return alert('Please enter a product name')
    setLoading(true); setResult(null)
    try { setResult(await api.generateDescription(form)) }
    catch (e: any) { alert('Generation failed: ' + e.message) }
    finally { setLoading(false) }
  }

  return (
    <Card title="Product Description Generator" icon="✍️">
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { key: 'product_name', label: 'Product Name *', placeholder: 'e.g. Smart Air Purifier Pro' },
            { key: 'sku', label: 'SKU', placeholder: 'e.g. ELEC-AP-001' },
            { key: 'key_features', label: 'Key Features', placeholder: 'e.g. HEPA filter, WiFi, App control' },
            { key: 'target_audience', label: 'Target Audience', placeholder: 'e.g. Health-conscious families' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>{f.label}</label>
              <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '12px', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Category</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px' }}>
              {['Electronics', 'Home & Kitchen', 'Sports', 'Clothing', 'Beauty', 'Toys', 'Food', 'Books'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Tone</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {['professional', 'friendly', 'luxury', 'technical'].map(t => (
                <button key={t} onClick={() => setForm(p => ({ ...p, tone: t }))}
                  style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: form.tone === t ? '#6366f1' : 'transparent', color: form.tone === t ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize', transition: 'all .2s' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button onClick={generate} disabled={loading} style={{ padding: '9px', borderRadius: '8px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: loading ? 0.7 : 1 }}>
            ✨ Generate Description
          </button>
        </div>

        {/* Result */}
        <div>
          {loading && <Spinner text="Gemini is crafting your product copy…" />}
          {!loading && !result && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>✍️</div>
              <div style={{ fontSize: '13px' }}>Fill in the form and click Generate</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>AI will write SEO-optimized copy for your product</div>
            </div>
          )}
          {result && (
            <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{result.product_name}</span>
                  <span style={{ marginLeft: '8px', fontSize: '11px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: '6px' }}>{result.tone}</span>
                </div>
                <button onClick={() => navigator.clipboard.writeText(result.description)}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px' }}>📋 Copy All</button>
              </div>
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                <SimpleMarkdown text={result.description} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── 4. Voice Copilot Info Panel ──────────────────────────────────────────────
function VoiceCopilotPanel() {
  const [supported] = useState(() => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognitionRef.current = recognition
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-IN'
    recognition.onresult = (e: any) => {
      const text = Array.from(e.results).map((r: any) => r[0].transcript).join(' ')
      setTranscript(text)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start()
    setListening(true)
  }

  return (
    <Card title="Voice Copilot" icon="🎙️">
      {!supported ? (
        <div style={{ color: '#f59e0b', fontSize: '13px', background: 'rgba(245,158,11,0.1)', padding: '12px 16px', borderRadius: '10px' }}>
          ⚠️ Voice recognition is not supported in your browser. Please use Chrome or Edge.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
          <div>
            <div style={{ textAlign: 'center', padding: '24px', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', marginBottom: '14px' }}>
              <button onClick={toggleListening} style={{
                width: 80, height: 80, borderRadius: '50%',
                background: listening ? 'radial-gradient(circle, #ef4444, #dc2626)' : 'radial-gradient(circle, #6366f1, #4f46e5)',
                border: listening ? '3px solid #ef4444' : '3px solid #6366f1',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
                boxShadow: listening ? '0 0 0 8px rgba(239,68,68,0.2), 0 0 0 16px rgba(239,68,68,0.1)' : '0 4px 20px rgba(99,102,241,0.4)',
                transition: 'all 0.3s',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" strokeWidth="2" />
                  <line x1="12" y1="19" x2="12" y2="23" strokeWidth="2" />
                  <line x1="8" y1="23" x2="16" y2="23" strokeWidth="2" />
                </svg>
              </button>
              <div style={{ fontWeight: 700, color: listening ? '#ef4444' : 'var(--text-primary)', fontSize: '14px' }}>
                {listening ? '🔴 Listening…' : '🎙️ Click to Speak'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Language: English (India)</div>
            </div>
            {transcript && (
              <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Transcript</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>{transcript}</div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  <button onClick={() => navigator.clipboard.writeText(transcript)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px' }}>📋 Copy</button>
                  <button onClick={() => setTranscript('')} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px' }}>🗑 Clear</button>
                </div>
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>💡 Voice Commands</div>
            {[
              { cmd: '"Show low stock products"', desc: 'Opens inventory alerts' },
              { cmd: '"Generate weekly report"', desc: 'Triggers AI report' },
              { cmd: '"Analyze ticket sentiment"', desc: 'Runs bulk sentiment scan' },
              { cmd: '"Track shipment [AWB]"', desc: 'Looks up shipment status' },
              { cmd: '"Create purchase order"', desc: 'Opens PO form' },
            ].map(c => (
              <div key={c.cmd} style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#818cf8', marginBottom: '2px' }}>{c.cmd}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.desc}</div>
              </div>
            ))}
            <div style={{ fontSize: '11px', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '8px 12px', borderRadius: '8px', marginTop: '8px' }}>
              💡 Tip: Copy the transcript and paste it into the AI Chat sidebar for full multi-agent responses.
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── Main AI Tools View ───────────────────────────────────────────────────────
export default function AIToolsView() {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <div className="page-heading">AI Enhancements</div>
          <div className="page-sub">Gemini-powered tools — reports, sentiment analysis, content generation & voice copilot</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', color: '#818cf8', fontWeight: 600 }}>
          ✨ Powered by Gemini AI
        </div>
      </div>
      <VoiceCopilotPanel />
      <ReportGenerator />
      <SentimentAnalyzer />
      <DescriptionGenerator />
    </div>
  )
}
