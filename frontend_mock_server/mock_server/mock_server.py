"""
RepoLens mock server — Phase 4.

Implements every endpoint in api_spec.md against the frozen fixture graph,
so the frontend can be built and demoed without waiting on the real
backend (Phase 5). Uses only the Python standard library — no pip install
needed, so any teammate can run this in seconds.

Run:
    python3 mock_server.py
Serves on http://localhost:8000, matching vite.config.js's proxy target.

When Phase 5's real FastAPI app is ready, just stop this and run that
instead — the frontend needs zero changes, since both speak the exact
same contract.
"""

import json
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

FIXTURE_PATH = Path(__file__).parent.parent / "phase0" / "fixtures" / "sample_graph.json"
GRAPH = json.loads(FIXTURE_PATH.read_text())


def find_node(node_id):
    return next((n for n in GRAPH["nodes"] if n["id"] == node_id), None)


def direct_dependents(node_id):
    """Nodes that CALL or IMPORT the given node (reverse edge lookup)."""
    return [
        e["source"]
        for e in GRAPH["edges"]
        if e["target"] == node_id and e["type"] in ("CALLS", "IMPORTS")
    ]


def affected_tests(node_id):
    return [e["source"] for e in GRAPH["edges"] if e["target"] == node_id and e["type"] == "TESTS"]


def build_impact(node_id):
    deps = direct_dependents(node_id)
    tests = affected_tests(node_id)
    risk = "HIGH" if len(deps) >= 2 else "MEDIUM" if len(deps) == 1 else "LOW"
    name = (find_node(node_id) or {}).get("name", node_id)
    return {
        "target_node_id": node_id,
        "risk_level": risk,
        "direct_dependents": deps,
        "indirect_dependents": [],
        "affected_tests": tests,
        "summary_text": (
            f"{len(deps)} component(s) and {len(tests)} test(s) depend on {name}. "
            f"Changing it directly affects: {', '.join(deps) if deps else 'nothing else in the graph'}."
        ),
    }


# Canned answers for the exact questions used in the demo script — matches
# the shape any real /ask response must return. Falls back to a generic
# graph-grounded-sounding answer for anything else so the UI never breaks
# during free-form testing.
CANNED_ANSWERS = [
    (
        re.compile(r"architecture|explain.*system|overview", re.I),
        {
            "answer_text": (
                "This is a layered service architecture. The API layer (routes.py) "
                "exposes POST /payment, which calls into PaymentService. PaymentService "
                "coordinates the user lookup, the Stripe charge, and the database write."
            ),
            "highlighted_node_ids": [
                "api/routes.py::POST /payment",
                "services/payment.py::PaymentService",
                "services/user.py::get_user",
                "stripe",
                "database/db.py::save_transaction",
            ],
        },
    ),
    (
        re.compile(r"payment.*happens|what happens.*payment", re.I),
        {
            "answer_text": (
                "A POST /payment request calls process_payment, which looks up the user, "
                "charges via Stripe, and saves the transaction to the database."
            ),
            "highlighted_node_ids": [
                "api/routes.py::POST /payment",
                "services/payment.py::process_payment",
                "services/user.py::get_user",
                "stripe",
                "database/db.py::save_transaction",
            ],
        },
    ),
    (
        re.compile(r"why.*(fail|break|error)|checkout", re.I),
        {
            "answer_text": (
                "checkout() calls process_payment() and assumes it always returns a "
                "Payment object. process_payment() has a path that returns None when the "
                "user has no valid payment method, so checkout.py:44 raises an "
                "AttributeError on payment.id."
            ),
            "highlighted_node_ids": [
                "api/checkout.py::checkout",
                "services/payment.py::process_payment",
            ],
        },
    ),
]

DEFAULT_ANSWER = {
    "answer_text": (
        "I can see PaymentService, its call chain into Stripe and the database, and "
        "its dependents (routes.py, checkout.py). Try asking about the architecture, "
        "what happens during a payment, or why checkout is failing."
    ),
    "highlighted_node_ids": ["services/payment.py::PaymentService"],
}


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/graph":
            return self._send_json(GRAPH)

        if path == "/health":
            return self._send_json(
                {
                    "architecture_score": 82,
                    "maintainability_score": 76,
                    "test_coverage": 0.82,
                    "critical_risks": 3,
                    "circular_dependencies": 1,
                    "high_coupling_count": 4,
                }
            )

        if path.startswith("/impact/"):
            node_id = unquote(path[len("/impact/"):])
            node = find_node(node_id)
            if not node:
                return self._send_json({"error": "node_id not found", "code": "NOT_FOUND"}, 404)
            return self._send_json(build_impact(node_id))

        return self._send_json({"error": "not found", "code": "NOT_FOUND"}, 404)

    def do_POST(self):
        path = urlparse(self.path).path

        if path == "/scan":
            self._read_json_body()
            return self._send_json(
                {"status": "ok", "node_count": len(GRAPH["nodes"]), "edge_count": len(GRAPH["edges"])}
            )

        if path == "/ask":
            body = self._read_json_body()
            question = body.get("question", "")
            for pattern, answer in CANNED_ANSWERS:
                if pattern.search(question):
                    return self._send_json(answer)
            return self._send_json(DEFAULT_ANSWER)

        if path.startswith("/testgen/"):
            return self._send_json(
                {
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
            )

        return self._send_json({"error": "not found", "code": "NOT_FOUND"}, 404)

    def log_message(self, format, *args):
        print(f"[mock_server] {self.address_string()} - {format % args}")


if __name__ == "__main__":
    port = 8000
    print(f"RepoLens mock server running on http://localhost:{port}")
    print(f"Serving fixture: {FIXTURE_PATH}")
    HTTPServer(("localhost", port), Handler).serve_forever()
