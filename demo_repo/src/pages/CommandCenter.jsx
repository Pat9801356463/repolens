import React from 'react'
import { Card, STitle, KPI, BarRow, EventItem, Grid, Divider } from '../components/UI'
import CityMap from '../components/CityMap'
import HeatmapRow from '../components/HeatmapRow'
import { DATASET_STATS, ZONE_ACTIVE, CORRIDORS, EVENT_CAUSES } from '../data/astramData'

const maxZone = 114

export default function CommandCenter({ onNav, onCopilotPrompt }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>

      {/* KPI row */}
      <Grid cols={4} gap={10}>
        {[
          { label: 'Total Events (6 months)', value: '8,173', sub: 'Nov 2023 – Apr 2024 · Bengaluru', delta: '↑ 12% vs previous period', dc: '#f87171' },
          { label: 'Active Right Now',        value: '1,007', sub: '12.3% of all events', delta: 'South Zone 2 critical — 114', dc: '#f87171', vc: '#f87171' },
          { label: 'High Priority',           value: '5,030', sub: '61.5% · XGBoost F1 = 0.999', delta: 'Predicted with 99.8% accuracy', dc: '#fbbf24', vc: '#fbbf24' },
          { label: 'Pot Hole SLA Breach',     value: '537',   sub: '217h median vs 72h SLA target', delta: 'Systemic failure — escalated', dc: '#f87171', vc: '#f87171' },
        ].map(k => (
          <Card key={k.label}>
            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase',
              letterSpacing: '.07em', marginBottom: 8 }}>{k.label}</div>
            <KPI value={k.value} sub={k.sub} delta={k.delta} deltaColor={k.dc} color={k.vc} />
          </Card>
        ))}
      </Grid>

      {/* Map + zone/events */}
      <Grid cols={2} gap={12}>
        <Card>
          <STitle dot="#3b82f6">City risk map — Bengaluru</STitle>
          <CityMap onHotspotClick={p => { onNav('s6'); onCopilotPrompt(p) }} />
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card>
            <STitle dot="#ef4444">Active events by zone</STitle>
            {ZONE_ACTIVE.slice(0, 6).map(z => (
              <BarRow key={z.zone} label={z.zone} value={z.active}
                max={maxZone} displayValue={z.active}
                color={z.active > 60 ? '#ef4444' : z.active > 20 ? '#f59e0b' : '#3b82f6'} />
            ))}
          </Card>
          <Card>
            <STitle dot="#ef4444">Live critical events</STitle>
            <EventItem
              title="IPL Match — Chinnaswamy Stadium"
              detail="45,000 attendees · Road closure: YES · Predicted delay: +34 min"
              variant="red" badge="PUBLIC EVENT" badgeVariant="red"
              onClick={() => { onNav('s6'); onCopilotPrompt('IPL match tomorrow Chinnaswamy 45000 attendees — full deployment plan') }}
            />
            <EventItem
              title="BMTC Breakdown — Mekhri Circle"
              detail="Bellary Rd 1 · Blocking 2 lanes · 0.68h median resolution"
              variant="warn" badge="BREAKDOWN" badgeVariant="warn"
              onClick={() => { onNav('s6'); onCopilotPrompt('BMTC breakdown at Mekhri Circle — fastest resolution plan?') }}
            />
            <EventItem
              title="Construction — ORR East 2"
              detail="102 active closures · 49h avg · Bellary Road alternate active"
              variant="blue" badge="PLANNED" badgeVariant="blue"
              onClick={() => { onNav('s4'); }}
            />
          </Card>
        </div>
      </Grid>

      {/* Bottom row */}
      <Grid cols={3} gap={12}>
        <Card>
          <STitle>Top corridors by event volume</STitle>
          {CORRIDORS.map(c => (
            <BarRow key={c.name} label={c.name} value={c.count}
              max={743} color={c.color} />
          ))}
        </Card>
        <Card>
          <STitle>Event cause distribution</STitle>
          {EVENT_CAUSES.slice(0, 6).map(c => (
            <BarRow key={c.cause} label={c.cause} value={c.count}
              max={4896} color={c.color} />
          ))}
        </Card>
        <Card>
          <STitle>Peak hour heatmap (actual ASTRAM data)</STitle>
          <HeatmapRow />
        </Card>
      </Grid>
    </div>
  )
}
