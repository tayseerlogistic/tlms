# Security Specification & Verification (TDD)

## 1. Data Invariants
1. **Administrative Authority**: Only users documented in `/admins/{uid}` or authenticated with the verified owner email `tayseerlogistic@gmail.com` can create/delete master records (Trucks, Equipment, Drivers, Cash Accounts) or mutate user roles.
2. **Role Boundaries**:
   - `admin`: Full read/write across all collections.
   - `dispatcher`: Can create/update schedules, manifests, assign trucks/equipment/drivers, and log meter readings.
   - `cashier`: Can manage cashbook transactions, accounts, fuel logs, and driver settlements.
   - `driver`: Can read their assigned truck/schedule/manifest, submit their own daily meter reading, and view their personal advances.
3. **Immutability of Audit Trails**: Records written to `/audit/{auditId}` can never be updated or deleted by any user or client.
4. **Default-Deny Catch-all**: Any path not explicitly matched is strictly inaccessible.
5. **ID Sanitization**: Document IDs must not exceed 128 characters and must match `^[a-zA-Z0-9_\-]+$`.

## 2. The "Dirty Dozen" Threat Payloads
1. **Unauthenticated Read on User Profiles**: A visitor with `request.auth == null` requests `/users/any_uid`. Expected: `PERMISSION_DENIED`.
2. **Self-Escalation to Admin**: Authenticated non-admin attempts to set `{ role: "admin" }` in their own `/users/{uid}` document. Expected: `PERMISSION_DENIED`.
3. **Spoofed Admin Write via Client Claim**: Attacker attaches fake token header or tries modifying `/admins/{attacker_uid}`. Expected: `PERMISSION_DENIED`.
4. **Driver Tampering with Cash Ledger**: User with `driver` role attempts write to `/cashbook/{txId}`. Expected: `PERMISSION_DENIED`.
5. **Direct Mutation of Audit Logs**: Any authenticated user attempts `update` or `delete` on `/audit/{auditId}`. Expected: `PERMISSION_DENIED`.
6. **Oversized String Injection (Denial-of-Wallet)**: Attacker attempts to post a 1MB payload into `truck.plate` or `driver.name`. Expected: `PERMISSION_DENIED`.
7. **Path Traversal / Malicious ID**: Request targeting `/trucks/../../secret` or IDs exceeding 128 chars. Expected: `PERMISSION_DENIED`.
8. **Orphaned Cash Transaction**: Writing a cash transaction with a negative amount on create or missing required fields. Expected: `PERMISSION_DENIED`.
9. **Fake Odometer Rollback**: Driver attempts to submit negative KM reading. Expected: `PERMISSION_DENIED`.
10. **Shadow Field Injection**: Writing unauthorized fields outside the permitted schema on `trucks` or `manifests`. Expected: `PERMISSION_DENIED`.
11. **Altering Immutable Creation Timestamps**: Modifying `createdAt` or `createdBy` on an existing cashbook record. Expected: `PERMISSION_DENIED`.
12. **Blanket Query Scraping**: Running an unconstrained `collectionGroup` scan without authenticated session. Expected: `PERMISSION_DENIED`.
