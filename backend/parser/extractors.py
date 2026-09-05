"""
parser/extractors.py — Phase 1

Turns a repo path into raw Node/Edge lists matching graph/schema.py.
This is the Phase 1 deliverable per the blueprint: functions, classes,
imports, and the deliberately scoped-down call resolution from §4.

Output contract: extract_repo(repo_path) -> (list[Node], list[Edge])
Downstream (Phase 2 / graph/builder.py) just drops this straight into
NetworkX — nothing here knows about NetworkX.

Design notes (mirrors blueprint §4 — read this before "fixing" a
missing edge, it's probably intentional):
  - Imports: only same-repo imports are resolved to a FILE node.
    Third-party imports (e.g. `import stripe`) become a single
    EXTERNAL_SERVICE node per top-level package name, deduped.
  - Calls: `foo()` resolves only if `foo` is defined in the same file,
    or imported by name directly into the current file's namespace.
    `self.service.charge()`-style attribute dispatch is NOT resolved
    (would need type inference) — such calls are silently skipped,
    never crash the extractor.
  - Classes: INHERITS edges only for literal base names in
    `class Foo(Bar):` — no dynamic base class construction.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from tree_sitter import Query, QueryCursor

from graph.schema import Node, NodeType, Edge, EdgeType
from parser.ts_setup import get_python_language, parse_source
from scanner.repo_scanner import ScannedFile, scan_repo, is_test_file

_QUERY_PATH = os.path.join(os.path.dirname(__file__), "queries", "python.scm")


def _load_query() -> Query:
    with open(_QUERY_PATH, "r") as f:
        src = f.read()
    return Query(get_python_language(), src)


# ---------------------------------------------------------------------------
# Per-file intermediate representation (before cross-file resolution)
# ---------------------------------------------------------------------------

@dataclass
class RawImport:
    # For `import x.y`      -> module="x.y", name=None,  alias=None
    # For `import x as y`   -> module="x",   name=None,  alias="y"
    # For `from x import y` -> module="x",   name="y",   alias=None
    # For `from . import y` -> module=".",   name="y",   alias=None (relative)
    module: str | None
    name: str | None
    alias: str | None
    line: int


@dataclass
class RawCall:
    name: str
    line: int
    enclosing_id: str  # node id of the function/method the call happens inside,
                        # or the FILE node id if it's module-level code


@dataclass
class FileExtraction:
    scanned: ScannedFile
    module_dotted: str                       # dotted module path, e.g. "services.payment"
    functions: dict[str, Node] = field(default_factory=dict)   # qualified name -> Node
    classes: dict[str, Node] = field(default_factory=dict)     # class name -> Node
    class_bases: dict[str, list[str]] = field(default_factory=dict)  # class name -> literal base names
    imports: list[RawImport] = field(default_factory=list)
    calls: list[RawCall] = field(default_factory=list)
    defines_edges: list[Edge] = field(default_factory=list)


def _rel_to_module(rel_path: str) -> str:
    """'services/payment.py' -> 'services.payment'; '.../__init__.py' -> package dotted path."""
    no_ext = rel_path[:-3] if rel_path.endswith(".py") else rel_path
    parts = no_ext.split("/")
    if parts and parts[-1] == "__init__":
        parts = parts[:-1]
    return ".".join(parts)


def _enclosing_function_id(node, file_id: str, module_dotted: str, source: bytes) -> str:
    """Walk up from a call-expression node to find the nearest enclosing
    function_definition (or class method), returning its qualified node id.
    Falls back to the FILE node id for module-level calls."""
    cur = node.parent
    class_name = None
    func_name = None
    while cur is not None:
        if cur.type == "function_definition" and func_name is None:
            name_node = cur.child_by_field_name("name")
            if name_node is not None:
                func_name = name_node.text.decode("utf-8", "replace")
        if cur.type == "class_definition" and class_name is None:
            name_node = cur.child_by_field_name("name")
            if name_node is not None:
                class_name = name_node.text.decode("utf-8", "replace")
        cur = cur.parent
    if func_name is None:
        return file_id
    qualified = f"{class_name}.{func_name}" if class_name else func_name
    return f"{file_id}::{qualified}"


def _extract_single_file(scanned: ScannedFile) -> FileExtraction:
    file_id = scanned.rel_path
    module_dotted = _rel_to_module(scanned.rel_path)

    with open(scanned.abs_path, "rb") as f:
        source = f.read()

    tree = parse_source(source)
    root = tree.root_node
    query = _load_query()
    cursor = QueryCursor(query)
    matches = cursor.matches(root)

    fx = FileExtraction(scanned=scanned, module_dotted=module_dotted)

    def text(n) -> str:
        return n.text.decode("utf-8", "replace")

    for _pattern_index, captures in matches:
        # --- function definitions ---
        if "function.def" in captures and "function.name" in captures:
            def_node = captures["function.def"][0]
            name_node = captures["function.name"][0]
            name = text(name_node)

            # is this a method (nested directly in a class body)?
            class_name = None
            p = def_node.parent
            while p is not None:
                if p.type == "class_definition":
                    class_name = text(p.child_by_field_name("name"))
                    break
                if p.type in ("module",):
                    break
                p = p.parent

            qualified = f"{class_name}.{name}" if class_name else name
            if qualified in fx.functions:
                continue  # already recorded (queries can co-match nested patterns)

            node = Node(
                id=f"{file_id}::{qualified}",
                type=NodeType.FUNCTION,
                name=name,
                file=file_id,
                line_start=def_node.start_point[0] + 1,
                line_end=def_node.end_point[0] + 1,
                metadata={"qualified_name": qualified, "is_method": class_name is not None},
            )
            fx.functions[qualified] = node

        # --- class definitions + literal base classes ---
        if "class.def" in captures and "class.name" in captures:
            def_node = captures["class.def"][0]
            name = text(captures["class.name"][0])
            if name not in fx.classes:
                node = Node(
                    id=f"{file_id}::{name}",
                    type=NodeType.CLASS,
                    name=name,
                    file=file_id,
                    line_start=def_node.start_point[0] + 1,
                    line_end=def_node.end_point[0] + 1,
                    metadata={},
                )
                fx.classes[name] = node
                fx.class_bases[name] = []
            if "class.base" in captures:
                for base_node in captures["class.base"]:
                    # only keep bases that belong to *this* class.def match
                    if base_node.start_byte >= def_node.start_byte and base_node.end_byte <= def_node.end_byte:
                        base_name = text(base_node)
                        if base_name not in fx.class_bases[name]:
                            fx.class_bases[name].append(base_name)

        # --- plain `import x[.y.z]` [as alias] ---
        if "import.module" in captures and "import.from_module" not in captures and "import.name" not in captures:
            for mod_node in captures["import.module"]:
                alias = text(captures["import.alias"][0]) if "import.alias" in captures else None
                fx.imports.append(RawImport(
                    module=text(mod_node), name=None, alias=alias,
                    line=mod_node.start_point[0] + 1,
                ))

        # --- `from x import y` [as alias] / `from . import y` ---
        if "import.name" in captures:
            from_module = None
            if "import.from_module" in captures:
                from_module = text(captures["import.from_module"][0])
            elif "import.relative_module" in captures:
                from_module = text(captures["import.relative_module"][0])
            for name_node in captures["import.name"]:
                alias = text(captures["import.alias"][0]) if "import.alias" in captures else None
                fx.imports.append(RawImport(
                    module=from_module, name=text(name_node), alias=alias,
                    line=name_node.start_point[0] + 1,
                ))

        # --- direct-name calls: foo(...) ---
        if "call.name" in captures:
            for name_node in captures["call.name"]:
                enclosing = _enclosing_function_id(name_node, file_id, module_dotted, source)
                fx.calls.append(RawCall(name=text(name_node), line=name_node.start_point[0] + 1, enclosing_id=enclosing))

    return fx


# ---------------------------------------------------------------------------
# Cross-file resolution (imports -> FILE/EXTERNAL_SERVICE, calls -> FUNCTION)
# ---------------------------------------------------------------------------

def _build_module_index(extractions: list[FileExtraction]) -> dict[str, FileExtraction]:
    """dotted module path -> FileExtraction, so `from services.payment import X`
    can be matched to services/payment.py."""
    return {fx.module_dotted: fx for fx in extractions}


def _resolve_import_target_file(
    imp: RawImport, from_fx: FileExtraction, module_index: dict[str, FileExtraction]
) -> FileExtraction | None:
    """Return the FileExtraction a same-repo import resolves to, or None
    if it's external / unresolvable (e.g. unsupported relative-dot depth)."""
    if imp.module is None:
        return None
    if imp.module == ".":
        # `from . import name` -> sibling module `name` in the same package
        pkg = from_fx.module_dotted.rsplit(".", 1)[0] if "." in from_fx.module_dotted else ""
        candidate = f"{pkg}.{imp.name}" if pkg else imp.name
        return module_index.get(candidate)
    if imp.module.startswith("."):
        # deeper relative imports (`from .. import x`) — best-effort, skip if ambiguous
        return None
    return module_index.get(imp.module)


def extract_repo(repo_path: str) -> tuple[list[Node], list[Edge]]:
    """
    Phase 1 entry point.

    Returns (nodes, edges) matching graph/schema.py, ready for Phase 2's
    graph/builder.py to load into NetworkX. Never raises on a single
    file's parse/resolve failure — that file is skipped and extraction
    continues (a hackathon demo repo dying on one weird file is not
    an option).
    """
    scanned_files = scan_repo(repo_path)

    extractions: list[FileExtraction] = []
    for sf in scanned_files:
        try:
            extractions.append(_extract_single_file(sf))
        except Exception as e:  # noqa: BLE001 — deliberate: one bad file shouldn't kill the scan
            print(f"[extractors] skipping {sf.rel_path}: {e}")

    module_index = _build_module_index(extractions)

    nodes: list[Node] = []
    edges: list[Edge] = []
    external_nodes: dict[str, Node] = {}   # top-level package name -> EXTERNAL_SERVICE node

    def get_external_node(pkg_root: str) -> Node:
        if pkg_root not in external_nodes:
            external_nodes[pkg_root] = Node(
                id=f"EXTERNAL::{pkg_root}",
                type=NodeType.EXTERNAL_SERVICE,
                name=pkg_root,
                file="",
                line_start=0,
                line_end=0,
                metadata={},
            )
        return external_nodes[pkg_root]

    for fx in extractions:
        file_id = fx.scanned.rel_path
        file_node = Node(
            id=file_id,
            type=NodeType.TEST if is_test_file(file_id) else NodeType.FILE,
            name=os.path.basename(file_id),
            file=file_id,
            line_start=1,
            line_end=0,  # filled below once we know source length isn't needed for MVP
            metadata={"module": fx.module_dotted},
        )
        nodes.append(file_node)

        # DEFINES: file -> class, file -> top-level function
        for cls_node in fx.classes.values():
            nodes.append(cls_node)
            edges.append(Edge(source=file_id, target=cls_node.id, type=EdgeType.DEFINES))
        for qualified, fn_node in fx.functions.items():
            nodes.append(fn_node)
            if fn_node.metadata.get("is_method"):
                class_name = qualified.split(".", 1)[0]
                cls_node = fx.classes.get(class_name)
                if cls_node is not None:
                    edges.append(Edge(source=cls_node.id, target=fn_node.id, type=EdgeType.DEFINES))
                else:
                    edges.append(Edge(source=file_id, target=fn_node.id, type=EdgeType.DEFINES))
            else:
                edges.append(Edge(source=file_id, target=fn_node.id, type=EdgeType.DEFINES))

        # IMPORTS: resolve same-repo vs external (§4)
        # also build a local "imported name -> Node" map (functions AND classes)
        # used for both call resolution and cross-file INHERITS resolution below
        imported_functions: dict[str, Node] = {}
        seen_import_targets: set[str] = set()
        for imp in fx.imports:
            target_fx = _resolve_import_target_file(imp, fx, module_index)
            if target_fx is not None:
                target_file_id = target_fx.scanned.rel_path
                if target_file_id not in seen_import_targets:
                    edges.append(Edge(
                        source=file_id, target=target_file_id, type=EdgeType.IMPORTS,
                        metadata={"line": imp.line},
                    ))
                    seen_import_targets.add(target_file_id)
                # if it's a `from x import name`, and `name` is a function or class
                # defined in that module, register it for call/inherits resolution
                if imp.name:
                    local_name = imp.alias or imp.name
                    if imp.name in target_fx.functions:
                        imported_functions[local_name] = target_fx.functions[imp.name]
                    elif imp.name in target_fx.classes:
                        imported_functions[local_name] = target_fx.classes[imp.name]
            else:
                if imp.module is None:
                    continue  # unresolvable relative import, skip silently per §4
                pkg_root = imp.module.split(".")[0]
                ext_node = get_external_node(pkg_root)
                key = f"EXT::{pkg_root}"
                if key not in seen_import_targets:
                    edges.append(Edge(
                        source=file_id, target=ext_node.id, type=EdgeType.IMPORTS,
                        metadata={"line": imp.line},
                    ))
                    seen_import_targets.add(key)

        # INHERITS: literal base classes only (§4)
        for cls_name, bases in fx.class_bases.items():
            cls_node = fx.classes[cls_name]
            for base_name in bases:
                target = None
                if base_name in fx.classes:
                    target = fx.classes[base_name].id
                elif base_name in imported_functions:
                    # imported_functions also happens to catch imported classes
                    # since we don't distinguish class vs function at import time
                    target = imported_functions[base_name].id
                if target:
                    edges.append(Edge(source=cls_node.id, target=target, type=EdgeType.INHERITS))
                # else: base class not resolvable (e.g. stdlib/third-party) — skip silently

        # CALLS: same-file definition, or imported-by-name (§4) — else silent skip
        for call in fx.calls:
            target_node = None
            # same-file: match against any function/method name (last path component)
            for qualified, fn_node in fx.functions.items():
                short_name = qualified.split(".")[-1]
                if short_name == call.name:
                    target_node = fn_node
                    break
            if target_node is None and call.name in imported_functions:
                target_node = imported_functions[call.name]
            if target_node is None:
                continue  # unresolvable dispatch (e.g. self.service.charge()) — skip, don't crash
            edges.append(Edge(
                source=call.enclosing_id, target=target_node.id, type=EdgeType.CALLS,
                metadata={"line": call.line},
            ))

    nodes.extend(external_nodes.values())
    return nodes, edges


if __name__ == "__main__":
    import sys
    import json

    target = sys.argv[1] if len(sys.argv) > 1 else "."
    nodes, edges = extract_repo(target)
    print(f"Extracted {len(nodes)} nodes, {len(edges)} edges from {target}\n")
    print(json.dumps({
        "nodes": [n.to_dict() for n in nodes],
        "edges": [e.to_dict() for e in edges],
    }, indent=2))
