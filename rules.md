# rules.md — Boundaries for AI Coding Tools

Read PRD.md and Architecture.md before generating any code. This file constrains *how* to build, not *what* to build.

## 1. Phase discipline
- Current phase: **Phase A only** (see Architecture.md). Do not scaffold sync, vector clocks, CRDT resolvers, or a backend unless explicitly asked to start Phase B.
- Do not "helpfully" add sync/network code to a Phase A file because it seems related. If it's not in the current prompt, don't build it.

## 2. File ownership (Phase A)
- `src/db/db.ts` and `src/types/patient.ts` are owned by Person A. Do not rename, remove, or change the signature of `addPatient`, `getAllPatients`, `getPatientById`, `updatePatient`, `deletePatient`, or the `Patient` interface without flagging it — other files import these directly.
- `src/routes.tsx` is edited only in Person A's context. If a prompt for Person B or C's work seems to need a new route, stop and flag it instead of editing `routes.tsx` directly.
- Only add new files inside the prompted person's owned folders; only import from other people's files, never edit them.

## 3. Non-negotiable product rules (do not optimize these away)
- Never write logic that deletes an allergy as a side effect of anything other than an explicit user action tombstoning it.
- Never auto-resolve a medication dosage conflict. If asked to build conflict resolution for dosage, route it to a human-review state — do not pick a "most likely correct" value.
- Any Phase B merge decision must be written to the audit trail (`change_log`). Do not implement a merge path that skips logging.

## 4. Libraries — avoid unless explicitly requested
- No new state management library (Redux, Zustand, Jotai, etc.) — React state + Dexie's live queries are sufficient for this scope.
- No UI component library beyond Tailwind (no MUI, Chakra, Ant Design) — keep the custom medical palette.
- No swapping Dexie for another IndexedDB wrapper (idb, localForage) without a recorded decision in memory.md.
- No ORM (Prisma, TypeORM, Sequelize) for the Phase B backend without it being explicitly requested — start with a plain SQL/driver layer unless told otherwise.
- No adding a CSS-in-JS library — Tailwind only.

## 5. Error handling
- Every IndexedDB call is wrapped and failures surface to the user via the toast system — never swallow an error silently.
- Offline is not an error state. Never show an error toast purely because the network is unavailable; the app is designed to not need it in Phase A.
- Zod validation errors render inline under the relevant field, not as a toast or alert.

## 6. What the AI should always do
- Re-read the current `Patient` interface and `db.ts` exports before writing any code that touches patient data — do not assume field names from memory.
- Keep placeholder pages as simple exported functions so teammates can extend them without touching shared files.
- When a prompt is ambiguous about which phase it belongs to, ask before building — do not guess and build the more advanced version "to save time."

## 7. What the AI should never do
- Never invent new `Patient` fields not defined in `src/types/patient.ts`.
- Never add a network call anywhere in Phase A code.
- Never commit to a Phase B architectural decision (backend language, DB choice) that isn't already recorded in Architecture.md or memory.md — flag it as an open decision instead.
