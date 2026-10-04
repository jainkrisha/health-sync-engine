# rules.md — Boundaries for AI Coding Tools

Read PRD.md and Architecture.md before generating any code. This file constrains *how* to build, not *what* to build.

## 1. Phase discipline
- Current phase: **full build** (Phase A + Phase B, see Architecture.md and Final_Project_Task_Split.md). Sync, vector clocks, the CRDT merge engine and the backend exist.
- The merge engine lives in `shared/` and runs on both client and server. Change merge rules there only, with a unit test in `shared/__tests__`.

## 2. Shared contracts
- `shared/types.ts` is the contract between client and server (Patient, PatientDoc, Mutation, Conflict, AuditEntry, socket events). Change it deliberately and update both sides.
- Patient writes on the device go through `commitLocalEdit()` in `client/src/db/patientRepo.ts`, never directly to Dexie, so they are encrypted, merged and queued for sync.

## 3. Non-negotiable product rules (do not optimize these away)
- Never write logic that deletes an allergy as a side effect of anything other than an explicit user action tombstoning it.
- Never auto-resolve a medication dosage conflict. If asked to build conflict resolution for dosage, route it to a human-review state — do not pick a "most likely correct" value.
- Every merge decision must be written to the audit trail (`AuditEntry`, append-only). Do not implement a merge path that skips logging.

## 4. Libraries — avoid unless explicitly requested
- No new state management library (Redux, Zustand, Jotai, etc.) — React state + Dexie's live queries are sufficient for this scope.
- No UI component library beyond Tailwind (no MUI, Chakra, Ant Design) — keep the custom medical palette.
- No swapping Dexie for another IndexedDB wrapper (idb, localForage) without a recorded decision in memory.md.
- Backend database is MongoDB via Mongoose (decided in the final task split). No SQL ORM.
- No adding a CSS-in-JS library — Tailwind only.

## 5. Error handling
- Every IndexedDB call is wrapped and failures surface to the user via the toast system — never swallow an error silently.
- Offline is not an error state. Never show an error toast purely because the network is unavailable; patient records must keep working offline. Only conflict review, the audit trail and admin pages need the server.
- Zod validation errors render inline under the relevant field, not as a toast or alert.

## 6. What the AI should always do
- Re-read `shared/types.ts` and `client/src/db/patientRepo.ts` before writing any code that touches patient data — do not assume field names from memory.
- Keep placeholder pages as simple exported functions so teammates can extend them without touching shared files.
- When a prompt is ambiguous about which phase it belongs to, ask before building — do not guess and build the more advanced version "to save time."

## 7. What the AI should never do
- Never invent new `Patient` fields not defined in `shared/types.ts`.
- Never write patient data to IndexedDB unencrypted.
- Never commit to an architectural decision that isn't already recorded in Architecture.md or memory.md — flag it as an open decision instead.
