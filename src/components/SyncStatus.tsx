import React from "react";
import { useLms } from "../context/LmsContext";
import { resolveTruck } from "../utils/fleetAnalytics";
export function SyncStatus() {
  const {
    syncStatus,
    errorStates,
    kmRecords,
    historicalTrucks: trucks,
    loadingStates,
  } = useLms();
  const unmatched = kmRecords.filter(
    (r) => !resolveTruck(trucks, r.truckId, r.veh),
  );
  const messages = {
    loading: "Loading from Firestore",
    synced: "Synced with Firestore",
    syncing: "Saving — waiting for Firestore confirmation",
    offline: "Offline or cached data — changes are not confirmed on the server",
    "guest/local-only":
      "Not authenticated — sign in to load and save production data",
    error: "Data synchronization failed",
  };
  return (
    <div
      role={syncStatus === "error" ? "alert" : "status"}
      className="mx-4 mt-3 rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 bg-slate-900"
    >
      <strong>{messages[syncStatus]}</strong>
      {Object.entries(errorStates).map(([name, message]) => (
        <p key={name} className="text-rose-300 mt-1">
          {message}
        </p>
      ))}
      {!loadingStates.trucks && unmatched.length > 0 && (
        <p className="text-amber-300 mt-1">
          {unmatched.length} KM records have unmatched truck identities:{" "}
          {[...new Set(unmatched.map((r) => r.veh))].join(", ")}. Link them to
          Master Data before comparing fleet totals.
        </p>
      )}
    </div>
  );
}
