/* Everything the site knows about Kathmandu *right now*, in one response.
 *
 * One route rather than one per fact: the homepage wants the hour, the weather
 * and the air together or not at all, and three routes would be three fetches,
 * three cache entries and three ways for the strip to render half-filled.
 *
 * Open-Meteo for both upstreams — no API key, no billing account, no signup, so
 * there is no secret to rotate and nothing to expire while nobody is looking.
 */
import { settings } from "@/lib/content";
import { TZ, type Live } from "@/lib/live";

/* Route handlers are never prerendered, but the constraint is absolute: any
   file touching a binding declares it as a literal. */
export const dynamic = "force-dynamic";

/* 15 min at the edge. Kathmandu's temperature does not move faster than that,
   and it means Open-Meteo sees a handful of requests a day no matter how many
   guests are on the site. `cacheEverything` because their response has no
   Cache-Control worth respecting. */
const UPSTREAM_TTL = 900;

/* Minutes since local midnight. Both sides of every comparison below go through
   this, which is what keeps Kathmandu's :45 offset from ever being arithmetic —
   we only ever subtract two wall clocks in the same zone. */
const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
};

const clockNow = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

/* The hour bands are derived from the real sun, not from hardcoded numbers:
   Kathmandu's sunrise swings about 80 minutes across the year, so a fixed
   "dawn is 6am" would have the site lit wrong for half of it. An hour either
   side of each event is the window where the light is actually changing. */
function daypart(now: number, sunrise: number, sunset: number): Live["daypart"] {
  if (now < sunrise - 60 || now > sunset + 60) return "night";
  if (now <= sunrise + 60) return "dawn";
  if (now >= sunset - 60) return "dusk";
  return "day";
}

/* WMO weather codes, grouped. The full table has 28 entries and splits hairs a
   guest does not care about ("slight" vs "moderate" drizzle); what they want to
   know is whether to expect to get wet walking from the terminal. */
function sky(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}

/* US AQI bands. Kathmandu's air is a real thing guests ask about and a real
   reason to book a room with the windows shut, so this is information rather
   than decoration — which is also why the number ships next to the word. */
function air(aqi: number): string {
  if (aqi <= 50) return "Good air";
  if (aqi <= 100) return "Moderate air";
  if (aqi <= 150) return "Poor air";
  if (aqi <= 200) return "Unhealthy air";
  return "Hazardous air";
}

/* Each upstream is separately catchable, so a weather outage still leaves the
   clock and the air reading intact. Failure here is always a missing field,
   never a failed response — the strip is supplementary and must not be able to
   take a page down. */
async function grab<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cf: { cacheTtl: UPSTREAM_TTL, cacheEverything: true },
    } as RequestInit);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.error("[live] upstream failed", url, err);
    return null;
  }
}

type Forecast = {
  current?: { temperature_2m?: number; weather_code?: number };
  daily?: { sunrise?: string[]; sunset?: string[] };
};
type Air = { current?: { us_aqi?: number } };

export async function GET() {
  /* The coordinates are a settings row, same as the ones the contact map is
     pinned to, so a corrected pin moves the weather with it. */
  const config = await settings().catch(() => ({}) as Record<string, string>);
  const lat = config.lat ?? "27.6981357";
  const lng = config.lng ?? "85.3540451";
  const at = `latitude=${lat}&longitude=${lng}&timezone=${encodeURIComponent(TZ)}`;

  const [forecast, quality] = await Promise.all([
    grab<Forecast>(
      `https://api.open-meteo.com/v1/forecast?${at}&current=temperature_2m,weather_code&daily=sunrise,sunset&forecast_days=1`,
    ),
    grab<Air>(`https://air-quality-api.open-meteo.com/v1/air-quality?${at}&current=us_aqi`),
  ]);

  const now = clockNow();
  /* Open-Meteo returns naive local ISO ("2026-08-29T05:42") because we asked for
     its timezone, so the time half is already a Kathmandu wall clock. */
  const sunrise = forecast?.daily?.sunrise?.[0]?.slice(11, 16);
  const sunset = forecast?.daily?.sunset?.[0]?.slice(11, 16);

  const temp = forecast?.current?.temperature_2m;
  const code = forecast?.current?.weather_code;
  const aqi = quality?.current?.us_aqi;

  const body: Live = {
    time: now,
    /* No sun times means no honest dawn/dusk, and guessing them is how the site
       ends up lit for a sunrise that already happened. Day is the neutral
       fallback: it is the palette the whole design was drawn in. */
    daypart: sunrise && sunset ? daypart(mins(now), mins(sunrise), mins(sunset)) : "day",
    temp: typeof temp === "number" ? Math.round(temp) : null,
    sky: typeof code === "number" ? sky(code) : null,
    aqi: typeof aqi === "number" ? Math.round(aqi) : null,
    air: typeof aqi === "number" ? air(Math.round(aqi)) : null,
  };

  return Response.json(body, {
    /* Ten minutes in the browser, fifteen shared: a guest reloading the page
       does not re-hit us, and the client polls on a slower cadence anyway. */
    headers: { "cache-control": "public, max-age=600, s-maxage=900" },
  });
}
