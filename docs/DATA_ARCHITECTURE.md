# Central Firestore architecture

The application retains React, LmsContext, existing screens, navigation and Firebase Authentication. Production business records now flow through `fleetRepository` → Firestore listeners → LmsContext projections → screens. Write handlers wait for Firestore; they do not mutate a second local business store. Authentication/user provisioning remains in the existing AuthContext and is not redesigned by this change.

## Data model and compatibility

| Collection | Identity and relationships | Compatibility choice |
| --- | --- | --- |
| trucks | document ID; normalizedPlate; assignedDriverId; assignedEquipmentId; archived | Existing plate/plateNorm/type/description fields retained |
| drivers | document ID; assignedTruckId; active; archivedAt | Existing mobile/iqama/status fields retained; history is projected from manifests |
| equipment | document ID; assignedTruckId; active | Dispatch equipment uses the master collection, including unassigned trailers |
| km_records | `truckId_YYYY-MM-DD`; truckId; date; distanceKm; nullable odometerKm; source; importBatchId; createdBy; timestamps | km/odometer/veh are compatibility aliases written consistently, not separate records |
| diesel_logs | document ID; truckId; nullable driverId; date; liters; cost | veh/drv remain historical display snapshots |
| schedules | date document; rows with stable row IDs, truckId and driverId | Existing daily grouped schedule model retained to avoid breaking exports/layout |
| manifests | date document; scheduleId where known; tags keyed by stable driverId | Existing daily document retained; numeric indexes require reviewed migration |
| cashbook | transaction ID; accountId; optional driverId/truckId; reversalOf | Existing account/employee strings retained as historical labels |
| cash_accounts / cash_employees | stable document IDs | No seeded accounts are merged over remote data |
| import_batches | UUID; type; normalized-content fileHash; expected/persisted/failed counts; failedIds; status; timestamps; createdBy | Counts reflect server-verified canonical daily records, not raw duplicate input rows |
| commodities / stores / data_quality / app_state | existing IDs; branding and learnedRules in app_state | Deprecated timetableRegistry is not read by operational screens or written by them |

Do not create parallel collections under different spellings. The app uses project `sonic-hawk-hsmzh`, database `ai-studio-8c81ea2f-4e0c-45e3-8fb8-22dded5a07f9`. `firebase.json` targets that exact named database; `firebase.emulator.json` uses an isolated demo project.

## Synchronization and deletion

- Collection listeners have loading/error/metadata states. Initial cache-only snapshots cannot hydrate a new session. Sign-out/account changes clear the exposed data. Errors clear the affected collection and appear in the shared status banner.
- No automatic browser-to-Firestore seeding, browser-only import, or fleet cache persistence remains. UI preferences and login branding may use localStorage. Existing authentication session/directory behavior is intentionally separate and unchanged.
- Offline writes are rejected when the browser reports offline. If connectivity drops during an SDK write, its pending state remains visible; success waits for server acknowledgement. Firestore memory caching is used, not persistent browser business caches or a custom offline queue. Do not describe offline data as server-confirmed.
- Driver archive persists `active:false` and clears truck assignments. Current/future schedule projections suppress archived driver assignments; historical schedule, manifest, diesel and cash references remain for audit. Every view derives from the shared driver collection. Truck and equipment removals similarly preserve historical identity through archive/inactivation.
- The normalized timetable adapter uses the same driver, truck, equipment, commodity, store and schedule collections. It no longer reads/writes a second registry. UI edits persist field differences rather than uploading an entire independent directory.
- Historical analytics include archived trucks; operational entry/dropdown lists use active trucks. Unmatched legacy KM is retained and prominently reported rather than dropped silently.

## KM behavior

The Dashboard, balancing table, export, reconciliation and matrix use canonical KM projections and shared `fleetAnalytics` helpers. The KM module has one month preference; data arrival selects the latest populated month only if the current selection has no records. “All” remains a dashboard option; the matrix uses the latest populated month in that case.

Daily-KM and meter edits use separate transactional patches. Editing one field reads the current document and preserves the other, including concurrent edits from another session. No missing odometer is replaced by zero; genuine zero is valid. Opening/closing display “No odometer reading” when absent. Explicit recalculation applies only to records marked `source:meter`, never imported/manual daily distances. Meter differences remain a separate metric from entered daily KM.

Legacy monthly summaries remain accepted for compatibility and are explicitly marked `legacy-monthly-summary` on the existing synthetic 15th-of-month date. They are not a reconstructed daily distribution. Prefer actual daily data; review these legacy summary rows before treating the daily matrix as a historical daily ledger.

Import validates records and exact normalized truck identity before writing. Conflicting duplicate daily values and unknown/ambiguous trucks block the import. A ledger is created first. Batches contain at most 200 records for one truck, keeping Firestore rule lookups within limits. A server-only query verifies IDs and distance/meter values, then updates counts/status. A partial result is an error with persisted counts and retry guidance; retrying the same canonical IDs does not duplicate days. Verification failure is never reported as success.

## Boundaries and rollout

This is a code-level repair, not evidence that the production database has already been migrated or rules deployed. Run the migration and acceptance steps in `MIGRATION_AND_TESTS.md` before rollout. Keeping old random-ID documents for audit is deliberate; canonical projections suppress duplicates, and strict rules reject new noncanonical KM writes. After reviewed backup/validation, administrators may separately retire obsolete documents.

The existing role model and authentication workflows are preserved. Rules add missing business collections, canonical KM validation, import-ledger ownership and active-driver assignment validation; this is not a comprehensive authentication/security redesign. High-volume server-side archival/cascades and per-user data partitioning would require additional backend work if business scale or access requirements change.
