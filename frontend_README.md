# RepoLens — Phase 4 (Frontend) deliverable

Everything here builds and runs standalone against the mock server —
verified with a real `npm install` + `npm run build` before handoff.

## Run it

**Terminal 1 — mock server** (stdlib only, no pip install needed):
```
cd mock_server
python3 mock_server.py
```
Serves on `http://localhost:8000`, backed by `phase0/fixtures/sample_graph.json`.

**Terminal 2 — frontend:**
```
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`. Vite proxies `/api/*` to the mock server on 8000.

## What's built

- **UploadScreen** — "Load demo repository" button, calls `POST /scan`
- **GraphView** — React Flow canvas, deterministic layered layout (BFS depth
  from import roots → columns), node click opens the impact drawer,
  highlighted nodes/edges glow amber when the AI answers a question
- **ChatPanel** — docked right, calls `POST /ask`, feeds `highlighted_node_ids`
  back up to `GraphView`
- **ImpactPanel** — slide-over drawer, calls `GET /impact/{node_id}`, shows
  risk level, dependents, affected tests
- **HealthDashboard** — separate tab, calls `GET /health` and
  `POST /testgen/{node_id}` (button-triggered, matches the "pre-baked,
  replay on stage" plan from the blueprint)

All five screens are wired against `src/api.js`, which matches
`phase0/api_spec.md` exactly. **Nothing in `src/` needs to change** when
Phase 5 swaps the mock server for the real FastAPI backend — just stop
`mock_server.py` and point the real backend at port 8000 (or edit the
`target` in `vite.config.js` if it runs elsewhere).

## Try these questions in the chat panel

The mock server pattern-matches these to give the exact demo-script answers:
- "Explain the architecture"
- "What happens when a user makes a payment?"
- "Why is checkout failing?"

Anything else gets a sensible generic fallback rather than an error, so
free-form testing during development won't break the UI.

## Known simplifications (fine for hackathon scope)

- Graph layout is a simple BFS-depth column layout, not a real
  auto-layout library (dagre/elk) — fine for a few dozen nodes, revisit
  if the real demo repo's graph is large or tangled.
- Impact drawer and chat panel both write to the same `highlightedIds`
  state — opening the drawer after asking a question will replace the
  chat's highlight with the drawer's. Acceptable for the demo flow
  (§9 of the blueprint does these one at a time), but flag if the demo
  script changes to do both at once.
- No loading skeletons beyond plain text — fine for a 5-minute demo,
  not meant to be a polished product.
