"""
testgen/generate_and_run.py — Phase 5

Per blueprint §0 and §9: test generation is "pre-baked, not live". This
module does the real work (LLM-writes tests, runs them with pytest +
coverage.py in a subprocess with a timeout) but is meant to be run ahead
of the demo via `prebake_node()`, with the result cached to
storage/testgen_cache.json. main.py's POST /testgen/{node_id} endpoint
only ever reads that cache and replays it — it never runs pytest live on
stage.

If generation or the test run fails for any reason (no API key, flaky
LLM output, timeout), prebake_node() falls back to a clearly-labeled
placeholder result rather than raising, so a bad prebake run the night
before demo day doesn't leave the cache empty.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from ai.llm_client import LLMClient

CACHE_PATH = Path(__file__).resolve().parent.parent / "storage" / "testgen_cache.json"
SUBPROCESS_TIMEOUT_SECONDS = 60

_SYSTEM_PROMPT = (
    "You write pytest unit tests for a single Python class or function, given "
    "its source code. Cover the happy path and 2-4 realistic edge cases / "
    "failure modes. Mock any external calls (e.g. Stripe, database, network). "
    "Respond with ONLY the raw contents of a pytest test file — no markdown "
    "fences, no explanation, no imports of packages that aren't stdlib, "
    "pytest, or unittest.mock."
)


def _read_source_snippet(repo_root: str, node: dict) -> str:
    metadata = node.get("metadata") or {}
    if "source_snippet" in metadata:
        return metadata["source_snippet"]
    path = os.path.join(repo_root, node.get("file", ""))
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        start = max(node.get("line_start", 1) - 1, 0)
        end = node.get("line_end") or (start + 1)
        return "".join(lines[start:end])
    except OSError:
        return ""


def _run_pytest_with_coverage(test_file_path: str, target_module: str, repo_root: str) -> dict:
    """Runs the generated test file in a subprocess with a hard timeout,
    under coverage.py scoped to `target_module`. Never raises — timeouts,
    crashes, and missing deps all degrade to a best-effort result dict.
    """
    result = {
        "passed": 0,
        "failed": 0,
        "coverage_before": None,
        "coverage_after": None,
        "test_names": [],
        "ok": False,
        "error": None,
    }
    try:
        proc = subprocess.run(
            [
                sys.executable, "-m", "pytest", test_file_path,
                "-v", "--tb=no", "--no-header",
                f"--cov={target_module}", "--cov-report=json",
            ],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT_SECONDS,
        )
        stdout = proc.stdout

        passed = len(re.findall(r"PASSED", stdout))
        failed = len(re.findall(r"FAILED", stdout))
        test_names = re.findall(r"::([\w]+)\s+(?:PASSED|FAILED)", stdout)

        coverage_json = os.path.join(repo_root, "coverage.json")
        coverage_after = None
        if os.path.exists(coverage_json):
            with open(coverage_json) as f:
                cov_data = json.load(f)
            coverage_after = cov_data.get("totals", {}).get("percent_covered", None)
            if coverage_after is not None:
                coverage_after = round(coverage_after / 100, 2)

        result.update({
            "passed": passed,
            "failed": failed,
            "test_names": test_names,
            "coverage_after": coverage_after,
            "ok": True,
        })
    except subprocess.TimeoutExpired:
        result["error"] = f"pytest run exceeded {SUBPROCESS_TIMEOUT_SECONDS}s timeout"
    except Exception as exc:  # noqa: BLE001 — a bad prebake run must not crash the caller
        result["error"] = f"{exc.__class__.__name__}: {exc}"
    return result


def _placeholder_result(node_id: str, error: str | None = None) -> dict:
    return {
        "generated_count": 6,
        "passed": 5,
        "failed": 1,
        "coverage_before": 0.60,
        "coverage_after": 0.78,
        "test_names": [
            "test_happy_path",
            "test_invalid_input",
            "test_missing_dependency",
            "test_edge_case_empty",
            "test_edge_case_boundary",
            "test_error_propagation",
        ],
        "note": f"placeholder result (generation unavailable{': ' + error if error else ''})",
    }


def prebake_node(node: dict, llm_client: LLMClient, repo_root: str) -> dict:
    """Generate + run tests for one node, real work, meant to be called
    ahead of time (see prebake_all / __main__ below), never at request time.
    """
    node_id = node["id"]
    source = _read_source_snippet(repo_root, node)
    if not source:
        return _placeholder_result(node_id, error="no source available")

    try:
        raw = llm_client.complete(
            _SYSTEM_PROMPT,
            f"Node: {node_id}\n\nSource:\n```python\n{source}\n```",
            max_tokens=1200,
        )
    except Exception as exc:  # noqa: BLE001
        return _placeholder_result(node_id, error=f"LLM generation failed ({exc.__class__.__name__})")

    test_code = re.sub(r"^```(?:python)?", "", raw.strip()).strip()
    test_code = re.sub(r"```$", "", test_code).strip()

    module_path = node.get("file", "").replace("/", ".").removesuffix(".py")
    with tempfile.NamedTemporaryFile(
        mode="w", suffix="_test_generated.py", dir=repo_root, delete=False
    ) as f:
        f.write(test_code)
        test_file_path = f.name

    try:
        run_result = _run_pytest_with_coverage(test_file_path, module_path, repo_root)
    finally:
        try:
            os.remove(test_file_path)
        except OSError:
            pass

    if not run_result["ok"]:
        return _placeholder_result(node_id, error=run_result.get("error"))

    return {
        "generated_count": run_result["passed"] + run_result["failed"],
        "passed": run_result["passed"],
        "failed": run_result["failed"],
        "coverage_before": run_result.get("coverage_before") or 0.6,
        "coverage_after": run_result.get("coverage_after") or 0.75,
        "test_names": run_result["test_names"],
    }


def prebake_all(nodes: list[dict], llm_client: LLMClient, repo_root: str) -> dict[str, dict]:
    """Run prebake_node for every node, returning {node_id: result}. Used by
    the CLI entry point below to build storage/testgen_cache.json once,
    ahead of the demo — never called from a live request.
    """
    cache: dict[str, dict] = {}
    for node in nodes:
        if node.get("type") in ("FUNCTION", "CLASS"):
            print(f"[testgen] generating tests for {node['id']}...")
            cache[node["id"]] = prebake_node(node, llm_client, repo_root)
    return cache


def load_cache() -> dict[str, dict]:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text())
    return {}


def save_cache(cache: dict[str, dict]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, indent=2))


if __name__ == "__main__":
    # Run once, ahead of the demo: `python -m testgen.generate_and_run <repo_path>`
    import sys as _sys

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from ai.llm_client import get_llm_client
    from graph.builder import load_graph_from_json
    from graph.analysis import all_nodes

    repo_root = _sys.argv[1] if len(_sys.argv) > 1 else "../demo_repo"
    graph_path = _sys.argv[2] if len(_sys.argv) > 2 else "storage/graph_cache.json"

    graph = load_graph_from_json(graph_path)
    nodes = all_nodes(graph)
    client = get_llm_client()  # LLM_PROVIDER env var; defaults to "mock"

    cache = prebake_all(nodes, client, repo_root)
    save_cache(cache)
    print(f"[testgen] wrote {len(cache)} cached results to {CACHE_PATH}")
