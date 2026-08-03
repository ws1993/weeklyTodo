#!/usr/bin/env python3
"""Bump weeklyTodo app version across package and Tauri metadata files.

Updates only app version fields (never dependency versions or rust-version).

Usage:
  python .cursor/skills/release-version/scripts/bump_version.py 1.0.0
  python .cursor/skills/release-version/scripts/bump_version.py v1.0.0
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

SEMVER_PATTERN = re.compile(r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.\-]+)?$")

# First "version" string in a JSON file (package.json / tauri.conf.json root).
FIRST_JSON_VERSION_PATTERN = re.compile(r'("version"\s*:\s*")[^"]*(")')

# package-lock packages[""].version only (stop before nested objects).
PACKAGES_EMPTY_VERSION_PATTERN = re.compile(
    r'("packages"\s*:\s*\{\s*""\s*:\s*\{[^}]*?"version"\s*:\s*")[^"]*(")',
    re.DOTALL,
)

# Cargo.toml [package] section only (not rust-version / deps).
CARGO_TOML_PACKAGE_VERSION_PATTERN = re.compile(
    r'(?ms)(^\[package\]\s*(?:(?!^\[).)*?^version\s*=\s*")[^"]*(")',
)

# Cargo.lock package block for this crate.
CARGO_LOCK_WEEKLY_TODO_PATTERN = re.compile(
    r'(name = "weekly-todo"\n)version = "[^"]*"'
)


def normalize_version(raw_version: str) -> str:
    version = raw_version.strip()
    if version.startswith(("v", "V")):
        version = version[1:]
    if not SEMVER_PATTERN.match(version):
        raise SystemExit(
            f"Invalid version '{raw_version}'. Expected semver like 1.0.0"
        )
    return version


def replace_first_json_version(path: Path, new_version: str) -> None:
    text = path.read_text(encoding="utf-8")
    updated, count = FIRST_JSON_VERSION_PATTERN.subn(
        rf"\g<1>{new_version}\g<2>",
        text,
        count=1,
    )
    if count != 1:
        raise SystemExit(f"No version field found in {path}")
    path.write_text(updated, encoding="utf-8", newline="\n")


def update_package_lock(path: Path, new_version: str) -> None:
    text = path.read_text(encoding="utf-8")

    updated, root_count = FIRST_JSON_VERSION_PATTERN.subn(
        rf"\g<1>{new_version}\g<2>",
        text,
        count=1,
    )
    if root_count != 1:
        raise SystemExit(f"No root version field found in {path}")

    updated, packages_count = PACKAGES_EMPTY_VERSION_PATTERN.subn(
        rf"\g<1>{new_version}\g<2>",
        updated,
        count=1,
    )
    if packages_count != 1:
        raise SystemExit('Could not find packages[""].version in ' + str(path))

    path.write_text(updated, encoding="utf-8", newline="\n")


def update_cargo_toml(path: Path, new_version: str) -> None:
    text = path.read_text(encoding="utf-8")
    updated, count = CARGO_TOML_PACKAGE_VERSION_PATTERN.subn(
        rf"\g<1>{new_version}\g<2>",
        text,
        count=1,
    )
    if count != 1:
        raise SystemExit(f"Could not find [package] version in {path}")
    path.write_text(updated, encoding="utf-8", newline="\n")


def update_cargo_lock(path: Path, new_version: str) -> None:
    text = path.read_text(encoding="utf-8")
    uses_crlf = "\r\n" in text
    normalized = text.replace("\r\n", "\n")
    updated, count = CARGO_LOCK_WEEKLY_TODO_PATTERN.subn(
        rf'\g<1>version = "{new_version}"',
        normalized,
        count=1,
    )
    if count != 1:
        raise SystemExit(
            f"Could not find weekly-todo package version in {path}"
        )
    if uses_crlf:
        updated = updated.replace("\n", "\r\n")
    path.write_text(updated, encoding="utf-8", newline="")


def repo_root_from_script() -> Path:
    # scripts/ -> release-version/ -> skills/ -> .cursor/ -> repo root
    return Path(__file__).resolve().parents[4]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Bump weeklyTodo app version in all version metadata files."
    )
    parser.add_argument(
        "version",
        help="Target semver, with or without leading v (e.g. 1.0.0 or v1.0.0)",
    )
    args = parser.parse_args(argv)

    new_version = normalize_version(args.version)
    root = repo_root_from_script()

    package_json = root / "package.json"
    package_lock = root / "package-lock.json"
    cargo_toml = root / "src-tauri" / "Cargo.toml"
    cargo_lock = root / "src-tauri" / "Cargo.lock"
    tauri_conf = root / "src-tauri" / "tauri.conf.json"

    for required_path in (
        package_json,
        package_lock,
        cargo_toml,
        cargo_lock,
        tauri_conf,
    ):
        if not required_path.is_file():
            raise SystemExit(f"Missing required file: {required_path}")

    replace_first_json_version(package_json, new_version)
    update_package_lock(package_lock, new_version)
    update_cargo_toml(cargo_toml, new_version)
    update_cargo_lock(cargo_lock, new_version)
    replace_first_json_version(tauri_conf, new_version)

    print(f"Bumped app version to {new_version} in:")
    print("  package.json")
    print("  package-lock.json")
    print("  src-tauri/Cargo.toml")
    print("  src-tauri/Cargo.lock")
    print("  src-tauri/tauri.conf.json")
    print(f"Tag should be: v{new_version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
