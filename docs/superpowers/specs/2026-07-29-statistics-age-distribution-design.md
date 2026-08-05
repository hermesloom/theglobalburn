# Age Distribution Chart on the Statistics Page

**Date:** 2026-07-29

## Goal

Add an age distribution diagram — one column per age — to the member-facing
statistics page at `/burn/[slug]/statistics`.

## Context

`/burn/[slug]/statistics` currently shows memberships by income tier (bar chart
+ pie chart), summary cards, and a finances section. It has no age chart.

An age chart already exists on the admin-only page
`/burn/[slug]/membership_tools/statistics` ("Member Age Distribution at Event
Start"), backed by `app/api/burn/[slug]/admin/membership-statistics/route.ts`.
That route and `app/api/burn/[slug]/admin/watcher-statistics/route.ts` each
carry their own copy of the age logic: an `EVENT_START_DATES` map, an `ageAt`
wrapper around `calculateAge`, and a `toDistribution` reducer. Adding a third
copy for the new endpoint is the wrong move, so the shared logic is extracted
first.

Data model: `burn_memberships.birthdate` is `not null`, stored as `text` in
`YYYY-MM-DD` form with a regex check constraint. `profiles` has no birthdate
column.

## Decisions

- **Reference date:** age at event start, matching the admin page. Not current
  age, which drifts through the year and would disagree with the admin numbers.
- **Scope:** members only. Children (stored under
  `burn_memberships.metadata->children` with a `dob` key) are excluded; the rest
  of this page counts memberships.
- **Aggregate only:** the endpoint returns counts per age and never birthdates
  or names. Unlike the admin page, `/burn/[slug]/statistics` is visible to every
  member, so shipping raw DOBs would expose every member's birthdate to every
  other member.
- **Gap filling:** every integer age from the minimum to the maximum present is
  emitted, including zero counts. The current admin behaviour emits only ages
  that occur, so ages 25, 27 and 30 render as three adjacent bars and misstate
  the shape of the distribution.

## Design

### 1. Shared helper — `app/api/_common/age.ts`

```ts
export const EVENT_START_DATES: Record<number, string> = {
  2026: "2026-07-18",
  2027: "2027-07-24",
};
export function getEventStartDate(project: Project): Date | null;
export function ageAt(
  birthDateStr: string,
  referenceDate: Date | null,
): number | null;
export function toAgeDistribution(
  map: Record<number, number>,
): { age: number; count: number }[];
```

`getEventStartDate` and `ageAt` move verbatim from
`app/api/burn/[slug]/admin/membership-statistics/route.ts` (lines 5–25). Both
admin routes import them instead of redeclaring.

`toAgeDistribution` replaces the local `toDistribution` in both admin routes: it
sorts the keys, then emits every integer from the minimum to the maximum age
with `count ?? 0`. An empty map yields `[]`. The two admin charts therefore gain
gap filling as well — intended, since it is the same fix.

Out of scope, but noted: `validateBurnAge` in `app/_components/utils.ts`
hardcodes `2026-07-20` while these routes use `2026-07-18`, and
`ListOfChildren.tsx` uses `burn_config.event_end_date` instead. Three different
reference dates for the same concept is a real bug, to be fixed separately.

### 2. API — `app/api/burn/[slug]/statistics/route.ts`

Add `birthdate` to the existing `.select("price, is_low_income, metadata")`; no
additional query is needed. Inside the loop that already walks the memberships,
bucket `ageAt(membership.birthdate, eventStart)`, skipping entries whose date
does not parse.

The response gains two fields:

```ts
ageDistribution: { age: number; count: number }[];
eventStartDate: string | null; // "YYYY-MM-DD"
```

All existing fields (`lowIncome`, `mediumIncome`, `highIncome`, `alversjo`,
`total`) are unchanged, so no existing consumer breaks. Authorisation is
unchanged: `requestWithMembership` with `BurnRole.Admin` as the fallback role.

### 3. Page — `app/burn/[slug]/statistics/page.tsx`

Extend the local `Statistics` interface with the two new fields, then render a
full-width card between the two-chart grid and the summary cards.

Title: `Age Distribution at Event Start ({eventStartDate})`, falling back to
`Age Distribution` when `eventStartDate` is null.

Chart: Recharts `BarChart` over `statistics.ageDistribution`.

- `XAxis dataKey="age"`, labelled "Age"
- `YAxis allowDecimals={false}`
- `Tooltip` formatting values as `[value, "Members"]`
- `Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]}` — the same fill as
  the existing income bar chart
- height follows the page's `isMobile` state: 250 on mobile, 350 otherwise
- `interval="preserveStartEnd"` on mobile and `interval={0}` on desktop; a range
  spanning roughly ages 14–70 is about 50 columns, which crowds a phone

When `ageDistribution` is empty the card renders "No data", matching the admin
page's `AgeChart`.

## Testing

Vitest is configured (`vitest.config.ts`, `npm test`) with an include glob of
`["utils/**/*.test.ts", "app/**/*.test.ts"]`, so `app/api/_common/age.ts` is
directly unit-testable and is built test-first: `ageAt` (valid date, empty
string, garbage, reference-date null), `getEventStartDate` (known year, unknown
year, missing config), and `toAgeDistribution` (empty map, single age, gap
filling, unsorted keys).

The route and the page are not unit-testable — there is no existing harness for
Next.js route handlers or React components here, and building one is out of
scope. They are verified by:

1. `npx tsc --noEmit` passes.
2. The page loads against real data and the age counts sum to a number no
   greater than `statistics.total` (equal, unless some birthdate fails to
   parse).
3. The two admin charts still render after the helper extraction.
