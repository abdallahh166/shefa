# Jira Import Notes

Use this file with:
- [production-readiness-backlog-jira.csv](c:/Users/Boo/Desktop/Shefaa/shefaa/docs/production-readiness-backlog-jira.csv)

## Recommended Import Mapping

Suggested column mapping for Jira CSV import:
- `Summary` -> Summary
- `Issue Type` -> Issue Type
- `Description` -> Description
- `Priority` -> Priority
- `Labels` -> Labels
- `Epic Name` -> Epic Name
- `Epic Link` -> Epic Link

Optional mappings:
- `Issue ID` -> External ID or custom text field
- `Effort` -> custom field or ignore
- `Dependencies` -> custom text field or ignore
- `Acceptance Criteria` -> custom field or append into Description

## Epic Relationship Strategy

This CSV uses:
- `Epic Name` on epic rows with values like `PR-EPIC-01`
- `Epic Link` on child rows pointing to that same epic name value

This works best in Jira company-managed projects where `Epic Name` and `Epic Link` are available during import.

If your Jira project is team-managed:
- import epics first
- then either map children manually to parents
- or replace `Epic Link` with your project's parent-link approach after import

## Recommended Import Order

1. Test import into a non-production Jira project or sandbox.
2. Confirm epic field names in your Jira instance.
3. Import the CSV.
4. Verify that child issues attached to the intended epics.
5. Adjust field mapping only once before importing into the real project.

## Practical Tip

If Jira does not expose `Epic Link` during import, the safest fallback is:
- import all rows
- keep `Issue ID` visible in Jira
- bulk re-parent by filtering on `Issue ID` prefixes such as `PR-1`, `PR-2`, and so on
