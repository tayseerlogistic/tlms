# Tayseer Logistics Management System (TLMS)

TLMS is a React + TypeScript fleet-operations workspace for dispatch schedules, daily manifests, fleet/KM and diesel records, cashbook activity, driver self-service, and master data.

## Requirements

- Node.js 22
- npm
- Access to the configured Firebase project for shared persistence. Local demo/offline data may appear when no Firebase session is active.

## Run locally

```bash
npm install --legacy-peer-deps --force
npm run dev
```

Vite serves the local app on port 3000. Use the Firebase configuration already provided by the deployment environment; do not commit credentials or private environment files.

## Validate changes

```bash
npm run lint
npm test
npm run build
```

CI runs those three checks on pull requests and pushes to the primary branches.

## Key areas

- `src/context/LmsContext.tsx`: shared data, Firebase snapshots, persistence, backup/restore.
- `src/components/TimetableParserView.tsx`: timetable import and editing.
- `src/components/DailyManifestView.tsx`: daily and multi-day manifest workflows.
- `src/components/KmFuelView.tsx`: odometer, fuel, and fleet balancing.
- `src/components/CashbookView.tsx`: transactions, employee advances, statements, and reports.
- `src/utils/dateUtils.ts`: Saudi business date and ISO date arithmetic.

## Dates and dashboard metrics

Operational dates use the `Asia/Riyadh` time zone. Dashboard trend values are based on recorded KM, diesel, timetable, and manifest data; missing data is not filled with synthetic trend values. Fuel efficiency is only computed when the period has both recorded distance and liters. The manifest model does not display a fabricated accuracy percentage: no independent holdout validation is implemented yet.

## Backup and restore

Use **Settings → Backup & Restore** to export a JSON snapshot before restoring. Restore validates the shape before applying data and, when signed in, syncs the supported collections to Firestore. If the restore reports an error partway through, inspect the database and restore snapshot before retrying; a sequence of collection writes is not a cross-collection transaction. Test a restore against a staging Firebase project before using it on production data.

## Dispatch and driver records

Manifest tags should use stable driver IDs. Legacy numeric-index manifest records are normalized during loading/saving to reduce the risk of a tag changing drivers after reordering. Archiving a driver preserves their historical record and removes the driver from current truck assignment rather than deleting history.

## Scope

This project review and its fixes do not include a security audit. Firebase rules, IAM, secrets, authentication hardening, and production access controls must be assessed separately before this test branch is treated as production-ready.
