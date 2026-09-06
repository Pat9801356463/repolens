import React, { useState } from 'react'
import { Card, STitle, Badge, BarRow, Grid, Divider } from '../components/UI'

const ALERTS = [
  {
    icon: '⚡', iconBg: 'rgba(239,68,68,.15)', iconColor: '#f87171',
    title: 'BMTC Bus Breakdown — Mekhri Circle',
    detail: 'Bellary Rd 1 · Blocking 2 lanes · High priority · Officer dispatched',
    time: '2 min ago · Predicted resolution: 41 min',
    badge: 'Critical', badgeV: 'red',
    prompt: 'BMTC breakdown at Mekhri Circle — fastest resolution plan?',
  },
  {
    icon: '◉', iconBg: 'rgba(59,130,246,.15)', iconColor: '#93c5fd',
    title: 'Water Logging — Mysore Road km 8',
    detail: 'South Zone 2 · 2 lanes submerged · 61h historical median resolution',
    time: '8 min ago · Pump unit dispatched',
    badge: 'High', badgeV: 'warn',
    prompt: 'Water logging on Mysore Road km 8 — diversions and pump deployment?',
  },
  {
    icon: '◈', iconBg: 'rgba(245,158,11,.15)', iconColor: '#fbbf24',
    title: 'VIP Movement — Bellary Road corridor',
    detail: '80% road closure probability · 12 officers pre-positioned · ORR alternate active',
    time: '15 min ago · Pre-clearance active',
    badge: 'Planned', badgeV: 'warn',
    prompt: 'VIP convoy on Bellary Road — full pre-clearance protocol?',
  },
  {
    icon: '△', iconBg: 'rgba(239,68,68,.12)', iconColor: '#f87171',
    title: 'Accident — Silk Board Junction',
    detail: 'Multi-vehicle · 3 lanes blocked · 0.67h median resolution · Ambulance en route',
    time: '22 min ago',
    badge: 'Critical', badgeV: 'red',
    prompt: 'Accident at Silk Board junction — diversion plan and officer count?',
  },
  {
    icon: '⬡', iconBg: 'rgba(245,158,11,.12)', iconColor: '#fbbf24',
    title: 'SLA Breach — 537 Pot Hole events exceeding 72h target',
    detail: 'Systemic failure · Median 217h vs 72h SLA · Requires commissioner escalation',
    time: 'Daily digest · Auto-escalated',
    badge: 'SLA Breach', badgeV: 'red',
    prompt: 'Pot hole SLA breach — executive summary for commissioner?',
  },
  {
    icon: '◌', iconBg: 'rgba(16,185,129,.12)', iconColor: '#34d399',
    title: 'AI Forecast — Construction peak · Hosur Road · Tomorrow 05:00–09:00',
    detail: 'Predicted from 480 historical construction events · Confidence: 89%',
    time: 'Proactive · T-12h alert',
    badge: 'Forecast', badgeV: 'green',
    prompt: 'Construction peak on Hosur Road tomorrow morning — pre-positioning needed?',
  },
  {
    icon: '◇', iconBg: 'rgba(139,92,246,.12)', iconColor: '#c4b5fd',
    title: 'Upcoming — IPL Match in 7 days · Pre-planning triggered',
    detail: 'Chinnaswamy Stadium · 45,000 attendees · 46.4% closure probability',
    time: 'T-7 days · Begin resource booking',
    badge: 'Upcoming', badgeV: 'purple',
    prompt: 'IPL match in 7 days — begin full pre-event planning protocol',
  },
  {
    icon: '⚠', iconBg: 'rgba(239,68,68,.10)', iconColor: '#f87171',
    title: 'Tree Fall — Tumkur Road km 22',
    detail: 'Blocking left lane · 12h median resolution · Tree removal crew dispatched',
    time: '38 min ago · Crew ETA 25 min',
    badge: 'High', badgeV: 'warn',
    prompt: 'Tree fall on Tumkur Road — what is the fastest diversion and resolution plan?',
  },
]

const SLA_TABLE = [
  { cause: 'Accident',          hours: 0.67,  sla: 2,  status: 'ok'   },
  { cause: 'Vehicle Breakdown', hours: 0.68,  sla: 2,  status: 'ok'   },
  { cause: 'Tree Fall',         hours: 12,    sla: 6,  status: 'warn' },
  { cause: 'Construction',      hours: 49,    sla: 24, status: 'warn' },
  { cause: 'Water Logging',     hours: 61,    sla: 12, status: 'fail' },
  { cause: 'Road Conditions',   hours: 154,   sla: 48, status: 'fail' },
  { cause: 'Pot Holes',         hours: 217,   sla: 72, status: 'fail', critical: true },
]

const ALERT_VOLUME = [
  { label: 'Vehicle Breakdown', val: 4896, color: '#8b5cf6' },
  { label: 'Pot Holes (breach)',val: 537,  color: '#ef4444' },
  { label: 'Construction',      val: 480,  color: '#06b6d4' },
  { label: 'Water Logging',     val: 458,  color: '#3b82f6' },
  { label: 'AI Forecast alerts',val: 200,  color: '#10b981', displayValue: '~200/day' },
]

export default function AlertFeed({ onCopilotPrompt, onNav }) {
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? ALERTS
    : filter === 'critical' ? ALERTS.filter(a => a.badgeV === 'red')
    : filter === 'forecast'  ? ALERTS.filter(a => a.badgeV === 'green' || a.badgeV === 'purple')
    : ALERTS

  const slaColor = s => s === 'ok' ? '#34d399' : s === 'warn' ? '#fbbf24' : '#f87171'
  const slaIcon  = s => s === 'ok' ? '✓' : '✗'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <Grid cols={2} gap={12}>

        {/* Feed */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: 12 }}>
            <STitle style={{ marginBottom: 0 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%',
                background: '#ef4444', display: 'inline-block', marginRight: 6 }} />
              Live alert feed
              <Badge variant="red" style={{ marginLeft: 7 }}>8 new</Badge>
            </STitle>
            <div style={{ display: 'flex', gap: 5 }}>
              {['all','critical','forecast'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{
                    background: filter === f ? 'rgba(59,130,246,.18)' : 'rgba(255,255,255,.05)',
                    border: '0.5px solid rgba(99,179,237,.13)', borderRadius: 5,
                    color: filter === f ? '#93c5fd' : '#94a3b8',
                    fontSize: 10, padding: '3px 9px', cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'all .15s',
                  }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowY: 'auto', maxHeight: 540 }}>
            {filtered.map((a, i) => (
              <div key={i}
                onClick={() => { onNav('s6'); onCopilotPrompt(a.prompt) }}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', background: '#0f2038',
                  borderRadius: 9, marginBottom: 7,
                  cursor: 'pointer', transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.05)'}
                onMouseLeave={e => e.currentTarget.style.background = '#0f2038'}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: a.iconBg, color: a.iconColor,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 13,
                  flexShrink: 0, marginTop: 1,
                }}>{a.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500,
                    color: '#e2e8f0', marginBottom: 3 }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8',
                    lineHeight: 1.4 }}>{a.detail}</div>
                  <div style={{ fontSize: 10, color: '#475569',
                    marginTop: 3 }}>{a.time}</div>
                </div>
                <Badge variant={a.badgeV} style={{ flexShrink: 0 }}>{a.badge}</Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Summary */}
          <Card>
            <STitle>Alert summary — last 24h</STitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[
                { val: '12', label: 'Critical', color: '#f87171' },
                { val: '31', label: 'High',     color: '#fbbf24' },
                { val: '18', label: 'Forecast', color: '#93c5fd' },
                { val: '537', label: 'SLA breach', color: '#f87171' },
              ].map(k => (
                <div key={k.label} style={{
                  textAlign: 'center', background: '#0f2038',
                  borderRadius: 8, padding: '10px 6px',
                  border: '0.5px solid rgba(99,179,237,.13)',
                }}>
                  <div style={{ fontSize: 20, fontWeight: 500, color: k.color }}>{k.val}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{k.label}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* SLA table */}
          <Card>
            <STitle>SLA performance — every event type</STitle>
            {SLA_TABLE.map(r => (
              <div key={r.cause} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center',
                padding: '7px 0',
                borderBottom: '0.5px solid rgba(255,255,255,.05)',
                fontSize: 11,
              }}>
                <span style={{
                  color: r.critical ? '#e2e8f0' : '#94a3b8',
                  fontWeight: r.critical ? 500 : 400,
                }}>{r.cause}</span>
                <span style={{
                  color: slaColor(r.status),
                  fontWeight: r.critical ? 500 : 400,
                }}>
                  {r.hours}h · {slaIcon(r.status)} vs {r.sla}h SLA
                  {r.critical && <span style={{ color: '#f87171' }}> ←</span>}
                </span>
              </div>
            ))}
          </Card>

          {/* Volume */}
          <Card>
            <STitle>Alert volume by event type</STitle>
            {ALERT_VOLUME.map(v => (
              <BarRow key={v.label} label={v.label} value={v.val}
                max={4896} color={v.color}
                displayValue={v.displayValue || v.val.toLocaleString()} />
            ))}
          </Card>
        </div>
      </Grid>
    </div>
  )
}
