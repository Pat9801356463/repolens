"""
parser/test_extractors.py — quick standalone sanity check for Phase 1.

Not a full pytest suite (no time for that in a hackathon) — just enough
asserts to catch a regression before you hand off to Phase 2. Run with:

    cd backend && python3 -m parser.test_extractors
"""
from parser.extractors import extract_repo
from graph.schema import NodeType, EdgeType


def by_id(nodes):
    return {n.id: n for n in nodes}


def main():
    nodes, edges = extract_repo("../demo_repo")
    n = by_id(nodes)

    checks = []

    def check(name, cond):
        checks.append((name, cond))

    check("FILE node for payment.py exists", "services/payment.py" in n)
    check("FUNCTION node for process_payment exists",
          "services/payment.py::process_payment" in n)
    check("METHOD node for PaymentService.charge exists",
          "services/payment.py::PaymentService.charge" in n)
    check("CLASS node for PaymentService exists",
          "services/payment.py::PaymentService" in n)
    check("test file typed as TEST not FILE",
          n["tests/test_payment.py"].type == NodeType.TEST)
    check("external package 'stripe' becomes EXTERNAL_SERVICE",
          "EXTERNAL::stripe" in n and n["EXTERNAL::stripe"].type == NodeType.EXTERNAL_SERVICE)

    edge_set = {(e.source, e.target, e.type) for e in edges}
    check("IMPORTS: payment.py -> stripe (external)",
          ("services/payment.py", "EXTERNAL::stripe", EdgeType.IMPORTS) in edge_set)
    check("IMPORTS: orders.py -> payment.py (same-repo)",
          ("services/orders.py", "services/payment.py", EdgeType.IMPORTS) in edge_set)
    check("CALLS: create_order -> process_payment (imported-by-name, §4)",
          ("services/orders.py::create_order", "services/payment.py::process_payment", EdgeType.CALLS) in edge_set)
    check("CALLS: charge -> _call_stripe is NOT created (self.x() dispatch, §4)",
          ("services/payment.py::PaymentService.charge",
           "services/payment.py::PaymentService._call_stripe", EdgeType.CALLS) not in edge_set)
    check("DEFINES: PaymentService -> PaymentService.charge (class -> method)",
          ("services/payment.py::PaymentService", "services/payment.py::PaymentService.charge", EdgeType.DEFINES) in edge_set)
    check("TESTS-adjacent: test_payment.py imports payment.py",
          ("tests/test_payment.py", "services/payment.py", EdgeType.IMPORTS) in edge_set)

    failed = [name for name, ok in checks if not ok]
    for name, ok in checks:
        print(("PASS" if ok else "FAIL"), "-", name)

    print(f"\n{len(checks) - len(failed)}/{len(checks)} checks passed")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
