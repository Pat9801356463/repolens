import React from 'react'

/* ─── Badge ─── */
export function Badge({ variant = 'blue', children, style }) {
  const variants = {
    red:    { background: 'rgba(239,68,68,.18)',   color: '#f87171' },
    warn:   { background: 'rgba(245,158,11,.18)',  color: '#fbbf24' },
    blue:   { background: 'rgba(59,130,246,.18)',  color: '#93c5fd' },
    green:  { background: 'rgba(16,185,129,.18)',  color: '#34d399' },
    purple: { background: 'rgba(139,92,246,.18)',  color: '#c4b5fd' },
    cyan:   { background: 'rgba(6,182,212,.18)',   color: '#67e8f9' },
    gray:   { background: 'rgba(255,255,255,.08)', color: '#94a3b8' },
  }
  return (
    <span style={{
      display: 'inline-block', fontSize: 9, fontWeight: 500,
      padding: '2px 7px', borderRadius: 5, letterSpacing: '.03em',
      whiteSpace: 'nowrap', ...variants[variant], ...style,
    }}>
      {children}
    </span>
  )
}

/* ─── Card ─── */
export function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#0c1a2e', border: '0.5px solid rgba(99,179,237,0.13)',
      borderRadius: 11, padding: 16, ...style,
      cursor: onClick ? 'pointer' : undefined,
    }}>
      {children}
    </div>
  )
}

/* ─── Section Title ─── */
export function STitle({ children, dot, style }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 500, color: '#e2e8f0',
      marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: '50%',
        background: dot, flexShrink: 0, display: 'inline-block' }} />}
      {children}
    </div>
  )
}

/* ─── Eyebrow label ─── */
export function Eyebrow({ children }) {
  return (
    <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase',
      letterSpacing: '.07em', marginBottom: 8 }}>
      {children}
    </div>
  )
}

/* ─── KPI Block ─── */
export function KPI({ value, sub, delta, deltaColor = '#f87171', color = '#e2e8f0' }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 500, lineHeight: 1, color }}>{value}</div>
      {sub   && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
      {delta && <div style={{ fontSize: 11, color: deltaColor, marginTop: 4 }}>{delta}</div>}
    </div>
  )
}

/* ─── Bar Row ─── */
export function BarRow({ label, value, max, color = '#3b82f6', displayValue, style }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 7, ...style }}>
      <span style={{ color: '#94a3b8', minWidth: 118, fontSize: 11,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,.07)',
        borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%',
          borderRadius: 3, background: color, transition: 'width .4s ease' }} />
      </div>
      <span style={{ color: '#475569', minWidth: 34,
        textAlign: 'right', fontSize: 10 }}>
        {displayValue ?? value}
      </span>
    </div>
  )
}

/* ─── Progress bar ─── */
export function ProgressBar({ pct, color = '#3b82f6', style }) {
  return (
    <div style={{ height: 5, borderRadius: 3,
      background: 'rgba(255,255,255,.07)', overflow: 'hidden', ...style }}>
      <div style={{ width: `${pct}%`, height: '100%',
        borderRadius: 3, background: color, transition: 'width .4s ease' }} />
    </div>
  )
}

/* ─── Divider ─── */
export function Divider({ style }) {
  return <div style={{ height: .5, background: 'rgba(255,255,255,.07)',
    margin: '14px 0', ...style }} />
}

/* ─── Info Box ─── */
export function InfoBox({ type = 'info', title, children }) {
  const styles = {
    info:    { bg: 'rgba(59,130,246,.07)',  border: 'rgba(59,130,246,.22)',  tc: '#93c5fd' },
    warn:    { bg: 'rgba(245,158,11,.07)', border: 'rgba(245,158,11,.22)', tc: '#fbbf24' },
    success: { bg: 'rgba(16,185,129,.07)', border: 'rgba(16,185,129,.22)', tc: '#34d399' },
    danger:  { bg: 'rgba(239,68,68,.07)',  border: 'rgba(239,68,68,.22)',  tc: '#f87171' },
  }
  const s = styles[type] || styles.info
  return (
    <div style={{ background: s.bg, border: `0.5px solid ${s.border}`,
      borderRadius: 9, padding: '10px 12px' }}>
      {title && <div style={{ fontSize: 11, fontWeight: 500,
        color: s.tc, marginBottom: 3 }}>{title}</div>}
      <div style={{ fontSize: 11, color: s.tc, opacity: .85,
        lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

/* ─── Event Item ─── */
export function EventItem({ title, detail, variant = 'blue', badge, badgeVariant, onClick }) {
  const borderColors = {
    blue: '#3b82f6', red: '#ef4444',
    warn: '#f59e0b', green: '#10b981', purple: '#8b5cf6',
  }
  return (
    <div onClick={onClick} style={{
      background: '#0f2038', borderRadius: 9, padding: '10px 12px',
      borderLeft: `3px solid ${borderColors[variant] || '#3b82f6'}`,
      cursor: onClick ? 'pointer' : undefined, marginBottom: 8,
      transition: 'background .15s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,.08)'}
    onMouseLeave={e => e.currentTarget.style.background = '#0f2038'}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 500,
          color: '#e2e8f0', flex: 1 }}>{title}</span>
        {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
      </div>
      {detail && <div style={{ fontSize: 11, color: '#94a3b8',
        marginTop: 4, lineHeight: 1.4 }}>{detail}</div>}
    </div>
  )
}

/* ─── Grids ─── */
export function Grid({ cols = 2, gap = 12, children, style }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap, ...style,
    }}>
      {children}
    </div>
  )
}

/* ─── Stat Tile ─── */
export function StatTile({ value, label, color = '#e2e8f0', bg, border }) {
  return (
    <div style={{
      textAlign: 'center', background: bg || '#0f2038',
      borderRadius: 9, padding: '12px 8px',
      border: `0.5px solid ${border || 'rgba(99,179,237,0.13)'}`,
    }}>
      <div style={{ fontSize: 20, fontWeight: 500, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, lineHeight: 1.3 }}>{label}</div>
    </div>
  )
}
