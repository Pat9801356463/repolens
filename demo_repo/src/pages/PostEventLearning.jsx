import React from 'react'
import { Card, STitle, Badge, BarRow, Grid, Divider, InfoBox } from '../components/UI'

const LEARNING_STEPS = [
  {
    n: '1', badge: 'green', badgeLabel: 'Auto',
    title: 'Event closes → ground truth captured',
    desc: 'Actual road closure, resolution time, and officer count stored in TimescaleDB with event_id key. Triggered within 500ms of status change to "closed".',
  },
  {
    n: '2', badge: 'blue', badgeLabel: 'Compute',
    title: 'Predicted vs actual comparison',
    desc: 'Congestion score delta, delay MAE, and closure accuracy computed per event. Error logged to error_log table with corridor + event_type breakdown.',
  },
  {
    n: '3', badge: 'purple', badgeLabel: 'ML',
    title: 'Error pattern detection',
    desc: 'Model identifies corridors and event types with highest prediction error. Feature engineering flag triggered for those segments automatically.',
  },
  {
    n: '4', badge: 'blue', badgeLabel: 'MLflow',
    title: 'Weekly auto-retrain via MLflow',
    desc: 'New model promoted if 5-fold CV score improves >0.5% over current production model. Old model archived with full metadata. Rollback in one click.',
  },
  {
    n: '5', badge: 'warn', badgeLabel: 'Calibrate',
    title: 'Resource allocation calibration',
    desc: 'If actual officers needed > predicted for a cause + zone pair, the IP optimizer increases the allocation multiplier for that combination.',
  },
]

const PERF_HISTORY = [
  { label: 'Week 1 (baseline)',    f1: 0.65, color: '#94a3b8' },
  { label: 'Week 4 (retrain 1)',   f1: 0.75, color: '#60a5fa' },
  { label: 'Week 8 (retrain 2)',   f1: 0.83, color: '#34d399' },
  { label: 'Week 12 (current)',    f1: 0.91, color: '#10b981' },
]

const PREDICTIONS = [
  { event: 'IPL Match (past)',     pred: '+32 min', actual: '+38 min', error: '+19%',   ok: false },
  { event: 'BMTC Breakdown Mek.', pred: '0.7h',    actual: '0.6h',    error: '−14%',   ok: true  },
  { event: 'VIP — Bellary Rd',    pred: 'Closure YES', actual: 'Closure YES', error: '✓ Correct', ok: true },
  { event: 'Water Logging Mys.',  pred: '48h res.', actual: '61h res.', error: '+27%',  ok: false },
  { event: 'Pot Hole ORR N1',     pred: '72h res.', actual: '217h res.',error: '+201% ✗', ok: false, critical: true },
  { event: 'Construction ORR E2', pred: '52h',     actual: '49h',      error: '−6%',   ok: true  },
]

const LEARNINGS = [
  {
    color: '#ef4444',
    title: 'Pot hole resolution is a systemic failure',
    desc: '537 events at 217h median — PWD integration missing. Auto-escalation rule added: any pot hole event >72h triggers commissioner-level alert automatically via the platform.',
  },
  {
    color: '#8b5cf6',
    title: 'BMTC breakdowns are predictable by corridor',
    desc: '1,466 BMTC events concentrated on Mysore Rd + Bellary Rd. Fleet age is the strongest predictor (95% null in dataset). BMTC registry integration queued as V1 priority.',
  },
  {
    color: '#3b82f6',
    title: 'Bimodal peak needs two separate models',
    desc: '21:00 peak (return traffic + events) and 05:00 peak (interstate trucks + early BMTC) have fundamentally different causes. Single model was underperforming. Two hour-band models now deployed.',
  },
  {
    color: '#10b981',
    title: 'VIP movement is the highest-precision predictable event',
    desc: '80% closure rate across 20 historical events. Prediction accuracy: 94%. Pre-clearance protocol achieves +5 min civilian delay vs +28 min reactive. Model confidence highest for this cause.',
  },
]

export default function PostEventLearning() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <Grid cols={2} gap={12}>

        {/* Learning loop */}
        <Card>
          <STitle>
            <Badge variant="cyan" style={{ marginRight: 6 }}>SELF-LEARNING</Badge>
            Post-event learning loop
          </STitle>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14, lineHeight: 1.5 }}>
            System automatically captures prediction vs actual after each event closes.
            Weekly model retrain cycle via MLflow. No developer intervention required.
          </div>

          {LEARNING_STEPS.map((s, i) => (
            <div key={s.n} style={{
              display: 'flex', gap: 10, padding: '9px 0',
              borderBottom: i < LEARNING_STEPS.length - 1
                ? '0.5px solid rgba(255,255,255,.05)' : 'none',
              alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#3b82f6',
                minWidth: 20, marginTop: 1 }}>{s.n}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#e2e8f0',
                  marginBottom: 3 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>{s.desc}</div>
              </div>
              <Badge variant={s.badge} style={{ flexShrink: 0 }}>{s.badgeLabel}</Badge>
            </div>
          ))}

          <Divider />

          <STitle style={{ fontSize: 11 }}>Model F1 improvement over time</STitle>
          {PERF_HISTORY.map(p => (
            <BarRow key={p.label} label={p.label} value={p.f1} max={1}
              color={p.color} displayValue={`F1 ${p.f1}`} />
          ))}
          <div style={{
            background: 'rgba(16,185,129,.07)', borderRadius: 9,
            padding: '9px 11px', border: '0.5px solid rgba(16,185,129,.2)',
            marginTop: 10,
          }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#34d399' }}>
              +40% F1 improvement over 12 weeks — continuously self-improving
            </div>
          </div>
        </Card>

        {/* Prediction vs actual + learnings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card>
            <STitle>Prediction vs actual — recent events</STitle>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '140px 1fr 1fr 1fr',
              gap: 8, padding: '5px 0',
              borderBottom: '0.5px solid rgba(255,255,255,.1)',
              fontSize: 10, color: '#475569',
              textTransform: 'uppercase', letterSpacing: '.05em',
            }}>
              <span>Event</span><span>Predicted</span>
              <span>Actual</span><span>Error</span>
            </div>
            {PREDICTIONS.map((r, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '140px 1fr 1fr 1fr',
                gap: 8, padding: '7px 0',
                borderBottom: '0.5px solid rgba(255,255,255,.04)',
                fontSize: 11, alignItems: 'center',
              }}>
                <span style={{ color: '#94a3b8', fontSize: 10 }}>{r.event}</span>
                <span style={{ color: '#e2e8f0' }}>{r.pred}</span>
                <span style={{ color: '#e2e8f0' }}>{r.actual}</span>
                <span style={{
                  color: r.critical ? '#f87171'
                    : r.ok ? '#34d399' : '#fbbf24',
                  fontWeight: r.critical ? 500 : 400,
                }}>{r.error}</span>
              </div>
            ))}
          </Card>

          <Card>
            <STitle>Systemic learnings — auto-generated from dataset</STitle>
            {LEARNINGS.map(l => (
              <div key={l.title} style={{
                display: 'flex', gap: 9, padding: '8px 0',
                borderBottom: '0.5px solid rgba(255,255,255,.05)',
                alignItems: 'flex-start',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: l.color, flexShrink: 0, marginTop: 4,
                }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500,
                    color: '#e2e8f0' }}>{l.title}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8',
                    marginTop: 2, lineHeight: 1.5 }}>{l.desc}</div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </Grid>
    </div>
  )
}
