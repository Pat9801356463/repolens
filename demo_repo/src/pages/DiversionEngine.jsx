import React, { useState } from 'react'
import { Card, STitle, Badge, BarRow, Grid, Divider, InfoBox } from '../components/UI'
import { DIVERSION_ROUTES, MONTHLY_EVENTS } from '../data/astramData'

export default function DiversionEngine() {
  const [selected, setSelected] = useState('A')
  const maxMonth = 1931

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <Grid cols={2} gap={12}>

        {/* Routes */}
        <Card>
          <STitle>
            <Badge variant="cyan" style={{ marginRight: 6 }}>AI ROUTING</Badge>
            Diversion engine — IPL match day
          </STitle>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
            Origin: Mysore Road west entry → Chinnaswamy Stadium · AI-ranked alternatives
          </div>

          {DIVERSION_ROUTES.map(r => {
            const isSel = selected === r.id
            const bdrColor = r.id === 'A' ? 'rgba(16,185,129,.3)' : r.id === 'B' ? 'rgba(245,158,11,.3)' : 'rgba(239,68,68,.3)'
            const bgColor  = r.id === 'A' ? 'rgba(16,185,129,.06)' : r.id === 'B' ? 'rgba(245,158,11,.06)' : 'rgba(239,68,68,.06)'
            return (
              <div key={r.id} onClick={() => setSelected(r.id)}
                style={{
                  background: isSel ? bgColor : '#0f2038',
                  borderRadius: 9, padding: 12,
                  border: `0.5px solid ${isSel ? bdrColor : 'rgba(99,179,237,.13)'}`,
                  cursor: 'pointer', marginBottom: 9, transition: 'all .15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 7 }}>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>
                    {r.id === 'A' && <span style={{ color: '#34d399' }}>★ </span>}
                    Route {r.id}: {r.name}
                  </span>
                  <Badge variant={r.id === 'A' ? 'green' : r.id === 'B' ? 'warn' : 'red'}>
                    {r.id === 'A' ? 'Recommended' : r.id === 'B' ? 'Medium' : 'Avoid'}
                  </Badge>
                </div>
                <div style={{ display: 'flex', gap: 14 }}>
                  {[
                    { label: 'Travel', val: r.travelTime },
                    { label: 'vs baseline', val: r.vsDelta, color: r.color },
                    { label: 'Congestion', val: r.congestionLevel },
                    { label: 'Emergency', val: r.emergencyAccess ? '✓' : '✗',
                      color: r.emergencyAccess ? '#34d399' : '#f87171' },
                  ].map(s => (
                    <div key={s.label} style={{ fontSize: 10, color: '#94a3b8' }}>
                      {s.label}: <span style={{ color: s.color || '#e2e8f0', fontWeight: 500 }}>{s.val}</span>
                    </div>
                  ))}
                </div>
                <div style={{ height: 5, borderRadius: 3,
                  background: 'rgba(255,255,255,.07)', overflow: 'hidden', marginTop: 8 }}>
                  <div style={{ width: `${r.loadAfter}%`, height: '100%',
                    borderRadius: 3, background: r.color }} />
                </div>
              </div>
            )
          })}
        </Card>

        {/* Redistribution impact */}
        <Card>
          <STitle>Traffic redistribution impact</STitle>

          {[
            { label: 'Mysore Road (before diversion)', pct: 92, color: '#ef4444', note: '92% load — overloaded' },
            { label: 'Mysore Road (after Route A)',    pct: 58, color: '#10b981', note: '58% load — recovered' },
            { label: 'Bellary Rd 1 (absorbs traffic)',pct: 74, color: '#f59e0b', note: '74% load — within capacity' },
          ].map(b => (
            <div key={b.label} style={{ marginBottom: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: 11, marginBottom: 5 }}>
                <span style={{ color: '#94a3b8' }}>{b.label}</span>
                <span style={{ color: b.color }}>{b.note}</span>
              </div>
              <div style={{ height: 7, borderRadius: 4,
                background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
                <div style={{ width: `${b.pct}%`, height: '100%',
                  borderRadius: 4, background: b.color, transition: 'width .5s' }} />
              </div>
            </div>
          ))}

          <Divider />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { val: '−34%', label: 'Congestion', color: '#34d399' },
              { val: '−34 min', label: 'Delay saved', color: '#34d399' },
              { val: '+28%', label: 'Throughput', color: '#34d399' },
              { val: '✓', label: 'Emergency clear', color: '#34d399' },
            ].map(k => (
              <div key={k.label} style={{ textAlign: 'center', background: 'rgba(16,185,129,.08)',
                borderRadius: 8, padding: '10px 6px', border: '0.5px solid rgba(16,185,129,.18)' }}>
                <div style={{ fontSize: 16, fontWeight: 500, color: k.color }}>{k.val}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{k.label}</div>
              </div>
            ))}
          </div>

          <Divider />
          <STitle style={{ fontSize: 11 }}>Monthly event load trend</STitle>
          {MONTHLY_EVENTS.map(m => (
            <BarRow key={m.month} label={m.month} value={m.count}
              max={maxMonth} color="#8b5cf6" />
          ))}
        </Card>
      </Grid>
    </div>
  )
}
