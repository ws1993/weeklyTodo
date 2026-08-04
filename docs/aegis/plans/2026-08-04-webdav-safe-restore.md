# Goal

Prevent automatic WebDAV synchronization from replacing existing remote task data with a newly initialized empty local database, and add a WebDAV settings workflow for listing database versions and restoring a selected version safely.

# Architecture

Rust remains the canonical owner of WebDAV authentication, remote filename validation, database validation, backup ordering, and local database replacement. The React settings panel owns presentation, selection, confirmation, and status feedback. Automatic synchronization is explicitly distinguishable from user-requested synchronization. A restore always uploads the current local database to a new remote backup before replacing the local file, then refreshes all database-backed frontend state and pauses automatic synchronization until explicitly resumed.

# Tech Stack

- Tauri 2 commands and Rust async services
- `reqwest` WebDAV requests with `rustls-tls`
- SQLite via bundled `rusqlite`
- React 19, TypeScript, Zustand, Vitest
- Existing tiny_http WebDAV test server and Rust sync tests

# Baseline/Authority Refs

- `src-tauri/src/storage.rs`: shared `%APPDATA%` storage configuration and data-directory resolution.
- `src-tauri/src/db.rs`: SQLite schema and migration owner.
- `src-tauri/src/sync.rs`: file-level synchronization and overwrite backups.
- `src-tauri/src/webdav.rs`: WebDAV HTTP operations and test server.
- `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`: Tauri command boundary.
- `src/features/settings/WebDavSyncPanel.tsx`: existing WebDAV settings UI.
- `src/App.tsx`: startup and interval synchronization lifecycle.
- `src/features/settings/webdavSettings.ts`: persisted WebDAV scheduling state.

# Compatibility Boundary

- Existing `weeklytodo.db` and `weeklytodo.db.YYYYMMDD-HHMMSS.bak` files remain readable.
- Existing manual “立即同步” keeps its normal local-newer/remote-newer behavior, except an empty local database cannot silently upload over an existing remote database.
- Existing WebDAV settings and credential storage formats remain compatible.
- Restore accepts only the current database filename or a single timestamped backup filename returned by the server; path traversal, query strings, and unrelated files are rejected.
- Local replacement remains atomic and removes stale SQLite WAL/SHM sidecars.
- No backup deletion or retention policy is added in this change.

# Verification

- Rust tests cover remote directory listing, filename filtering, malformed input rejection, restore backup ordering, invalid SQLite protection, backup collision handling, and automatic empty-local upload prevention.
- TypeScript tests cover persisted restore-pause state and scheduling behavior.
- `cargo test --manifest-path src-tauri/Cargo.toml` verifies the native implementation.
- `npm test` and `npm run lint` verify frontend behavior and types.
- `npm run build` verifies the production frontend contract.
- Manual verification confirms the settings page lists remote versions, requires explicit restore confirmation, shows the pre-restore backup, refreshes tasks/owners/tags, and does not auto-sync immediately after restoration.

## Repair Track

1. Add a tested remote `PROPFIND Depth: 1` listing parser and typed database-version metadata.
2. Add an explicit automatic-sync mode and refuse to upload a missing/fresh/meaningfully empty local database when a remote current database exists.
3. Add a separate restore command that validates the selected filename, uploads the local pre-restore backup, downloads and validates the selected SQLite file, and replaces the local database atomically.
4. Add typed bridge contracts and a WebDAV panel version browser with a destructive-action confirmation.
5. Persist a restore pause state, prevent overlapping automatic sync while restoring, and reinitialize all database-backed frontend state after success.

## Retirement Track

- The existing mtime-based sync path remains the canonical ordinary sync path; no duplicate frontend merge logic is introduced.
- The old unconditional automatic upload behavior is retired by routing automatic calls through the Rust eligibility guard.
- The existing `download_file` atomic replacement and `backup_filename` naming convention are retained and reused.
- The restore pause is retained as an explicit user-controlled safety state; it may be removed only if automatic sync gains an equivalent durable conflict/intent protocol.

## Implementation Tasks

### Task 1: Add failing Rust tests for WebDAV version listing and restore safety

Files: `src-tauri/src/webdav.rs`, `src-tauri/src/sync.rs`.

Write tests that seed the local test server with the current database and timestamped backups, then assert that listing returns only valid database versions ordered newest-first. Add tests proving invalid filenames are rejected, restore uploads local bytes before replacement, invalid downloaded SQLite bytes leave local data unchanged, and an automatic sync with a remote current plus an empty/fresh local database returns a skipped result without issuing a PUT.

Run `cargo test --manifest-path src-tauri/Cargo.toml webdav sync`. The new tests must fail because the listing, restore, and guarded automatic mode do not yet exist.

### Task 2: Implement WebDAV directory listing and safe filename metadata

Files: `src-tauri/src/webdav.rs`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`.

Add a small tested listing parser or XML dependency only if required by the existing response format. Parse directory children as associated href, modification time, size, and collection status; ignore the directory self-entry and unrelated files. Filter by the exact database/backup filename grammar, normalize URL path components safely, and return a stable native metadata structure. Extend the tiny_http test server to answer `Depth: 1` with self and child responses.

Run the focused Rust tests and `cargo fmt --check`.

### Task 3: Implement explicit automatic-sync guard and selected-version restore

Files: `src-tauri/src/sync.rs`, `src-tauri/src/commands.rs`, `src-tauri/src/contracts.rs`, `src-tauri/src/lib.rs`.

Add a sync mode that is passed by the command boundary. Before automatic synchronization can upload, inspect meaningful local content without creating a missing database. If the remote current exists and local content is missing or effectively fresh/empty, return a non-destructive skipped result. Keep ordinary non-empty local-newer sync behavior intact. Add separate list and restore command functions. Restore must validate the selected filename server-side, checkpoint the local database only after confirming it exists, upload current local bytes to a collision-free remote backup, download the selected version through the existing SQLite-header and atomic-replacement path, and return restore metadata. It must not call ordinary mtime reconciliation after replacement.

Run `cargo test --manifest-path src-tauri/Cargo.toml` and `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`.

### Task 4: Extend TypeScript contracts and bridge functions

Files: `src/shared/contracts/types.ts`, `src/api/nativeBridge.ts`.

Add types for remote database versions, restore results, and the guarded/skipped sync direction. Add bridge functions for listing versions and restoring a selected filename, preserving the existing credential flow and command names. Update all consumers to handle the new result direction without treating skipped as success upload/download.

Run `npm run lint`.

### Task 5: Add persisted restore-pause scheduling behavior

Files: `src/features/settings/webdavSettings.ts`, `src/features/settings/webdavSettings.test.ts`, `src/App.tsx`.

Add a persisted pause state with backward-compatible default false. Make due checks return false while paused. Ensure restore can pause automatic startup/interval sync and that successful restore reinitializes weeks, selected week, task tree, owners, tags, and group colors. Keep an explicit user action available in the panel to resume automatic sync.

Write the settings regression test first, run it RED, implement the smallest state change, then run it GREEN and run the complete frontend test suite.

### Task 6: Add version browser and explicit restore confirmation UI

Files: `src/features/settings/WebDavSyncPanel.tsx`, `src/styles.css`, and focused component tests if the existing test environment supports the bridge mock seam.

Add a refreshable remote-version list in the existing sync settings page. Show current/backup type, filename, size, and modification time. Disable list/restore/sync actions while another remote operation is active. Require a two-step confirmation that names the selected version and states that the current local database will first be backed up to WebDAV. On success show the generated local backup filename, refresh the app state, and show that automatic sync is paused. Provide a visible resume action.

Run `npm test`, `npm run lint`, and `npm run build`.

### Task 7: End-to-end verification and recovery checklist

Files: no production files unless verification exposes a defect.

Run `cargo test --manifest-path src-tauri/Cargo.toml`, `npm test`, `npm run lint`, `npm run build`, and `cargo fmt --check`. Manually verify with a disposable WebDAV directory: empty local plus populated remote cannot auto-upload; list shows current and `.bak` versions; restore creates a new pre-restore backup before replacement; restored tasks and metadata appear; automatic sync remains paused until resumed; and a failed download leaves the pre-restore local database intact.
