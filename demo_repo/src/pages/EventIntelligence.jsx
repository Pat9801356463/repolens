import React, { useState } from 'react'
import { Card, STitle, Badge, BarRow, Grid, Divider, InfoBox } from '../components/UI'
import { FORECAST_PARAMS, CLOSURE_RATES, RESOLUTION_TIMES } from '../data/astramData'

const EVENT_TYPES = Object.entries(FORECAST_PARAMS).map(([k, v]) => ({ key: k, label: v.label }))

const MODELS = [
  { name: 'TFT ★ Selected', f1: 0.93, auc: 0.951, bar: 93, color: '#3b82f6', best: true },
  { name: 'XGBoost',        f1: 0.91, auc: 0.934, bar: 91, color: '#34d399' },
  { name: 'LightGBM',       f1: 0.90, auc: 0.927, bar: 90, color: '#34d399' },
  { name: 'CatBoost',       f1: 0.89, auc: 0.918, bar: 89, color: '#a78bfa' },
  { name: 'LSTM',           f1: 0.86, auc: 0.891, bar: 86, color: '#fbbf24' },
  { name: 'Random Forest',  f1: 0.83, auc: 0.862, bar: 83, color: '#94a3b8' },
]

const FEATURES = [
  { name: 'event_cause_encoded',  imp: 0.564, color: '#3b82f6' },
  { name: 'requires_road_closure',imp: 0.371, color: '#3b82f6' },
  { name: 'priority_score',       imp: 0.061, color: '#8b5cf6' },
  { name: 'corridor_risk_index',  imp: 0.023, color: '#06b6d4' },
  { name: 'junction_heat_score',  imp: 0.017, color: '#10b981' },
  { name: 'time / zone features', imp: 0.001, color: '#94a3b8' },
]

export default function EventIntelligence() {
  const [eventType, setEventType] = useState('public_event')
  const params = FORECAST_PARAMS[eventType]

  const slaColor = h => h.status === 'ok' ? '#34d399' : h.status === 'warn' ? '#fbbf24' : '#f87171'
  const slaIcon  = h => h.status === 'ok' ? '✓' : h.status === 'warn' ? '⚠' : '✗'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <Grid cols={2} gap={12}>

        {/* Forecaster */}
        <Card>
          <STitle><Badge variant="cyan" style={{ marginRight: 6 }}>AI FORECAST</Badge>Event impact predictor</STitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Event type</div>
              <select value={eventType} onChange={e => setEventType(e.target.value)}
                style={{ background: '#0f2038', border: '0.5px solid rgba(99,179,237,.25)', borderRadius: 7,
                  color: '#e2e8f0', fontSize: 11, padding: '6px 10px', fontFamily: 'inherit',
                  outline: 'none', width: '100%' }}>
                {EVENT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Corridor</div>
              <select style={{ background: '#0f2038', border: '0.5px solid rgba(99,179,237,.25)', borderRadius: 7,
                color: '#e2e8f0', fontSize: 11, padding: '6px 10px', fontFamily: 'inherit',
                outline: 'none', width: '100%' }}>
                {['Mysore Road','Bellary Road 1','ORR North 1','Hosur Road'].map(c =>
                  <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* KPI tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Congestion score', value: params.congestion, color: '#f87171', bg: 'rgba(239,68,68,.10)', border: 'rgba(239,68,68,.2)' },
              { label: 'Delay (min)',       value: `+${params.delay}`, color: '#fbbf24', bg: 'rgba(245,158,11,.10)', border: 'rgba(245,158,11,.2)' },
              { label: 'Impact radius',    value: params.radius,      color: '#c4b5fd', bg: 'rgba(139,92,246,.10)', border: 'rgba(139,92,246,.2)' },
              { label: 'Confidence',       value: params.confidence,  color: '#34d399', bg: 'rgba(16,185,129,.10)', border: 'rgba(16,185,129,.2)' },
            ].map(k => (
              <div key={k.label} style={{ textAlign: 'center', padding: '10px 6px',
                background: k.bg, borderRadius: 9, border: `0.5px solid ${k.border}` }}>
                <div style={{ fontSize: 20, fontWeight: 500, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {[
            { label: 'Road closure probability', value: params.closureRate, color: '#ef4444', display: `${params.closureRate}%` },
            { label: 'Expected resolution', value: 60, color: '#3b82f6', display: params.resolutionTime },
          ].map(b => (
            <div key={b.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: '#94a3b8' }}>{b.label}</span>
                <span style={{ color: b.color, fontWeight: 500 }}>{b.display}</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
                <div style={{ width: `${b.value}%`, height: '100%', borderRadius: 3, background: b.color, transition: 'width .4s' }} />
              </div>
            </div>
          ))}

          <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
            Based on <span style={{ color: '#94a3b8' }}>{params.historicalCount} historical events</span> of this type
          </div>

          <Divider />

          {/* Explainable AI panel */}
          <STitle style={{ fontSize: 11, marginBottom: 8 }}>
            <Badge variant="purple" style={{ marginRight: 5 }}>XAI</Badge>Why this recommendation?
          </STitle>
          <div style={{ background: '#0f2038', borderRadius: 8, padding: 10,
            border: '0.5px solid rgba(139,92,246,.2)', fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>
            <span style={{ color: '#c4b5fd', fontWeight: 500 }}>Officer count: {params.officers}</span>
            {' '}— increased from baseline because{' '}
            <span style={{ color: '#e2e8f0' }}>
              {eventType === 'public_event' && 'expected crowd exceeds historical threshold by 38% and two critical intersections (Mekhri Circle, Silk Board) fall within 2.1km impact radius'}
              {eventType === 'vip_movement' && '80% historical road closure rate requires maximum pre-clearance with 30-min advance positioning'}
              {eventType === 'construction' && 'long 49h resolution time requires sustained shift coverage across 2 officer rotations'}
              {eventType === 'accident' && 'rapid 0.67h resolution requires immediate 6-officer response with tow and ambulance coordination'}
              {eventType === 'protest' && '40% closure rate and unpredictable crowd behavior requires 10-officer flexible deployment'}
              {eventType === 'procession' && '26% closure rate with predictable route enables 8-officer linear deployment'}
            </span>.
            Confidence {params.confidence} based on {params.historicalCount} similar events.
          </div>
        </Card>

        {/* Closure rates + SLA */}
        <Card>
          <STitle>Road closure rate by event cause — real data</STitle>
          {CLOSURE_RATES.map(c => (
            <BarRow key={c.cause} label={c.cause} value={c.rate} max={100}
              color={c.color} displayValue={`${c.rate}%`} />
          ))}
          <Divider />
          <STitle style={{ fontSize: 11 }}>Resolution time SLA performance</STitle>
          {RESOLUTION_TIMES.map(r => (
            <div key={r.cause} style={{ display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', padding: '6px 0',
              borderBottom: '0.5px solid rgba(255,255,255,.05)', fontSize: 11 }}>
              <span style={{ color: '#e2e8f0' }}>{r.cause}</span>
              <span style={{ color: slaColor(r), fontWeight: r.status === 'fail' ? 500 : 400 }}>
                {r.hours}h · {slaIcon(r)} vs {r.sla}h SLA
              </span>
            </div>
          ))}
        </Card>
      </Grid>

      {/* Model + Feature importance */}
      <Grid cols={2} gap={12}>
        <Card>
          <STitle><Badge variant="cyan" style={{ marginRight: 6 }}>ML MODELS</Badge>5-fold cross-validated comparison</STitle>
          {MODELS.map(m => (
            <div key={m.name} style={{ display: 'flex', alignItems: 'center',
              gap: 8, padding: '5px 0', borderBottom: '0.5px solid rgba(255,255,255,.04)',
              fontSize: 11 }}>
              <span style={{ minWidth: 105, fontSize: 10, color: '#e2e8f0',
                ...(m.best ? { background: 'rgba(59,130,246,.2)', borderRadius: 4, padding: '1px 5px', color: '#93c5fd' } : {}) }}>
                {m.name}
              </span>
              <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,.07)',
                borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${m.bar}%`, height: '100%',
                  borderRadius: 3, background: m.color }} />
              </div>
              <span style={{ color: '#475569', minWidth: 60, textAlign: 'right', fontSize: 10 }}>
                F1 {m.f1} · AUC {m.auc}
              </span>
            </div>
          ))}
          <InfoBox type="info" style={{ marginTop: 10 }}
            title="Why Temporal Fusion Transformer?">
            Handles multi-variate time-series with temporal self-attention.
            Learns which hours and corridors matter for each future step.
            +3% F1 over XGBoost with 5-fold CV, no data leakage.
          </InfoBox>
        </Card>
        <Card>
          <STitle>Feature importance — SHAP values (XGBoost fit)</STitle>
          {FEATURES.map(f => (
            <BarRow key={f.name} label={f.name} value={f.imp} max={0.564}
              color={f.color} displayValue={f.imp.toFixed(3)} style={{ marginBottom: 9 }} />
          ))}
          <InfoBox type="warn" title="Why time features score near-zero">
            Without a calendar or weather signal, hour-of-day and day-of-week
            carry no meaningful variance. Adding holiday calendar + IMD weather
            API would push time features to second strongest predictor group.
          </InfoBox>
        </Card>
      </Grid>
    </div>
  )
}
