import { useState, useEffect } from 'react'
import api from './api'
import type { SessionInfo, SecurityEvent, PlatformUser } from './types'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const EVENT_COLOR: Record<string, string> = {
  LOGIN_SUCCESS: '#10b981', LOGIN_FAILED: '#ef4444', PASSWORD_CHANGED: '#6366f1',
  SESSION_REVOKED: '#f59e0b', ALL_SESSIONS_REVOKED: '#f97316', PERMISSION_DENIED: '#ef4444',
  PASSWORD_CHANGE_FAILED: '#ef4444',
}
const EVENT_ICON: Record<string, string> = {
  LOGIN_SUCCESS: '✅', LOGIN_FAILED: '❌', PASSWORD_CHANGED: '🔑',
  SESSION_REVOKED: '🚫', ALL_SESSIONS_REVOKED: '🔒', PERMISSION_DENIED: '⛔',
  PASSWORD_CHANGE_FAILED: '⚠️',
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px 24px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
        <span style={{ fontSize: '20px' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

// ─── 1. Active Sessions ───────────────────────────────────────────────────────
function SessionsPanel() {
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)

  const load = () => api.securitySessions().then(setSessions).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const revoke = async (jti: string) => {
    if (!confirm('Revoke this session? The device will be signed out immediately.')) return
    setRevoking(jti)
    try { await api.securityRevokeSession(jti); load() }
    finally { setRevoking(null) }
  }

  const revokeAll = async () => {
    if (!confirm('Sign out of all other sessions?')) return
    await api.securityRevokeAll(); load()
  }

  return (
    <Section title="Active Sessions" icon="🖥️">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button onClick={revokeAll} style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid #ef444444', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
          🔒 Sign Out All Other Sessions
        </button>
      </div>
      {loading ? <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading sessions…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sessions.map(s => (
            <div key={s.jti} style={{ background: s.is_current ? 'rgba(99,102,241,0.08)' : 'rgba(0,0,0,0.2)', border: `1px solid ${s.is_current ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`, borderRadius: '10px', padding: '14px 16px', display: 'flex', gap: '14px', alignItems: 'center' }}>
              <span style={{ fontSize: '24px' }}>
                {s.user_agent.toLowerCase().includes('mobile') ? '📱' : s.user_agent.toLowerCase().includes('chrome') ? '🌐' : '💻'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>{s.user_agent.slice(0, 60)}</span>
                  {s.is_current && <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '1px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>CURRENT</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  IP: {s.ip} &nbsp;·&nbsp; Created: {s.created_at.slice(0, 16).replace('T', ' ')} UTC
                </div>
              </div>
              {!s.is_current && (
                <button onClick={() => revoke(s.jti)} disabled={revoking === s.jti}
                  style={{ padding: '5px 14px', borderRadius: '7px', border: '1px solid #ef444444', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 600, flexShrink: 0, opacity: revoking === s.jti ? 0.6 : 1 }}>
                  {revoking === s.jti ? '…' : 'Revoke'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ─── 2. Change Password ───────────────────────────────────────────────────────
function ChangePasswordPanel() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const submit = async () => {
    if (form.new_password !== form.confirm_password) return setResult({ ok: false, message: 'New passwords do not match' })
    if (form.new_password.length < 8) return setResult({ ok: false, message: 'Password must be at least 8 characters' })
    setLoading(true); setResult(null)
    try {
      const res = await api.securityChangePassword(form.current_password, form.new_password)
      setResult({ ok: true, message: res.message || 'Password changed successfully' })
      setForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (e: any) {
      setResult({ ok: false, message: e.message || 'Failed to change password' })
    } finally { setLoading(false) }
  }

  const strength = (pw: string) => {
    let score = 0
    if (pw.length >= 8) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    return score
  }

  const s = strength(form.new_password)
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981']

  return (
    <Section title="Change Password" icon="🔑">
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { key: 'current_password', label: 'Current Password', placeholder: 'Enter current password' },
            { key: 'new_password', label: 'New Password', placeholder: 'At least 8 characters' },
            { key: 'confirm_password', label: 'Confirm New Password', placeholder: 'Repeat new password' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px', textTransform: 'uppercase' }}>{f.label}</label>
              <input type="password" value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
          ))}

          {/* Strength meter */}
          {form.new_password && (
            <div>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= s ? strengthColor[s] : 'rgba(255,255,255,0.1)', transition: 'background .3s' }} />
                ))}
              </div>
              <div style={{ fontSize: '11px', color: strengthColor[s], fontWeight: 600 }}>{strengthLabel[s]}</div>
            </div>
          )}

          <button onClick={submit} disabled={loading || !form.current_password || !form.new_password}
            style={{ padding: '9px', borderRadius: '8px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Changing…' : '🔑 Change Password'}
          </button>

          {result && (
            <div style={{ background: result.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${result.ok ? '#10b98144' : '#ef444444'}`, borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: result.ok ? '#10b981' : '#ef4444' }}>
              {result.ok ? '✅' : '❌'} {result.message}
            </div>
          )}
        </div>

        {/* Tips */}
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '16px 18px' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', fontSize: '13px' }}>🛡️ Password Best Practices</div>
          {[
            'Use at least 8 characters',
            'Mix uppercase & lowercase letters',
            'Include numbers (0–9)',
            'Add special characters (!@#$%)',
            'Never reuse old passwords',
            'Use a unique password for this account',
          ].map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span style={{ color: '#10b981', flexShrink: 0 }}>✓</span>{tip}
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ─── 3. Security Audit Log ────────────────────────────────────────────────────
function AuditPanel() {
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = (type?: string) => {
    setLoading(true)
    api.securityAuditEvents(type).then(res => { setEvents(res.events); setTypes(res.types || []) }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  return (
    <Section title="Security Audit Log" icon="🛡️">
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <button onClick={() => { setFilter(''); load() }} style={{ padding: '5px 14px', borderRadius: '7px', border: '1px solid var(--border)', background: !filter ? '#6366f1' : 'transparent', color: !filter ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>All</button>
        {types.map(t => (
          <button key={t} onClick={() => { setFilter(t); load(t) }}
            style={{ padding: '5px 14px', borderRadius: '7px', border: '1px solid var(--border)', background: filter === t ? (EVENT_COLOR[t] || '#6366f1') : 'transparent', color: filter === t ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
            {EVENT_ICON[t] || '•'} {t.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading events…</div> : (
        <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {events.map(ev => (
            <div key={ev.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', borderLeft: `3px solid ${EVENT_COLOR[ev.type] || '#64748b'}` }}>
              <span style={{ fontSize: '16px', flexShrink: 0 }}>{EVENT_ICON[ev.type] || '•'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '12px', color: EVENT_COLOR[ev.type] || 'var(--text-primary)' }}>{ev.type.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ev.email}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  IP: {ev.ip} &nbsp;·&nbsp; {ev.ts.slice(0, 16).replace('T', ' ')} UTC &nbsp;·&nbsp; {ev.detail}
                </div>
              </div>
            </div>
          ))}
          {events.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px', fontSize: '13px' }}>No events found</div>}
        </div>
      )}
    </Section>
  )
}

// ─── 4. GDPR Data Export ──────────────────────────────────────────────────────
function GDPRPanel() {
  const [loading, setLoading] = useState(false)
  const [exported, setExported] = useState(false)

  const exportData = async () => {
    setLoading(true)
    try {
      const data = await api.securityExportData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shopmind-data-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExported(true)
    } finally { setLoading(false) }
  }

  return (
    <Section title="GDPR & Data Privacy" icon="📦">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            Under GDPR and India's DPDP Act, you have the right to receive a copy of all personal data ShopMind holds about you. Click below to download a full export as a JSON file.
          </div>
          <button onClick={exportData} disabled={loading}
            style={{ padding: '10px 22px', borderRadius: '10px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {loading ? '⏳ Preparing export…' : '📥 Download My Data (JSON)'}
          </button>
          {exported && (
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#10b981' }}>✅ Export downloaded successfully!</div>
          )}
        </div>
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '16px 18px' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', fontSize: '13px' }}>📋 Export Includes</div>
          {['Account information (email, name, role)', 'Customer profile (address, phone)', 'Order history with line items', 'Support ticket history', 'Data retention policy'].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span style={{ color: '#6366f1', flexShrink: 0 }}>▶</span>{item}
            </div>
          ))}
          <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: '8px', fontSize: '11px', color: '#818cf8' }}>
            📧 To request permanent data deletion, contact <strong>privacy@shopmind.ai</strong>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── 5. User Management (Admin only) ─────────────────────────────────────────
function UserManagementPanel() {
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role_name: 'ANALYST' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => api.securityListUsers().then(setUsers).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const createUser = async () => {
    if (!form.email || !form.full_name || !form.password) return setError('All fields are required')
    setSaving(true); setError('')
    try { await api.securityCreateUser(form); setShowForm(false); setForm({ email: '', full_name: '', password: '', role_name: 'ANALYST' }); load() }
    catch (e: any) { setError(e.message || 'Failed to create user') }
    finally { setSaving(false) }
  }

  const toggleStatus = async (u: PlatformUser) => {
    if (!confirm(`${u.is_active ? 'Deactivate' : 'Activate'} ${u.full_name}?`)) return
    await api.securityUpdateUserStatus(u.id, !u.is_active); load()
  }

  const ROLE_COLORS: Record<string, string> = { ADMIN: '#ef4444', OPS_MANAGER: '#f97316', ANALYST: '#6366f1', CUSTOMER_SUPPORT: '#10b981', CUSTOMER: '#64748b' }

  return (
    <Section title="User Management" icon="👥">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <button onClick={() => setShowForm(s => !s)} style={{ padding: '7px 16px', borderRadius: '8px', background: showForm ? 'transparent' : '#6366f1', border: showForm ? '1px solid var(--border)' : 'none', color: showForm ? 'var(--text-secondary)' : '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
          {showForm ? '✕ Cancel' : '+ New User'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[['email', 'Email', 'email'], ['full_name', 'Full Name', 'text'], ['password', 'Password', 'password']].map(([k, label, type]) => (
            <div key={k}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>{label}</label>
              <input type={type} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={label}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '12px', boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Role</label>
            <select value={form.role_name} onChange={e => setForm(f => ({ ...f, role_name: e.target.value }))
} style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px' }}>
              {['ADMIN', 'OPS_MANAGER', 'ANALYST', 'CUSTOMER_SUPPORT', 'CUSTOMER'].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          {error && <div style={{ gridColumn: '1/-1', color: '#ef4444', fontSize: '12px' }}>❌ {error}</div>}
          <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={createUser} disabled={saving} style={{ padding: '7px 20px', borderRadius: '8px', background: '#10b981', border: 'none', color: '#fff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Creating…' : '✓ Create User'}
            </button>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading users…</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['User', 'Role', 'Status', 'Created', 'Last Login', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '11px 12px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.full_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '11px 12px' }}>
                    <span style={{ background: `${ROLE_COLORS[u.role] || '#64748b'}22`, color: ROLE_COLORS[u.role] || '#64748b', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>{u.role}</span>
                  </td>
                  <td style={{ padding: '11px 12px' }}>
                    <span style={{ color: u.is_active ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: '12px' }}>● {u.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td style={{ padding: '11px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>{u.created_at.slice(0, 10)}</td>
                  <td style={{ padding: '11px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>{u.last_login ? u.last_login.slice(0, 16).replace('T', ' ') : '—'}</td>
                  <td style={{ padding: '11px 12px' }}>
                    <button onClick={() => toggleStatus(u)}
                      style={{ padding: '4px 12px', borderRadius: '6px', border: `1px solid ${u.is_active ? '#ef444444' : '#10b98144'}`, background: u.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', color: u.is_active ? '#ef4444' : '#10b981', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

// ─── Main Security View ───────────────────────────────────────────────────────
export default function SecurityView() {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="page-heading">Security & Compliance</div>
          <div className="page-sub">Manage sessions, change password, audit logs, GDPR data export & user management</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
          🛡️ Security Dashboard
        </div>
      </div>
      <SessionsPanel />
      <ChangePasswordPanel />
      <AuditPanel />
      <GDPRPanel />
      <UserManagementPanel />
    </div>
  )
}
