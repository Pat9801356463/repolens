"""
scanner/repo_scanner.py — Phase 1

Walks a repo path and returns the list of Python source files worth
parsing, filtering out virtualenvs, caches, VCS dirs, and other noise.
This never touches the API or frontend (see blueprint Phase 1 contract).
"""
from __future__ import annotations

import os
from dataclasses import dataclass

# Directory names to never descend into.
IGNORED_DIRS = {
    ".git", ".hg", ".svn",
    "venv", ".venv", "env", ".env",
    "node_modules",
    "__pycache__",
    ".mypy_cache", ".pytest_cache", ".ruff_cache",
    "build", "dist", "site-packages",
    ".tox", ".eggs",
    ".idea", ".vscode",
}

# File suffixes/names to skip even inside otherwise-scanned dirs.
IGNORED_FILE_SUFFIXES = (".pyc", ".pyo", ".so")


@dataclass
class ScannedFile:
    abs_path: str      # absolute path on disk
    rel_path: str       # path relative to repo root, POSIX-style, used as the
                         # `file` field on Nodes (e.g. "services/payment.py")


def is_test_file(rel_path: str) -> bool:
    base = os.path.basename(rel_path)
    return base.startswith("test_") or base.endswith("_test.py") or "/tests/" in rel_path.replace(os.sep, "/")


def scan_repo(repo_path: str, max_files: int | None = None) -> list[ScannedFile]:
    """
    Walk `repo_path` and return every .py file worth parsing.

    Raises FileNotFoundError / NotADirectoryError on a bad path so the
    caller (main.py's /scan endpoint) can surface a clean 400 instead of
    a stack trace.
    """
    repo_path = os.path.abspath(repo_path)
    if not os.path.isdir(repo_path):
        raise NotADirectoryError(f"Not a directory: {repo_path}")

    results: list[ScannedFile] = []

    for dirpath, dirnames, filenames in os.walk(repo_path):
        # prune ignored dirs in-place so os.walk doesn't descend into them
        dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS and not d.startswith(".")]

        for fname in filenames:
            if not fname.endswith(".py"):
                continue
            if fname.endswith(IGNORED_FILE_SUFFIXES):
                continue

            abs_path = os.path.join(dirpath, fname)
            rel_path = os.path.relpath(abs_path, repo_path).replace(os.sep, "/")
            results.append(ScannedFile(abs_path=abs_path, rel_path=rel_path))

            if max_files is not None and len(results) >= max_files:
                return results

    return results


if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "."
    files = scan_repo(target)
    print(f"Found {len(files)} Python files under {target}:")
    for f in files:
        print(" -", f.rel_path)
