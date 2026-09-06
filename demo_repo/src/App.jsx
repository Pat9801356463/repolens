import React, { useState } from 'react'
import TopBar from './components/TopBar'
import CommandCenter    from './pages/CommandCenter'
import EventIntelligence from './pages/EventIntelligence'
import ResourcePlanner  from './pages/ResourcePlanner'
import DiversionEngine  from './pages/DiversionEngine'
import DigitalTwin      from './pages/DigitalTwin'
import AICopilot        from './pages/AICopilot'
import WarRoom          from './pages/WarRoom'
import ModelAccuracy    from './pages/ModelAccuracy'
import AlertFeed        from './pages/AlertFeed'
import PostEventLearning from './pages/PostEventLearning'

export default function App() {
  const [screen, setScreen]           = useState('s1')
  const [copilotPrompt, setCopilotPrompt] = useState(null)

  /* When a hotspot or alert triggers the copilot,
     switch to the copilot screen and pass the prompt. */
  const handleCopilotPrompt = (text) => {
    setCopilotPrompt(text)
    setScreen('s6')
  }

  const nav = (id) => setScreen(id)

  const sharedProps = {
    onNav: nav,
    onCopilotPrompt: handleCopilotPrompt,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column',
      height: '100vh', background: '#07111f', overflow: 'hidden' }}>

      <TopBar active={screen} onNav={nav} />

      {/* Scrollable screen area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {screen === 's1'  && <CommandCenter     {...sharedProps} />}
        {screen === 's2'  && <EventIntelligence {...sharedProps} />}
        {screen === 's3'  && <ResourcePlanner   {...sharedProps} />}
        {screen === 's4'  && <DiversionEngine   {...sharedProps} />}
        {screen === 's5'  && <DigitalTwin       {...sharedProps} />}
        {screen === 's6'  && (
          <AICopilot
            {...sharedProps}
            initialPrompt={copilotPrompt}
            onPromptConsumed={() => setCopilotPrompt(null)}
          />
        )}
        {screen === 's7'  && <WarRoom           {...sharedProps} />}
        {screen === 's8'  && <ModelAccuracy     {...sharedProps} />}
        {screen === 's9'  && <AlertFeed         {...sharedProps} />}
        {screen === 's10' && <PostEventLearning {...sharedProps} />}
      </div>
    </div>
  )
}
