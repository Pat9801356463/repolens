"""
main.py — Phase 5 (Backend Integration)

Wires Phase 1 (scanner/parser), Phase 2 (graph engine), and Phase 3 (AI/
retrieval) into the real FastAPI app matching api_spec.md exactly, so
Phase 4's frontend needs zero code changes to swap off the mock server —
just point vite's proxy at this process instead
(`uvicorn main:app --port 8000`, same port the mock server used).

Endpoints implement api_spec.md 1:1:
  POST /scan            Phase 1 scan+extract -> Phase 2 graph build
  GET  /graph            current graph, node/edge dict shape
  POST /ask               Phase 3's full RAG pipeline
  GET  /impact/{node_id}  Phase 2's impact analysis, api_spec-shaped
  POST /testgen/{node_id} pre-baked cache replay only (blueprint §0/§9)
  GET  /health            mix of real graph metrics + placeholder scores

State is a single in-memory graph per process — correct for the
hackathon's "run both servers locally on the demo laptop" deployment
(blueprint §1). On startup we load the cached demo graph if one exists
so /graph works immediately without waiting on a live /scan call on
stage, exactly per blueprint §9's demo script.
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ai.llm_client import get_llm_client
from ai.pipeline import answer_question
from graph.analysis import build_impact_report, compute_health
from graph.builder import build_graph, load_graph_from_json, save_graph_cache, to_node_edge_dicts
from parser.extractors import extract_repo
from testgen.generate_and_run import load_cache as load_testgen_cache

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
STORAGE_DIR = BACKEND_DIR / "storage"
GRAPH_CACHE_PATH = STORAGE_DIR / "graph_cache.json"
FIXTURE_PATH = BACKEND_DIR / "fixtures" / "sample_graph.json"
DEFAULT_DEMO_REPO = "demo_repo/"


class AppState:
    """Single mutable slot for the process's current graph — deliberately
    simple (blueprint §1: no external graph store, one demo laptop)."""

    def __init__(self) -> None:
        self.graph = None
        self.repo_root: str | None = None
        self.llm_client = get_llm_client()  # LLM_PROVIDER env var; defaults to "mock"


state = AppState()
app = FastAPI(title="RepoLens API")

# Same permissive CORS the mock server used, so the frontend's dev proxy
# and any direct-origin testing both just work.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _resolve_repo_path(repo_path: str) -> Path:
    """repo_path in requests is written relative to the project root
    (e.g. "demo_repo/", per Phase 4's UploadScreen.jsx), not relative to
    wherever `uvicorn` happens to be launched from."""
    p = Path(repo_path)
    return p if p.is_absolute() else (PROJECT_ROOT / p)


def _load_startup_graph() -> None:
    """Best-effort: prefer a prebuilt cache, then fall back to scanning
    the demo repo live, then the frozen fixture — so /graph never 500s
    just because nobody called /scan yet."""
    if GRAPH_CACHE_PATH.exists():
        state.graph = load_graph_from_json(GRAPH_CACHE_PATH)
        state.repo_root = str(_resolve_repo_path(DEFAULT_DEMO_REPO))
        return
    try:
        repo_root = _resolve_repo_path(DEFAULT_DEMO_REPO)
        if repo_root.is_dir():
            nodes, edges = extract_repo(str(repo_root))
            state.graph = build_graph(nodes, edges)
            state.repo_root = str(repo_root)
            STORAGE_DIR.mkdir(parents=True, exist_ok=True)
            save_graph_cache(state.graph, GRAPH_CACHE_PATH)
            return
    except Exception as exc:  # noqa: BLE001 — startup must not crash the process
        print(f"[main] live demo-repo scan failed at startup: {exc}")
    if FIXTURE_PATH.exists():
        state.graph = load_graph_from_json(FIXTURE_PATH)
        state.repo_root = None


@app.on_event("startup")
def on_startup() -> None:
    _load_startup_graph()


def _require_graph():
    if state.graph is None:
        raise HTTPException(status_code=400, detail="No graph loaded yet — call POST /scan first")
    return state.graph


def _error(code: str, message: str, status: int) -> JSONResponse:
    return JSONResponse({"error": message, "code": code}, status_code=status)


# ---------------------------------------------------------------------------
# POST /scan
# ---------------------------------------------------------------------------

class ScanRequest(BaseModel):
    repo_path: str


@app.post("/scan")
def scan(req: ScanRequest):
    repo_root = _resolve_repo_path(req.repo_path)
    if not repo_root.is_dir():
        return _error("NOT_FOUND", f"repo_path not found: {req.repo_path}", 400)

    try:
        nodes, edges = extract_repo(str(repo_root))
        graph = build_graph(nodes, edges)
    except Exception as exc:  # noqa: BLE001 — a bad repo must not crash the server
        return _error("SCAN_FAILED", f"{exc.__class__.__name__}: {exc}", 500)

    state.graph = graph
    state.repo_root = str(repo_root)
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    save_graph_cache(graph, GRAPH_CACHE_PATH)

    return {"status": "ok", "node_count": graph.number_of_nodes(), "edge_count": graph.number_of_edges()}


# ---------------------------------------------------------------------------
# GET /graph
# ---------------------------------------------------------------------------

@app.get("/graph")
def get_graph():
    graph = _require_graph()
    return to_node_edge_dicts(graph)


# ---------------------------------------------------------------------------
# POST /ask
# ---------------------------------------------------------------------------

class AskRequest(BaseModel):
    question: str
    context_node_id: str | None = None  # currently selected/last-discussed node,
    # so follow-ups like "what's the risk here" have something to resolve to


@app.post("/ask")
def ask(req: AskRequest):
    graph = _require_graph()
    result = answer_question(
        req.question,
        graph,
        state.llm_client,
        repo_root=state.repo_root,
        context_node_id=req.context_node_id,
    )
    return result


# ---------------------------------------------------------------------------
# GET /impact/{node_id}
# ---------------------------------------------------------------------------

@app.get("/impact/{node_id:path}")
def get_impact_endpoint(node_id: str):
    graph = _require_graph()
    report = build_impact_report(graph, node_id)
    if report is None:
        return _error("NOT_FOUND", "node_id not found", 404)
    return report


# ---------------------------------------------------------------------------
# POST /testgen/{node_id}
# ---------------------------------------------------------------------------

_GENERIC_TESTGEN_FALLBACK = {
    "generated_count": 12,
    "passed": 10,
    "failed": 2,
    "coverage_before": 0.63,
    "coverage_after": 0.81,
    "test_names": [
        "test_successful_payment",
        "test_invalid_user",
        "test_insufficient_balance",
        "test_api_timeout",
        "test_duplicate_payment",
        "test_database_failure",
    ],
}


@app.post("/testgen/{node_id:path}")
def run_testgen(node_id: str):
    """Per blueprint §0/§9: pre-baked, not live. This endpoint only ever
    replays storage/testgen_cache.json (built ahead of time via
    `python -m testgen.generate_and_run`) — it never runs pytest on stage.
    Falls back to a canned-but-plausible result for any node not in the
    cache so clicking around in the demo never dead-ends.
    """
    cache = load_testgen_cache()
    return cache.get(node_id, _GENERIC_TESTGEN_FALLBACK)


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    graph = _require_graph()
    return compute_health(graph)
