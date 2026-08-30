/**
 * Regions people can belong to.
 *
 * Stored as a code, never as the display label. Free text would give you
 * "Bay Area", "bay area", "SF Bay Area" and "Bay Area, CA" as four distinct
 * values, and nothing that depends on grouping — meets near you, who else
 * in your area runs this part — would ever work. Codes also mean a label can
 * be reworded without migrating anyone's row.
 *
 * The list is deliberately short and California-heavy: that's where the
 * community is. Adding regions is a one-line change as it spreads.
 */

export type Region = {
  code: string;
  label: string;
  group: string;
};

export const REGIONS: Region[] = [
  { code: 'us-ca-bay-area', label: 'Bay Area', group: 'California' },
  { code: 'us-ca-sacramento', label: 'Sacramento', group: 'California' },
  { code: 'us-ca-central-valley', label: 'Central Valley', group: 'California' },
  { code: 'us-ca-los-angeles', label: 'Los Angeles', group: 'California' },
  { code: 'us-ca-orange-county', label: 'Orange County', group: 'California' },
  { code: 'us-ca-inland-empire', label: 'Inland Empire', group: 'California' },
  { code: 'us-ca-san-diego', label: 'San Diego', group: 'California' },

  { code: 'us-wa-seattle', label: 'Seattle', group: 'Pacific Northwest' },
  { code: 'us-or-portland', label: 'Portland', group: 'Pacific Northwest' },

  { code: 'us-nv-las-vegas', label: 'Las Vegas', group: 'Southwest' },
  { code: 'us-az-phoenix', label: 'Phoenix', group: 'Southwest' },
  { code: 'us-co-denver', label: 'Denver', group: 'Southwest' },

  { code: 'us-tx-dallas', label: 'Dallas–Fort Worth', group: 'Texas' },
  { code: 'us-tx-houston', label: 'Houston', group: 'Texas' },
  { code: 'us-tx-austin', label: 'Austin', group: 'Texas' },

  { code: 'us-il-chicago', label: 'Chicago', group: 'Midwest & East' },
  { code: 'us-ga-atlanta', label: 'Atlanta', group: 'Midwest & East' },
  { code: 'us-fl-miami', label: 'Miami', group: 'Midwest & East' },
  { code: 'us-ny-new-york', label: 'New York', group: 'Midwest & East' },
  { code: 'us-ma-boston', label: 'Boston', group: 'Midwest & East' },
  { code: 'us-dc', label: 'Washington DC', group: 'Midwest & East' },

  { code: 'other', label: 'Somewhere else', group: 'Elsewhere' },
];

/** Groups in list order, each with its regions. Used to render section headers. */
export function groupedRegions(): { group: string; regions: Region[] }[] {
  const groups: { group: string; regions: Region[] }[] = [];

  for (const region of REGIONS) {
    const existing = groups.find((g) => g.group === region.group);
    if (existing) existing.regions.push(region);
    else groups.push({ group: region.group, regions: [region] });
  }

  return groups;
}

/**
 * Display label for a stored code. Falls back to the raw value so that rows
 * saved before this list existed, or codes retired from it, still show
 * something rather than vanishing.
 */
export function regionLabel(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return REGIONS.find((region) => region.code === code)?.label ?? code;
}
