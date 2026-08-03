# memory.md — Living Project State

Update this file at the end of every work session, before switching tools or chats. Keep entries short and factual — this file exists so an AI tool can resume work without re-reading the whole codebase or re-deriving decisions already made.

**How to update:** append to the relevant section below; don't rewrite history. Move items from "In Progress" to "Completed" as they finish. Add new items to "Open Decisions" the moment a choice needs to be made but hasn't been — don't let them stay implicit.

---

## Current Phase
Phase A — local-first CRUD shell (scaffolding complete; page implementations not yet started)

## Completed

### Person A — shared foundation (stable, do not modify)
- `src/db/db.ts` — Dexie schema (`HealthRecordDB`, indexed on `id, name, updatedAt`) + five typed CRUD helpers: `addPatient`, `getAllPatients`, `getPatientById`, `updatePatient`, `deletePatient`. Exports are stable.
- `src/types/patient.ts` — `Patient` interface with fields: `id`, `name`, `dateOfBirth`, `bloodType`, `allergies: string[]`, `medications: {name,dosage}[]`, `vitals: {heartRate?,bloodPressure?,temperature?}`, `createdAt`, `updatedAt`. Do not add fields.
- `src/context/AuthContext.tsx` — stub auth context (`isAuthenticated`, `login`, `logout`).
- `src/layout/Layout.tsx` — app shell with sidebar navigation.
- `src/layout/OfflineBadge.tsx` — online/offline indicator component.
- `src/routes.tsx` — full React Router v6 route table: `/` → Login, `/dashboard` → Dashboard placeholder, `/patients` → PatientList placeholder, `/patients/new` → PatientForm add, `/patients/:id/edit` → PatientForm edit. All protected by `ProtectedRoute`. **Person A owns exclusively.**
- `src/pages/Login/Login.tsx` — functional login page (Person A).

### Person B — 2026-08-03 (feature/dashboard-list)
- `src/hooks/usePatients.ts` — **complete**. Loads all patients on mount via `getAllPatients()`, exposes `{ patients, loading, refetch, removePatient }`. Manual refetch pattern (see Decisions Log).
- `src/components/Toast.tsx` — **complete**. `ToastProvider` + `useToast()` hook. 4s auto-dismiss, types: success/error/warning/info. Shared — Person C may reuse.
- `src/pages/PatientList/PatientList.tsx` — **complete**. Desktop table + mobile card layout, client-side name search, delete confirmation dialog, toast on success/error, empty state + loading skeleton.
- `src/components/Card.tsx` — **complete**. `<Card>` generic wrapper + `<StatCard>` (icon + value + label + accent colour). Shared — any teammate may import.
- `src/pages/Dashboard/Dashboard.tsx` — **complete + verified**. Three StatCards (total/allergy/7-day counts), last-5 recent activity list sorted by updatedAt, Add Patient CTA, skeleton + empty state. All data from IndexedDB via usePatients(). Offline verification: all data paths confirmed pure Dexie/IndexedDB — no fetch/XHR calls anywhere in Person B's files. Font load (Google Fonts in index.css) fails gracefully offline — falls back to system-ui per tailwind.config.js; not a functional error. A11y audit: StatCard aria-label added; ConfirmDialog focus trap (Tab/Escape) added; responsive skeleton fixed (table skeleton md+, card skeleton below md). Breakpoints verified: grid-cols-1→sm:grid-cols-3 for stats, hidden md:block/md:hidden for table/card split.
- `src/pages/Dashboard/DashboardPage.tsx` — original placeholder stub (superseded by Dashboard.tsx above; wire routes when ready).
- `src/pages/PatientList/PatientListPage.tsx` — placeholder stub (superseded by PatientList.tsx above; wire routes when ready).

### Person C — stub placeholders only (real implementation not yet built)
- `src/pages/PatientForm/PatientFormPage.tsx` — placeholder `<div>` only.
- `src/schemas/patientSchema.ts` — Zod schema for Patient (Person C owns).
- `src/hooks/usePatientForm.ts` — stub signature only (Person C owns).

## In Progress
_(none — all Person B Phase A items complete and verified; awaiting Person A route wire-up)_

## Blockers
_(none — `routes.tsx` and `App.tsx` wiring done 2026-08-03 at user request; `ToastProvider` in place)_

## Open Decisions
_(none currently open)_

## Decisions Log
_(record each decision once made, with a one-line reason — e.g. "2026-08-02: Locked Phase A stack to React+Vite+TS+Dexie per Week 1 Task Split doc.")_
- 2026-08-02: Phase B backend language locked to **Node.js**. Reason: keeps the whole stack in TypeScript, and Zod schemas/types from Phase A can be shared with the backend instead of ported to a second language.
- 2026-08-02: Phase B local storage stays on **IndexedDB/Dexie** (no move to SQLite). Reason: PRD's Phase A non-goals rule out a native app — PWA only — and SQLite would require a native/Capacitor shell for filesystem access, which contradicts that. Staying on Dexie also preserves the Phase A `db.ts` investment instead of rewriting it for Phase B.
- 2026-08-03: Confirmed Phase A tech stack locked — React 18 + Vite + TypeScript + TailwindCSS v3 + React Router v6 + Dexie.js + React Hook Form + Zod + vite-plugin-pwa. No additional state management libraries permitted (no Redux, Zustand, Jotai). No UI component libraries beyond Tailwind (no MUI, Chakra, Ant Design).
- 2026-08-03: `usePatients` uses **manual refetch** (not Dexie `useLiveQuery`). Reason: `useLiveQuery` requires an observable subscription and adds reactive complexity; manual `refetch()` after each mutation is simpler, fully offline, and sufficient for Phase A's single-user/single-tab scope.
- 2026-08-03: Created `src/components/Toast.tsx` as a **shared component** (Person B). Self-contained context + hook pattern. Person C can call `useToast().toast()` directly in PatientForm for delete/save feedback — no modifications needed.
- 2026-08-03: **A11y fix** — ConfirmDialog had no focus trap; keyboard users could Tab out of the modal into background content. Fixed by adding `onKeyDown` handler that cycles Tab/Shift+Tab within focusable dialog elements and fires `onCancel` on Escape. Person C should apply the same pattern to any modal in PatientForm.
- 2026-08-03: **Diagnosis — pages appeared unchanged in browser.** Root cause was NOT missing file writes — `PatientList.tsx` (506 lines) and `Dashboard.tsx` (258 lines) both exist on disk with full content and are untracked (`git status` confirmed). Root cause: `routes.tsx` defines its own inline `PatientList` and `Dashboard` stub components and never imports from the page files Person B created. Files on disk are correct; wiring is Person A's action item. Lesson: always verify `git status` and `routes.tsx` import graph before assuming a file write failed.
- 2026-08-03: **Final compliance check (pre-PR) —** 8/8 checks passed after fixes. One real rules.md §5 violation found and fixed: `void refetch()` on mount in `usePatients.ts` was silently swallowing `getAllPatients()` failures. Fixed by adding a real `catch` block that sets `error` state; both `Dashboard.tsx` and `PatientList.tsx` now surface it via `useToast()`. One minor type fix: `JSX.IntrinsicElements` in `Card.tsx` replaced with `ElementType` from react (explicit import, no global namespace reliance). All other checks clean: zero network calls, zero Phase B code, zero banned libraries, zero allergy/dosage mutation logic, zero invented Patient fields, zero console.logs, zero `any` types. Branch is ready for PR into main.

## Next Steps
- **Person B:** `git add` + `git commit` all untracked/modified files, then `git push origin main` (or open PR from main if working directly on it). Files to stage: `src/components/`, `src/pages/Dashboard/Dashboard.tsx`, `src/pages/PatientList/PatientList.tsx`, `src/hooks/usePatients.ts`, `memory.md`, `src/index.css`, `src/routes.tsx`, `src/App.tsx`.
- **Person C:** implement `PatientFormPage.tsx` (add/edit form using React Hook Form + Zod schema). Can use `useToast()` from `src/components/Toast.tsx` directly. Apply ConfirmDialog focus-trap pattern from PatientList if any modals are needed.
