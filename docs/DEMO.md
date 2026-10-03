# Demo script (two devices, one laptop)

Setup: stack running (`docker compose up` or the dev servers) and seeded (`npm run server:seed`).

1. **Device A**: open the app in a normal window, sign in as `worker1`.
   **Device B**: open a second window with `?device=B` on the URL (for example `http://localhost:5173/?device=B`) and sign in as `worker2`. It has its own encrypted database and its own device id.
2. On A, add a patient with an allergy (Penicillin) and a medication (Metformin 500 mg). It appears on B within a second (real-time broadcast).
3. Turn on **Simulate offline** on both windows.
4. On A: change Metformin to 850 mg and add the allergy Latex.
   On B: change Metformin to 1000 mg, add Peanuts, and record a heart rate.
   Both show "Changes not synced yet"; the header counts pending changes.
5. Turn A back online, then B. Show on both devices:
   - all three allergies are there (never-lose rule, OR-Set);
   - both vitals readings are in the history;
   - Metformin shows **Under review**, still at 850 mg. It was not silently overwritten.
6. Sign in as `reviewer` (third window, `?device=R`). Open **Conflict Review**: both doses side by side with device ids and vector clocks marked concurrent. Enter a corrected dose (750 mg) with a note.
7. Both devices update to 750 mg immediately.
8. Sign in as `auditor`: **Audit Trail** shows every decision (LWW, OR-Set add, conflict detected, manual resolution with the note). Auditors cannot edit patients or open Conflict Review.
9. Optional: in DevTools > Application > IndexedDB > HealthSync > patients, show that records are encrypted blobs, not readable JSON.
10. Optional: turn the real network off (DevTools > Network > Offline) on the production build, reload the page, and keep working.

The same flow runs automatically in `e2e/two-devices.spec.ts`.
