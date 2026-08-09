# -*- coding: utf-8 -*-
"""Compile and import-check the Python backend runtime modules."""

from __future__ import annotations

import ast
import importlib
import sys
from pathlib import Path


REQUIRED_IMPORTS = [
    "bs4",
    "chardet",
    "docx",
    "dotenv",
    "googletrans",
    "langdetect",
    "lxml",
    "openai",
    "openpyxl",
    "PIL",
    "playwright",
    "requests",
    "sqlalchemy",
    "thefuzz",
]

BACKEND_MODULES = [
    "python_backend.main",
    "python_backend.services.currency_converter",
    "python_backend.services.itk",
    "python_backend.services.netflex",
    "python_backend.services.obscura_manager",
    "python_backend.services.orkim",
    "python_backend.services.sigma_playwright",
    "python_backend.services.tci_playwright",
]


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

    backend_dir = repo_root / "python_backend"
    ok = True

    for path in sorted(backend_dir.rglob("*.py")):
        try:
            ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            print(f"SYNTAX OK {path.relative_to(repo_root)}")
        except Exception as exc:
            ok = False
            print(f"SYNTAX FAIL {path.relative_to(repo_root)}: {type(exc).__name__}: {exc}")

    for module_name in REQUIRED_IMPORTS:
        try:
            importlib.import_module(module_name)
            print(f"IMPORT OK {module_name}")
        except Exception as exc:
            ok = False
            print(f"IMPORT FAIL {module_name}: {type(exc).__name__}: {exc}")

    for module_name in BACKEND_MODULES:
        try:
            importlib.import_module(module_name)
            print(f"BACKEND OK {module_name}")
        except Exception as exc:
            ok = False
            print(f"BACKEND FAIL {module_name}: {type(exc).__name__}: {exc}")

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
