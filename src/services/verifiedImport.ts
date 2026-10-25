import type { KmRecord } from "../types";
export type ImportResult = {
  batchId: string;
  expectedRecordCount: number;
  persistedRecordCount: number;
  failedRecordCount: number;
  status: "completed" | "partial" | "failed";
  failedIds: string[];
};
export interface ImportTransport {
  begin: (result: ImportResult) => Promise<void>;
  write: (records: KmRecord[]) => Promise<void>;
  verify: () => Promise<KmRecord[]>;
  finish: (result: ImportResult, errors: string[]) => Promise<void>;
  verificationFailed: (message: string) => Promise<void>;
}
/** Transport-independent protocol: write acknowledgements alone never mean import success. */
export async function runVerifiedImport(
  batchId: string,
  records: KmRecord[],
  transport: ImportTransport,
): Promise<ImportResult> {
  const expected = new Map(records.map((r) => [r.id, r]));
  const result: ImportResult = {
    batchId,
    expectedRecordCount: expected.size,
    persistedRecordCount: 0,
    failedRecordCount: expected.size,
    status: "failed",
    failedIds: [],
  };
  await transport.begin(result);
  const groups = new Map<string, KmRecord[]>();
  for (const r of expected.values()) {
    const key = r.truckId!;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const errors: string[] = [];
  // A batch contains only one truck, keeping rule document lookups within Firestore limits.
  for (const rows of groups.values())
    for (let offset = 0; offset < rows.length; offset += 200) {
      try {
        await transport.write(rows.slice(offset, offset + 200));
      } catch (error) {
        errors.push(String(error));
      }
    }
  try {
    const saved = new Set(
      (await transport.verify())
        .filter((actual) => {
          const wanted = expected.get(actual.id);
          return (
            wanted &&
            actual.truckId === wanted.truckId &&
            actual.date === wanted.date &&
            actual.distanceKm === wanted.distanceKm &&
            actual.odometerKm === wanted.odometerKm
          );
        })
        .map((r) => r.id),
    );
    result.persistedRecordCount = saved.size;
    result.failedIds = [...expected.keys()].filter((id) => !saved.has(id));
    result.failedRecordCount = result.failedIds.length;
    result.status =
      saved.size === expected.size
        ? "completed"
        : saved.size
          ? "partial"
          : "failed";
    await transport.finish(result, errors);
    return result;
  } catch (error) {
    await transport.verificationFailed(String(error)).catch(() => {});
    throw new Error(
      `KM import ${batchId} could not be verified on the server. Some records may be saved; retry the same file safely. ${String(error)}`,
    );
  }
}
