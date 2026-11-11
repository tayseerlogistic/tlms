import { abbreviateManifestCustomers } from './manifestCustomer';
import referenceTransitions from '../data/manifestTransitions.json';
import { predictRouteProgression, type TransitionModel } from './routeProgression';
import { manifestForTrips, scheduleRowsForDriver } from './dispatchManifest';
import { Driver, DailySchedule, TimetableRow, LearnedRule, ManifestSuggestion } from '../types';

export interface ModelTrainingStats {
  totalTripsIngested: number;
  distinctDates: number;
  driversTrained: number;
  patternsExtracted: number;
  accuracyRate: number; // e.g. 96.8
  lastTrainedAt: string;
}

// Global in-memory cache of trained AI model
let globalModelStats: ModelTrainingStats = {
  totalTripsIngested: 0,
  distinctDates: 0,
  driversTrained: 0,
  patternsExtracted: 0,
  accuracyRate: 0,
  lastTrainedAt: ''
};

/**
 * Normalizes text for AI token matching
 */
export function normText(s: string): string {
  return String(s || '').toUpperCase().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Trains the Manifest AI Model by scanning historical schedules and daily manifests.
 */
export function trainManifestAiModel(
  drivers: Driver[],
  schedules: Record<string, DailySchedule>,
  manifests: Record<string, Record<string, string>>,
  existingRules: LearnedRule[] = []
): { stats: ModelTrainingStats; rules: LearnedRule[] } {
  let tripsCount = 0;
  const tripKeys = new Set<string>();
  const datesSet = new Set<string>();
  const rulesMap = new Map<string, LearnedRule>();
  const previousRules = new Map<string, LearnedRule>();

  // Keep existing learned knowledge without starting fresh hit counts from previous runs.
  existingRules.forEach(rule => {
    const driverId = rule.driverId || drivers[rule.driverIndex]?.id;
    const key = `${driverId || rule.driverIndex}__${rule.result}`;
    previousRules.set(key, { ...rule, ...(driverId ? { driverId } : {}) });
  });

  // 1. Ingest driver historical logs across the dates actually available.
  drivers.forEach((drv, drvIdx) => {
    if (!drv.history) return;

    const histDates = Object.keys(drv.history).sort();
    histDates.forEach(dt => {
      datesSet.add(dt);
      const tag = drv.history![dt];
      if (!tag) return;
      const tripKey = `${drv.id}__${dt}__${tag}`;
      if (!tripKeys.has(tripKey)) { tripKeys.add(tripKey); tripsCount++; }

      // Derive commodity/party features from the observed activity, never assume
      // a customer's commodity or route from its name alone.
      const features = tag.split(/\s+\/\s+/).map(activity => {
        const collection = activity.match(/^(.+?)\s+Collection from\s+(.+?)(?:\s+-|$)/i);
        const supply = activity.match(/^(.+?)\s+Supply for\s+(.+?)(?:\s+-|$)/i);
        if (collection) return `COLLECTION|${normText(collection[2])}|${normText(collection[1])}`;
        if (supply) return `SUPPLY|${normText(supply[2])}|${normText(supply[1])}`;
        return normText(activity) === 'INTERNAL TRANSFER' ? 'INTERNAL_TRANSFER' : 'STATUS';
      });
      const patternKey = features.join(' + ');

      const ruleKey = `${drv.id}__${tag}`;
      const existing = rulesMap.get(ruleKey);
      if (existing) {
        existing.hits += 1;
        if (!existing.keys.includes(patternKey)) existing.keys.push(patternKey);
        existing.lastSeen = dt;
      } else {
        rulesMap.set(ruleKey, {
          driverId: drv.id,
          driverIndex: drvIdx,
          driverName: drv.name,
          keys: [patternKey],
          result: tag,
          hits: 1,
          lastSeen: dt
        });
      }
    });
  });

  // 2. Ingest confirmed manifests and correlate with Timetable schedules
  Object.entries(manifests).forEach(([dt, tagsMap]) => {
    datesSet.add(dt);
    const daySchedule = schedules[dt];
    const schedRows = daySchedule?.rows || [];

    Object.entries(tagsMap).forEach(([idxStr, tag]) => {
      const numericIndex = Number(idxStr);
      const hasLegacyIndex = idxStr.trim() !== '' && Number.isInteger(numericIndex) && String(numericIndex) === idxStr;
      const drvIdx = hasLegacyIndex ? numericIndex : drivers.findIndex(driver => driver.id === idxStr);
      if (drvIdx < 0 || !drivers[drvIdx]) return;
      const drv = drivers[drvIdx];
      const tripKey = `${drv.id}__${dt}__${tag}`;
      const isNewObservation = !tripKeys.has(tripKey);
      if (isNewObservation) { tripKeys.add(tripKey); tripsCount++; }
      // Check if driver was dispatched in timetable for this date
      const matchedRows = scheduleRowsForDriver(drv, schedRows);
      if (matchedRows.length) {
        const keys = matchedRows.map(row =>
          `${normText(row.source)}>${normText(row.destination)}|${normText(row.supplier || row.customer)}|${normText(row.commodity?.split('/')[0] || '')}`
        );

        const ruleKey = `${drv.id}__${tag}`;
        const existing = rulesMap.get(ruleKey);
        if (existing) {
          // A driver's status may exist in both history and the manifest collection.
          if (isNewObservation) existing.hits += 1;
          existing.keys = Array.from(new Set([...existing.keys, ...keys]));
          if (dt > existing.lastSeen) existing.lastSeen = dt;
        } else {
          rulesMap.set(ruleKey, {
            driverId: drv.id,
            driverIndex: drvIdx,
            driverName: drv.name,
            keys,
            result: tag,
            hits: isNewObservation ? 1 : 0,
            lastSeen: dt
          });
        }
      }
    });
  });

  // Merge prior route features into freshly computed counts, preserving rules no longer
  // represented by current source data. Repeating training cannot inflate the hit count.
  previousRules.forEach((previous, key) => {
    const observed = rulesMap.get(key);
    if (!observed) {
      rulesMap.set(key, previous);
      return;
    }
    observed.keys = Array.from(new Set([...(previous.keys || []), ...(observed.keys || [])]));
  });

  // Learned rules live in one app_state document. Bound the serialized payload
  // below Firestore's document limit, including long historical descriptions.
  let bytes = 0;
  const updatedRules = Array.from(rulesMap.values()).sort((a, b) => b.hits - a.hits)
    .filter(rule => {
      const size = new TextEncoder().encode(JSON.stringify(rule)).length + 1;
      if (bytes + size > 650000) return false;
      bytes += size;
      return true;
    }).slice(0, 500);

  globalModelStats = {
    totalTripsIngested: tripsCount,
    distinctDates: datesSet.size,
    driversTrained: new Set(updatedRules.map(rule => rule.driverId || drivers[rule.driverIndex]?.id || String(rule.driverIndex))).size,
    patternsExtracted: updatedRules.length,
    // No independent holdout evaluation is run here; do not fabricate an accuracy percentage.
    accuracyRate: 0,
    lastTrainedAt: new Date().toISOString()
  };

  return {
    stats: globalModelStats,
    rules: updatedRules
  };
}

export function getManifestModelStats(): ModelTrainingStats {
  return globalModelStats;
}

/**
 * Predicts the most accurate daily manifest tag for a driver based on:
 * 1. Timetable dispatch schedule for the date (Auto-fetched)
 * 2. Previous day's activity and trip progression stage
 * 3. AI-learned historical patterns & driver habits
 */
export function predictManifestForDriver(
  driverIndex: number,
  driver: Driver,
  date: string,
  currentScheduleRows: TimetableRow[],
  previousTag: string,
  learnedRules: LearnedRule[],
  confirmedTag?: string,
  progression?: {schedules: Record<string, DailySchedule>; model?: TransitionModel}
): ManifestSuggestion {
  // If already confirmed by dispatcher for this date, return locked
  if (confirmedTag) {
    return {
      text: confirmedTag,
      conf: 'high',
      reason: 'Confirmed & verified manifest status for this date'
    };
  }

  previousTag = abbreviateManifestCustomers(previousTag);
  if (progression) {
    const suggestion = predictRouteProgression(driver, date, previousTag, scheduleRowsForDriver(driver,currentScheduleRows),
      progression.schedules, progression.model || referenceTransitions as TransitionModel);
    if (suggestion) {
      if (!scheduleRowsForDriver(driver,currentScheduleRows).length && suggestion.conf==='low' && suggestion.text===previousTag)
        return {...suggestion,text:''};
      return suggestion;
    }
  }

  const prevNorm = normText(previousTag);
  const matchedRows = scheduleRowsForDriver(driver, currentScheduleRows);
  if (matchedRows.length) {
    return {
      text: manifestForTrips(matchedRows),
      conf: 'medium',
      reason: `Schedule draft: all ${matchedRows.length} trip(s) included. Loading, travel and offloading must be checked by the dispatcher; a schedule is not proof of completion.`
    };
  }

  // History is evidence of the previous status, not proof of a new trip stage.
  // The workbook includes trips lasting different numbers of days, so automatic
  // Loading -> Travel -> Offloading transitions would fabricate completion.
  if (/UNDER LOADING|ON THE WAY|BORDER|OFFLOADING|COMING BACK|COLLECTION FROM/i.test(previousTag) ||
      previousTag.includes(' / ')) {
    return {
      text: progression ? '' : previousTag,
      conf: 'low',
      reason: progression ? 'Review today’s status. The available dated history and dispatch could not establish the next trip stage.' : 'Previous recorded activity carried forward. No current dispatch evidence confirms a new stage; review before saving.'
    };
  }
  if (prevNorm) {
    // 2g. Maintenance / Vacation / Standby
    if (prevNorm.includes('TRUCK UNDER MAINTENANCE')) {
      return {
        text: 'Truck Under Maintenance at Yanbu',
        conf: 'medium',
        reason: 'Workshop Schedule: Vehicle maintenance and mechanical inspection ongoing.'
      };
    }

    if (prevNorm.includes('VACATION')) {
      return {
        text: 'Vacation',
        conf: 'medium',
        reason: 'Driver on approved annual vacation leave.'
      };
    }

    if (prevNorm.includes('WITH OUT TRUCK')) {
      return {
        text: 'With Out Truck',
        conf: 'medium',
        reason: 'Driver standby awaiting vehicle assignment.'
      };
    }

    if (prevNorm === 'AT YANBU' || prevNorm.includes('AT YANBU')) {
      return {
        text: 'At Yanbu',
        conf: 'medium',
        reason: 'Standby at Yanbu Base awaiting new dispatch.'
      };
    }

    if (prevNorm.includes('INTERNAL TRANSFER')) {
      return {
        text: 'Internal Transfer',
        conf: 'medium',
        reason: 'Internal yard logistics and transfer support.'
      };
    }
  }

  // 3. CHECK LEARNED HISTORICAL RULES & PREFERENCES
  const driverRules = learnedRules.filter(r => r.driverId ? r.driverId === driver.id : r.driverIndex === driverIndex);
  if (driverRules.length > 0) {
    const topRule = driverRules[0];
    if (topRule.hits >= 3 && /^(At Yanbu|Standby)$/i.test(topRule.result)) {
      return {
        text: topRule.result,
        conf: 'medium',
        reason: `AI Heuristic Match: High-frequency route pattern (${topRule.hits} recorded trips).`
      };
    }
  }

  // 4. DEFAULT STANDBY
  return {
    text: 'At Yanbu',
    conf: 'low',
    reason: 'Standby at Yanbu Base (no dispatch scheduled for today).'
  };
}
