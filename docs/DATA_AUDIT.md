# Data audit — main e319aa5 (before implementation)

- `src/context/LmsContext.tsx:89–241`: fifteen business state initializers read browser caches and seed files; an effect writes them back. Browser state survives logout and can be mistaken for remote data.
- `LmsContext.tsx:244–397`: listeners accept a local profile as authentication, hide errors in console warnings, merge built-in cash accounts, and do not clear collections on session changes.
- `LmsContext.tsx:436–472`: driver archive clears truck assignments, but the independent timetable directory is unaffected. Guest mode mutates local state.
- `src/components/TimetableParserView.tsx:84–242` and `src/utils/timetableEngine.ts:320–395`: a second registry and schedules live in localStorage and `app_state/timetableRegistry`. The archive matcher also uses over-escaped regular expressions. Automatic registry writes can upload demo data.
- `LmsContext.tsx:681–760`: KM writes identify trucks by mutable plate, reuse arbitrary IDs, and trust writes/local state without a server verification or batch ledger.
- `src/components/KmFuelView.tsx:125–137`: latest populated month fallback already exists on main. Matrix daily distance editing is also already fixed. Separate month states, exact plateNorm comparisons, and unlinked records still allow inconsistent totals. The single-date odometer editor and fast logger overwrite daily distances.
- `KmFuelView.tsx:1253–1330` versus `OverviewView.tsx:54–92`: master table iterates master trucks; overview aggregates all raw records. Unmatched vehicles disappear from the table but remain in the graph. Analytics are duplicated.
- Manifest state is duplicated in `drivers.history`; numeric tag keys are interpreted using the current array order and can change identity after reorder/deletion.
- `firestore.rules`: missing `app_state`, `commodities`, `stores`, `data_quality`, and `import_batches` permissions. KM rules do not validate distance, meter, foreign key, or canonical ID.
- `src/firebase/config.ts`: project `sonic-hawk-hsmzh`, named database `ai-studio-8c81ea2f-4e0c-45e3-8fb8-22dded5a07f9`. Repository access alone cannot verify deployed rules or live records.

Preserve the screens and existing collection names. Replace business caches with one repository and listener-backed context; keep legacy fields as UI adapters, introduce stable relationships on writes, and migrate historical ambiguity explicitly rather than guessing identities.
