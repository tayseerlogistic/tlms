# Changed files

Paths are relative to the repository. The PR diff is the authoritative file list.

| File | Reason |
| --- | --- |
| `.firebaserc` | Select the existing Firebase project. |
| `.github/workflows/ci.yml` | Run reproducible installation, validation and Java 21 Firestore tests. |
| `.gitignore` | Exclude migration backups and plans. |
| `docs/DATA_ARCHITECTURE.md` | Document the audit, architecture and rollout. |
| `docs/DATA_AUDIT.md` | Document the audit, architecture and rollout. |
| `docs/MIGRATION_AND_TESTS.md` | Document the audit, architecture and rollout. |
| `firebase.emulator.json` | Isolate emulator tests from production. |
| `firebase.json` | Target rules at the exact named production database. |
| `firestore.rules` | Validate canonical KM, allow required collections and protect import ownership/driver assignments. |
| `package-lock.json` | Lock the npm dependency graph used by CI. |
| `package.json` | Add verification and migration commands and development tools. |
| `scripts/migrate-data.ts` | Back up, plan, conditionally apply and read back administrative migration writes. |
| `src/App.tsx` | Display shared sync/error status on every app screen. |
| `src/components/DailyManifestView.tsx` | Resolve tags by stable driver IDs only. |
| `src/components/DriverPortalView.tsx` | Preserve daily KM during meter submissions and keep hooks stable while records load. |
| `src/components/ErrorBoundary.tsx` | Remove the unsupported claim that unsaved data is safe in browser storage. |
| `src/components/KmFuelView.tsx` | Share month/data/calculations, verify imports and separate meter/daily edits. |
| `src/components/Navbar.tsx` | Read shared branding through context. |
| `src/components/OverviewView.tsx` | Use shared analytics rather than independent totals. |
| `src/components/SettingsView.tsx` | Save/read branding through the central repository. |
| `src/components/SyncStatus.tsx` | Explain loading, pending, offline, auth, permission and unmatched-truck states. |
| `src/components/TimetableParserView.tsx` | Use shared master collections through adapters and await saves. |
| `src/context/LmsContext.tsx` | Replace seeded/browser stores with one repository-backed context and domain actions. |
| `src/data/README.md` | Mark retained seed files as isolated migration reference, not production sources. |
| `src/firebase/config.ts` | Preserve the actual project/database and remove unauthenticated startup probe. |
| `src/services/fleetRepository.ts` | Centralize authenticated Firestore listeners, CRUD, batches and transactional KM edits. |
| `src/services/verifiedImport.ts` | Verify import results against server reads and expose partial failures. |
| `src/types/index.ts` | Add stable relationships, archive fields, canonical KM fields and metadata. |
| `src/utils/dataMigration.ts` | Build a reviewable migration plan that blocks ambiguous identities and conflicts. |
| `src/utils/fleetAnalytics.ts` | Normalize identity and unify canonical KM, period and fuel calculations. |
| `src/utils/fleetPolicy.ts` | Separate policy constants from business seed files. |
| `src/utils/kmImportUtils.ts` | Accept canonical distance/meter names and retain explicit source semantics. |
| `src/utils/multiDayManifestParser.ts` | Remove automatically bundled real historical sample records. |
| `src/utils/timetableEngine.ts` | Persist UI preferences only; remove embedded fleet registries. |
| `tests/dataMigration.test.ts` | Test data consistency, migration or import/error behavior. |
| `tests/fleetAnalytics.test.ts` | Test data consistency, migration or import/error behavior. |
| `tests/rules/firestore.test.ts` | Test data consistency, migration or import/error behavior. |
| `tests/verifiedImport.test.ts` | Test data consistency, migration or import/error behavior. |
| `docs/CHANGED_FILES.md` | Provide this file-by-file change inventory. |
