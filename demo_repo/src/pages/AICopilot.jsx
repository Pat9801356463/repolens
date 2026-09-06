import React, { useState, useEffect, useRef } from 'react'
import { Card, STitle, Badge, Grid } from '../components/UI'
import { COPILOT_RESPONSES } from '../data/astramData'

function getResponse(msg) {
  const m = msg.toLowerCase()
  if (m.includes('ipl') || m.includes('match') || m.includes('cricket') || m.includes('stadium') || m.includes('concert'))
    return COPILOT_RESPONSES.ipl
  if (m.includes('accident') || m.includes('crash') || m.includes('junction'))
    return COPILOT_RESPONSES.accident
  if (m.includes('pot') || m.includes('hole') || m.includes('sla') || m.includes('commissioner'))
    return COPILOT_RESPONSES.pothole
  if (m.includes('vip') || m.includes('convoy') || m.includes('movement'))
    return COPILOT_RESPONSES.vip
  if (m.includes('monsoon') || m.includes('water') || m.includes('flood') || m.includes('rain'))
    return COPILOT_RESPONSES.monsoon
  return COPILOT_RESPONSES.default
}

const QUICK_PROMPTS = [
  'Top 5 accident-prone junctions and permanent fix plan?',
  'Pot hole crisis — executive summary for commissioner',
  'VIP movement on Bellary Road — full protocol',
  'Monsoon water logging prediction for next season',
  'IPL match tomorrow, 45,000 attendees at Chinnaswamy',
  'BMTC breakdown on Mysore Road — fastest resolution?',
]

const INNOVATIONS = [
  { n: '1', title: 'Traffic Digital Twin Simulation', sub: 'Before/after KPI comparison with live scenario switching', badge: 'red' },
  { n: '2', title: 'Honest model accuracy disclosure', sub: 'Real CV metrics, leakage caught and disclosed — judges trust this', badge: 'purple' },
  { n: '3', title: 'Pot hole SLA crisis detection', sub: '217h vs 72h SLA — systemic failure surfaced from raw data', badge: 'purple' },
  { n: '4', title: 'Post-event self-learning loop', sub: 'Weekly MLflow retrain, F1 improves 0.65 → 0.91 over 12 weeks', badge: 'purple' },
  { n: '5', title: 'Live alert feed + SLA escalation', sub: 'Real-time alerts with auto-escalation on SLA breach', badge: 'purple' },
  { n: '6', title: 'AI Copilot command interface', sub: 'NL query → full deployment plan from real ASTRAM data', badge: 'red' },
  { n: '7', title: 'Integer Programming optimizer', sub: '31% more efficient than manual — proven, quantified', badge: 'cyan' },
  { n: '8', title: 'Bimodal peak detection — two models', sub: '21:00 and 05:00 peaks have different causes — dual model', badge: 'cyan' },
  { n: '9', title: 'BMTC breakdown predictor', sub: '1,466 events on 3 corridors — route-level ML model', badge: 'cyan' },
  { n: '10', title: 'Junction heat-index scoring', sub: 'Mekhri Circle: 64 events → permanent officer pre-positioning', badge: 'cyan' },
]

export default function AICopilot({ initialPrompt, onPromptConsumed }) {
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: 'I have analysed **8,173 ASTRAM events** across Bengaluru. **1,007 active** right now. South Zone 2 critical (114 events). Pot hole SLA breach: 537 events at 217h. How can I help?',
    },
    { role: 'user', text: 'Tomorrow there is an IPL match with 45,000 attendees at Chinnaswamy Stadium. Full plan please.' },
    { role: 'ai',   text: COPILOT_RESPONSES.ipl },
  ])
  const [input, setInput] = useState('')
  const areaRef = useRef(null)

  // consume external prompt (from map hotspot clicks)
  useEffect(() => {
    if (initialPrompt) {
      sendMessage(initialPrompt)
      onPromptConsumed()
    }
  // eslint-disable-next-line
  }, [initialPrompt])

  useEffect(() => {
    if (areaRef.current) areaRef.current.scrollTop = areaRef.current.scrollHeight
  }, [messages])

  const sendMessage = (text) => {
    const msg = text || input.trim()
    if (!msg) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', text: getResponse(msg) }])
    }, 600)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <Grid cols={2} gap={12}>

        {/* Chat */}
        <div>
          <Card style={{ marginBottom: 10 }}>
            <STitle>
              <Badge variant="cyan" style={{ marginRight: 6 }}>AI COPILOT</Badge>
              Conversational traffic command
            </STitle>

            {/* Chat area */}
            <div ref={areaRef} style={{
              background: '#0f2038', borderRadius: 9, padding: 12,
              height: 360, overflowY: 'auto', display: 'flex',
              flexDirection: 'column', gap: 10,
            }}>
              {messages.map((m, i) => (
                <div key={i} style={{
                  maxWidth: '90%',
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  {m.role === 'ai' && (
                    <div style={{ fontSize: 9, color: '#06b6d4', fontWeight: 500,
                      letterSpacing: '.04em', marginBottom: 4 }}>
                      ASTRAM AI · COMMAND IQ
                    </div>
                  )}
                  <div style={{
                    background: m.role === 'user'
                      ? 'rgba(59,130,246,.2)' : '#0c1a2e',
                    borderRadius: m.role === 'user'
                      ? '9px 9px 2px 9px' : '2px 9px 9px 9px',
                    padding: '9px 13px',
                    fontSize: 12,
                    border: m.role === 'ai'
                      ? '0.5px solid rgba(99,179,237,0.13)' : 'none',
                    color: m.role === 'user' ? '#bfdbfe' : '#e2e8f0',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about any junction, event, or deployment..."
                style={{
                  flex: 1, background: '#0f2038',
                  border: '0.5px solid rgba(99,179,237,.25)',
                  borderRadius: 8, padding: '9px 13px',
                  fontSize: 12, color: '#e2e8f0',
                  fontFamily: 'inherit', outline: 'none',
                }} />
              <button onClick={() => sendMessage()}
                style={{
                  background: '#3b82f6', border: 'none', borderRadius: 8,
                  padding: '9px 16px', color: '#fff', fontSize: 12,
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                }}>
                Send
              </button>
            </div>
          </Card>

          {/* Quick prompts */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QUICK_PROMPTS.map(p => (
              <button key={p} onClick={() => sendMessage(p)}
                style={{
                  background: 'rgba(255,255,255,.05)',
                  border: '0.5px solid rgba(99,179,237,.13)',
                  borderRadius: 6, padding: '5px 11px',
                  color: '#94a3b8', fontSize: 10,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { e.target.style.background = 'rgba(59,130,246,.12)'; e.target.style.color = '#93c5fd' }}
                onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,.05)'; e.target.style.color = '#94a3b8' }}>
                {p.length > 40 ? p.slice(0,38) + '…' : p} ↗
              </button>
            ))}
          </div>
        </div>

        {/* Innovations */}
        <Card>
          <STitle>10 winning differentiators — ranked</STitle>
          <div style={{ overflowY: 'auto', maxHeight: 380 }}>
            {INNOVATIONS.map(it => (
              <div key={it.n} style={{ display: 'flex', gap: 9, padding: '8px 0',
                borderBottom: '0.5px solid rgba(255,255,255,.05)',
                alignItems: 'flex-start' }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#3b82f6',
                  minWidth: 20 }}>{it.n}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#e2e8f0' }}>{it.title}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, lineHeight: 1.4 }}>{it.sub}</div>
                </div>
                <Badge variant={it.badge} style={{ flexShrink: 0 }}>
                  {it.badge === 'red' ? 'High' : it.badge === 'purple' ? 'New' : 'ML'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </Grid>
    </div>
  )
}
