# Changelog

All notable changes to **ChatLens** are documented here.

## [0.1.1] — 2026-09-14

### Fixed
- ⚡ Indexing no longer stalls on very large sessions. Previously each session file was read in full and whitespace-normalized before being truncated, so a single multi-hundred-MB session could push indexing to ~28s and leave the panel showing "0 of 0 sessions". Now only the indexed head of each file is read (~30x faster).

## [0.1.0] — 2026-07-30

### Added
- 🔎 Sidebar full-text search across all Copilot chat sessions in every workspace.
- 🗂️ Workspace and 🤖 model filter dropdowns with relevance ranking and highlighted snippets.
- 💬 Readable transcript viewer — opens any session as chat bubbles with rendered markdown.
- 🔄 Refresh command to re-index after new chats.
- ⚙️ Settings: `chatlens.maxIndexKB`, `chatlens.days`.

### Notes
- 100% local, read-only, offline. No network calls.
- Reconstructs conversations from VS Code's internal `kind:0`/`kind:1`/`kind:2` transcript log.
