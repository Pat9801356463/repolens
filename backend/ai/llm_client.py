"""
ai/llm_client.py

Provider-agnostic LLM wrapper (blueprint §1: "Abstract it so you can swap
providers if one rate-limits mid-demo"). Everything else in ai/ talks to
`LLMClient.complete(...)` and never touches a provider SDK directly.

Provider is chosen via the LLM_PROVIDER env var: "anthropic" | "openai" |
"gemini" | "mock". Defaults to "mock" so the rest of Phase 3 is importable
and testable with zero API keys and zero network calls — exactly what lets
this phase develop fully in parallel against the fixture graph.
"""
from __future__ import annotations

import json
import os
import re
from abc import ABC, abstractmethod


class LLMError(Exception):
    """Raised when a provider call fails after retries."""


class LLMClient(ABC):
    @abstractmethod
    def complete(self, system: str, user: str, max_tokens: int = 800) -> str:
        """Return raw text completion for a system+user prompt pair."""

    def complete_json(self, system: str, user: str, max_tokens: int = 800) -> dict:
        """Complete and parse the result as JSON, tolerating markdown fences
        and minor formatting noise (LLMs love wrapping JSON in ```json).
        """
        raw = self.complete(system, user, max_tokens=max_tokens)
        return _extract_json(raw)


def _extract_json(raw: str) -> dict:
    text = raw.strip()
    text = re.sub(r"^```(?:json)?", "", text.strip(), flags=re.IGNORECASE).strip()
    text = re.sub(r"```$", "", text.strip()).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Last resort: grab the first {...} block in the text.
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    raise LLMError(f"Could not parse JSON from LLM response: {raw[:300]!r}")


class AnthropicClient(LLMClient):
    def __init__(self, model: str = "claude-sonnet-4-6", api_key: str | None = None):
        import anthropic  # local import: only required if this provider is used

        self.model = model
        self._client = anthropic.Anthropic(api_key=api_key or os.environ.get("ANTHROPIC_API_KEY"))

    def complete(self, system: str, user: str, max_tokens: int = 800) -> str:
        resp = self._client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return "".join(block.text for block in resp.content if block.type == "text")


class OpenAIClient(LLMClient):
    def __init__(self, model: str = "gpt-4o-mini", api_key: str | None = None):
        import openai  # local import: only required if this provider is used

        self.model = model
        self._client = openai.OpenAI(api_key=api_key or os.environ.get("OPENAI_API_KEY"))

    def complete(self, system: str, user: str, max_tokens: int = 800) -> str:
        resp = self._client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        return resp.choices[0].message.content or ""


class GeminiClient(LLMClient):
    """Uses the current `google-genai` SDK (the old `google-generativeai`
    package was fully retired by Google on Nov 30, 2025 — frozen at v0.8.6,
    no further fixes). Free-tier eligible models as of this writing:
    gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.5-pro."""

    def __init__(self, model: str = "gemini-2.5-flash", api_key: str | None = None):
        from google import genai  # local import: only required if this provider is used

        self.model = model
        self._client = genai.Client(api_key=api_key or os.environ.get("GEMINI_API_KEY"))

    def complete(self, system: str, user: str, max_tokens: int = 800) -> str:
        from google.genai import types

        resp = self._client.models.generate_content(
            model=self.model,
            contents=user,
            config=types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=max_tokens,
            ),
        )
        return resp.text or ""


class MockLLMClient(LLMClient):
    """Deterministic stand-in used for offline development and unit tests.

    Per blueprint §7's whole premise ("the LLM doesn't know the difference"
    when pointed at the fixture graph) — this takes that one step further
    for CI/dev: no network call at all, just a canned-but-structurally-valid
    response so every other Phase 3 module (intent, retriever, pipeline)
    can be built and tested before any API key exists.
    """

    def __init__(self, canned_responses: list[str] | None = None):
        self._queue = list(canned_responses or [])
        self.calls: list[tuple[str, str]] = []

    def complete(self, system: str, user: str, max_tokens: int = 800) -> str:
        self.calls.append((system, user))
        if self._queue:
            return self._queue.pop(0)
        # Generic fallback: try to be a plausible intent classifier or QA
        # answer depending on what's being asked, so ad-hoc calls in a demo
        # rehearsal don't just crash.
        if "architecture_overview" in system or "architecture_overview" in user:
            return json.dumps({"intent": "general_qa"})
        return json.dumps({"answer_text": "[mock] no canned response queued", "highlighted_node_ids": []})


def get_llm_client(provider: str | None = None) -> LLMClient:
    """Factory. Reads LLM_PROVIDER env var if `provider` not given."""
    provider = (provider or os.environ.get("LLM_PROVIDER", "mock")).lower()
    if provider == "anthropic":
        return AnthropicClient()
    if provider == "openai":
        return OpenAIClient()
    if provider == "gemini":
        return GeminiClient()
    if provider == "mock":
        return MockLLMClient()
    raise ValueError(f"Unknown LLM provider: {provider!r}")
