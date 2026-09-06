"""
ai/prompts.py

One prompt template per demo feature (blueprint §0/§9): architecture
explanation, impact analysis, bug trace, and a general_qa fallback.

Every template enforces the same output contract from §5:
    { "answer_text": str, "highlighted_node_ids": [str, ...] }
so ai/pipeline.py can parse all four the same way.
"""
from __future__ import annotations

JSON_CONTRACT_INSTRUCTION = (
    "Respond with ONLY a single JSON object, no markdown fences, no preamble, "
    "matching exactly this shape:\n"
    '{"answer_text": "<your answer as plain text>", '
    '"highlighted_node_ids": ["<node id>", "..."]}\n'
    "highlighted_node_ids must only contain node ids that appear in the "
    "context below — never invent ids."
)

INTENT_SYSTEM_PROMPT = (
    "You are the intent classifier for RepoLens, a codebase-understanding "
    "assistant. Classify the user's question into exactly one category:\n"
    "- architecture_overview: asking about the overall system design/structure\n"
    "- impact_analysis: asking what breaks/is affected if a piece of code changes\n"
    "- bug_trace: asking why something is failing or how an error propagates\n"
    "- test_gen: asking to generate or run tests\n"
    "- general_qa: anything else about the codebase\n"
    'Respond with ONLY JSON: {"intent": "<one of the categories above>"}'
)


def build_architecture_prompt(subgraph_text: str, question: str) -> tuple[str, str]:
    system = (
        "You are RepoLens, an assistant that explains a codebase's "
        "architecture to engineers using a dependency graph as ground truth. "
        "Be concrete: name the actual files, classes, and functions from the "
        "context. Do not invent components that aren't in the graph.\n\n"
        + JSON_CONTRACT_INSTRUCTION
    )
    user = (
        f"Here is the full system graph (nodes and edges):\n{subgraph_text}\n\n"
        f"Question: {question}\n\n"
        "Give a concise architecture explanation (3-6 sentences) grounded "
        "only in the graph above, and list the node ids most central to your "
        "explanation in highlighted_node_ids."
    )
    return system, user


def build_impact_prompt(subgraph_text: str, target_node_id: str, impact_nodes_text: str, question: str) -> tuple[str, str]:
    system = (
        "You are RepoLens, explaining the blast radius of a code change. "
        "You are given the target node and a pre-computed list of nodes "
        "that depend on it (already ordered by hop distance / severity from "
        "a graph traversal — trust this list, don't recompute it yourself). "
        "Narrate it in plain English for an engineer deciding whether the "
        "change is safe.\n\n" + JSON_CONTRACT_INSTRUCTION
    )
    user = (
        f"Target node being changed: {target_node_id}\n\n"
        f"Target node context:\n{subgraph_text}\n\n"
        f"Nodes affected (from graph traversal, ordered by severity):\n{impact_nodes_text}\n\n"
        f"Question: {question}\n\n"
        "Explain what breaks or needs attention if this node changes, "
        "highest severity first. highlighted_node_ids should be the affected "
        "node ids, most severe first."
    )
    return system, user


def build_bug_trace_prompt(subgraph_text: str, trace_text: str, question: str) -> tuple[str, str]:
    system = (
        "You are RepoLens, tracing a bug forward from an entry point through "
        "a pre-computed call trace (from a graph traversal — trust the order "
        "given, don't guess at call structure yourself). Identify the most "
        "likely point(s) of failure based on the source snippets provided.\n\n"
        + JSON_CONTRACT_INSTRUCTION
    )
    user = (
        f"Call trace from entry point, in execution order, with source:\n{trace_text}\n\n"
        f"Additional context:\n{subgraph_text}\n\n"
        f"Question: {question}\n\n"
        "Explain the likely failure path in plain English, referencing "
        "specific functions/lines. highlighted_node_ids should be the nodes "
        "on the suspected failure path, in execution order."
    )
    return system, user


def build_general_qa_prompt(subgraph_text: str, question: str) -> tuple[str, str]:
    system = (
        "You are RepoLens, answering a general question about a codebase "
        "using only the retrieved subgraph and source snippets below as "
        "ground truth. If the context doesn't contain enough information, "
        "say so plainly rather than guessing.\n\n" + JSON_CONTRACT_INSTRUCTION
    )
    user = (
        f"Retrieved context:\n{subgraph_text}\n\n"
        f"Question: {question}\n\n"
        "Answer using only the context above."
    )
    return system, user
