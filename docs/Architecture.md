# Architecture — HealthSync

Phase A (local-only CRUD PWA) is complete and has been extended into the full system: a server, real-time sync, vector clocks, field-level CRDT merging, conflict review, RBAC, encryption and an audit trail.

## 1. Overview

```
 Device A (PWA)                         Device B (PWA)
 ┌──────────────────────────┐           ┌──────────────────────────┐
 │ React UI                 │           │ React UI                 │
 │  └ form → shared/diff    │           │                          │
 │      field-level mutations│          │                          │
 │ patientRepo (local merge)│           │                          │
 │ IndexedDB (Dexie)        │           │ IndexedDB (Dexie)        │
 │  patients  {base, local} │ encrypted │                          │
 │  outbox    mutations     │ AES-GCM   │                          │
 │ syncEngine (socket.io)   │           │ syncEngine               │
 └────────────┬─────────────┘           └────────────┬─────────────┘
              │ mutation:push / sync:pull  (JWT + clientId)
              ▼                                      ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │ Node.js server (Express + Socket.io)                            │
 │  syncService.processMutations  ← merge authority                │
 │    validate (zod) → per-patient lock → shared/mergeEngine       │
 │    → save canonical doc → conflicts → audit → broadcast         │
 │  REST: auth, patients, conflicts/resolve, audit-log, users,     │
 │        devices, stats, sync (fallback)                          │
 └──────────────────────────────┬──────────────────────────────────┘
                                ▼
 MongoDB: users, patients (canonical CRDT doc), mutationlogs,
          conflicts, auditentries (append-only), devices, counters
```

The merge engine lives in `shared/` and is the same code on the server and on every device.

## 2. Data model

### Patient (what the UI shows)
`name, dateOfBirth, gender, bloodType, contactNumber, allergies[{allergen, severity, reaction}], medications[{name, dosage, frequency, startDate, endDate}], vitals[{recordedAt, recordedBy, heartRate, bloodPressure, temperature, respiratoryRate, oxygenSaturation}]`

### PatientDoc (the CRDT document that syncs)
Each piece of the record carries the vector clock of the write that set it:

| Part | CRDT | Notes |
|---|---|---|
| `scalars.{name, dateOfBirth, gender, bloodType, contactNumber}` | LWW register | `{value, clock, timestamp, clientId}` |
| `allergies[key]` | OR-Set element | `addTags[]`, `removedTags[]`, `details` LWW (severity, reaction). Present while some add-tag is not removed |
| `medications[key].critical` | critical register | `{dosage, frequency, active}`; concurrent different values become a conflict |
| `medications[key].details` | LWW register | start/end dates |
| `vitals[id]` | grow-only set | readings are never overwritten |
| `deleted` | LWW register | archive (soft delete) |
| `clock` | vector clock | merge of every write applied |

Keys are normalised names (`"  Penicillin "` → `penicillin`), so the same allergen or drug added on two devices is one entry.

### Mutation (the unit of sync)
```ts
{ id, clientId, userId, entityId, entityType: 'patient',
  operation: 'create' | 'update' | 'delete',
  field?: 'name' | ... | 'allergies' | 'medications' | 'vitals',
  payload, vectorClock, timestamp, status }
```
Field payloads: scalar `{value}`; allergies `{op:'add', allergen, severity, reaction, tag}` or `{op:'remove', allergen, observedTags}`; medications `{op:'setCritical', name, dosage, frequency, active}` or `{op:'setDetails', name, startDate, endDate}`; vitals `{op:'record', reading}`.

## 3. Vector clocks

- Format `{ [clientId]: counter }`. Each device has a random `clientId` (per browser profile).
- A new mutation's clock is the device's copy of the patient's clock with its own counter incremented, so it dominates everything the device has seen.
- `compare(a, b)` returns `before | after | equal | concurrent`. Concurrent means neither device had seen the other's write: a genuine conflict.
- After receiving a canonical copy, the device's clock for that patient is the merged clock, so its next edit is sequential.

## 4. Sync protocol (Socket.io, REST fallback at `/api/sync`)

| Direction | Event | Payload |
|---|---|---|
| client → server | `mutation:push` (with ack) | `{ mutations }` → `{ results[{mutationId, status}], patients: PatientDoc[], serverSeq }` |
| server → sender | `sync:ack` | `{ mutationIds, results }` |
| server → other devices | `patient:changed` | `{ patient: PatientDoc, serverSeq }` |
| server → reviewers | `conflict:changed` | `{ conflict }` |
| client → server | `sync:pull` (with ack) | `{ since }` → `{ patients, serverSeq }` |

Device flow:
1. Save: form changes → `shared/diff` builds only the mutations for what changed (three-way rebase against the snapshot the form opened with, so remote edits are not reverted) → applied to the local copy → queued in the outbox. Built inside a lock so clocks never repeat.
2. Sync (on connect, on `online`, after each save, or "Sync now"): push the outbox in order in batches; mark each mutation `synced`, `conflict` or `rejected`; store returned canonical docs; pull everything with `seq > lastServerSeq`.
3. Each stored patient keeps `base` (last canonical copy) and `local` (base + still-pending edits re-applied). The UI shows `local`.

Server flow per mutation: validate with zod → reject if the role cannot write → idempotency check on mutation id → per-patient lock → `applyMutation(server mode)` → save canonical doc with a new global `seq` → create conflicts → write audit entries for every decision → log the mutation → broadcast.

## 5. Merge rules

| Situation | Result |
|---|---|
| Incoming clock after stored | applied |
| Incoming clock before/equal | kept existing (stale or duplicate) |
| Concurrent, LWW field | later timestamp wins, client id breaks ties; clocks merged |
| Concurrent, allergies | union; a remove only cancels the add-tags it observed, so a concurrent add/update survives |
| Concurrent, medication dose with different values | stored value kept, conflict opened for review |
| Concurrent, medication dose with the same value | merged, no review |
| New medication on two devices | both kept |
| Reviewer resolution | written with `merge(both clocks) + server tick`, which dominates both conflicting writes everywhere |

## 6. Security

- **Auth**: bcrypt password hashes, JWT (`userId, username, name, role`), required on every REST route and on the Socket.io handshake. The server overrides `userId`/`clientId` in pushed mutations with the authenticated identity.
- **RBAC** (server enforced, UI hides what you cannot use):

| | health_worker | clinical_reviewer | admin | auditor |
|---|---|---|---|---|
| Read patients | ✓ | ✓ | ✓ | ✓ |
| Create/edit/archive patients | ✓ | ✓ | ✓ | |
| Conflict review | | ✓ | ✓ | |
| Patient merge history | | ✓ | ✓ | ✓ |
| Audit trail | | | ✓ | ✓ |
| Users & devices | | | ✓ | |

- **Encryption at rest (device)**: AES-256-GCM via Web Crypto. A per-device key is generated once and stored in IndexedDB as a non-extractable `CryptoKey`; patient rows and outbox rows contain only `{iv, ciphertext}`. Trade-off: protects data in DevTools, copied profiles and disk images, but code running in the same browser profile can still decrypt. A passphrase-derived key would add an unlock step on each launch.
- **Audit trail**: Mongoose hooks block every update and delete on `AuditEntry`; there is no API to change it.

## 7. Deployment

`docker-compose.yml` runs `mongo`, `server` (multi-stage Node image) and `client` (Vite build served by nginx, which proxies `/api` and `/socket.io` to the server so the browser uses a single origin).

## 8. Known limits

- LWW tie-breaks use device timestamps; a device with a wrong clock can win a concurrent LWW edit (dose conflicts are unaffected because they never auto-resolve).
- One server process (the per-patient lock is in memory). Scaling out would need a distributed lock or MongoDB transactions.
- Conflict review and the audit trail need a connection; patient data does not.
- Compaction of tombstoned allergy tags and old mutation logs is not implemented.
