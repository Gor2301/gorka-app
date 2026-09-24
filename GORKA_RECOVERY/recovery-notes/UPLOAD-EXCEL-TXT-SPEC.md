UPLOAD - EXCEL AND TXT FORMATS - TASK SPEC



Task: Add .txt and .xlsx/.xls support to the local-only structured upload path.

Status: Proposed. Not implemented. The implementation is deferred by conscious decision.

Date: September 24, 2026.

Scope: MVP. Bounded. Two formats. No schema change. No cloud.

Follows: The Dashboard Stats task (66c6f12), which is complete and verified.



WHY THIS TASK EXISTS



The debtor data upload path currently accepts CSV only. The Upload page advertises Excel, JSON, XML (structured) and PDF, Images, Text, Email (unstructured), but the service rejects everything except CSV. This is the gap the task closes, in part.



The task adds:



TXT - any text file with a delimiter: tab, semicolon, or comma. This is the CSV parser applied to a file with a different extension.



Excel - .xlsx and .xls files. One sheet per file. Header row plus data rows, same shape as CSV.



Both formats feed the same local insert path:

file -> parse locally -> localDB.bulkInsertDebtors(rows) -> Rust -> SQLCipher



This is a bulk upload path. Not one debtor at a time. The task is about parsing a file with many rows and inserting them in one transaction, exactly as the CSV path does today.



What this is not: this is not the unstructured path (PDF, JPEG, PNG). That remains deferred. This is not a schema change. This is not a cloud feature. This is not a change to the boundary.



WHAT EXISTS TODAY



Frontend upload service (supervisor-dashboard/src/services/upload.service.ts):



parseCsv(text) - splits on newlines, auto-detects delimiter (tab, semicolon, comma), maps headers to DebtorInput fields, returns { rows, errors }.



uploadStructuredData(\_token, file, dataType) - guards against non-CSV, reads the file as text, calls parseCsv, calls localDB.bulkInsertDebtors.



uploadUnstructuredData(\_token, \_file, \_documentType) - returns "not yet available." No parsing.



Frontend page (supervisor-dashboard/src/pages/Upload.tsx):



Two cards: Structured and Unstructured.



File input with an accept attribute listing the advertised extensions.



A dataType dropdown offering CSV and JSON (JSON is advertised but not implemented).



A format-info grid listing CSV, Excel, JSON, XML (structured).



Local DB service (supervisor-dashboard/src/services/local.db.ts):



localDB.bulkInsertDebtors(inputs: DebtorInput\[]) - calls the Rust bulk\_insert\_debtors command.



DebtorInput interface: { name, surname, email?, phone?, data? }.



Rust commands (src-tauri/src/main.rs):



bulk\_insert\_debtors(inputs: Vec<DebtorInput>) - transaction-wrapped, org-scoped, inserts each debtor and appends one audit entry. Verified September 14 and September 24.



Dependencies (from package.json, read September 24):



No Excel parser. No xlsx, no exceljs, no papaparse, no csv-parse.



No PDF parser, no OCR library. (Not needed for this task.)



The CSV parser is hand-written in upload.service.ts.



RESTRICTIONS



R1 - The invariant. Debtor data never leaves the machine. Both formats are parsed locally, in the WebView, and inserted into the local SQLCipher database. No fetch. No token. No cloud endpoint. This is the reason the upload path was rewritten on September 14, and it stays that way.



R2 - No schema change. DebtorInput already has the fields the parsers produce. bulk\_insert\_debtors already exists. Nothing in the Rust layer changes. No migration.



R3 - No boundary regression. The upload path is the one place where a boundary violation happened before. Every change to it must be checked against R1, at read time and at build time.



R4 - One new dependency, if Excel is in scope. TXT requires zero new dependencies. Excel requires one. Both run in the WebView, not in Rust, so no Rust rebuild for these changes alone.



R5 - Bulk, not one-by-one. The task is about inserting many rows from one file. A single-row file works too, but the target is a file with dozens or hundreds of rows, inserted in one bulk\_insert\_debtors call.



R6 - MVP honesty. The formats supported must match the formats advertised. If the UI lists Excel, Excel must work. If JSON is listed but not implemented, that listing is a lie. For this task, JSON and XML remain unimplemented and are moved out of the "supported" list.



R7 - Same row-mapping rules as CSV. Excel and TXT use the same header-name matching and the same field mapping the CSV parser uses. One mapping table, not three.



R8 - No formatter/encoding adventures. The mojibake in upload.service.ts and Upload.tsx is out of scope. The dataType dropdown redesign is in scope, but no other cosmetic changes.



DECISIONS



D1 - TXT is supported by extension only, no dataType entry.

D2 - TXT files use the same delimiter detection as CSV.

D3 - Excel parser: SheetJS Community Edition, pinned to an explicitly verified version and package source. Verify the source and license before installing. Pin the exact version in package.json and package-lock.json. Do not run an unqualified npm install xlsx. (Note: the current npm registry version is behind the current SheetJS release. SheetJS distributes the current version through its own CDN/tarball. See D-B below.)

D4 - Excel: first sheet, first row as headers, remaining rows as data. No multi-sheet handling. No header-row detection heuristics.

D5 - Excel cell normalization. Rewritten from an earlier, under-specified draft. The rules:



Preserve actual string cells as strings.



Preserve boolean cells as "true" / "false".



For numeric cells, convert deterministically to a non-exponential decimal representation.



For date-formatted cells, use the workbook/cell date formatting information, not the raw numeric value.



Do not attempt to reconstruct information that is not present in the workbook.



Document that phone numbers, IDs, and similar values should be stored as text in Excel when leading zeros or exact formatting matter.

D6 - One shared row-mapping function. parseCsv is refactored so that:



parseCsvToCells(text) - splits lines, produces string\[]\[] rows of cells.



parseExcelToCells(arrayBuffer) - reads the workbook, produces string\[]\[] rows of cells.



rowsToDebtors(headers, rows) - shared. Does the header matching, name/surname fallback, debt detection, and builds DebtorInput\[].

D7 - Upload page keeps the same accept list structure, extended. Structured accept becomes .csv,.txt,.xlsx,.xls. JSON and XML are removed from both the accept list and the "Supported" label.

D8 - dataType dropdown is removed. Detection is by extension. The dropdown currently offers an unimplemented option (JSON) and its presence is more confusing than helpful.

D9 - Unstructured processing remains untouched. .txt is removed from the unstructured file selector, because TXT is now explicitly assigned to the structured path.

D10 - MVP upload resource limits. Structured uploads have explicit maximum file size and row-count limits. Exceeding a limit produces a clear local validation error and does not call bulkInsertDebtors. The limits:



Maximum file size: 10 MB. Checked on file.size before file.arrayBuffer() is called.



Maximum parsed rows: 10,000. Checked on sheet\['!ref'] range before sheet\_to\_json is called.

The limits are chosen for realistic MVP usage and verified by testing a file near each limit. Both are recorded here as decided values; if testing shows they are wrong, they are amended here.



THE OPEN DECISION - EXCEL PARSER LOCATION



Decision D-B is open. It has two options. Neither is chosen today.



Option 1 - Frontend (SheetJS).

Parses Excel in the WebView.

Strengths for production: no Rust rebuild for parser changes; the raw file never leaves the WebView; simple dependency model.

Weaknesses for production: the whole file and the whole extracted array live in JavaScript memory; JavaScript is slower than native Rust for large files; the parsing logic is tested outside the Rust test surface; the batch is not a first-class object, which is awkward for the future sync event model.



Option 2 - Backend (calamine, in Rust).

Parses Excel in the Tauri process.

Strengths for production: parse and insert are one transaction, one Rust command; the parser is compiled, runs at native speed; memory is native, not JavaScript; the parsing logic is in the same crate and test runner as the local data layer; the batch is a first-class object, which fits the sync event model naturally.

Weaknesses for production: every parser change requires cargo build; on the main machine that means the signing workflow, and SAC blocks execution, so the only real test loop is the cloud machine; calamine is a smaller ecosystem than SheetJS.



Current leaning: backend (calamine).

Based on the reconnaissance: transactionality, the event model, and the test surface favor Rust for the long term.



Implementation deferred.

The MVP keeps CSV-only at this stage. This is a conscious decision, not a backlog item. The UI currently advertises Excel, JSON, and XML, which do not work. Fixing the UI without implementing the formats would leave the UI pointing at nothing. The UI is left as it is, and the mismatch is recorded as a known limitation of the current MVP stage.



What determines the final decision.

Whether the MVP is a stepping stone that will be rewritten for production, or the production version with features turned off.

If the former: the MVP choice is pragmatic, and SheetJS is fine.

If the latter: the choice is permanent, and calamine is preferable now.



What does not change either way.

The shape of the code. Both options produce string\[]\[] and feed the same rowsToDebtors mapper, then localDB.bulkInsertDebtors(). If the parser moves from JavaScript to Rust later, the mapper moves with it, and the insert command does not change. The migration is a rewrite of the parser, not a redesign of the path.



WHAT WE ARE GOING TO BUILD



Step 1 - Read the current files on disk. Re-read immediately before the edits.

Step 2 - Split parseCsv into parser and mapper.

New shape in upload.service.ts:

parseCsvToCells(text) - returns { headers, rows, errors }

rowsToDebtors(headers, rows) - returns { rows: DebtorInput\[], errors }

parseCsv(text) becomes a thin wrapper that calls both. No behavior change for CSV.

Step 3 - Add TXT support.

Guard in uploadStructuredData changes from "only CSV" to "CSV or TXT." parseCsvToCells is called for both. No parser change. Upload.tsx accept gains .txt in the structured list.

This is commit point 1.

Step 3.5 - Regression checkpoint.

Run a fixed CSV test file before and after the refactor. Verify equal output. Commit the test file to the repo so the comparison is repeatable.

Step 4 - npm install SheetJS at the pinned version.

Commit point 2 begins here.

Step 4.5 - Write parseExcelToCells with the D5 normalization rules and D10 limits.

Step 4.6 - Test Excel with the full matrix. Commit point 2.

Step 5 - UI cleanup.

Remove dataType. Remove JSON/XML from accept and labels. Remove .txt from unstructured accept. Commit point 3.

Step 6 - Boundary check, static and runtime.

Static: findstr for fetch, api., supervisor\_token in the upload path. Expected: zero matches.

Runtime: perform a CSV, TXT, and XLSX upload with network inspection on. Confirm no cloud/API request occurs.



WHAT IS EXPLICITLY OUT OF SCOPE



Unstructured: PDF, JPEG, PNG, email, OCR. Deferred.



JSON upload. Not implemented. Remove from UI in this task.



XML upload. Same.



Any schema change. None needed.



Any Rust change for the parser itself. None needed while the parser is frontend-only.



Refactoring the mojibake in either file.



Redesigning the Upload page beyond what is needed.



Multi-sheet Excel. First sheet only.



Header-row detection in Excel. First row is the header.



HOW WE KNOW IT WORKED



TXT acceptance:



A .txt file with tab-separated values and headers Name, Surname, Email, Phone inserts the expected number of debtors.



A .txt file with semicolon-separated values does the same.



A .txt file with comma-separated values does the same.



The inserted debtors appear in Collections.



The count in Collections matches the number of data rows in the file.



Excel acceptance:



.xlsx: normal strings, blank cells, blank rows, numeric phone, text phone with leading zero, date cell, boolean cell, multiple sheets, empty first sheet, first row headers, unexpected columns.



.xls: normal file, strings, numeric phone, date, first sheet.



Multiple sheets: Sheet 1 imported, Sheet 2 ignored. Verified, not assumed.



The inserted debtors appear in Collections. The count matches.



A phone column containing a value Excel formats as a number inserts the number as a string, not in scientific notation.



Both:



No /api/dashboard/stats call, no fetch, no token.



The boundary check (Step 6) returns zero matches at source level and no cloud request at runtime.



No new error in the console.



Regression:



A .csv file uploads exactly as before. Same result, same count.



COST ESTIMATE



Step 1 - re-read files: \~5 min

Step 2 - refactor parseCsv: \~30 min

Step 3 - add TXT: \~15 min

Step 3 - test TXT, commit: \~15 min

Step 3.5 - CSV regression: \~20 min

Step 4 - npm install SheetJS pinned: \~5 min

Step 4 - write parseExcelToCells: \~30 min

Step 4 - wire it in: \~15 min

Step 4 - test Excel with real files: \~30 min

Step 4 - commit: \~10 min

Step 5 - UI cleanup: \~15 min

Step 5 - commit: \~5 min

Step 6 - boundary check: \~5 min



Total: roughly 3 hours. TXT alone is about 45 minutes including test and commit.



OPEN DECISIONS FOR THE NEXT SESSION



Excel parser location. SheetJS (frontend) vs calamine (backend). Current lean: backend. The determining question is whether the MVP is a stepping stone or the production version with features turned off.



If SheetJS is chosen: the version-pinning path. Point package.json at the SheetJS download URL (simpler, standard), or vendor the tarball into the repo (more traceable, more work). Recommendation: the URL approach.



D10 limits: 10 MB file size, 10,000 rows. Confirmed by the founder. If testing shows they are wrong, amend here.



COMMIT POINTS



Commit 1 - Refactor + TXT.

parseCsv split into parser and mapper; TXT accepted; accept list updated; CSV regression verified; test file committed.

Commit 2 - Excel.

Pinned SheetJS dependency; parseExcelToCells; wired into uploadStructuredData; full test matrix passed.

Commit 3 - UI cleanup.

Remove dataType; remove JSON/XML; remove .txt from unstructured accept.



End of spec.

