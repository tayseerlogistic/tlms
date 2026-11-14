# Connect the combined Tayseer Driver Report

1. Open your response spreadsheet using the Google account that owns its linked driver form.
2. Open Extensions → Apps Script. If this already contains your earlier monthly automation, use a new standalone project at https://script.google.com/home/projects/create instead.
3. Replace Code.gs with the complete included Code.gs. In Project Settings, enable “Show appsscript.json manifest file in editor”, then replace that file with the included manifest.
4. In the downloadable template, set CONFIG.sheetId to the ID in your response spreadsheet URL and CONFIG.project to your TLMS Firebase project ID. Also set CONFIG.truckOrder and CONFIG.driverOrder to the approved sequences. The privately supplied preconfigured package already has all four values. Select setupTLMS and click Run. Review and authorize access. The executing Google account needs permission to read/write the TLMS Firestore database in tayseer-tlms-1792924020. The TLMS email/password account does not grant Google Cloud access. An administrator must authorize the installing Google account in Cloud IAM. This setup uses that account's OAuth access, without private keys in the website.
5. The installer checks Firestore access first, updates the linked form, adds required Report Date, and configures the exact nine statuses. It creates KM Readings, Daily Follow-up, a sync log, and submission/5-minute retry triggers. Existing monthly tabs and original response records are retained.
6. Remove the old KM-only script's triggers if you previously enabled them. Keep one installing account. Otherwise both versions can process the same submissions.
7. Submit a real report, choosing the working date explicitly. Open TLMS Sync Log. In TLMS Settings → Driver Reports verify the truck, assignment, meter and status. Confirm the manifest and check that Daily Follow-up shows the confirmed text after the next sync.

The public template requires your own response spreadsheet ID and TLMS Firebase project ID. The privately supplied package is configured for the previously supplied Tayseer_Daily_KM 2027 workbook. setupTLMS updates the form linked to the configured workbook. Verify that is the intended form before running setup.

The new sheets are generated views. Make corrections and assignments in TLMS. Each truck has one row in KM Readings, and each driver has one row in Daily Follow-up. The approved sequences remain fixed, with new entries appended. Both tabs use full dates across months and years. Current assignments appear in the first two columns. Historical driver/truck information and the original status appear in notes.

The script starts with new submissions. It retains raw form responses, unique source-row references and all report versions. Conflicting meters/statuses require dispatcher approval. A missing previous-day meter saves the meter and displays Needs review in the note. TLMS's distance matrix uses zero until an adjacent meter establishes a valid distance. Negative or over-3,000 daily distances require correction. A late accepted meter recalculates the following day's derived distance. Existing manually imported daily distances are preserved.

Unknown plates and invalid form values are recorded in TLMS Sync Log for correction. Reprocessing of a corrected source row is performed by an administrator: set nextRow in Script Properties to that row number and run syncTLMS. Reports already delivered use their original stored submission; submit a new report to correct those. Never sort/delete the original response rows, because their row references identify deliveries.

Existing truck assignments provide the starting baseline when assignment history is first enabled. Older assignment dates cannot be inferred. Verify assignment history before reporting past dates. Use the effective date on TLMS's Driver Reports page for reassignments. When a driver reports on the wrong truck, reject the report and have the driver resubmit with the correct truck.

A daily JSON copy is saved into a private “TLMS Driver Report Backups” Drive folder. It includes registry, assignments, raw/accepted reports, readings, schedules and confirmed manifest documents. This is a driver-report recovery snapshot. TLMS Backup & Restore continues to provide the whole-system backup.

To stop the integration, delete submitTLMS and syncTLMS triggers in this Apps Script project. Trigger execution uses the installing account. Keep that account active and review the sync status in TLMS. The script stays private and operates while TLMS is closed.
