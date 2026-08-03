# memory.md — Living Project State

Update this file at the end of every work session, before switching tools or chats. Keep entries short and factual — this file exists so an AI tool can resume work without re-reading the whole codebase or re-deriving decisions already made.

**How to update:** append to the relevant section below; don't rewrite history. Move items from "In Progress" to "Completed" as they finish. Add new items to "Open Decisions" the moment a choice needs to be made but hasn't been — don't let them stay implicit.

---

## Current Phase
Phase A — local-first CRUD shell (not started)

## Completed
_(none yet)_

## In Progress
_(none yet)_

## Blockers
_(none yet)_

## Open Decisions
_(none currently open)_

## Decisions Log
_(record each decision once made, with a one-line reason — e.g. "2026-08-02: Locked Phase A stack to React+Vite+TS+Dexie per Week 1 Task Split doc.")_
- 2026-08-02: Phase B backend language locked to **Node.js**. Reason: keeps the whole stack in TypeScript, and Zod schemas/types from Phase A can be shared with the backend instead of ported to a second language.
- 2026-08-02: Phase B local storage stays on **IndexedDB/Dexie** (no move to SQLite). Reason: PRD's Phase A non-goals rule out a native app — PWA only — and SQLite would require a native/Capacitor shell to get filesystem access, which contradicts that. Staying on Dexie also preserves the Phase A `db.ts` investment instead of rewriting it for Phase B.

## Next Steps
_(none yet — populate once Phase A work begins)_
