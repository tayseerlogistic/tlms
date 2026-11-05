# Manifest prediction audit — 5 November 2026

## Source and matching

Analyzed `Drivers and Trucks Daily follow up.xlsx`: 46 sheets, comprising 24 manifest and 22 schedule tabs. Only records through 4 November 2026 were eligible. The workbook was not modified and no live Firestore records were imported or overwritten.

| Measure | Count |
|---|---:|
| Historical driver/date statuses | 47,171 |
| Schedule rows | 16,409 |
| Schedule driver/date groups | 12,946 |
| Groups with same-date manifest matches | 11,652 |
| Compatible activity matches | 6,861 |
| Ambiguous route activities excluded | 56 |
| Conflicting source cells excluded | 2 |
| Eligible next-stage transitions | 17,072 |

Matching uses stable driver identity, then commodity and movement type. Ambiguous routes are excluded. The published model contains aggregate transition counts, with no driver names or identity documents.

## Findings

The previous flow could regenerate Loading from a repeated schedule, or carry yesterday's tag indefinitely. Schedule-generated suggestions could also enter the same history used for learning.

Route behavior differs: Yanbu–Turaif commonly progresses from loading to transit to offloading; Jeddah and Rabigh often progress directly from loading to offloading. Some Rabigh jobs remain loading for another day. Warehouse movements to Dammam have their own travel pattern. A universal three-day cycle would introduce errors.

## Changes

- Learn source, destination, commodity, warehouse/customer movement, current stage, and consecutive days in that stage.
- Prefer supported material/route patterns, then route, destination and movement patterns. Unsupported patterns retain a low-confidence review fallback.
- Separate warehouse transfers from customer supply. Preserve supplier collections and TLS–TPF internal transfers.
- A repeated waybill may progress through stages; a new waybill or changed route starts a new loading suggestion.
- Preserve all driver trips and explicit confirmed tags. Do not invent progression across missing days.
- Schedule sync creates an unconfirmed draft. Confirm & Save and imported historical manifests create confirmed history. Backups preserve draft dates.
- Learn from newer confirmed app records without double-counting the bundled reference model. Historical-date predictions exclude future records.

Older saved documents without an explicit draft flag remain treated as historical confirmed records for compatibility. Existing incorrect confirmed tags require review and regeneration; this release does not rewrite them.

## Chronological validation

Trained on 16,561 transitions before 1 October 2026, then evaluated 511 transitions from 1 October through 4 November. Evidence thresholds covered 444 cases; 330 were correct: **74.3% next-stage accuracy on covered cases**. Leaving the stage unchanged was correct in 78 of those same 444 cases: **17.6%**. The 67 uncovered cases are excluded from that accuracy figure. This is not full-manifest or live-production accuracy.

The final aggregate model was refit on all 17,072 eligible transitions. Reproduce it with:

```sh
node --import tsx scripts/train-manifest-workbook.ts input.xlsx src/data/manifestTransitions.json 2026-11-04
```

## Validation and use

Unit tests, TypeScript validation and the production build passed. Regression coverage includes route progression, warehouse/internal movements, new versus repeated waybills, stage age, multiple trips, confirmed overrides, gaps, ambiguous routes, changed routes and commodity aliases. Live browser verification remains outstanding.

After deployment, open Daily Manifest and its suggestion tools, choose **Suggest statuses**, review every proposed status and then **Confirm & Save**. Confirm actual results daily so subsequent predictions use verified history. No additional workbook upload is required for this bundled reference model.
