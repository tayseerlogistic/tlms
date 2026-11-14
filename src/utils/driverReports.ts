import type { DailySchedule, Driver, KmRecord, ManifestSuggestion, Truck } from '../types';
import { isValidISODate, shiftISODate } from './dateUtils';
import { normalizePlate, odometerKm, distanceKm } from './fleetAnalytics';
import { manifestActivity, scheduleRowsForDriver } from './dispatchManifest';

export const REPORT_STATUSES = [
 ['loading','🏭 Loading / لوڈنگ / लोडिंग'],
 ['transit','🚛 On the Way / راستے میں / रास्ते में'],
 ['border','🛂 At Border / بارڈر پر / बॉर्डर पर'],
 ['waiting','⏳ Waiting for Offloading / انتظار / इंतज़ार'],
 ['offloading','📦 Offloading / ان لوڈنگ / अनलोडिंग'],
 ['returning','↩️ Coming Back to Yanbu / واپسی / वापसी'],
 ['base','🏠 At Yanbu / ینبع / यानबू'],
 ['internal','🔄 Internal Transfer / ٹرانسفر / ट्रांसफर'],
 ['maintenance','🔧 Maintenance / Breakdown / خرابی / खराबी']
] as const;
export type ReportStage = typeof REPORT_STATUSES[number][0];
export interface DriverReport {
 id: string; date: string; submittedAt: string; plate: string; truckId: string;
 driverId: string | null; driverName: string; odometer: number; status: ReportStage;
 remarks: string; state: 'accepted' | 'review' | 'duplicate' | 'rejected' | 'superseded';
 reason: string; validationError?: string; source: 'google-form'; sourceRow?: number; reviewedBy?: string; reviewedAt?: string;
}
export interface ReportDay extends DriverReport { reportId: string }
export interface AssignmentEvent {
 id: string; truckId: string; plate: string; driverId: string | null; driverName: string;
 previousDriverId: string | null; previousDriverName: string; effectiveDate: string; changedAt: string;
}
export function reportStatus(value: string): ReportStage | undefined {
 const normalized = value.replace(/^[^A-Za-z]+/, '').split(' / ')[0].trim().toLowerCase();
 return REPORT_STATUSES.find(([code, label]) => code === value || label.replace(/^[^A-Za-z]+/, '').split(' / ')[0].toLowerCase() === normalized)?.[0];
}
export function resolveReportAssignment(truck: Truck, date: string, events: AssignmentEvent[], drivers: Driver[]) {
 const history = events.filter(event => event.truckId === truck.id).sort((a,b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.changedAt.localeCompare(b.changedAt));
 const event = history.filter(item => item.effectiveDate <= date).at(-1);
 const id = event ? event.driverId : history.length ? history[0].previousDriverId : truck.assignedDriverId ?? null;
 return { driverId: id, driverName: drivers.find(driver => driver.id === id)?.name ||
  (event ? event.driverName : history[0]?.previousDriverName || truck.assignedDriverName || '') };
}
export function validateDriverReport(report: DriverReport, today: string) {
 if (report.validationError) throw new Error('Correct the form report and submit again: '+report.validationError);
 if (!isValidISODate(report.date) || report.date > today) throw new Error('Choose a valid report date up to today.');
 if (!REPORT_STATUSES.some(([stage]) => stage === report.status)) throw new Error('Choose one of the nine truck statuses.');
 if (!Number.isFinite(report.odometer) || report.odometer < 0 || report.odometer >= 1e12) throw new Error('Enter a valid non-negative meter reading.');
 if (!report.truckId || !normalizePlate(report.plate)) throw new Error('Truck was not matched.');
}
export function reportMeterPlan(report: DriverReport, records: KmRecord[], previous?: ReportDay, approve = false) {
 const rows = records.filter(row => row.truckId === report.truckId).sort((a,b) => a.date.localeCompare(b.date));
 const current = rows.find(row => row.date === report.date);
 const before = rows.filter(row => row.date < report.date && odometerKm(row) !== null).at(-1);
 const after = rows.find(row => row.date > report.date && odometerKm(row) !== null);
 const old = current ? odometerKm(current) : null;
 const issues: string[] = [];
 if (!report.driverId) issues.push('No dated driver assignment');
 if (previous && (previous.odometer !== report.odometer || previous.status !== report.status || previous.remarks !== report.remarks)) issues.push('Changed report for the same day');
 if (old !== null && old !== report.odometer) issues.push('Different meter already recorded');
 if (before && report.odometer < odometerKm(before)!) issues.push('Below the earlier meter');
 if (after && report.odometer > odometerKm(after)!) issues.push('Above the later meter');
 const delta = before?.date === shiftISODate(report.date,-1) ? report.odometer - odometerKm(before)! : null;
 if (after?.date === shiftISODate(report.date,1) && after.source === 'google-form' && odometerKm(after)!-report.odometer>3000)
  issues.push('Following daily distance exceeds 3,000 KM');
 if (delta !== null && delta > 3000) issues.push('Daily distance exceeds 3,000 KM');
 const importedDistance = current && current.source !== 'google-form';
 if (importedDistance && delta !== null && distanceKm(current) !== delta) issues.push('Existing daily distance differs');
 const invalidDistance = delta !== null && (delta < 0 || delta > 3000);
 if ((invalidDistance || (after && report.odometer > odometerKm(after)!) || (before && report.odometer < odometerKm(before)!)) && approve) throw new Error('Correct the meter before approving. Daily distance must be between 0 and 3,000 KM.');
 if (issues.length && !approve) return { state: 'review' as const, reason: issues.join('. '), writes: [] as KmRecord[] };
 const daily = importedDistance ? distanceKm(current!) : delta ?? 0;
 const reading = {
  ...current, id: report.truckId+'_'+report.date, truckId: report.truckId, veh: report.plate,
  date: report.date, odometer: report.odometer, odometerKm: report.odometer, km: daily, distanceKm: daily,
  source: current?.source || 'google-form', reportId: report.id,
  readingSource: 'google-form', needsDistanceReview: delta === null,
 } as KmRecord;
 const writes = [reading];
 // A late or corrected meter also changes the following day's derived distance.
 if (after?.date === shiftISODate(report.date,1) && after.source === 'google-form') {
  const nextDistance = odometerKm(after)! - report.odometer;
  if (nextDistance < 0 || nextDistance > 3000) throw new Error('This meter would invalidate the following day. Correct the related reading first.');
  writes.push({...after, km: nextDistance, distanceKm: nextDistance, needsDistanceReview: false} as KmRecord);
 }
 return {state:'accepted' as const, reason: delta === null ? 'Meter saved. Missing previous-day meter; daily KM needs review.' : 'Meter and daily KM verified.', writes};
}
export function reportManifest(report: DriverReport, driver: Driver, schedules: Record<string,DailySchedule>, previous: string): ManifestSuggestion {
 const direct: Partial<Record<ReportStage,string>> = {returning:'Coming Back to Yanbu',base:'At Yanbu',internal:'Internal Transfer',maintenance:'Truck Under Maintenance'};
 if (direct[report.status]) return {text:direct[report.status]!,conf:'medium',reason:'Driver reported '+report.status+' for '+report.date+'. '+report.remarks};
 let trips = scheduleRowsForDriver(driver, schedules[report.date]?.rows || []).filter(row => !row.truckId || row.truckId === report.truckId);
 if (!trips.length) {
  const date = Object.keys(schedules).filter(date => date < report.date && date >= shiftISODate(report.date,-21)).sort().reverse()
   .find(date => scheduleRowsForDriver(driver,schedules[date].rows).some(row => row.truckId === report.truckId || normalizePlate(row.plateNo) === normalizePlate(report.plate)));
  if (date) trips = scheduleRowsForDriver(driver,schedules[date].rows).filter(row => row.truckId === report.truckId || normalizePlate(row.plateNo) === normalizePlate(report.plate));
 }
 const unique = [...new Map(trips.map(row => [JSON.stringify([row.source,row.destination,manifestActivity(row)]),row])).values()];
 if (unique.length > 1) return {text:'',conf:'low',reason:'Driver report matches multiple routes. Choose the active trip before confirming.'};
 const trip = unique[0];
 const label = REPORT_STATUSES.find(([stage])=>stage === report.status)![1].replace(/^[^A-Za-z]+/,'').split(' / ')[0];
 if (!trip) return {text:label,conf:'low',reason:'Driver reported '+label+'. No unique dispatch matched; review route and customer. Previous: '+previous};
 const prefix = manifestActivity(trip).replace(/\s+-\s+Under Loading at .*/i,'');
 if (prefix === 'Internal Transfer') return {text:'Internal Transfer',conf:'medium',reason:'Driver report matched internal dispatch.'};
 const suffix = {loading:'Under Loading at '+(trip.source || 'Yanbu'),transit:'On the way to '+trip.destination,
  border:'At Border — '+trip.destination,waiting:'Waiting for Offloading at '+trip.destination,offloading:'Under Offloading at '+trip.destination};
 return {text:prefix+' - '+suffix[report.status as keyof typeof suffix],conf:'medium',reason:'Driver report dated '+report.date+' matched dispatch '+(trip.waybill || 'awaiting waybill')+'. Review before confirmation.'};
}
