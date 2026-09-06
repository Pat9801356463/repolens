import React from 'react'
import { Card, STitle, Badge, BarRow, Grid, Divider, InfoBox, StatTile } from '../components/UI'
import { OFFICER_DEPLOYMENT, VEHICLE_BREAKDOWNS, HOT_JUNCTIONS } from '../data/astramData'

const BARRICADES = [
  { location: 'Chinnaswamy 400m perimeter', count: '24 barricades', badge: 'red',  reason: 'Primary crowd containment ring' },
  { location: 'MG Road / Brigade Rd junction', count: '8 barricades', badge: 'warn', reason: 'Choke point — 3 approach lanes converge' },
  { location: 'Cubbon Park bypass',         count: '6 barricades', badge: 'warn', reason: 'Exit route overflow prevention' },
  { location: 'Ulsoor Lake access points',  count: '4 barricades', badge: 'blue', reason: 'Secondary overflow control' },
  { location: 'Emergency vehicle corridors',count: 'CLEAR LANES',  badge: 'green',reason: 'Minimum 3.5m clearance maintained' },
]

const IP_CONSTRAINTS = [
  'Total available officers: 133',
  'Min coverage per active-event zone: 1 officer / 5 events',
  'High-priority zones: 2× coverage multiplier',
  'Emergency reserve: ≥ 10 officers held back',
  'Peak hour shift overlap: 30-min handover window',
]

export default function ResourcePlanner({ onCopilotPrompt }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <Grid cols={2} gap={12}>

        {/* Officer deployment */}
        <Card>
          <STitle>
            <Badge variant="cyan" style={{ marginRight: 6 }}>AI OPTIMIZER</Badge>
            Smart officer deployment — Integer Programming + RL
          </STitle>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14, lineHeight: 1.5 }}>
            Deployment optimized by zone risk, event load, and time-of-day pattern.
            <span style={{ color: '#34d399', fontWeight: 500 }}> 31% more efficient</span> than manual allocation.
          </div>

          {/* Officer zones */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
            {OFFICER_DEPLOYMENT.map(z => (
              <div key={z.zone}
                onClick={() => onCopilotPrompt(`Why does ${z.zone} need ${z.officers} officers? Detail the reasoning.`)}
                style={{ background: '#0f2038', borderRadius: 9, padding: 12,
                  textAlign: 'center', border: '0.5px solid rgba(99,179,237,0.13)',
                  cursor: 'pointer', transition: 'border-color .15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,179,237,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(99,179,237,0.13)'}>
                <div style={{ fontSize: 22, fontWeight: 500, color: z.color }}>{z.officers}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{z.zone}</div>
                <div style={{ fontSize: 10, color: '#06b6d4', marginTop: 3 }}>{z.peak}</div>
              </div>
            ))}
          </div>

          <InfoBox type="success">
            Total: <strong>92 officers</strong> · Manual estimate: 133 ·
            <strong> 41 officers freed</strong> for emergency reserve ·
            BMTC route corridors pre-covered
          </InfoBox>

          <Divider />

          {/* XAI for IP */}
          <STitle style={{ fontSize: 11, marginBottom: 8 }}>
            <Badge variant="purple" style={{ marginRight: 5 }}>XAI</Badge>
            Optimization model — constraints and objective
          </STitle>
          <div style={{ background: '#0f2038', borderRadius: 8, padding: 11,
            border: '0.5px solid rgba(139,92,246,.2)' }}>
            <div style={{ fontSize: 10, color: '#c4b5fd', fontWeight: 500, marginBottom: 6 }}>
              Objective: Minimize total officer-hours while maintaining zone coverage SLA
            </div>
            {IP_CONSTRAINTS.map((c, i) => (
              <div key={i} style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.7,
                display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <span style={{ color: '#475569' }}>→</span> {c}
              </div>
            ))}
            <div style={{ fontSize: 10, color: '#34d399', fontWeight: 500, marginTop: 8 }}>
              Result: South Zone 2 = 24 (event density 114/5 = 22.8 → rounded up, 2× multiplier for High priority)
            </div>
          </div>
        </Card>

        {/* Barricade plan */}
        <Card>
          <STitle>
            <Badge variant="cyan" style={{ marginRight: 6 }}>AI BARRICADE</Badge>
            Intelligent barricade plan — IPL match day
          </STitle>
          {BARRICADES.map(b => (
            <div key={b.location} style={{ display: 'flex', alignItems: 'flex-start',
              justifyContent: 'space-between', padding: '8px 0',
              borderBottom: '0.5px solid rgba(255,255,255,.05)', gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#e2e8f0' }}>{b.location}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{b.reason}</div>
              </div>
              <Badge variant={b.badge}>{b.count}</Badge>
            </div>
          ))}

          <Divider />
          <STitle style={{ fontSize: 11 }}>Vehicle breakdown profile — BMTC dominant</STitle>
          {VEHICLE_BREAKDOWNS.map(v => (
            <BarRow key={v.type} label={v.type} value={v.count}
              max={1466} color={v.color} />
          ))}

          <Divider />
          <STitle style={{ fontSize: 11 }}>Top 5 hot junctions</STitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
            {HOT_JUNCTIONS.slice(0, 5).map(j => (
              <div key={j.name}
                onClick={() => onCopilotPrompt(`${j.name} has ${j.count} incidents — causes and permanent deployment plan?`)}
                style={{ background: '#0f2038', borderRadius: 8, padding: 8,
                  textAlign: 'center', border: `0.5px solid ${j.count > 50 ? 'rgba(239,68,68,.25)' : 'rgba(245,158,11,.2)'}`,
                  cursor: 'pointer' }}>
                <div style={{ fontSize: 18, fontWeight: 500,
                  color: j.count > 50 ? '#f87171' : '#fbbf24' }}>{j.count}</div>
                <div style={{ fontSize: 9, color: '#475569', marginTop: 3 }}>
                  {j.name.split(' ').slice(0, 2).join(' ')}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Grid>
    </div>
  )
}
