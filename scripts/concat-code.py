#!/usr/bin/env python3
"""
Concatenates code files into one text file with headers.

Usage:
    python concat_code.py                # defaults to src/
    python concat_code.py src/ tests/    # multiple folders
    python concat_code.py src/App.tsx utils/helper.js
    python concat_code.py -o output.md
"""

import sys
import os
from pathlib import Path
from typing import List
import pyperclip

DEFAULT_PATHS = ["src", "docs"]
DEFAULT_OUTPUT = "src.txt"

# File extensions to include
INCLUDE_EXT = {
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".css",
    ".scss",
    ".sass",
    ".json",
    ".html",
    ".vue",
    ".svelte",
    ".md",
    ".mts",
    # add more if needed: ".md", ".py", etc.
}

# Folders to skip entirely
SKIP_DIRS = {
    "node_modules",
    ".git",
    "dist",
    "build",
    "coverage",
    ".next",
    ".turbo",
    ".cache",
    "__pycache__",
    "venv",
    ".venv",
    "env",
}


def should_include(path: Path) -> bool:
    if path.is_dir():
        return False
    if path.suffix.lower() not in INCLUDE_EXT:
        return False

    # Skip if any parent folder is in SKIP_DIRS
    for part in path.parts:
        if part in SKIP_DIRS:
            return False
    return True


def collect_files(paths: List[str]) -> List[Path]:
    files = []
    for p in paths:
        path = Path(p).resolve()
        if not path.exists():
            print(f"Warning: path not found → {p}", file=sys.stderr)
            continue
        if path.is_file():
            if should_include(path):
                files.append(path)
        elif path.is_dir():
            for root, dirs, filenames in os.walk(path, topdown=True):
                dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
                for filename in filenames:
                    fp = Path(root) / filename
                    if should_include(fp):
                        files.append(fp)
        else:
            print(f"Warning: not a file or directory → {p}", file=sys.stderr)
    return sorted(files)


def main():
    # Parse arguments
    args = sys.argv[1:]
    output = DEFAULT_OUTPUT
    paths: List[str] = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg in ("-o", "--output"):
            if i + 1 < len(args):
                output = args[i + 1]
                i += 2
                continue
        paths.append(arg)
        i += 1

    if not paths:
        paths = DEFAULT_PATHS

    files = collect_files(paths)

    if not files:
        print("No matching files found.", file=sys.stderr)
        return 1

    with open(output, "w", encoding="utf-8") as out:
        for idx, file_path in enumerate(files, 1):
            try:
                rel_path = file_path.relative_to(Path.cwd()).as_posix()
            except ValueError:
                # fallback if not under cwd
                rel_path = file_path.as_posix()

            header = f"""
```{file_path.suffix[1:] or 'text'}
# {rel_path}
```
"""
            out.write(header)

            try:
                content = file_path.read_text(encoding="utf-8")
                out.write(content)
            except Exception as e:
                out.write(f"\n// ERROR reading file: {e}\n")

            out.write("\n\n")

    print(f"Done. Wrote {len(files)} files → {output}")
    with open(output, encoding="utf-8") as f:
        pyperclip.copy(f.read())
        print("→ also copied to clipboard")
    return 0


if __name__ == "__main__":
    sys.exit(main())
