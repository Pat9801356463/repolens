"""
ai/pipeline.py

The single function main.py's /ask endpoint will call. Implements the
full RAG flow from blueprint §5 end to end and always returns the frozen
contract:

    { "answer_text": str, "highlighted_node_ids": list[str] }

even in failure modes — a demo mid-question crash is worse than a slightly
wrong answer, so this degrades instead of raising wherever it safely can.
"""
from __future__ import annotations

from ai import prompts, retriever
from ai.intent import classify_intent
from ai.llm_client import LLMClient, LLMError

# Cache for the whole-graph architecture summary text (§5: "pre-computed
# once at load time, cached"). Keyed by id(graph) since a single process
# only ever loads one graph at a time in this MVP.
_architecture_context_cache: dict[int, str] = {}


def _safe_result(answer_text: str, highlighted_node_ids: list[str] | None = None) -> dict:
    return {"answer_text": answer_text, "highlighted_node_ids": highlighted_node_ids or []}


def _get_architecture_context(graph, repo_root: str | None) -> str:
    key = id(graph)
    if key not in _architecture_context_cache:
        _architecture_context_cache[key] = retriever.build_architecture_summary_context(graph, repo_root=repo_root)
    return _architecture_context_cache[key]


def answer_question(
    question: str,
    graph,
    llm_client: LLMClient,
    repo_root: str | None = None,
    context_node_id: str | None = None,
) -> dict:
    """Route `question` through intent classification -> retrieval ->
    prompt assembly -> LLM call, per blueprint §5.

    `context_node_id` is whatever node the UI currently has selected or
    last discussed — retrieval falls back to it when the question itself
    names nothing the graph recognizes (see ai/retriever.py).
    """
    intent = classify_intent(question, llm_client)

    if intent == "architecture_overview":
        return _handle_architecture(question, graph, llm_client, repo_root)
    if intent == "impact_analysis":
        return _handle_impact(question, graph, llm_client, repo_root, context_node_id)
    if intent == "bug_trace":
        return _handle_bug_trace(question, graph, llm_client, repo_root, context_node_id)
    if intent == "test_gen":
        return _safe_result(
            "Test generation runs as a separate pre-baked step — see the "
            "Test Generation panel for cached results rather than asking here."
        )
    return _handle_general_qa(question, graph, llm_client, repo_root, context_node_id)


def _call_and_parse(system: str, user: str, llm_client: LLMClient, valid_ids: set[str]) -> dict:
    try:
        result = llm_client.complete_json(system, user)
        answer_text = str(result.get("answer_text", "")).strip()
        ids = result.get("highlighted_node_ids", [])
        # Never trust the LLM's ids blindly (prompts say not to invent them,
        # but models hallucinate) — filter to ids that actually exist.
        clean_ids = [i for i in ids if isinstance(i, str) and i in valid_ids]
        if not answer_text:
            return _safe_result("The model returned an empty answer. Try rephrasing the question.")
        return _safe_result(answer_text, clean_ids)
    except LLMError:
        return _safe_result("I couldn't parse a response from the model — try asking again.")
    except Exception as exc:  # provider/network failure mid-demo
        return _safe_result(f"The AI service is unavailable right now ({exc.__class__.__name__}).")


def _handle_architecture(question: str, graph, llm_client: LLMClient, repo_root: str | None) -> dict:
    context = _get_architecture_context(graph, repo_root)
    system, user = prompts.build_architecture_prompt(context, question)
    return _call_and_parse(system, user, llm_client, set(graph.nodes))


def _handle_impact(
    question: str, graph, llm_client: LLMClient, repo_root: str | None, context_node_id: str | None = None
) -> dict:
    data = retriever.retrieve_for_impact(graph, question, repo_root=repo_root, context_node_id=context_node_id)
    if data["target"] is None:
        return _safe_result(
            "I couldn't find a matching function, class, or file in the graph "
            "for that question — try naming it more specifically, or click a "
            "node in the graph first so I know what 'here' refers to."
        )
    system, user = prompts.build_impact_prompt(
        data["subgraph_text"], data["target"]["id"], data["impact_text"], question
    )
    valid_ids = {data["target"]["id"]} | {n["id"] for n in data["impact_nodes"]}
    return _call_and_parse(system, user, llm_client, valid_ids)


def _handle_bug_trace(
    question: str, graph, llm_client: LLMClient, repo_root: str | None, context_node_id: str | None = None
) -> dict:
    data = retriever.retrieve_for_bug_trace(graph, question, repo_root=repo_root, context_node_id=context_node_id)
    if data["entry"] is None:
        return _safe_result(
            "I couldn't find a matching entry point in the graph for that "
            "question — try naming the route or function involved, or click "
            "a node in the graph first so I know what 'here' refers to."
        )
    system, user = prompts.build_bug_trace_prompt(data["subgraph_text"], data["trace_text"], question)
    valid_ids = {data["entry"]["id"]} | {n["id"] for n in data["trace_nodes"]}
    return _call_and_parse(system, user, llm_client, valid_ids)


def _handle_general_qa(
    question: str, graph, llm_client: LLMClient, repo_root: str | None, context_node_id: str | None = None
) -> dict:
    data = retriever.retrieve_for_general_qa(graph, question, repo_root=repo_root, context_node_id=context_node_id)
    if not data["node_ids"]:
        return _safe_result(
            "I couldn't find anything in the codebase graph matching that "
            "question — try naming a specific file, class, or function, or "
            "click a node in the graph first so I know what 'here' refers to."
        )
    system, user = prompts.build_general_qa_prompt(data["subgraph_text"], question)
    return _call_and_parse(system, user, llm_client, set(data["node_ids"]))
