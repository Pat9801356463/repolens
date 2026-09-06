import React from 'react'

const SCREENS = [
  { id: 's1',  label: 'Command'        },
  { id: 's2',  label: 'Event Intel'    },
  { id: 's3',  label: 'Resources'      },
  { id: 's4',  label: 'Diversion'      },
  { id: 's5',  label: 'Digital Twin'   },
  { id: 's6',  label: 'AI Copilot'     },
  { id: 's7',  label: 'War Room'       },
  { id: 's8',  label: 'Model Accuracy' },
  { id: 's9',  label: 'Alert Feed'     },
  { id: 's10', label: 'Learning'       },
]

export default function TopBar({ active, onNav }) {
  return (
    <div style={{
      background: '#0c1a2e',
      borderBottom: '1px solid rgba(99,179,237,0.13)',
      padding: '0 18px',
      display: 'flex', alignItems: 'center', gap: 8,
      height: 46, flexShrink: 0,
    }}>
      {/* Logo */}
      <span style={{ fontSize: 13, fontWeight: 500, color: '#06b6d4',
        letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
        ASTRAM <span style={{ color: '#e2e8f0', fontWeight: 500 }}>COMMAND IQ</span>
        <span style={{ fontSize: 9, color: '#475569', marginLeft: 5 }}>v3.1</span>
      </span>

      {/* Nav */}
      <nav style={{ display: 'flex', gap: 2, marginLeft: 8,
        overflowX: 'auto', flex: 1 }}>
        {SCREENS.map(({ id, label }) => {
          const on = active === id
          return (
            <button key={id} onClick={() => onNav(id)}
              style={{
                background: on ? 'rgba(59,130,246,.18)' : 'none',
                border: 'none',
                color: on ? '#93c5fd' : '#94a3b8',
                fontSize: 11, padding: '5px 10px', borderRadius: 6,
                cursor: 'pointer', whiteSpace: 'nowrap',
                letterSpacing: '.01em', transition: 'all .15s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => { if (!on) { e.target.style.background = 'rgba(255,255,255,.06)'; e.target.style.color = '#e2e8f0' } }}
              onMouseLeave={e => { if (!on) { e.target.style.background = 'none'; e.target.style.color = '#94a3b8' } }}
            >
              {label}
            </button>
          )
        })}
      </nav>

      {/* Status pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7,
        flexShrink: 0, marginLeft: 8 }}>
        <Pill color="rgba(239,68,68,.18)" text="rgba(248,113,113,1)" border="rgba(239,68,68,.3)">1,007 Active</Pill>
        <Pill color="rgba(245,158,11,.18)" text="rgba(251,191,36,1)"  border="rgba(245,158,11,.3)">676 Closures</Pill>
        <Pill color="rgba(16,185,129,.18)"  text="rgba(52,211,153,1)"  border="rgba(16,185,129,.3)">● Live</Pill>
      </div>
    </div>
  )
}

function Pill({ color, text, border, children }) {
  return (
    <span style={{
      fontSize: 10, padding: '3px 8px', borderRadius: 99, fontWeight: 500,
      whiteSpace: 'nowrap', background: color, color: text,
      border: `0.5px solid ${border}`,
    }}>
      {children}
    </span>
  )
}
