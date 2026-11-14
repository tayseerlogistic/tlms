import type { DailySchedule, Driver, ManifestSuggestion } from '../types';
import { manifestForTrips, scheduleRowsForDriver } from './dispatchManifest';
import { reportManifest, type ReportDay } from './driverReports';
import { predictRouteProgression } from './routeProgression';

/** Sheets uses operational records supplied at sync time, without bundled training data. */
export function predictSheetManifest(
 driver: Driver, date: string, schedules: Record<string, DailySchedule>,
 reports: ReportDay[], confirmed: string | undefined, history: Record<string,string>
): ManifestSuggestion {
 if (confirmed) return {text:confirmed,conf:'high',reason:'Confirmed by dispatch.'};
 const relevant = reports.filter(report=>report.date===date && report.driverId===driver.id);
 const latest = Object.keys(history).filter(day=>day<date).sort().at(-1);
 const previous = latest ? history[latest] : '';
 if (relevant.length>1) return {text:'',conf:'low',reason:'Multiple truck reports. Review the active assignment.'};
 if (relevant.length===1) return reportManifest(relevant[0],driver,schedules,previous);
 const trips = scheduleRowsForDriver(driver,schedules[date]?.rows || []);
 const progression = predictRouteProgression({...driver,history},date,previous,trips,schedules,
  {version:1,through:'',observations:0,counts:{}});
 if (progression) return progression;
 if (trips.length) return {text:manifestForTrips(trips),conf:'medium',reason:'Schedule draft. Awaiting driver report and dispatcher review.'};
 return {text:previous,conf:'low',reason:previous?'Previous confirmed status. Awaiting report.':'No report or confirmed history.'};
}
