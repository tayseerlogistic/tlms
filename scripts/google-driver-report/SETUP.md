# Create the new Tayseer form and spreadsheet

1. Replace Code.gs in your existing TLMS Driver Report Sync Apps Script project with Code.gs from this updated private package. Save. Keep the supplied appsscript.json.
2. Choose createNewTLMSSystem beside Run, then click Run. Review any Google authorization prompt using the Google account that will own the new resources.
3. The script creates a new Tayseer Driver Report form and Tayseer KM & Daily Follow-up spreadsheet. It saves their IDs immediately, so a retry resumes the same resources.
4. The execution log prints NEW SPREADSHEET, FORM EDITOR and DRIVER FORM links after setup succeeds. START HERE in the new spreadsheet also contains those links.
5. Open DRIVER FORM, select a truck and enter the actual meter and status, then submit. Check TLMS Sync Log and TLMS Settings → Driver Reports.
6. Firebase rules still need deployment for the website's report reviews and assignment history. The script's Google account needs the Firestore access configured separately.
7. If an older KM-only integration was installed, remove its triggers after verifying the new integration. Use one installing account.

The new sheets are generated views. Make corrections and assignments in TLMS. Each truck has one row in KM Readings, and each driver has one row in Daily Follow-up. The approved sequences remain fixed, with new entries appended. Both tabs use full dates across months and years. Current assignments appear in the first two columns. Historical driver/truck information and the original status appear in notes.

Run setupTLMS after replacing Code.gs to update the existing form. It removes the Report Date question and uses the original response timestamp in Saudi time. After midnight, submissions belong to the new calendar day. Previously processed reports retain their saved dates. Existing response columns and rows are retained.

The script starts with new submissions. It retains raw form responses, unique source-row references and all report versions. Conflicting meters/statuses require dispatcher approval. A missing previous-day meter saves the meter and displays Needs review in the note. TLMS's distance matrix uses zero until an adjacent meter establishes a valid distance. Negative or over-3,000 daily distances require correction. A late accepted meter recalculates the following day's derived distance. Existing manually imported daily distances are preserved.

Unknown plates and invalid form values are recorded in TLMS Sync Log for correction. Reprocessing of a corrected source row is performed by an administrator: set nextRow in Script Properties to that row number and run syncTLMS. Reports already delivered use their original stored submission; submit a new report to correct those. Never sort/delete the original response rows, because their row references identify deliveries.

Existing truck assignments provide the starting baseline when assignment history is first enabled. Older assignment dates cannot be inferred. Verify assignment history before reporting past dates. Use the effective date on TLMS's Driver Reports page for reassignments. When a driver reports on the wrong truck, reject the report and have the driver resubmit with the correct truck.

A daily JSON copy is saved into a private “TLMS Driver Report Backups” Drive folder. It includes registry, assignments, raw/accepted reports, readings, schedules and confirmed manifest documents. This is a driver-report recovery snapshot. TLMS Backup & Restore continues to provide the whole-system backup.

To stop the integration, delete submitTLMS and syncTLMS triggers in this Apps Script project. Trigger execution uses the installing account. Keep that account active and review the sync status in TLMS. The script stays private and operates while TLMS is closed.
