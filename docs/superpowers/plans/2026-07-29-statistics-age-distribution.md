# Statistics Page Age Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an age distribution bar chart — one column per age — to the member-facing statistics page at `/burn/[slug]/statistics`.

**Architecture:** Age-at-event-start logic is currently duplicated across two admin API routes. Task 1 extracts it into a tested shared module `app/api/_common/age.ts`. Task 2 switches both admin routes onto that module. Task 3 adds an `ageDistribution` field to the existing `/statistics` endpoint. Task 4 renders the chart on the page.

**Tech Stack:** Next.js App Router (client components), TypeScript, Supabase JS client, Recharts, Vitest, Tailwind, NextUI.

## Global Constraints

- Event start dates are `{ 2026: "2026-07-18", 2027: "2027-07-24" }` — copy these values exactly.
- `burn_memberships.birthdate` is a `not null` `text` column in `YYYY-MM-DD` format. It is **not** a `date` type.
- The `/burn/[slug]/statistics` endpoint is visible to every member. It must return **aggregate counts only** — never a birthdate, name, or membership id.
- Ages are always measured **at event start**, never as current age.
- The age distribution must include every integer age from the minimum to the maximum present, with zero counts for ages nobody has.
- Do not change existing response fields (`lowIncome`, `mediumIncome`, `highIncome`, `alversjo`, `total`) or any route's authorisation.
- Do not touch `validateBurnAge` in `app/_components/utils.ts` or `ListOfChildren.tsx`. Their disagreeing reference dates are a known separate bug and are out of scope.
- Tests run with `npm test` (vitest). The include glob is `["utils/**/*.test.ts", "app/**/*.test.ts"]` — test files must match it.
- Existing test style: `import { describe, expect, it } from "vitest";` and import source modules via the `@/` alias.

---

### Task 1: Shared age helper module

Creates the tested module that Tasks 2 and 3 both import. Nothing else changes yet, so this task is self-contained and its tests are the only verification needed.

**Files:**
- Create: `app/api/_common/age.ts`
- Test: `app/api/_common/age.test.ts`

**Interfaces:**
- Consumes: `calculateAge` from `@/app/burn/[slug]/membership/components/helpers/date` (signature: `(birthDate: Date, referenceDate?: Date) => number`), and the `Project` type from `@/utils/types`.
- Produces:
  - `EVENT_START_DATES: Record<number, string>`
  - `getEventStartDate(project: Project): Date | null`
  - `ageAt(birthDateStr: string, referenceDate: Date | null): number | null`
  - `toAgeDistribution(map: Record<number, number>): { age: number; count: number }[]`

- [ ] **Step 1: Write the failing test**

Create `app/api/_common/age.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  EVENT_START_DATES,
  getEventStartDate,
  ageAt,
  toAgeDistribution,
} from "@/app/api/_common/age";
import { Project } from "@/utils/types";

// Only the burn_config fields these helpers read matter; the rest of Project
// is irrelevant here, so build a minimal stub and cast.
const projectWith = (burnConfig: Record<string, unknown>) =>
  ({ burn_config: burnConfig }) as unknown as Project;

describe("EVENT_START_DATES", () => {
  it("holds the known burn start dates", () => {
    expect(EVENT_START_DATES).toEqual({
      2026: "2026-07-18",
      2027: "2027-07-24",
    });
  });
});

describe("getEventStartDate", () => {
  it("derives the start date from event_end_date's year", () => {
    const result = getEventStartDate(
      projectWith({ event_end_date: "2026-07-26" }),
    );
    expect(result?.toISOString().slice(0, 10)).toBe("2026-07-18");
  });

  it("falls back to open_sale_general_starting_at when there is no end date", () => {
    const result = getEventStartDate(
      projectWith({ open_sale_general_starting_at: "2027-02-01T10:00:00Z" }),
    );
    expect(result?.toISOString().slice(0, 10)).toBe("2027-07-24");
  });

  it("returns null when neither date is configured", () => {
    expect(getEventStartDate(projectWith({}))).toBeNull();
  });

  it("returns null for a year with no known start date", () => {
    expect(
      getEventStartDate(projectWith({ event_end_date: "2031-07-26" })),
    ).toBeNull();
  });
});

describe("ageAt", () => {
  it("computes age on the reference date", () => {
    expect(ageAt("1990-01-15", new Date("2026-07-18"))).toBe(36);
  });

  it("does not count a birthday that has not happened yet by the reference date", () => {
    expect(ageAt("1990-12-15", new Date("2026-07-18"))).toBe(35);
  });

  it("counts a birthday falling exactly on the reference date", () => {
    expect(ageAt("1990-07-18", new Date("2026-07-18"))).toBe(36);
  });

  it("returns null for an empty birthdate", () => {
    expect(ageAt("", new Date("2026-07-18"))).toBeNull();
  });

  it("returns null for an unparseable birthdate", () => {
    expect(ageAt("not-a-date", new Date("2026-07-18"))).toBeNull();
  });

  it("measures against today when the reference date is null", () => {
    const now = new Date();
    const birth = new Date(
      Date.UTC(now.getUTCFullYear() - 30, now.getUTCMonth(), 1),
    );
    expect(ageAt(birth.toISOString().slice(0, 10), null)).toBe(30);
  });
});

describe("toAgeDistribution", () => {
  it("returns an empty array for an empty map", () => {
    expect(toAgeDistribution({})).toEqual([]);
  });

  it("returns a single entry unchanged", () => {
    expect(toAgeDistribution({ 30: 4 })).toEqual([{ age: 30, count: 4 }]);
  });

  it("fills gaps between the minimum and maximum age with zeros", () => {
    expect(toAgeDistribution({ 25: 2, 27: 1 })).toEqual([
      { age: 25, count: 2 },
      { age: 26, count: 0 },
      { age: 27, count: 1 },
    ]);
  });

  it("sorts numerically rather than lexicographically", () => {
    expect(toAgeDistribution({ 9: 1, 10: 2, 11: 3 })).toEqual([
      { age: 9, count: 1 },
      { age: 10, count: 2 },
      { age: 11, count: 3 },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- app/api/_common/age.test.ts`
Expected: FAIL — the suite cannot resolve `@/app/api/_common/age` because the module does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `app/api/_common/age.ts`. `getEventStartDate` and `ageAt` are moved verbatim from `app/api/burn/[slug]/admin/membership-statistics/route.ts:5-25`; `toAgeDistribution` is the old `toDistribution` reducer plus gap filling.

```ts
import { Project } from "@/utils/types";
import { calculateAge } from "@/app/burn/[slug]/membership/components/helpers/date";

export const EVENT_START_DATES: Record<number, string> = {
  2026: "2026-07-18",
  2027: "2027-07-24",
};

export function getEventStartDate(project: Project): Date | null {
  const yearSource =
    project.burn_config.event_end_date ||
    project.burn_config.open_sale_general_starting_at;
  if (!yearSource) return null;
  const year = new Date(yearSource).getFullYear();
  const dateStr = EVENT_START_DATES[year];
  return dateStr ? new Date(dateStr) : null;
}

export function ageAt(
  birthDateStr: string,
  referenceDate: Date | null,
): number | null {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return null;
  return calculateAge(birth, referenceDate ?? undefined);
}

/**
 * Turns an age -> count map into a sorted array with every integer age between
 * the minimum and maximum present, so ages nobody has render as empty columns
 * rather than collapsing the distribution.
 */
export function toAgeDistribution(
  map: Record<number, number>,
): { age: number; count: number }[] {
  const ages = Object.keys(map).map((age) => parseInt(age));
  if (ages.length === 0) return [];

  const min = Math.min(...ages);
  const max = Math.max(...ages);

  return Array.from({ length: max - min + 1 }, (_, i) => ({
    age: min + i,
    count: map[min + i] ?? 0,
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- app/api/_common/age.test.ts`
Expected: PASS — 15 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/_common/age.ts app/api/_common/age.test.ts
git commit -m "refactor: extract shared age-at-event helpers with gap-filled distribution"
```

---

### Task 2: Switch the two admin routes onto the shared helper

Both admin routes carry a byte-identical copy of the helpers. This task deletes both copies. The two files' relevant regions are identical, so the **same edit applies to each**.

**Files:**
- Modify: `app/api/burn/[slug]/admin/membership-statistics/route.ts:1-25` and `:112-115`
- Modify: `app/api/burn/[slug]/admin/watcher-statistics/route.ts:1-25` and `:112-115`

**Interfaces:**
- Consumes: `getEventStartDate`, `ageAt`, `toAgeDistribution` from `@/app/api/_common/age` (Task 1).
- Produces: nothing new. Both routes keep returning `memberAgeDistribution` and `childrenAgeDistribution` as `{ age, count }[]`, now gap-filled.

- [ ] **Step 1: Replace the header of `membership-statistics/route.ts`**

Delete lines 1–25 — the `calculateAge` import, `EVENT_START_DATES`, `getEventStartDate`, and `ageAt` — and replace them with:

```ts
import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";
import {
  getEventStartDate,
  ageAt,
  toAgeDistribution,
} from "@/app/api/_common/age";
```

Note `Project` is dropped from the `@/utils/types` import: it was only referenced by the deleted `getEventStartDate` signature. `BurnRole` is still used at the bottom of the file and must stay.

- [ ] **Step 2: Remove the local `toDistribution` from `membership-statistics/route.ts`**

Delete these four lines (around line 112):

```ts
    const toDistribution = (map: Record<number, number>) =>
      Object.entries(map)
        .map(([age, count]) => ({ age: parseInt(age), count }))
        .sort((a, b) => a.age - b.age);
```

Then update the two call sites in the return object:

```ts
      memberAgeDistribution: toAgeDistribution(memberAgeMap),
      childrenAgeDistribution: toAgeDistribution(childAgeMap),
```

Leave every other line of the handler alone — the check-in aggregation, anomaly buckets, and pet counts are untouched.

- [ ] **Step 3: Apply Steps 1 and 2 to `watcher-statistics/route.ts`**

The same four edits, with one difference: this file's bottom-of-file role argument is also `[BurnRole.MembershipManager, BurnRole.MembershipLead]`, so `BurnRole` stays imported there too. Verify by reading the file rather than assuming — if `Project` turns out to be referenced somewhere else in it, keep that import.

- [ ] **Step 4: Verify the refactor compiles and nothing else broke**

Run: `npx tsc --noEmit`
Expected: no errors. In particular, no "'Project' is declared but never used" and no unresolved `toDistribution`.

Run: `npm test`
Expected: PASS — the Task 1 suite plus the four pre-existing `utils/stripe` suites.

- [ ] **Step 5: Commit**

```bash
git add "app/api/burn/[slug]/admin/membership-statistics/route.ts" "app/api/burn/[slug]/admin/watcher-statistics/route.ts"
git commit -m "refactor: use shared age helpers in the admin statistics routes"
```

---

### Task 3: Return the age distribution from the statistics endpoint

**Files:**
- Modify: `app/api/burn/[slug]/statistics/route.ts`

**Interfaces:**
- Consumes: `getEventStartDate`, `ageAt`, `toAgeDistribution` from `@/app/api/_common/age` (Task 1).
- Produces: the GET response gains exactly two fields, consumed by Task 4:
  - `ageDistribution: { age: number; count: number }[]`
  - `eventStartDate: string | null` — `"YYYY-MM-DD"`

- [ ] **Step 1: Add the import**

At the top of `app/api/burn/[slug]/statistics/route.ts`, after the existing two imports:

```ts
import {
  getEventStartDate,
  ageAt,
  toAgeDistribution,
} from "@/app/api/_common/age";
```

- [ ] **Step 2: Select `birthdate` in the existing query**

Change the `.select(...)` line so the same single query also returns the birthdate — do **not** add a second query:

```ts
        .select("price, is_low_income, metadata, birthdate")
```

- [ ] **Step 3: Compute the distribution inside the existing loop**

Add the accumulator next to the existing counters (after `let alversjo = 0;`):

```ts
    const eventStart = getEventStartDate(project!);
    const ageMap: Record<number, number> = {};
```

Then, inside the existing `for (const membership of memberships)` loop, after the Alversjö addon check and before the closing brace:

```ts
      const age = ageAt(membership.birthdate, eventStart);
      if (age !== null) {
        ageMap[age] = (ageMap[age] || 0) + 1;
      }
```

`birthdate` is `not null` in the database, so `age` is null only if a stored value fails to parse. Those memberships are skipped rather than bucketed, which is why the chart's counts can be lower than `total`.

- [ ] **Step 4: Extend the returned object**

Add two fields to the existing `return`, leaving the other five untouched:

```ts
    return {
      lowIncome,
      mediumIncome,
      highIncome,
      alversjo,
      total: memberships.length,
      ageDistribution: toAgeDistribution(ageMap),
      eventStartDate: eventStart ? eventStart.toISOString().slice(0, 10) : null,
    };
```

Do not add names, ids, or birthdates to this response. This endpoint is readable by every member.

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Verify the endpoint against real data**

Start the dev server with `npm run dev`, log in as a member of a burn, and open the browser devtools Network tab on `/burn/<slug>/statistics`. Inspect the `/api/burn/<slug>/statistics` response.

Expected: `ageDistribution` is an array of `{ age, count }` sorted ascending, with **no gaps** in the `age` sequence; `eventStartDate` is `"2026-07-18"` for a 2026 burn. Confirm the counts sum to at most `total`:

```js
// paste in the devtools console after copying the response as `r`
r.ageDistribution.reduce((s, e) => s + e.count, 0) <= r.total;
```

- [ ] **Step 7: Commit**

```bash
git add "app/api/burn/[slug]/statistics/route.ts"
git commit -m "feat: return member age distribution from the statistics endpoint"
```

---

### Task 4: Render the age chart on the statistics page

**Files:**
- Modify: `app/burn/[slug]/statistics/page.tsx`

**Interfaces:**
- Consumes: `ageDistribution` and `eventStartDate` from the Task 3 endpoint response.
- Produces: nothing other components rely on.

- [ ] **Step 1: Extend the `Statistics` interface**

The interface at the top of the file currently has five fields. Add the two new ones:

```ts
interface Statistics {
  lowIncome: number;
  mediumIncome: number;
  highIncome: number;
  alversjo: number;
  total: number;
  ageDistribution: { age: number; count: number }[];
  eventStartDate: string | null;
}
```

- [ ] **Step 2: Add the chart card to the JSX**

Insert this block between the closing `</div>` of the two-column chart grid and the `{/* Summary Cards */}` comment. It is full width because an age range of roughly 14–70 is about 50 columns and will not fit beside another chart.

```tsx
      {/* Age Distribution */}
      <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow mb-4">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
          {statistics.eventStartDate
            ? `Age Distribution at Event Start (${statistics.eventStartDate})`
            : "Age Distribution"}
        </h2>
        {statistics.ageDistribution.length === 0 ? (
          <div className="text-gray-500">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
            <BarChart
              data={statistics.ageDistribution}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="age"
                label={{ value: "Age", position: "insideBottom", offset: -2 }}
                height={40}
                tick={{ fontSize: isMobile ? 10 : 11 }}
                interval={isMobile ? "preserveStartEnd" : 0}
              />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  fontSize: "14px",
                  padding: "8px",
                  borderRadius: "6px",
                }}
                labelFormatter={(age: any) => `Age ${age}`}
                formatter={(value: any) => [value, "Members"]}
              />
              <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
```

Every Recharts component used here — `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer` — is already imported at the top of this file. Do not add imports.

`isMobile` is the existing state driven by the file's `window.innerWidth < 640` resize listener; reuse it rather than adding another.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify the page renders**

With `npm run dev` running, open `/burn/<slug>/statistics` as a member.

Expected:
- A full-width "Age Distribution at Event Start (2026-07-18)" card sits below the income bar and pie charts and above the four summary cards.
- One bar per age, ascending, with visible empty slots at ages nobody has.
- Hovering a bar shows "Age N" and "Members: <count>".
- Narrow the window below 640px: the chart shrinks to 250px tall and the x-axis thins its labels instead of overlapping them.

- [ ] **Step 5: Verify the admin charts still work**

Open `/burn/<slug>/membership_tools/statistics` as a membership manager.

Expected: both "Member Age Distribution at Event Start" and "Children Age Distribution at Event Start" still render, now with gap-filled x-axes. This is the regression check for Task 2.

- [ ] **Step 6: Run the full check and commit**

```bash
npm test && npx tsc --noEmit
git add "app/burn/[slug]/statistics/page.tsx"
git commit -m "feat: show member age distribution on the statistics page"
```
