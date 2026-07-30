# Changelog

All notable changes to **ChatLens** are documented here.

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
