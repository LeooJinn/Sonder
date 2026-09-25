/**
 * The HTML for /p/:vin, with the car written into it.
 *
 * The web app is a single page: every URL serves the same index.html and
 * JavaScript draws the passport afterwards. Link unfurlers — iMessage,
 * Instagram, Discord, forums — don't run JavaScript, so without this every
 * shared passport previews as a bare "Sonder". This fetches the app's own
 * index.html, adds a title, description and photo for the car, and serves
 * that instead. The app then boots exactly as it would have.
 *
 * vercel.json routes /p/:vin here. Only published passports get details;
 * anything else gets the page untouched, so a private car stays
 * indistinguishable from a missing one, exactly as in the app.
 */

import { regionLabel } from '../lib/regions';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const BUCKET = 'photos';

type Car = {
  ownershipId: string;
  vehicleId: string;
  title: string;
  owner?: string;
  region?: string;
  askingPriceCents?: number;
  forSale: boolean;
};

type CurrentRow = {
  id: string;
  for_sale?: boolean;
  asking_price_cents?: number | null;
  profiles: { display_name: string | null; handle: string | null; region: string | null } | null;
  vehicles: { id: string; year: string | null; make: string | null; model: string | null; trim: string | null };
};

type PhotoRow = { storage_path: string; width: number | null; height: number | null };

function rest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, ...init?.headers },
  });
}

/** Row count from PostgREST without fetching the rows. */
async function count(path: string): Promise<number> {
  const response = await rest(path, { method: 'HEAD', headers: { Prefer: 'count=exact' } });
  const range = response.headers.get('content-range') ?? '';
  return Number(range.split('/')[1]) || 0;
}

async function findCar(vin: string): Promise<Car | null> {
  const response = await rest(
    `ownerships?select=id,for_sale,asking_price_cents,profiles(display_name,handle,region),vehicles!inner(id,year,make,model,trim)` +
      `&is_public=eq.true&ended_on=is.null&vehicles.vin=eq.${encodeURIComponent(vin)}&limit=1`
  );
  if (!response.ok) return null;
  const [row] = (await response.json()) as CurrentRow[];
  if (!row) return null;

  const v = row.vehicles;
  const owner = row.profiles?.display_name ?? (row.profiles?.handle ? `@${row.profiles.handle}` : undefined);
  return {
    ownershipId: row.id,
    vehicleId: v.id,
    title: [v.year, v.make, v.model, v.trim].filter(Boolean).join(' '),
    owner: owner ?? undefined,
    region: regionLabel(row.profiles?.region ?? undefined),
    forSale: Boolean(row.for_sale),
    askingPriceCents: row.asking_price_cents ?? undefined,
  };
}

/** The car's own gallery first, then a photo from its current log. */
async function findPhoto(ownershipId: string): Promise<PhotoRow | null> {
  const gallery = await rest(
    `photos?select=storage_path,width,height&ownership_id=eq.${ownershipId}&order=position.desc&limit=1`
  );
  const [fromGallery] = gallery.ok ? ((await gallery.json()) as PhotoRow[]) : [];
  if (fromGallery) return fromGallery;

  const logged = await rest(
    `photos?select=storage_path,width,height,entries!inner(ownership_id)&entries.ownership_id=eq.${ownershipId}&limit=1`
  );
  const [fromLog] = logged.ok ? ((await logged.json()) as PhotoRow[]) : [];
  return fromLog ?? null;
}

function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function money(cents: number): string {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

async function describe(car: Car, pageUrl: string): Promise<string> {
  const [photo, owners, entries] = await Promise.all([
    findPhoto(car.ownershipId),
    count(`ownerships?select=id&vehicle_id=eq.${car.vehicleId}`),
    count(`entries?select=id,ownerships!inner(vehicle_id)&ownerships.vehicle_id=eq.${car.vehicleId}`),
  ]);

  const sale = car.forSale
    ? `For sale${car.askingPriceCents !== undefined ? ` at ${money(car.askingPriceCents)}` : ''}${
        car.region ? ` in ${car.region}` : ''
      }. `
    : '';
  const kept = car.owner ? `Kept by ${car.owner}${car.region && !car.forSale ? ` in ${car.region}` : ''}. ` : '';
  const history = `${plural(owners, 'owner', 'owners')} and ${plural(entries, 'log entry', 'log entries')} on Sonder, with every mod, service and repair.`;

  const title = `${car.title} on Sonder`;
  const description = `${sale}${kept}${history}`;
  const image = photo ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${photo.storage_path}` : undefined;

  const tags = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}" />`,
    `<meta property="og:site_name" content="Sonder" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escape(pageUrl)}" />`,
    `<meta property="og:title" content="${escape(title)}" />`,
    `<meta property="og:description" content="${escape(description)}" />`,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${escape(title)}" />`,
    `<meta name="twitter:description" content="${escape(description)}" />`,
  ];
  if (image) {
    tags.push(
      `<meta property="og:image" content="${escape(image)}" />`,
      `<meta name="twitter:image" content="${escape(image)}" />`,
      `<meta property="og:image:alt" content="${escape(`Photo of the ${car.title}`)}" />`
    );
    if (photo?.width && photo.height) {
      tags.push(
        `<meta property="og:image:width" content="${photo.width}" />`,
        `<meta property="og:image:height" content="${photo.height}" />`
      );
    }
  }
  return tags.join('\n    ');
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const vin = (url.searchParams.get('vin') ?? '').toUpperCase();
  const pageUrl = `${url.origin}/p/${vin}`;

  // index.html is a static file, served before any rewrite applies, so this
  // can't loop back into this function.
  const template = await fetch(`${url.origin}/index.html`).then((r) => (r.ok ? r.text() : null));
  if (!template) return new Response('Sonder is unavailable right now.', { status: 502 });

  let html = template;
  let found = false;

  if (/^[A-HJ-NPR-Z0-9]{17}$/.test(vin) && SUPABASE_URL && ANON_KEY) {
    try {
      const car = await findCar(vin);
      if (car) {
        const tags = await describe(car, pageUrl);
        html = /<title>[^<]*<\/title>/.test(html)
          ? html.replace(/<title>[^<]*<\/title>/, tags)
          : html.replace('</head>', `    ${tags}\n  </head>`);
        found = true;
      }
    } catch {
      // A preview is a nicety. If the database is unreachable, the page
      // still loads and the app shows its own error once it runs.
    }
  }

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Short, so a change of photo or price shows up in new shares soon;
      // stale-while-revalidate keeps it fast for the people who follow them.
      'cache-control': found
        ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400'
        : 'public, max-age=0, s-maxage=60',
    },
  });
}
