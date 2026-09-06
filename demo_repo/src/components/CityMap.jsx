import React from 'react'

const HOTSPOTS = [
  { cx: 88,  cy: 130, r: [22,13,5], fill: '#ef4444', label: 'Mysore Road',  sub: '743 events',  prompt: 'Mysore Road has 743 events — top causes, officer deployment, and diversion plan?' },
  { cx: 175, cy: 38,  r: [17,9,4],  fill: '#ef4444', label: 'Bellary Rd 1', sub: '610 events',  prompt: 'Bellary Road 1 has 610 events and most accident hotspots — full analysis and plan?' },
  { cx: 48,  cy: 80,  r: [13,7,3],  fill: '#f59e0b', label: 'Tumkur Rd',    sub: '458 events',  prompt: 'Tumkur Road peak hours and top causes analysis?' },
  { cx: 258, cy: 88,  r: [12,6,3],  fill: '#8b5cf6', label: 'ORR East 2',   sub: 'Construction',prompt: 'ORR East 2 construction — 102 events, 49h avg closure, diversion plan?' },
  { cx: 205, cy: 153, r: [7,3,2],   fill: '#ef4444', label: 'Silk Board',   sub: '33 incidents',prompt: 'Silk Board junction — 33 incidents, causes and permanent fix?' },
  { cx: 155, cy: 72,  r: [8,3.5,2], fill: '#ef4444', label: 'Mekhri Cir.', sub: '64 incidents', prompt: 'Mekhri Circle has 64 incidents — causes and permanent deployment plan?' },
  { cx: 230, cy: 162, r: [10,5,2.5],fill: '#f59e0b', label: 'Hosur Rd',    sub: '213 events',  prompt: 'Hosur Road events and peak hour analysis?' },
]

export default function CityMap({ onHotspotClick }) {
  return (
    <div style={{ background: '#0f2038', borderRadius: 9,
      border: '0.5px solid rgba(99,179,237,0.13)', overflow: 'hidden' }}>
      <svg width="100%" viewBox="0 0 340 215" style={{ display: 'block' }}>
        <rect width="340" height="215" fill="#0a1628" />

        {/* Road grid */}
        <g stroke="rgba(99,179,237,0.09)" strokeWidth="0.5" fill="none">
          {[55,95,135,175].map(y => <line key={y} x1="0" y1={y} x2="340" y2={y+20} />)}
          {[45,95,148,200,252,300].map(x => <line key={x} x1={x} y1="0" x2={x-10} y2="215" />)}
        </g>

        {/* ORR ring */}
        <ellipse cx="170" cy="107" rx="128" ry="80"
          fill="none" stroke="rgba(99,179,237,0.14)"
          strokeWidth="1" strokeDasharray="4 3" />

        {/* Hotspots */}
        {HOTSPOTS.map((h, i) => (
          <g key={i} style={{ cursor: 'pointer' }}
            onClick={() => onHotspotClick(h.prompt)}>
            <circle cx={h.cx} cy={h.cy} r={h.r[0]}
              fill={h.fill} opacity="0.18" />
            <circle cx={h.cx} cy={h.cy} r={h.r[1]}
              fill={h.fill} opacity="0.38" />
            <circle cx={h.cx} cy={h.cy} r={h.r[2]}
              fill={h.fill} />
            <text x={h.cx} y={h.cy + h.r[0] + 10}
              textAnchor="middle" fontSize="7.5"
              fill="#94a3b8" fontFamily="inherit">{h.label}</text>
            {h.sub && (
              <text x={h.cx} y={h.cy + h.r[0] + 19}
                textAnchor="middle" fontSize="6.5"
                fill="#64748b" fontFamily="inherit">{h.sub}</text>
            )}
          </g>
        ))}

        {/* Legend */}
        <g fontFamily="inherit">
          {[
            { cx: 12, label: 'High risk',    fill: '#ef4444' },
            { cx: 65, label: 'Medium',       fill: '#f59e0b' },
            { cx: 112, label: 'Construction', fill: '#8b5cf6' },
          ].map(l => (
            <g key={l.label}>
              <circle cx={l.cx} cy="202" r="4" fill={l.fill} opacity=".5" />
              <text x={l.cx + 7} y="206" fontSize="7.5" fill="#64748b">{l.label}</text>
            </g>
          ))}
        </g>
      </svg>
      <div style={{ fontSize: 10, color: '#475569', padding: '6px 10px' }}>
        Click any hotspot for AI analysis and intervention plan
      </div>
    </div>
  )
}
