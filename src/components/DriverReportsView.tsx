import React, { useState } from 'react';
import { useLms } from '../context/LmsContext';
import { useAuth } from '../context/AuthContext';
import { ksaDateISO } from '../utils/dateUtils';
import { REPORT_STATUSES } from '../utils/driverReports';

export function DriverReportsView() {
 const {driverReports,reportDays,reportIntegration,trucks,drivers,assignmentEvents,reviewDriverReport,assignTruck,errorStates} = useLms();
 const {isDispatcher,isAdmin} = useAuth();
 const [date,setDate] = useState(ksaDateISO);
 const [pending,setPending] = useState('');
 const [feedback,setFeedback] = useState('');
 const [truckId,setTruck] = useState('');
 const [driverId,setDriver] = useState('');
 const [assignmentDate,setAssignmentDate] = useState(ksaDateISO);
 const reports = driverReports.filter(report=>report.date===date).sort((a,b)=>b.submittedAt.localeCompare(a.submittedAt));
 const accepted = reportDays.filter(report=>report.date===date);
 const activeTrucks=trucks.filter(truck=>!truck.archived && !truck.isThirdParty);
 const missing=activeTrucks.filter(truck=>!accepted.some(report=>report.truckId===truck.id));
 const run = async (key: string, action: ()=>Promise<void>) => {
  setPending(key);setFeedback('');
  try {await action();setFeedback('Saved.');} catch(error){setFeedback(error instanceof Error?error.message:'Save failed.');}
  finally {setPending('');}
 };
 return <section className="space-y-4">
  <h3 className="text-xl font-bold">Driver reports & assignments</h3>
  <p>Drivers select a truck, meter and status. The submission date is recorded automatically in Saudi time. Review conflicts here before they replace an accepted report.</p>
  <details className="border rounded-xl p-3"><summary>Connect Google Form and Sheets</summary>
    <ol className="list-decimal pl-5 space-y-2 mt-3">
      <li>Extract the private TLMS Combined Driver Report Setup ZIP supplied in your chat. It contains Code.gs and appsscript.json.</li>
      <li>Copy them into a new Apps Script project using the account that owns the response sheet and linked form.</li>
      <li>Deploy the included updated Firebase rules to enable report reviews and assignment history.</li>
      <li>Run setupTLMS once and authorize Google access. The installing Google account needs Firestore access.</li>
      <li>Submit a report and check this screen, KM Readings and Daily Follow-up in Sheets.</li>
    </ol>
    <p className="mt-2"><a className="underline" href="./driver-report-setup/SETUP.md" download>Complete setup instructions</a></p>
  </details>
  <p className="text-sm">{reportIntegration.lastSuccess ? 'Last Google sync: '+new Date(reportIntegration.lastSuccess).toLocaleString() : 'Google Form connection awaiting activation.'}
   {reportIntegration.error && <strong className="text-rose-500"> · {reportIntegration.error}</strong>}</p>
  {['driver_reports','driver_report_days','assignment_events','integration_status'].some(name=>errorStates[name]) &&
    <p role="alert">Driver reports require the updated Firebase rules. {Object.entries(errorStates).filter(([name])=>['driver_reports','driver_report_days','assignment_events','integration_status'].includes(name)).map(([,error])=>error).join(' ')}</p>}
  <div className="flex flex-wrap items-center gap-3">
   <label>Report date <input aria-label="Driver report date" type="date" value={date} max={ksaDateISO()} onChange={e=>setDate(e.target.value)} /></label>
   <span>{accepted.length} truck reports accepted · {missing.length} missing · {reports.filter(report=>report.state==='review').length} need review</span>
  </div>
  <details><summary>Missing truck reports ({missing.length})</summary><p>{missing.map(truck=>truck.plate).join(' · ') || 'All active fleet trucks reported.'}</p></details>
  {feedback && <p role="status">{feedback}</p>}
  <div className="overflow-x-auto rounded-xl border border-slate-400">
   <table className="w-full text-sm text-left"><thead><tr>{['Truck / driver','Report','Meter','State','Review'].map(label=><th key={label} className="p-3">{label}</th>)}</tr></thead>
    <tbody>{reports.map(report=><tr key={report.id} className="border-t border-slate-300">
     <td className="p-3">{report.plate}<br/>{report.driverName || 'No dated assignment'}</td>
     <td className="p-3">{REPORT_STATUSES.find(([stage])=>stage===report.status)?.[1] || report.status}<br/>{report.remarks}<br/><small>{new Date(report.submittedAt).toLocaleString()}</small></td>
     <td className="p-3">{report.odometer.toLocaleString()}</td>
     <td className="p-3">{report.state}<br/><small>{report.reason}</small></td>
     <td className="p-3">{report.state==='review' && (isDispatcher||isAdmin) && <div className="flex gap-2">
      <button disabled={Boolean(pending)} className="rounded border p-2" onClick={()=>run(report.id,()=>reviewDriverReport(report.id,true))}>Approve</button>
      <button disabled={Boolean(pending)} className="rounded border p-2" onClick={()=>run(report.id,()=>reviewDriverReport(report.id,false))}>Reject</button>
     </div>}</td>
    </tr>)}{!reports.length&&<tr><td colSpan={5} className="p-3">No driver submissions for this date.</td></tr>}</tbody>
   </table>
  </div>
  {(isDispatcher||isAdmin)&&<form className="flex flex-wrap items-end gap-3 border rounded-xl p-4" onSubmit={e=>{e.preventDefault();run('assignment',()=>assignTruck(truckId,driverId||null,assignmentDate));}}>
   <label>Truck<select aria-label="Assign truck" required value={truckId} onChange={e=>setTruck(e.target.value)}><option value="">Choose truck</option>{activeTrucks.map(truck=><option key={truck.id} value={truck.id}>{truck.plate}</option>)}</select></label>
   <label>Driver<select aria-label="Assigned driver" value={driverId} onChange={e=>setDriver(e.target.value)}><option value="">Unassigned</option>{drivers.filter(driver=>driver.active!==false).map(driver=><option key={driver.id} value={driver.id}>{driver.name} · {driver.iqama}</option>)}</select></label>
   <label>Effective date<input type="date" required max={ksaDateISO()} value={assignmentDate} onChange={e=>setAssignmentDate(e.target.value)} /></label>
   <button type="submit" disabled={!truckId||Boolean(pending)} className="border rounded p-2">Save assignment</button>
   <p className="w-full text-sm">Add or archive drivers and trucks in Master Repository. Saved reports retain their dated assignment.</p>
  </form>}
  <details><summary>Assignment history ({assignmentEvents.length})</summary>
   {assignmentEvents.slice().sort((a,b)=>b.changedAt.localeCompare(a.changedAt)).slice(0,100).map(event=><p key={event.id}>{event.effectiveDate} · {event.plate} · {event.previousDriverName||'Unassigned'} → {event.driverName||'Unassigned'}</p>)}
  </details>
 </section>;
}
