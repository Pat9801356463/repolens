"""
ai/intent.py

Classifies a user question into one of the routes from blueprint §5:
architecture_overview | impact_analysis | bug_trace | test_gen | general_qa

Primary path is the LLM call the blueprint specifies ("cheap prompt"). A
keyword-based fallback runs if the LLM call fails or returns something
unparseable — per §9, a live LLM call is only "low-stakes if slow", but a
crashed intent classifier would take down every single demo beat, so it
gets a safety net the individual feature prompts don't need.
"""
from __future__ import annotations

from ai.llm_client import LLMClient
from ai.prompts import INTENT_SYSTEM_PROMPT

VALID_INTENTS = {
    "architecture_overview",
    "impact_analysis",
    "bug_trace",
    "test_gen",
    "general_qa",
}

_KEYWORD_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("test_gen", ("generate test", "write test", "test coverage", "run the tests", "unit test")),
    ("bug_trace", ("why is", "why does", "failing", "error", "traceback", "bug", "crash", "exception")),
    ("impact_analysis", ("what breaks", "what if i change", "impact of", "affect", "depend on", "safe to change", "blast radius", "risk")),
    ("architecture_overview", ("architecture", "overview", "how is this structured", "explain the system", "high level", "how does this codebase work")),
]


def classify_intent_by_keywords(question: str) -> str:
    q = question.lower()
    for intent, keywords in _KEYWORD_RULES:
        if any(kw in q for kw in keywords):
            return intent
    return "general_qa"


def classify_intent(question: str, llm_client: LLMClient) -> str:
    """LLM-first classification with a deterministic keyword fallback.

    Never raises — worst case it degrades to keyword matching, which is
    good enough to keep every demo beat routable even if the LLM API
    hiccups mid-demo (§9's stated risk).
    """
    try:
        result = llm_client.complete_json(INTENT_SYSTEM_PROMPT, f"Question: {question}", max_tokens=50)
        intent = str(result.get("intent", "")).strip()
        if intent in VALID_INTENTS:
            return intent
    except Exception:
        # Broad on purpose: provider SDKs raise their own exception types
        # (rate limits, timeouts, auth errors) that we don't want to import
        # here just to catch. Any failure means "fall back to keywords".
        pass
    return classify_intent_by_keywords(question)
