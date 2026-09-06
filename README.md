# RepoLens — integrated build (Phase 5 complete)

All five phases are wired together and integration-tested end to end.

## Run it

Backend (from `backend/`):
    pip install -r requirements.txt
    LLM_PROVIDER=mock uvicorn main:app --port 8000 --reload
    # or LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-... for real answers

Frontend (from `frontend/`):
    npm install
    npm run dev
    # open http://localhost:5173 — vite proxies /api/* to localhost:8000

Prebuild the demo graph cache (optional — main.py auto-scans demo_repo/
at startup if no cache exists yet):
    python3 scripts/prebuild_demo_graph.py

## What Phase 5 did

Phases 0-4 arrived with a classic hackathon problem: Phase 3 (AI/
retrieval) and its tests were built against a richer graph-engine
interface (get_node, find_nodes_by_name, get_forward_trace,
load_graph_from_json, dict-shaped get_impact/get_subgraph) than Phase
2's original analysis.py exposed (graph-shaped returns, no name
lookup). Phase 0's api_spec.md and schema.py had also drifted slightly
from what Phase 1's real extractor and Phase 3's own fixture produced.

Integration work:
- `backend/graph/analysis.py` and `graph/builder.py` were reconciled to
  the interface Phase 3's real, tested code depends on (verified by
  running Phase 3's own `tests/test_pipeline.py` unmodified against the
  new implementation — all 13 checks pass).
- `backend/graph/schema.py` uses Phase 0's canonical version (adds
  `to_dict`/`from_dict`, matches `fixtures/sample_graph.json` and
  `api_spec.md`'s examples exactly).
- `backend/main.py` (new) wires Phase 1's scanner/parser, the
  reconciled Phase 2 graph engine, and Phase 3's `ai/pipeline` into a
  real FastAPI app implementing every endpoint in `api_spec.md`,
  replacing Phase 4's mock server with zero frontend changes needed —
  same routes, same port, same response shapes.
- `backend/testgen/generate_and_run.py` (new) — the pre-baked test-gen
  module the blueprint calls for (§0/§9): does the real LLM-generate +
  pytest + coverage.py work, but only ever runs ahead of time via
  `scripts/prebuild_demo_graph.py --with-testgen`; the live endpoint
  only replays the cache.
- Verified end to end: real repo → Phase 1 extraction (18 nodes, 22
  edges from `demo_repo/`) → Phase 2 graph → Phase 3 `/ask` → real
  FastAPI server on port 8000, hit with curl exactly as the browser
  would (CORS preflight, `/graph`, `/health`, `/ask`, `/impact`,
  `/testgen`, `/scan` error handling all checked).
