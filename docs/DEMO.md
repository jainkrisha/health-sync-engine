# Demo script (two devices, one laptop)

Setup: stack running (`docker compose up` or the dev servers) and seeded (`docker compose exec server node dist/seed.js`, or `npm run seed` in `server/`).

The sign-in screen asks **Where do you work?**: **Primary Health Centre (PHC)** (local doctor, works offline) or **District hospital** (central system). Health workers use PHC; admin, reviewer and auditor use the district hospital. Picking the wrong one shows which place the account belongs to.

1. **Device A**: open the app in a normal window, choose **PHC**, sign in as `worker1` (PHC Wagholi).
   **Device B**: open a second window with `?device=B` on the URL (for example `http://localhost:5173/?device=B`), choose **PHC**, sign in as `worker2` (PHC Lonikand). It has its own encrypted database and its own device id.
2. On A, add a patient with an allergy (Penicillin) and a medication (Metformin 500 mg). It appears on B within a second (real-time broadcast).
3. Turn on **Simulate offline** on both windows.
4. On A: change Metformin to 850 mg and add the allergy Latex.
   On B: change Metformin to 1000 mg, add Peanuts, and record a heart rate.
   Both show "Changes not sent yet"; the strip at the top counts them.
5. Turn A back online, then B. Show on both devices:
   - all three allergies are there (never-lose rule, OR-Set);
   - both vitals readings are in the history;
   - the record says **Medicine dose waiting for review**, still at 850 mg. It was not silently overwritten.
6. Sign in at the **District hospital** as `reviewer` or `admin` (third window, `?device=R`). This is the central view of every PHC; **Health centres** and **Staff and devices** list each PHC and tablet. Open **Dose reviews**: both doses side by side (device ids and vector clocks under Technical details). Choose **Neither: enter the correct dose**, type 750 mg, add a note and save.
7. Both devices update to 750 mg immediately.
8. Sign in at the **District hospital** as `auditor`: **Change history** shows every decision (newest change wins, allergies always kept, dose sent for review, reviewer decision with the note). **Timeline by device** draws the two tablets' edits meeting at the review. Auditors cannot edit patients or open Dose reviews.
9. Optional: on **Patients**, press **Download** and save the list as an Excel or CSV file.
10. Optional: in DevTools > Application > IndexedDB > HealthSync > patients, show that records are encrypted blobs, not readable JSON.
11. Optional: turn the real network off (DevTools > Network > Offline) on the production build, reload the page, and keep working.

The same flow runs automatically in `client/e2e/two-devices.spec.ts`.
