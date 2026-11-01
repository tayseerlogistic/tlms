# TLMS workflow audit — 1 November 2026

Scope: code review, workbook analysis, automated regression checks, TypeScript and production compilation. This is not certification of every live browser interaction or production Firestore permissions.

## Workbook evidence

Source: user attachment “Copy of Drivers and Trucks Daily follow up.xlsx”; read without modifying it. 45 tabs include monthly manifest histories and daily dispatch sheets.

Against the supplied restored registry (68 drivers), the conservative historical preview through 2026-11-01 matched 27,894 driver/date status observations across 670 populated dates. 794 review lines include unresolved historical identities, section/summary rows and three contradictory driver/date cells. These are not 794 missing current drivers. Historical identities must not be guessed from a truck's current assignment.

The November manifest overlaps 31 October. Conflicting statuses are omitted for review rather than selecting a sheet silently. Future cells through November are excluded from historical observations. Excel serial dates are interpreted as calendar days, independent of browser timezone.

An offline training pass on matched observations retained 500 bounded historical rules (87,826 serialized bytes). This validates extraction and payload size, not prediction accuracy. No live histories or learned rules were written from this audit.

## Corrected defects

- Prediction previously used the first matching trip; schedule-to-manifest saving repeatedly overwrote the same driver's tag, retaining only the last trip.
- Shared dispatch logic now combines every trip in row order, including repeated trips with identical descriptions. UI shows every matched trip and waybill.
- Driver ID takes precedence; without one, Iqama or exact name is used. Conflicting identities and reused truck plates cannot silently attach another driver's trip.
- Collection labels use supplier information and commodity. Tronox supplies CS; Yasref can supply sulphur/molten sulphur. Luberef sulphur collection remains supported. A company can also receive deliveries; customer deliveries are not globally changed into collections.
- TLS/TPF internal movements, including TLS-TPF and TPF-TLS, produce exactly “Internal Transfer.”
- A schedule is a plan, not proof of a completed loading/travel/offloading stage. Previous multi-activity statuses are carried forward for review instead of fabricating one next stage.
- Historical feature extraction no longer invents a commodity from customer name (for example treating every Tronox activity as SA). All scheduled trips contribute route keys without inflating daily observation counts.
- Training directly after import now sees the imported records, not stale React subscription state. Rule payloads are bounded before persistence.
- Manifest import supports multi-sheet Excel preview; dispatch tabs are excluded. Import only occurs after the existing review/sync action.
- Previous paste-header fix is included on main.
- Schedule starts with core columns; all official columns remain available through Columns and full exports. Column selection works again.
- Manifest training metrics are collapsed by default; workflows have short instructions; timetable management is grouped under Manage. Today and saved-schedule navigation are explicit.

## Preservation

No migration, full-backup restore, seed upload, or production database mutation was performed. Existing driver, truck, equipment, Cashbook and KM records are not rewritten by deploying this code. Historical workbook import is a separate explicit UI action. Existing confirmed statuses remain unchanged until the dispatcher saves or imports.

## Verification

- 42 automated tests passed: Cashbook reversals, migration identity, KSA dates, fleet/KM aggregation, multi-month KM input, verified imports, stable manifest matching, multiple trips, supplier direction, internal transfers, historical training and workbook conflicts.
- TypeScript and Vite production build passed.
- Rules emulator could not run: environment has Java 17; installed Firebase CLI requires Java 21+. Rules were not changed.
- Existing Vite large-bundle warning remains.
- Live email/password sign-in, responsive screenshots, exports/downloads and permission checks were not exercised against the production application. They remain a live acceptance check after Vercel deployment.

## Dispatcher acceptance check after deployment

1. Open a saved schedule; verify date, driver, supplier/customer and each separate trip row.
2. Give one driver a Tronox CS collection, a TPF-to-TLS movement and a delivery. Review the combined manifest draft and confirm all three activities are present before saving.
3. Verify a delivery to Tronox/Yasref remains a delivery.
4. Confirm a reviewed manifest, refresh, and check it remains unchanged.
5. On Import previous manifests, upload the workbook and review unmatched identities/conflicts. Select the preview month. Sync only after review; do not use full backup restoration.
6. Verify current Cashbook, KM, driver and equipment counts remain unchanged.

The workbook teaches historical patterns; it does not establish an independently measured accuracy percentage.
