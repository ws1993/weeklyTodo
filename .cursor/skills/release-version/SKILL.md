---
name: release-version
description: >-
  Bumps weeklyTodo app version across package.json, package-lock.json,
  src-tauri/Cargo.toml, Cargo.lock, and tauri.conf.json, then commits and
  creates/pushes annotated git tag vX.Y.Z to trigger GitHub Release.
  Use when the user asks to release, bump version, ship a version, update
  version to X.Y.Z, 更新版本, 发版, 打 tag, or publish a new release.
---

# weeklyTodo release-version

When the user asks to update/release a version (e.g. 「更新版本到 1.0.0」「release 0.2.0」), execute this workflow end-to-end. Do not only explain it.

## Goal

1. Sync version fields to the requested semver.
2. Commit version-only changes.
3. Create annotated tag `vX.Y.Z`.
4. Push branch + tag so `.github/workflows/release.yml` runs.

## Version source of truth

App update check (`src-tauri/src/updater.rs`) compares GitHub latest release `tag_name` (with leading `v` stripped) to `env!("CARGO_PKG_VERSION")` from `src-tauri/Cargo.toml`.

Tag must be `v` + exact package version, e.g. version `1.0.0` → tag `v1.0.0`.

## Files to update (all must match)

| File | Field |
|------|--------|
| `package.json` | top-level `"version"` |
| `package-lock.json` | root `"version"` and `packages[""].version` |
| `src-tauri/Cargo.toml` | `[package] version` only (never `rust-version` or dependency versions) |
| `src-tauri/Cargo.lock` | `name = "weekly-todo"` package `version` |
| `src-tauri/tauri.conf.json` | top-level `"version"` |

Prefer the helper script (Python 3):

```bash
python .cursor/skills/release-version/scripts/bump_version.py 1.0.0
```

If the script fails, edit the five files manually with the same rules.

## Preconditions (stop if unmet)

1. Working tree has **no unrelated dirty changes**, or only changes you will leave unstaged. Never mix feature code into a version commit.
2. Target version is valid semver: `MAJOR.MINOR.PATCH` (optional prerelease like `1.0.0-beta.1` only if user explicitly asks).
3. Strip a leading `v` from user input (`v1.0.0` → `1.0.0`).
4. Tag `vX.Y.Z` must not already exist locally or on `origin` (`git rev-parse vX.Y.Z`, `git ls-remote --tags origin vX.Y.Z`).
5. Confirm current versions in the five files are consistent before bumping; if inconsistent, fix them to the new version anyway and note it in the summary.

If the user did not specify a version, ask for it. Do not invent a bump.

## Workflow

Copy and track:

```
Release Progress:
- [ ] Parse target version
- [ ] Preflight git/tag checks
- [ ] Bump version files
- [ ] Verify all five files show new version
- [ ] Commit version bump
- [ ] Create annotated tag vX.Y.Z
- [ ] Push branch and tag
- [ ] Report result + Release Actions link
```

### 1. Parse version

- Input examples: `1.0.0`, `v1.0.0`, `更新版本到 1.0.0`
- Set `VERSION=X.Y.Z` (no `v`)
- Set `TAG=v$VERSION`

### 2. Preflight

```bash
git status -sb
git rev-parse --verify "$TAG"
git ls-remote --tags origin "refs/tags/$TAG"
```

Abort if tag exists. If dirty tree has non-version files, stop and ask the user how to proceed.

### 3. Bump

```bash
python .cursor/skills/release-version/scripts/bump_version.py "$VERSION"
```

Verify with:

```bash
python -c "import json; from pathlib import Path; print(json.loads(Path('package.json').read_text())['version']); print(json.loads(Path('package-lock.json').read_text())['version']); print(json.loads(Path('package-lock.json').read_text())['packages']['']['version']); print(json.loads(Path('src-tauri/tauri.conf.json').read_text())['version'])"
# Cargo.toml [package] version and Cargo.lock weekly-todo block must match X.Y.Z
```

### 4. Commit

Stage **only** version files:

```bash
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json
```

Commit message (conventional style):

```
chore(release): bump version to X.Y.Z
```

Note: weeklyTodo has no CI workflow anymore — pushing to `main` triggers nothing; only the `v*` tag push triggers `.github/workflows/release.yml` packaging. Do not add unrelated changes to this commit.

Follow repo git safety rules: never amend unless user asks; never skip hooks unless user asks; never force-push.

### 5. Tag

```bash
git tag -a "vX.Y.Z" -m "Release vX.Y.Z"
```

Use annotated tags only.

### 6. Push

Push current branch and the tag (required for GitHub Release workflow):

```bash
git push origin HEAD
git push origin "vX.Y.Z"
```

Release workflow triggers on `push` of tags matching `v*`.

If push fails (auth/network), report the local commit/tag state and exact commands the user can run.

### 7. Final report to user

Always include:

- Old version → new version
- Commit hash / message
- Tag name
- Whether push succeeded
- Reminder: wait for GitHub Actions **Release** job; users check updates against latest Release tag
- Link pattern: `https://github.com/ws1993/weeklyTodo/releases` and Actions tab

## Do not

- Change dependency versions or `rust-version`
- Create lightweight tags
- Push only the branch without the tag (Release will not run)
- Bump version without commit/tag when user asked for a full release (unless they say「只改版本号不提交」)
- Rewrite history or force-push tags

## Partial modes

| User intent | Actions |
|-------------|---------|
| 更新版本 / 发版 / release to X.Y.Z | Full workflow including push |
| 只改版本号 | Bump files only, no commit/tag |
| 打 tag 但不 push | Commit + tag, no push |
| 只 push 已有 tag | Push only, no file edits |

Honor explicit partial requests; default is **full release**.

## Example

User: 「我要更新版本到 1.0.0」

Agent:

1. Runs `python .cursor/skills/release-version/scripts/bump_version.py 1.0.0`
2. Commits `chore(release): bump version to 1.0.0`
3. Tags `v1.0.0`
4. Pushes branch + `v1.0.0`
5. Summarizes and points to Releases/Actions
