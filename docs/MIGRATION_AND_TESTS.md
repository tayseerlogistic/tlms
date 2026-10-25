# Migration, deployment and acceptance

## Before changing production

1. Use a maintenance window and export the existing Firestore database. In each browser that may contain unique legacy data, export its current full backup before deploying this change. The new application intentionally does not auto-load or overwrite old caches. Do not clear browser storage until reconciliation is complete.
2. Inventory the `tls_lms_offline_cache_v2_*` and `timetable_db_v4` caches with the operator of that browser. Treat them as untrusted candidate data: compare IDs, plates, Iqama, dates, totals and timestamps against Firestore. Never automatically upload bundled `src/data` demo records. Those files are isolated legacy fixtures and are no longer runtime sources.
3. Reconcile unmatched master records from legacy timetableRegistry/local backups into Firestore using reviewed stable IDs. Do not merge on fuzzy names or plate suffixes. Preserve existing IDs; assign new IDs only to genuinely new entities. Resolve duplicate normalized plates explicitly.
4. Set Application Default Credentials for an administrator in a trusted workstation or Cloud Shell. Never add credentials to the repository. Run `npm install`, then `npm run migrate:plan`. The script targets the exact configured project/database, exports a timestamped backup and writes a plan under ignored `migration-output/`. It makes no writes by default.
5. Resolve every blocker in the plan. Numeric manifest keys require an explicitly reviewed JSON mapping such as `{"0":"driver-stable-id"}` from the historical ordering at the time of export, supplied with `--driver-index-map path.json`. Never derive this mapping from the current sorted driver list. Conflicting duplicates, unknown trucks and inconsistent history stop migration.
6. Review the generated backup and plan. Apply with `npm run migrate:plan -- --apply`. Writes use version preconditions and server read-back checks. A concurrent edit fails the affected batch instead of overwriting newer data. Earlier batches may already be committed; rerun the dry-run to reconcile a partial run. No legacy documents are deleted automatically.
7. For reviewed browser-only data, use Settings backup restore after reconciling IDs, or a separately reviewed administrator migration. Restore now merges a complete backup into Firestore instead of deleting records absent from the file. KM rows must match backup trucks and are server-verified. A partial failure is reported; repeat only after reviewing current data. Optional historical sections should be supplied as empty arrays when absent. The script does not directly read browser storage or execute arbitrary cache data.
8. Run `npm run lint`, `npm test`, `npm run build`, and (Java 21+) `npm run test:rules`. CI includes Java 21 and the rules test command.
9. Deploy the reviewed rules to project `sonic-hawk-hsmzh`, named database `ai-studio-8c81ea2f-4e0c-45e3-8fb8-22dded5a07f9`, using the supplied Firebase configuration. For example, use `npx firebase-tools deploy --only firestore:rules --project sonic-hawk-hsmzh` from this repository in a trusted environment. Verify the database selection and published rule text in Firebase Console. These steps have not been executed against production by this change.
10. Deploy the application in the same maintenance window. Old clients using random-ID KM writes or the deprecated timetableRegistry will be rejected by the new rules; close/reload old sessions. Complete the two-session acceptance checklist below before reopening normal operation.

## Verification evidence

- Local TypeScript check: passed.
- Local unit suite: 31 tests passed at the initial handoff, covering existing cash/date/import behavior plus canonical KM, matching, duplicate precedence, meter semantics, partial imports, verification failures, retry idempotence and migration ambiguity.
- Local production build: passed. Existing large-chunk warning remains.
- Local rules emulator: could not start because the environment provides Java 17 and current Firebase tooling requires Java 21. Rules tests are included in CI with Java 21; inspect the pull request check result.
- Production Firestore credentials/data and deployed rules were not available. No production writes, migration, rule deployment or real authenticated two-browser test was performed.

## Live acceptance checklist (not claimed as executed)

| Scenario | Expected evidence |
| --- | --- |
| Add driver | One Firestore driver ID; appears in Master Data, timetable and manifest in two sessions |
| Edit driver | Same ID; operational names/contact details update in both sessions |
| Archive driver | active=false; truck assignments cleared; removed from active lists, future dispatch and operational manifest; historical identity retained after refresh |
| Truck create/edit/archive | Stable ID across plate changes; affected assignments and all screens update; historical analytics retained |
| Multi-month import | import_batches expected/persisted counts match server documents; status completed only after verification |
| Dashboard/table/matrix | Same selected-month total for canonical records; unmatched rows visibly reported |
| Month selection | Populated user selection retained; empty default falls back to latest populated month |
| Daily KM edit | distanceKm/km updated; odometerKm/odometer unchanged, including a concurrent meter edit |
| Odometer edit | Only meter field updated; daily distance unchanged, including a concurrent distance edit |
| Refresh | No seed/browser cache reappears; server records load with visible sync state |
| Second session | Authenticated session sees the same IDs and changes without manual refresh |
| Permission failure | Affected collection cleared and named permission error visible, not an unexplained empty table |
| Partial bulk failure | Exact server-verified saved/failed counts; same-file retry yields no duplicate days |
| Runtime source audit | No fleet/timetable business cache writes; production bundle does not import src/data fixtures; identity domain remains in existing AuthContext |

Do not mark the live checklist complete based only on unit tests or a successful build.

Deployment reference: [Firebase rules deployment guide](https://firebase.google.com/docs/rules/manage-deploy). Rules must be deployed to the configured named database; deploying only the default database does not update this app.
