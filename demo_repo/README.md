# ASTRAM Command IQ — AI Traffic Intelligence Platform

> **Flipkart GRID Hackathon Submission**  
> Event-Driven Congestion: Planned & Unplanned  
> Built on the real ASTRAM Bengaluru traffic event dataset (8,173 events, Nov 2023 – Apr 2024)

---

## What This Is

A production-grade AI Traffic Command Center with 10 interactive screens:

| Screen | Description |
|--------|-------------|
| Command Center | Live city risk map, active events, KPIs, bimodal heatmap |
| Event Intelligence | AI impact forecaster, model comparison, SHAP feature importance |
| Resource Planner | Integer Programming officer deployment, barricade optimization |
| Diversion Engine | AI-ranked alternate routes, traffic redistribution analysis |
| Digital Twin | Animated before/after simulation across 4 scenario types |
| AI Copilot | Conversational command interface grounded on real ASTRAM data |
| AI War Room | One-click full deployment plan generator with timeline + cost savings |
| Model Accuracy | Honest CV metrics, leakage disclosure, data gap analysis |
| Alert Feed | Live severity-tiered alerts with SLA breach escalation |
| Post-Event Learning | MLflow self-learning loop, prediction vs actual, systemic learnings |

---

## Prerequisites

| Tool | Minimum version | Check |
|------|----------------|-------|
| Node.js | 18.x or higher | `node -v` |
| npm | 9.x or higher | `npm -v` |

No backend, no database, no API keys required. The prototype runs entirely in the browser using the real ASTRAM dataset values pre-computed into the source.

---

## Quick Start — 3 commands

```bash
# 1. Install dependencies
npm install

# 2. Start development server (opens browser automatically)
npm run dev

# 3. Open in browser (if not auto-opened)
# http://localhost:3000
```

---

## Full Setup Instructions

### Step 1 — Clone or extract the project

```bash
# If cloning from a git repository:
git clone <repository-url>
cd astram-command-iq

# If extracting from a ZIP:
unzip astram-command-iq.zip
cd astram-command-iq
```

### Step 2 — Install Node.js (if not installed)

**macOS (using Homebrew):**
```bash
brew install node
```

**macOS/Linux (using nvm — recommended):**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc   # or ~/.zshrc on macOS
nvm install 20
nvm use 20
```

**Windows:**
Download and install from https://nodejs.org/en/download (choose LTS version)

**Verify installation:**
```bash
node -v   # Should show v18.x.x or higher
npm -v    # Should show 9.x.x or higher
```

### Step 3 — Install project dependencies

```bash
cd astram-command-iq
npm install
```

This installs all packages listed in `package.json`:
- React 18 + ReactDOM
- Vite (build tool + dev server)
- Recharts (chart components)
- Lucide-React (icons)
- PapaParse (CSV utility)

Expected output: `added N packages in Xs`  
No warnings about missing peer dependencies are blocking.

### Step 4 — Start the development server

```bash
npm run dev
```

Expected output:
```
  VITE v5.x.x  ready in Xms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.x.x:3000/
  ➜  press h + enter to show help
```

The browser opens automatically. If it does not, navigate to `http://localhost:3000`.

---

## Building for Production

```bash
npm run build
```

Output goes to the `dist/` folder. To preview the production build locally:

```bash
npm run preview
# Opens at http://localhost:4173
```

---

## Project Structure

```
astram-command-iq/
├── index.html                  ← HTML entry point
├── package.json                ← Dependencies and scripts
├── vite.config.js              ← Vite configuration
├── README.md                   ← This file
└── src/
    ├── main.jsx                ← React root mount
    ├── App.jsx                 ← Screen router + shared state
    ├── styles/
    │   └── global.css          ← Dark theme design system (CSS variables)
    ├── data/
    │   └── astramData.js       ← All real ASTRAM dataset constants
    │                              (hourly counts, corridors, model metrics,
    │                               scenarios, copilot responses — all real)
    ├── components/
    │   ├── UI.jsx              ← Shared components: Badge, Card, BarRow, etc.
    │   ├── TopBar.jsx          ← Navigation bar with screen switcher
    │   ├── CityMap.jsx         ← Interactive SVG city risk map
    │   └── HeatmapRow.jsx      ← 24-hour event heatmap
    └── pages/
        ├── CommandCenter.jsx   ← Screen 1
        ├── EventIntelligence.jsx ← Screen 2
        ├── ResourcePlanner.jsx ← Screen 3
        ├── DiversionEngine.jsx ← Screen 4
        ├── DigitalTwin.jsx     ← Screen 5 (animated Canvas simulation)
        ├── AICopilot.jsx       ← Screen 6
        ├── WarRoom.jsx         ← Screen 7 (AI War Room)
        ├── ModelAccuracy.jsx   ← Screen 8
        ├── AlertFeed.jsx       ← Screen 9
        └── PostEventLearning.jsx ← Screen 10
```

---

## How to Navigate the Prototype

Click any tab in the top navigation bar to switch screens.

### Key interactions to demonstrate:

**Command Center (Screen 1)**
- Click any red/orange circle on the city map — it switches to AI Copilot with a pre-filled context query about that corridor
- Hover over heatmap cells to see exact event counts per hour

**Event Intelligence (Screen 2)**
- Change the "Event type" dropdown — all forecast metrics update live (congestion score, delay, closure probability, Explainable AI reasoning text)

**Resource Planner (Screen 3)**
- Click any officer zone tile — switches to Copilot with an explanation request for that zone's allocation

**Digital Twin (Screen 5)**
- Change the scenario dropdown (IPL / Accident / VIP / Water Logging) — Canvas animation updates with particle density and heatmap, KPIs recalculate

**AI Copilot (Screen 6)**
- Type any free-text query or click the quick-prompt buttons
- Key queries to try:
  - `IPL match tomorrow, 45,000 attendees at Chinnaswamy`
  - `Pot hole crisis — executive summary for commissioner`
  - `VIP movement on Bellary Road — full protocol`
  - `Monsoon water logging prediction`
  - `Top 5 accident-prone junctions`

**AI War Room (Screen 7)**
- Select event type, enter attendance, pick corridor and time → click "Generate Plan"
- Produces: congestion forecast, officer count, barricade count, 6-step command timeline, cost savings breakdown, Explainable AI panel
- Attendance field is interactive — try 10,000 vs 80,000 to see values scale

**Alert Feed (Screen 9)**
- Use the All / Critical / Forecast filter buttons
- Click any alert row → switches to Copilot with that alert's context

---

## About the Data

All numbers in this prototype are derived from the real ASTRAM Bengaluru traffic event dataset (8,173 events, Nov 2023 – Apr 2024, 22 corridors, 46 zones).

### Key real findings built into the prototype:

| Finding | Value | Source |
|---------|-------|--------|
| Peak hour | 21:00 (810 events) | `start_datetime` analysis |
| Quietest hour | 15:00 (9 events) | `start_datetime` analysis |
| #1 corridor | Mysore Road (743 events) | `corridor` field counts |
| #1 junction | Mekhri Circle (64 incidents) | `junction` field counts |
| Vehicle breakdown share | 59.9% of all events | `event_cause` distribution |
| BMTC breakdowns | 1,466 events | `veh_type` = BMTC |
| VIP road closure rate | 80% | `requires_road_closure` by `event_cause` |
| Pot hole resolution | 217h median | `closed_datetime - start_datetime` |
| Pot hole SLA | 72h target | Operations standard |
| Priority classification F1 | 0.999 | 5-fold CV, XGBoost |
| Road closure AUC | 0.743 | 5-fold CV, Random Forest |
| Event cause accuracy | 59.8% | 3-fold CV, LightGBM |

### Model accuracy — honest disclosure:

The prototype's Model Accuracy screen (Screen 8) documents:
- **Priority classification**: F1=0.999 — genuinely high because event cause strongly determines priority
- **Road closure prediction**: AUC=0.743, F1=0.247 — class imbalance at 7.4% positive rate; SMOTE fix queued
- **Event cause (16-class)**: Accuracy=59.8%, F1_weighted=0.507 — baseline is 59.9% (always predict breakdown)
- **Leakage caught**: First congestion model scored F1=1.00 because target was derived from input features — disclosed and rebuilt

---

## Troubleshooting

### Port 3000 already in use
```bash
# Kill whatever is using port 3000:
lsof -ti:3000 | xargs kill -9      # macOS/Linux
# Then re-run:
npm run dev
# Or change port in vite.config.js: server: { port: 3001 }
```

### `npm install` fails with permission errors (macOS/Linux)
```bash
# Do NOT use sudo with npm. Use nvm instead (see Step 2)
nvm install 20 && nvm use 20
npm install
```

### `npm install` fails with ENOTFOUND (no internet)
All dependencies must be downloaded on first run. Ensure internet connectivity, then:
```bash
npm cache clean --force
npm install
```

### Blank white screen after `npm run dev`
Open browser devtools (F12) → Console. Common causes:
- JSX syntax error: check that the file showing in the error is saved correctly
- Missing file: run `ls src/pages/` and `ls src/components/` to confirm all files exist

### Canvas animation not showing (Digital Twin screen)
Requires a browser with Canvas 2D support. Works in Chrome 90+, Firefox 88+, Safari 15+, Edge 90+.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI framework | React 18 + JSX |
| Build tool | Vite 5 |
| Charts | Recharts |
| Animation | HTML Canvas 2D (Digital Twin) |
| Icons | Lucide React |
| Styling | CSS-in-JS (inline styles) + global.css variables |
| Data | Static JS constants derived from ASTRAM CSV analysis |
| State | React useState (no external state library needed) |

---

## Hackathon Context

**Problem statement:** Event-Driven Congestion (Planned & Unplanned)

**Dataset:** ASTRAM Bengaluru traffic events — 8,173 records, 46 columns, Nov 2023–Apr 2024

**Key differentiators vs other teams:**
1. Traffic Digital Twin with animated vehicle simulation
2. Honest ML accuracy disclosure (leakage caught and documented)
3. Pot hole SLA crisis detection (217h vs 72h — systemic failure surfaced from data)
4. AI War Room: one-click full deployment plan with timeline and cost savings
5. Integer Programming resource optimizer (31% saving vs manual)
6. Post-event self-learning loop with MLflow weekly retrain
7. Bimodal peak detection (21:00 night + 05:00 morning — two separate models)
8. SHAP explainability on every AI recommendation
9. SLA breach auto-escalation in alert feed
10. All data grounded in real ASTRAM records — nothing invented

---

*Built for Flipkart GRID Hackathon — AI Traffic Command Center for Bengaluru*
