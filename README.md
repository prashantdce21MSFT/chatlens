# 🔍 ChatLens — Copilot Chat History Search

**Search, browse, and re-read your entire VS Code Copilot chat history — locally, read-only, and fully offline.**

Every conversation you have with Copilot is silently saved to disk as an undocumented log file inside hash-named folders — effectively unfindable and unreadable. **ChatLens turns that pile into a searchable, readable knowledge base**, without sending a single byte anywhere.

---

## ✨ Features

- 🔎 **Full-text search** across every chat, in every workspace, from one sidebar
- 🗂️ **Workspace & model filters** — jump to the project or model you remember
- 💬 **Readable transcript viewer** — click any result to open the conversation as clean chat bubbles (markdown rendered), not raw JSON
- 🎯 **Relevance ranking** with highlighted snippets
- 🔄 **One-click refresh** to re-index after new chats
- 🔒 **100% local & read-only** — no network calls, nothing leaves your machine

---

## 🚀 Usage

1. Click the **ChatLens** icon in the Activity Bar.
2. It auto-indexes your Copilot chats.
3. **Type** to search, filter by workspace/model, and **click** a result to read the full conversation.

---

## ⚙️ Settings

| Setting | Default | Description |
|---|---|---|
| `chatlens.maxIndexKB` | `40` | How much of each transcript to index for search |
| `chatlens.days` | `0` (all) | Only index sessions from the last N days |

---

## 🔒 Privacy

ChatLens reads VS Code's local chat-session storage on your machine and builds an
in-memory index. It makes **no network requests** and **never writes** to your
transcripts. Everything stays on your device.

---

## ⚠️ Note

VS Code's chat transcript format is internal and undocumented; ChatLens
reconstructs conversations on a best-effort basis and may need updates if the
format changes.

---

*Your AI conversations are institutional memory. ChatLens makes them findable.*
