import React from 'react'
import { HOURLY_EVENTS } from '../data/astramData'

const MAX = 810

function getColor(val) {
  const p = val / MAX
  if (p > 0.7) return '#ef4444'
  if (p > 0.5) return '#f59e0b'
  if (p > 0.3) return '#3b82f6'
  if (p > 0.1) return '#1e3a5f'
  return 'rgba(255,255,255,0.04)'
}

export default function HeatmapRow() {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>
        Events per hour across 8,173 records
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 2 }}>
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            title={`${h}:00 — ${HOURLY_EVENTS[h]} events`}
            style={{
              height: 14, borderRadius: 2,
              background: getColor(HOURLY_EVENTS[h]),
              cursor: 'pointer', transition: 'opacity .15s',
            }}
            onMouseEnter={e => e.target.style.opacity = '.65'}
            onMouseLeave={e => e.target.style.opacity = '1'}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        fontSize: 9, color: '#475569', marginTop: 3, marginBottom: 10 }}>
        <span>00:00</span><span>06:00</span>
        <span>12:00</span><span>18:00</span><span>23:00</span>
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
        <span style={{ color: '#fbbf24', fontWeight: 500 }}>Peak: 21:00</span>
        {' '}— 810 events ·{' '}
        <span style={{ color: '#34d399', fontWeight: 500 }}>Quietest: 15:00</span>
        {' '}— 9 events
        <br />
        <span style={{ color: '#93c5fd' }}>Bimodal pattern:</span>
        {' '}night spike 20–22h + early morning 4–6h
      </div>
    </div>
  )
}
