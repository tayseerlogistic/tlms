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
  const registryReady = !loadingStates.trucks && !errorStates.trucks;
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
      {['commodities', 'stores', 'data_quality', 'app_state'].some(name => /permission|insufficient/i.test(errorStates[name] || '')) && (
        <p className="text-amber-300 mt-1">Publish this version’s firestore.rules to project sonic-hawk-hsmzh, database ai-studio-8c81ea2f-4e0c-45e3-8fb8-22dded5a07f9. Deploying the website does not publish Firestore rules.</p>
      )}
      {Object.entries(errorStates).map(([name, message]) => (
        <p key={name} className="text-rose-300 mt-1">
          {message}
        </p>
      ))}
      {registryReady && trucks.length === 0 && kmRecords.length > 0 && (
        <p className="text-amber-300 mt-1">The Firestore truck registry is empty. {kmRecords.length} KM records are loaded, but fleet tables require saved master trucks. Restore or migrate the verified truck registry in Settings → Master Data before linking historical KM.</p>
      )}
      {registryReady && trucks.length > 0 && unmatched.length > 0 && (
        <p className="text-amber-300 mt-1">
          {unmatched.length} KM records have unmatched truck identities:{" "}
          {[...new Set(unmatched.map((r) => r.veh))].join(", ")}. Link them to
          Master Data before comparing fleet totals.
        </p>
      )}
    </div>
  );
}
