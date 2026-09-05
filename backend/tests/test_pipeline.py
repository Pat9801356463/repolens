"""
tests/test_pipeline.py

Exercises all four routed intents (architecture_overview, impact_analysis,
bug_trace, general_qa) end to end against fixtures/sample_graph.json,
using MockLLMClient so this runs with no API key and no network — the
whole point of the fixture-based parallel-dev contract in blueprint §7.

Run: python -m tests.test_pipeline    (from the repolens/ directory)
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ai.intent import classify_intent_by_keywords
from ai.llm_client import MockLLMClient
from ai.pipeline import answer_question
from graph.analysis import find_cycles, get_impact, load_graph_from_json

FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "phase3_dev_fixture.json"


def check(label: str, condition: bool, detail: str = ""):
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {label}" + (f" — {detail}" if detail and not condition else ""))
    assert condition, detail


def main():
    graph = load_graph_from_json(str(FIXTURE_PATH))
    check("fixture graph loads", graph.number_of_nodes() == 10, f"got {graph.number_of_nodes()} nodes")

    # --- intent classification (keyword fallback, no LLM needed) ---
    check(
        "keyword intent: impact",
        classify_intent_by_keywords("what breaks if I change process_payment?") == "impact_analysis",
    )
    check(
        "keyword intent: bug trace",
        classify_intent_by_keywords("why is /api/pay failing for some users?") == "bug_trace",
    )
    check(
        "keyword intent: architecture",
        classify_intent_by_keywords("give me an architecture overview") == "architecture_overview",
    )

    # --- graph engine sanity (Phase 2 stand-in) ---
    impact = get_impact(graph, "services/validators.py::validate_card")
    impacted_ids = {n["id"] for n in impact}
    check(
        "impact analysis finds process_payment",
        "services/payment.py::PaymentService.process_payment" in impacted_ids,
    )
    check("no cycles in fixture graph", find_cycles(graph) == [])

    # --- full pipeline, one call per route, mocked LLM ---
    mock = MockLLMClient(canned_responses=[
        json.dumps({"intent": "architecture_overview"}),
        json.dumps({
            "answer_text": "The system exposes /api/pay, which calls PaymentService.process_payment, "
                           "which validates the card then charges via Stripe.",
            "highlighted_node_ids": ["api.py::pay", "services/payment.py::PaymentService.process_payment"],
        }),
    ])
    result = answer_question("Explain the architecture of this system", graph, mock)
    check("architecture_overview returns contract shape", set(result.keys()) == {"answer_text", "highlighted_node_ids"})
    check("architecture_overview answer non-empty", len(result["answer_text"]) > 0)
    check(
        "architecture_overview filters to valid node ids",
        all(nid in graph.nodes for nid in result["highlighted_node_ids"]),
    )

    mock2 = MockLLMClient(canned_responses=[
        json.dumps({"intent": "impact_analysis"}),
        json.dumps({
            "answer_text": "Changing validate_card directly affects process_payment (high severity), "
                           "which cascades to the /api/pay route.",
            "highlighted_node_ids": [
                "services/payment.py::PaymentService.process_payment",
                "api.py::pay",
                "some_hallucinated_node_id",  # should get filtered out
            ],
        }),
    ])
    result2 = answer_question("What breaks if I change validate_card?", graph, mock2)
    check("impact_analysis drops hallucinated ids", "some_hallucinated_node_id" not in result2["highlighted_node_ids"])
    check(
        "impact_analysis keeps valid ids",
        "services/payment.py::PaymentService.process_payment" in result2["highlighted_node_ids"],
    )

    mock3 = MockLLMClient(canned_responses=[
        json.dumps({"intent": "bug_trace"}),
        json.dumps({
            "answer_text": "The call chain runs pay -> process_payment -> validate_card / stripe charge. "
                           "A failure is most likely in the stripe charge call if the card token is malformed.",
            "highlighted_node_ids": ["api.py::pay", "services/payment.py::PaymentService.process_payment"],
        }),
    ])
    result3 = answer_question("Why is /api/pay failing for some requests?", graph, mock3)
    check("bug_trace answer non-empty", len(result3["answer_text"]) > 0)

    # --- failure mode: LLM raises mid-call, pipeline should degrade not crash ---
    class ExplodingClient(MockLLMClient):
        def complete(self, system, user, max_tokens=800):
            raise RuntimeError("simulated rate limit")

    exploding = ExplodingClient()
    result4 = answer_question("What breaks if I change validate_card?", graph, exploding)
    check(
        "pipeline degrades gracefully on LLM failure",
        set(result4.keys()) == {"answer_text", "highlighted_node_ids"} and len(result4["answer_text"]) > 0,
    )

    print("\nAll Phase 3 checks passed.")


if __name__ == "__main__":
    main()
