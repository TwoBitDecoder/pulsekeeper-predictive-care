# Complete Medready Equipment Oracle

## Goals
- Rename the Lovable project and repository-facing package/docs to **Medready-Equipment-Oracle**.
- Add a README overview of the technology stack and source-file architecture.
- Complete the existing roadmap: staff access, shared fleet data, persistent alert acknowledgements, and telemetry CSV import.

## Work
1. **Identity and documentation**
   - Rename the Lovable project and package metadata.
   - Update the README with the product summary, current stack, directory map, and setup notes.
   - Record the app’s structure rule in `AGENTS.md` and keep the roadmap current.
2. **Staff access**
   - Add email/password and Google sign-in using Lovable Cloud Auth.
   - Use the existing profiles and separate staff-role tables; protect app pages and keep data access governed by existing row policies.
   - Add sign-out and a clear account/profile view.
3. **Shared fleet data**
   - Replace browser-only acknowledgement storage with shared saved acknowledgements.
   - Connect equipment, telemetry, and maintenance views to the existing cloud tables while preserving the predictive-analysis workflow.
   - Add manager equipment entry and staff maintenance logging so the shared dataset can be operated from the app.
4. **Telemetry CSV workflow**
   - Add a readings upload with column/date/value validation, preview, row-level error reporting, and a confirmed import.
   - Restrict imports to authorized staff and save valid rows to the existing readings table.
5. **Verification**
   - Add focused tests for CSV validation and access rules alongside the current tests.
   - Run the relevant tests and verify sign-in, data entry/import, and saved acknowledgements in the preview.

## Technical notes
- Preserve TanStack Start, React, and the existing deterministic predictive model.
- Use the existing Lovable Cloud tables and RLS; add only necessary schema changes through a migration.
- Keep demo/model calculations deterministic and avoid browser-only storage for shared operational records.