# Product Requirements Document — HealthSync
## Offline-First, Conflict-Resolving Health Record System

## 1. Problem
Healthcare workers in areas with poor or no internet connectivity need to record and update patient data on the spot. Multiple devices (multiple workers, multiple visits) may edit the same patient record while offline. When connectivity returns, naive sync overwrites data and silently loses information — unacceptable for medical records, especially allergies and medication dosages.

## 2. Target User
Community healthcare workers / field clinicians who:
- Work in low/no-connectivity areas (rural clinics, mobile health units, disaster response)
- Use a phone, tablet, or laptop as their primary device
- Need to read and edit patient records without waiting for a network connection
- Are not technical — the app must fail safely without requiring them to understand sync internals

## 3. Core Problem the System Solves
Two devices edit the same patient record while both are offline. When they reconnect:
- Non-critical fields (name, blood type) resolve automatically via last-write-wins.
- Allergy records never get deleted or silently dropped in a merge — additions from either device are preserved (add-wins).
- Critical fields (e.g. medication dosage) are never auto-resolved — a conflict here is flagged for human review, not guessed at.
- Every sync and every merge decision is written to an append-only audit trail.

## 4. Scope by Phase

### Phase A — Local-first CRUD shell (current phase, "Week 1")
- Installable PWA, works fully offline (no network calls for app shell or data)
- Local browser storage (IndexedDB via Dexie.js) as the on-device store
- Full CRUD on patient records: add, view, list, search, edit, delete
- Dummy/stub auth (no real backend auth yet)
- No sync, no multi-device merge, no vector clocks yet — this phase proves the offline CRUD experience only

### Phase B — Sync & Conflict Resolution (later phase, not yet started)
- Vector clock stamping on every field-level write
- Field-level CRDT resolution:
  - LWW-Register for simple fields (name, blood type, DOB)
  - Set-CRDT (add-wins, tombstoned deletes) for the allergy set — allergies are never silently deleted
  - Critical-field flag (medication dosage and similar) — never auto-resolved, always routed to human review
- Backend sync service: accepts deltas from devices, runs the merge engine against canonical state, returns accepted / conflict-flagged / server-has-newer
- Append-only audit trail (`change_log`) recording every merge decision
- Minimal dashboard surfacing flagged conflicts for human review

### Explicit non-goals (do not build unless this document is updated)
- Real authentication / user management beyond a stub
- Multi-tenant or multi-clinic support
- Any field auto-resolution for medication dosage or other flagged critical fields
- A native mobile app (PWA only)

## 5. Success Criteria
- Phase A: app is fully usable with WiFi off — add, edit, list, delete patients, survive a tab close and reopen, data intact.
- Phase B: two devices can independently edit the same patient offline, sync to the server, and the canonical record ends up correctly merged per the rules above, with a full audit trail — no data loss, no silent overwrite, critical fields never guessed.

## 6. Key Non-Negotiable Product Rules
These apply regardless of implementation phase and should not be relaxed for convenience:
1. Allergy data is never deleted as a side effect of a merge.
2. Medication dosage conflicts are never auto-resolved — always routed to a human.
3. Every merge decision is recorded in an audit trail, not just applied silently.
4. The app must be fully functional with no network connection at any phase.
