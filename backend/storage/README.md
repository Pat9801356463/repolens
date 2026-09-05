# backend/storage/

- `graph_cache.json` — the built demo-repo graph, so the server doesn't
  need to re-run tree-sitter parsing on every startup. Regenerate with:
  `python3 ../scripts/prebuild_demo_graph.py` (run from `backend/`, or
  `python3 scripts/prebuild_demo_graph.py` from the project root).

- `testgen_cache.json` — pre-baked test-generation results (blueprint
  §0/§9: "generate and run once before the demo, cache the output,
  replay it"). Ships as `{}` — POST /testgen/{node_id} falls back to a
  generic-but-plausible canned result for any node not in this file, so
  the endpoint always returns *something* demo-safe. To get real
  per-node results, run the real prebake with an actual LLM key before
  demo day:

      LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-... \
        python3 scripts/prebuild_demo_graph.py --with-testgen

  Never run test-gen live on stage — it shells out to pytest in a
  subprocess and can be slow or flaky mid-demo.
