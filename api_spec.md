# RepoLens API Spec (frozen after Phase 0)

All responses are JSON. Frontend (Phase 4) builds a mock server returning
these exact example shapes; Phase 5 later swaps the mock for the real
FastAPI app without the frontend changing a line.

---

## `POST /scan`

Kicks off scanning + parsing + graph-building for a repo. For the hackathon
demo this is called once, ahead of time, against the frozen demo repo — not
live on stage.

**Request**
```json
{ "repo_path": "demo_repo/" }
```

**Response**
```json
{ "status": "ok", "node_count": 14, "edge_count": 16 }
```

---

## `GET /graph`

Returns the full current graph. Shape matches `fixtures/sample_graph.json`
exactly — that file IS a valid example response for this endpoint.

**Response**
```json
{
  "nodes": [ /* Node objects, see schema.py / sample_graph.json */ ],
  "edges": [ /* Edge objects, see schema.py / sample_graph.json */ ]
}
```

---

## `POST /ask`

The main Q&A endpoint. Backs "Explain the architecture", "why is X
failing", and general questions.

**Request**
```json
{ "question": "What happens when a user makes a payment?" }
```

**Response**
```json
{
  "answer_text": "A POST /payment request calls process_payment, which looks up the user, charges via Stripe, and saves the transaction to the database.",
  "highlighted_node_ids": [
    "api/routes.py::POST /payment",
    "services/payment.py::process_payment",
    "services/user.py::get_user",
    "stripe",
    "database/db.py::save_transaction"
  ]
}
```

Frontend behavior contract: on receiving a response, highlight exactly the
nodes in `highlighted_node_ids` in the graph view and display `answer_text`
in the chat panel. `highlighted_node_ids` may be empty for purely
conversational answers.

---

## `GET /impact/{node_id}`

Deterministic graph traversal — no LLM call needed on the backend, though
the response includes a short LLM-narrated summary for display.

Note: `node_id` must be URL-encoded (it contains `::`, `/`, and spaces).

**Request**
```
GET /impact/services%2Fpayment.py%3A%3Aprocess_payment
```

**Response**
```json
{
  "target_node_id": "services/payment.py::process_payment",
  "risk_level": "HIGH",
  "direct_dependents": [
    "api/routes.py::POST /payment",
    "api/checkout.py::checkout"
  ],
  "indirect_dependents": [],
  "affected_tests": [
    "tests/test_payment.py::test_process_payment_success"
  ],
  "summary_text": "3 components and 1 test depend on process_payment. Changing it affects the payment API route and checkout flow directly."
}
```

---

## `POST /testgen/{node_id}`

Pre-baked for the demo (per blueprint §0/§9) — real backend work happens
before the demo, this endpoint just replays cached results live.

**Request**
```
POST /testgen/services%2Fpayment.py%3A%3APaymentService
```

**Response**
```json
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
    "test_database_failure"
  ]
}
```

---

## `GET /health`

Backs the final "SYSTEM HEALTH" dashboard screen. Numbers can be a mix of
real computed metrics (cycle count, coupling from Phase 2) and precomputed
placeholders — doesn't need to be fully live.

**Response**
```json
{
  "architecture_score": 82,
  "maintainability_score": 76,
  "test_coverage": 0.82,
  "critical_risks": 3,
  "circular_dependencies": 1,
  "high_coupling_count": 4
}
```

---

## Error shape (all endpoints)

```json
{ "error": "node_id not found", "code": "NOT_FOUND" }
```
