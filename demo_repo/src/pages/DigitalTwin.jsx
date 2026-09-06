import React, { useState, useEffect, useRef } from 'react'
import { Card, STitle, Badge, Grid, Divider } from '../components/UI'
import { SIM_SCENARIOS } from '../data/astramData'

const SCENARIO_KEYS = Object.keys(SIM_SCENARIOS)

// Animated traffic flow SVG canvas
function TrafficCanvas({ scenario, mode }) {
  const canvasRef = useRef(null)
  const animRef   = useRef(null)
  const dotData   = useRef([])

  const s = SIM_SCENARIOS[scenario]
  const data = mode === 'A' ? s.noIntervention : s.aiIntervention
  const cong = parseInt(data.congestion)

  // seed dots
  const initDots = () => {
    const dots = []
    const count = mode === 'A' ? 28 : 18
    for (let i = 0; i < count; i++) {
      dots.push({
        x: Math.random() * 320, y: Math.random() * 185,
        vx: (Math.random() - 0.5) * (mode === 'A' ? 0.4 : 0.9),
        vy: (Math.random() - 0.5) * (mode === 'A' ? 0.4 : 0.9),
        r: Math.random() * 2 + 1.5,
        color: mode === 'A'
          ? (Math.random() > 0.5 ? '#ef4444' : '#f59e0b')
          : (Math.random() > 0.5 ? '#10b981' : '#3b82f6'),
      })
    }
    dotData.current = dots
  }

  useEffect(() => {
    initDots()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const draw = () => {
      ctx.clearRect(0, 0, 320, 185)

      // Background
      ctx.fillStyle = '#0a1628'
      ctx.fillRect(0, 0, 320, 185)

      // Road grid
      ctx.strokeStyle = 'rgba(99,179,237,0.10)'
      ctx.lineWidth = 0.5
      ;[[0,50,320,68],[0,95,320,113],[0,140,320,155]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke()
      })
      ;[[40,0,32,185],[95,0,88,185],[148,0,143,185],[198,0,200,185],[250,0,255,185]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke()
      })

      // Congestion heatmap zones
      const alpha = (cong / 100) * 0.45
      if (mode === 'A') {
        const grad = ctx.createRadialGradient(160,92,10,160,92,90)
        grad.addColorStop(0, `rgba(239,68,68,${alpha})`)
        grad.addColorStop(1, 'rgba(239,68,68,0)')
        ctx.fillStyle = grad
        ctx.fillRect(0,0,320,185)
      } else {
        const grad = ctx.createRadialGradient(160,92,10,160,92,50)
        grad.addColorStop(0, `rgba(16,185,129,${alpha * 0.5})`)
        grad.addColorStop(1, 'rgba(16,185,129,0)')
        ctx.fillStyle = grad
        ctx.fillRect(0,0,320,185)
      }

      // Dots (vehicles)
      dotData.current.forEach(d => {
        d.x += d.vx; d.y += d.vy
        if (d.x < 0 || d.x > 320) d.vx *= -1
        if (d.y < 0 || d.y > 185) d.vy *= -1
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = d.color
        ctx.fill()
      })

      // Labels
      ctx.fillStyle = mode === 'A' ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.5)'
      ctx.font = '9px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText(mode === 'A' ? '◉ Congestion building' : '◎ Traffic flowing', 160, 15)

      animRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animRef.current)
  // eslint-disable-next-line
  }, [scenario, mode])

  return (
    <canvas ref={canvasRef} width={320} height={185}
      style={{ width: '100%', borderRadius: 8, display: 'block',
        border: `0.5px solid ${mode === 'A' ? 'rgba(239,68,68,.3)' : 'rgba(16,185,129,.3)'}` }} />
  )
}

export default function DigitalTwin() {
  const [scenario, setScenario] = useState('ipl')
  const s = SIM_SCENARIOS[scenario]

  const kpiColor = (mode, field) => {
    if (field === 'delay' || field === 'congestion') return mode === 'A' ? '#f87171' : '#34d399'
    if (field === 'throughput') return mode === 'A' ? '#f87171' : '#34d399'
    if (field === 'radius') return mode === 'A' ? '#f87171' : '#34d399'
    return '#e2e8f0'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12,
          marginBottom: 16, flexWrap: 'wrap' }}>
          <STitle style={{ marginBottom: 0 }}>
            <Badge variant="purple" style={{ marginRight: 6 }}>DIGITAL TWIN</Badge>
            Traffic simulation — live scenario comparison
          </STitle>
          <select value={scenario} onChange={e => setScenario(e.target.value)}
            style={{ background: '#0f2038', border: '0.5px solid rgba(99,179,237,.25)',
              borderRadius: 7, color: '#e2e8f0', fontSize: 11, padding: '6px 10px',
              fontFamily: 'inherit', outline: 'none', minWidth: 280 }}>
            {SCENARIO_KEYS.map(k => (
              <option key={k} value={k}>{SIM_SCENARIOS[k].label}</option>
            ))}
          </select>
          <Badge variant="cyan">Temporal Fusion Transformer · 5-min resolution</Badge>
        </div>

        <Grid cols={2} gap={12}>
          {/* Scenario A */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#f87171',
              marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, background: '#ef4444',
                borderRadius: '50%', display: 'inline-block' }} />
              Scenario A — No Intervention
            </div>
            <TrafficCanvas scenario={scenario} mode="A" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 10 }}>
              {[
                { label: 'Avg delay (min)', val: s.noIntervention.delay, field: 'delay' },
                { label: 'Congestion score', val: s.noIntervention.congestion, field: 'congestion' },
                { label: 'Throughput', val: s.noIntervention.throughput, field: 'throughput' },
                { label: 'Impact radius', val: s.noIntervention.radius, field: 'radius' },
              ].map(k => (
                <div key={k.label} style={{ background: '#0f2038', borderRadius: 7,
                  padding: '8px 10px', border: '0.5px solid rgba(239,68,68,.15)', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 500,
                    color: kpiColor('A', k.field) }}>{k.val}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, lineHeight: 1.5 }}>
              Bottleneck: <span style={{ color: '#f87171' }}>{s.noIntervention.bottleneck}</span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
              Officers: <span style={{ color: '#f87171' }}>{s.noIntervention.officers}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.07)',
              overflow: 'hidden', marginTop: 8 }}>
              <div style={{ width: `${s.noIntervention.congestion}%`, height: '100%',
                borderRadius: 3, background: '#ef4444', transition: 'width .5s' }} />
            </div>
          </div>

          {/* Scenario B */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#34d399',
              marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, background: '#10b981',
                borderRadius: '50%', display: 'inline-block' }} />
              Scenario B — AI Intervention
            </div>
            <TrafficCanvas scenario={scenario} mode="B" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 10 }}>
              {[
                { label: 'Avg delay (min)', val: s.aiIntervention.delay, field: 'delay' },
                { label: 'Congestion score', val: s.aiIntervention.congestion, field: 'congestion' },
                { label: 'Throughput', val: s.aiIntervention.throughput, field: 'throughput' },
                { label: 'Impact radius', val: s.aiIntervention.radius, field: 'radius' },
              ].map(k => (
                <div key={k.label} style={{ background: '#0f2038', borderRadius: 7,
                  padding: '8px 10px', border: '0.5px solid rgba(16,185,129,.15)', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 500,
                    color: kpiColor('B', k.field) }}>{k.val}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, lineHeight: 1.5 }}>
              Measures: <span style={{ color: '#34d399' }}>{s.aiIntervention.measures}</span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
              Officers: <span style={{ color: '#34d399' }}>{s.aiIntervention.officers}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.07)',
              overflow: 'hidden', marginTop: 8 }}>
              <div style={{ width: `${s.aiIntervention.congestion}%`, height: '100%',
                borderRadius: 3, background: '#10b981', transition: 'width .5s' }} />
            </div>
          </div>
        </Grid>

        {/* Gains */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
          gap: 8, marginTop: 14 }}>
          {[
            { val: s.gains.delay,      label: 'Delay reduction' },
            { val: s.gains.congestion, label: 'Congestion drop' },
            { val: s.gains.throughput, label: 'Throughput gain' },
            { val: s.gains.radius,     label: 'Radius shrink' },
          ].map(g => (
            <div key={g.label} style={{ background: 'rgba(16,185,129,.08)', borderRadius: 8,
              padding: 10, textAlign: 'center', border: '0.5px solid rgba(16,185,129,.18)' }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: '#34d399' }}>{g.val}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{g.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: '#475569', textAlign: 'center', marginTop: 8 }}>
          Temporal Fusion Transformer · 5-minute resolution · Bengaluru road network graph
        </div>
      </Card>
    </div>
  )
}
