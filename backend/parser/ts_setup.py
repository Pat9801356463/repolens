"""
parser/ts_setup.py — Phase 1

Loads the tree-sitter Python grammar and hands back a ready-to-use
Parser + Language pair. Kept in its own module so extractors.py stays
focused on query logic, and so we only pay the grammar-load cost once
per process (module-level cache).

Tested against: tree_sitter==0.25.x, tree_sitter_python==0.25.x
"""
from __future__ import annotations

import functools

import tree_sitter_python as tspython
from tree_sitter import Language, Parser


@functools.lru_cache(maxsize=1)
def get_python_language() -> Language:
    return Language(tspython.language())


@functools.lru_cache(maxsize=1)
def get_python_parser() -> Parser:
    return Parser(get_python_language())


def parse_source(source_bytes: bytes):
    """Parse raw source bytes and return the tree-sitter Tree."""
    parser = get_python_parser()
    return parser.parse(source_bytes)
