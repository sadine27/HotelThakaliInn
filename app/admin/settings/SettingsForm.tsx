"use client";

/* The settings console.
 *
 * The screen this replaces was thirteen blank boxes, and the complaint about it
 * was not that it looked plain — it was that a blank box asks a question the
 * person filling it in has to guess the answer to. Do I type the +977 or not?
 * Is it "950m" or "950 m"? Which of the thirty things every room has did I
 * forget? Guessing wrong on the first one means a guest in India taps the
 * hotel's number and dials an Indian one.
 *
 * So: no field here is a blank box if a control can answer the question
 * instead. The country code is a select, so it cannot be left off. The
 * amenities are a list you tick, so none can be forgotten. Each link is checked
 * against the host it claims to be from, so it cannot be half-pasted. And every
 * section shows what it will actually look like — not a mock, but the exact
 * string lib/settings-schema.ts is about to store.
 *
 * The rules all live in lib/settings-schema.ts, and the server action runs the
 * same computeErrors() over the same FormValues before it writes anything. What
 * is here is only the part you can see. */

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { MARKS } from "@/components/SocialMarks";
import { mapEmbedUrl, phoneHref, waHref } from "@/lib/site";
import {
  AMENITIES,
  ARRIVAL_UNITS,
  COUNTRY_CODES,
  MEALS,
  MEAL_STYLES,
  SOCIAL_PLATFORMS,
  composeAll,
  composeAmenities,
  composeGoodToKnow,
  composeRoomSize,
  composeSizePair,
  computeErrors,
  coordsFromMapsUrl,
  digitsOnly,
  smallestRoomSize,
  type ArrivalRow,
  type Errors,
  type FormValues,
  type GoodRow,
  type Meal,
  type RoomSizeUnit,
} from "@/lib/settings-schema";

export type SaveState = { errors?: Errors; message?: string } | null;

/* Human names for the ids computeErrors() keys its messages by, so the summary
   at the top reads as a list of fields rather than a list of variables. */
const FIELD_NAMES: Record<string, string> = {
  phone: "Front desk number",
  whatsapp: "WhatsApp number",
  email: "Email address",
  booking_url: "Booking.com link",
  maps_url: "Google Maps link",
  lat: "Latitude",
  lng: "Longitude",
  plus_code: "Plus code",
  addr_tole: "Street or tole",
  addr_ward: "Ward number",
  addr_city: "City",
  addr_postal: "Postal code",
  room_sizes: "Room sizes",
  amenities: "What every room has",
};

const nameFor = (id: string): string => {
  if (FIELD_NAMES[id]) return FIELD_NAMES[id];
  const [kind, i] = id.split("-");
  const n = Number(i) + 1;
  if (kind === "social") return `Social link ${n}`;
  if (kind === "arrival") return `Arrival row ${n}`;
  if (kind === "good") return `Good-to-know point ${n}`;
  if (kind === "amen") return `Extra amenity ${n}`;
  if (kind === "meal") return `Meal ${n}`;
  if (kind === "room") return `Room ${n} size`;
  return id;
};

/* Two or three mutually exclusive answers, drawn as buttons rather than hidden
   inside a select. A dropdown makes you open it to find out what the other
   choice even is; these state both, and the pressed one stays pressed. */
function Choice<T extends string>({
  value,
  onPick,
  options,
  label,
}: {
  value: T;
  onPick: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <span className="adm-con-choice" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="adm-btn adm-btn--sm"
          aria-pressed={value === o.value}
          onClick={() => onPick(o.value)}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

/* A dot AND a word — colour never carries the state on its own. "off" keeps the
   row's height so a lamp turning on cannot shove the layout. */
function Lamp({ state }: { state: "ok" | "bad" | "req" | "off" }) {
  const word = state === "ok" ? "valid" : state === "bad" ? "invalid" : state === "req" ? "needed" : "";
  return (
    <p className="adm-con-lamp" data-state={state} aria-hidden={state === "off"}>
      {word}
    </p>
  );
}

/* What lib/permissions.ts decided about this person and the email row, already
   resolved on the server. The console never re-derives it from a role string:
   an owner's access can come from a 24-hour grant, and only the server can know
   whether one is live. */
export type EmailAccess = {
  allowed: boolean;
  via: "role" | "grant" | null;
  leftLabel: string | null;
  grantedBy: string | null;
};

export default function SettingsForm({
  initial,
  emailAccess,
  save,
}: {
  initial: FormValues;
  emailAccess: EmailAccess;
  save: (prev: SaveState, data: FormData) => Promise<SaveState>;
}) {
  const [state, formAction] = useActionState(save, null);
  const [v, setV] = useState<FormValues>(initial);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  /* Bumped on each refused save. The summary only exists after that render, so
     focus has to wait for the commit — an effect keyed on this counter runs at
     exactly the right moment, and only when a save was actually attempted. */
  const [attempt, setAttempt] = useState(0);
  /* The identity of the rejection the person has already started fixing.
     Comparing against it derives "is the server's complaint still current?"
     instead of mirroring state into state — an effect that calls setState
     kicks off a second render pass for something already knowable. */
  const [dismissed, setDismissed] = useState<SaveState>(null);
  const [emailUnlocked, setEmailUnlocked] = useState(false);
  const [coordsManual, setCoordsManual] = useState(false);
  const [customDraft, setCustomDraft] = useState("");
  const [pinNote, setPinNote] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);

  const emailEditable = emailAccess.allowed;

  /* One setter for everything, so "the person changed something" is a single
     place — which is what clears a stale rejection from the server and marks
     the form dirty for the bar at the bottom. */
  const update = (patch: Partial<FormValues>) => {
    setV((prev) => ({ ...prev, ...patch }));
    setDismissed(state);
  };
  const mark = (id: string) => setTouched((t) => ({ ...t, [id]: true }));

  const errors = useMemo(() => computeErrors(v), [v]);
  const rows = useMemo(() => composeAll(v), [v]);
  const serverErrors: Errors | null = state !== dismissed ? (state?.errors ?? null) : null;
  const shown: Errors = { ...(serverErrors ?? {}), ...errors };
  const problems = Object.keys(shown);
  const dirty = useMemo(() => JSON.stringify(v) !== JSON.stringify(initial), [v, initial]);
  /* A rejection from the server counts as having tried to save, so every lamp
     lights without a second state flag to keep in step. */
  const showAll = submitted || serverErrors !== null;

  /* Moving focus is a real DOM effect and belongs here; nothing else does. */
  useEffect(() => {
    if (attempt > 0 || state?.errors) summaryRef.current?.focus();
  }, [attempt, state]);

  /* Show a field's lamp once it has been visited, or once someone has tried to
     save — shouting at every empty field the moment the page opens is how a
     form teaches people to ignore it. */
  const lamp = (id: string): "ok" | "bad" | "req" | "off" => {
    if (!touched[id] && !showAll) return "off";
    return shown[id] ? "bad" : "ok";
  };
  const err = (id: string) =>
    (touched[id] || showAll) && shown[id] ? (
      <p className="adm-con-err" id={`${id}-err`}>
        {shown[id]}
      </p>
    ) : null;
  const described = (id: string) => ((touched[id] || showAll) && shown[id] ? `${id}-err` : undefined);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    setSubmitted(true);
    if (problems.length) {
      e.preventDefault();
      /* Focus goes to the summary rather than the first bad field: on a form
         this long the useful thing is the whole list, and each entry links to
         its own control. The effect above does the moving, once the summary
         has actually rendered. */
      setAttempt((n) => n + 1);
    }
  }

  /* Pasting the maps link is what places the pin — the two coordinate boxes are
     a readout of it, not two more things to type correctly. */
  function readPin(url: string) {
    const found = coordsFromMapsUrl(url);
    if (!found) {
      setPinNote(url.trim() ? "No pin in that link — in Google Maps use Share → Copy link." : "");
      return;
    }
    update({ lat: found.lat, lng: found.lng });
    setTouched((t) => ({ ...t, lat: true, lng: true }));
    setPinNote(
      found.from === "pin"
        ? "Pin read from this link."
        : "That link only carries the map's centre, not a pin — check the preview.",
    );
  }

  const toggleAmenity = (a: string) => {
    const next = new Set(v.amenPicked);
    if (next.has(a)) next.delete(a);
    else next.add(a);
    /* Re-ordered to the catalogue every time, so the stored line is the same
       whichever order the boxes happened to be ticked in. */
    update({ amenPicked: AMENITIES.filter((x) => next.has(x)) });
  };

  const setRow = <T,>(list: T[], i: number, patch: Partial<T>): T[] =>
    list.map((r, n) => (n === i ? { ...r, ...patch } : r));
  const dropRow = <T,>(list: T[], i: number): T[] => list.filter((_, n) => n !== i);

  /* A phone box holds digits. Not "digits, checked afterwards" — the letters
     never land in the first place, so there is nothing to explain and nothing
     to correct. E.164 caps the whole number at 15, and the country code has
     already spent some of that, so the room left here shrinks when you switch
     from +977 to +1. */
  const roomForDigits = (cc: string) => Math.max(1, 15 - digitsOnly(cc).length);
  const onlyDigits = (raw: string, cc: string) => digitsOnly(raw).slice(0, roomForDigits(cc));

  const coordsOk = !errors.lat && !errors.lng;

  return (
    <form className="adm-con" action={formAction} onSubmit={onSubmit} noValidate>
      {/* Every value the action writes, composed from the parts above. Sent as
          one hidden field rather than forty named inputs: the server rebuilds
          FormValues from it and re-runs the very same computeErrors(), so there
          is no second, subtly different reading of this form anywhere. */}
      <input type="hidden" name="values" value={JSON.stringify(v)} />

      {showAll && problems.length > 0 && (
        <div className="adm-con-summary" role="alert" tabIndex={-1} ref={summaryRef}>
          <h2>
            {problems.length} {problems.length === 1 ? "problem" : "problems"} — nothing saved
          </h2>
          <ol>
            {problems.map((id) => (
              <li key={id}>
                <a href={`#${id}`}>{nameFor(id)}</a> — {shown[id]}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── CONTACT ── */}
      <fieldset className="adm-con-panel">
        <legend>Contact</legend>
        <div className="adm-con-split">
          <div className="adm-con-grid">
            <div className="adm-con-field">
              <label htmlFor="phone">Front desk number</label>
              <div className="adm-con-pair">
                <select
                  className="adm-con-mono adm-w-cc"
                  value={v.phoneCc}
                  aria-label="Country code"
                  onChange={(e) => update({ phoneCc: e.target.value })}
                  onBlur={() => mark("phone")}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} {c.name}
                    </option>
                  ))}
                </select>
                <input
                  id="phone"
                  className="adm-con-mono"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="9840007925"
                  maxLength={roomForDigits(v.phoneCc)}
                  value={v.phoneLocal}
                  aria-describedby={described("phone")}
                  onChange={(e) => update({ phoneLocal: onlyDigits(e.target.value, v.phoneCc) })}
                  onBlur={() => mark("phone")}
                />
              </div>
              <Lamp state={lamp("phone")} />
              {err("phone")}
              <p className="adm-con-readout">
                dials as <b>{phoneHref(rows.phone)}</b>
              </p>
            </div>

            <div className="adm-con-field">
              <span className="adm-con-legend">WhatsApp number</span>
              <label className="adm-con-tick">
                <input
                  type="checkbox"
                  checked={v.waSame}
                  onChange={(e) => update({ waSame: e.target.checked })}
                />
                <span>Same as the front desk number</span>
              </label>
              <div className="adm-con-pair">
                <select
                  className="adm-con-mono adm-w-cc"
                  value={v.waSame ? v.phoneCc : v.waCc}
                  disabled={v.waSame}
                  aria-label="WhatsApp country code"
                  onChange={(e) => update({ waCc: e.target.value })}
                  onBlur={() => mark("whatsapp")}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} {c.name}
                    </option>
                  ))}
                </select>
                <input
                  id="whatsapp"
                  className="adm-con-mono"
                  inputMode="numeric"
                  placeholder="9840007925"
                  maxLength={roomForDigits(v.waCc)}
                  value={v.waSame ? v.phoneLocal : v.waLocal}
                  disabled={v.waSame}
                  aria-describedby={described("whatsapp")}
                  onChange={(e) => update({ waLocal: onlyDigits(e.target.value, v.waCc) })}
                  onBlur={() => mark("whatsapp")}
                />
              </div>
              <Lamp state={v.waSame ? "off" : lamp("whatsapp")} />
              {!v.waSame && err("whatsapp")}
              <p className="adm-con-readout">
                opens <b>{waHref(rows.whatsapp)}</b>
              </p>
            </div>

            <div className="adm-con-field adm-con-wide">
              <label htmlFor="email">
                Email address
                {emailUnlocked ? (
                  <span className="adm-con-lock" data-open="1">
                    unlocked
                  </span>
                ) : (
                  <span className="adm-con-lock">
                    {!emailAccess.allowed
                      ? "locked — ask the developer"
                      : emailAccess.via === "grant"
                        ? `locked · access granted, ${emailAccess.leftLabel}`
                        : "locked"}
                  </span>
                )}
              </label>
              <input
                id="email"
                type="email"
                className="adm-con-mono"
                value={v.email}
                disabled={!emailUnlocked}
                aria-describedby={described("email")}
                onChange={(e) => update({ email: e.target.value })}
                onBlur={() => mark("email")}
              />
              <Lamp state={emailUnlocked ? lamp("email") : "off"} />
              {emailUnlocked && err("email")}
              <p className="adm-con-warn">
                This is where every enquiry from the website is sent. Changing it stops that mail
                arriving until a developer redeploys the site — the destination is pinned in the
                deploy configuration, not here.
                {emailEditable ? "" : " Message the developer if it needs to change; they can grant access for 24 hours."}
                {emailAccess.via === "grant" && emailAccess.grantedBy
                  ? ` Granted by ${emailAccess.grantedBy}, ${emailAccess.leftLabel}.`
                  : ""}
              </p>
              {emailEditable && (
                <p className="adm-con-hint">
                  {/* Lock, not just unlock. Leaving the field open for the rest
                      of a session is how the one row nobody meant to touch gets
                      touched — and there was no way back short of reloading. */}
                  <button
                    type="button"
                    className="adm-btn adm-btn--sm"
                    onClick={() => {
                      if (emailUnlocked) update({ email: initial.email });
                      setEmailUnlocked((open) => !open);
                    }}
                  >
                    {emailUnlocked ? "Lock" : "Unlock"}
                  </button>{" "}
                  {emailUnlocked ? "Locking again puts back the address that is on the site." : ""}
                </p>
              )}
            </div>

            <div className="adm-con-field adm-con-wide">
              <label htmlFor="booking_url">Booking.com link</label>
              <input
                id="booking_url"
                className="adm-con-mono"
                placeholder="https://www.booking.com/hotel/np/thakali-inn.html"
                value={v.bookingUrl}
                aria-describedby={described("booking_url")}
                onChange={(e) => update({ bookingUrl: e.target.value })}
                onBlur={() => mark("booking_url")}
              />
              <Lamp state={lamp("booking_url")} />
              {err("booking_url")}
            </div>

            <div className="adm-con-field adm-con-wide">
              <span className="adm-con-legend">Social links</span>
              <div className="adm-con-rows">
                {v.socials.length === 0 && (
                  <p className="adm-con-empty">No social accounts shown on the site yet.</p>
                )}
                {v.socials.map((s, i) => {
                  const platform = SOCIAL_PLATFORMS.find((p) => p.label === s.label);
                  const id = `social-${i}`;
                  return (
                    <div className="adm-con-row" key={id}>
                      <select
                        value={s.label}
                        aria-label={`Platform for social link ${i + 1}`}
                        onChange={(e) => update({ socials: setRow(v.socials, i, { label: e.target.value }) })}
                        onBlur={() => mark(id)}
                      >
                        {/* A stored label from before this select existed must
                            still be selectable, or changing any other row would
                            silently rewrite this one. */}
                        {!platform && <option value={s.label}>{s.label || "— pick one —"}</option>}
                        {SOCIAL_PLATFORMS.map((p) => (
                          <option key={p.label} value={p.label}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <input
                        id={id}
                        className="adm-con-mono adm-con-flex"
                        placeholder={platform?.placeholder ?? "https://…"}
                        value={s.href}
                        aria-describedby={described(id)}
                        onChange={(e) => update({ socials: setRow(v.socials, i, { href: e.target.value }) })}
                        onBlur={() => mark(id)}
                      />
                      <Lamp state={lamp(id)} />
                      <button
                        type="button"
                        className="adm-btn adm-btn--x"
                        aria-label={`Remove ${s.label || "this"} link`}
                        onClick={() => update({ socials: dropRow(v.socials, i) })}
                      >
                        ×
                      </button>
                      {err(id) && <div className="adm-con-note">{err(id)}</div>}
                    </div>
                  );
                })}
              </div>
              {/* The whole pool, visible at once. The button this replaces added
                  "the first platform not already used", so getting to TikTok
                  meant creating and re-picking nine rows you didn't want. */}
              <p className="adm-con-legend adm-con-pick-head">Add a platform</p>
              <div className="adm-con-pick">
                {SOCIAL_PLATFORMS.map((p) => {
                  const used = v.socials.some((s) => s.label === p.label);
                  const Icon = MARKS[p.label];
                  return (
                    <button
                      key={p.label}
                      type="button"
                      className="adm-con-pick-btn"
                      disabled={used}
                      aria-label={used ? `${p.label} — already added` : `Add ${p.label}`}
                      onClick={() => {
                        update({ socials: [...v.socials, { label: p.label, href: "" }] });
                        mark(`social-${v.socials.length}`);
                      }}
                    >
                      <span className="adm-con-pick-mark">{Icon ? <Icon size={20} /> : "?"}</span>
                      <span className="adm-con-pick-name">{p.label}</span>
                      {/* A shape, not a colour — and the button's accessible
                          name already says "already added" in full. Spelling it
                          out here cost the longest platform names their last
                          four characters. */}
                      {used && <span className="adm-con-pick-on">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="adm-con-preview">
            <h3>On the site</h3>
            <div className="adm-con-preview-body">
              <p>{rows.phone}</p>
              <p>{rows.email}</p>
              <div className="adm-con-marks">
                {v.socials
                  .filter((s) => s.href.trim())
                  .map((s, i) => {
                    const Icon = MARKS[s.label];
                    return (
                      <span
                        className="adm-con-mark"
                        key={`${s.label}-${i}`}
                        data-unknown={Icon ? undefined : "1"}
                        title={s.label}
                      >
                        {Icon ? <Icon size={17} /> : s.label.slice(0, 4)}
                      </span>
                    );
                  })}
              </div>
              {v.socials.some((s) => s.href.trim() && !MARKS[s.label]) && (
                <p className="adm-con-err">
                  A dashed box has no icon — the site will print its name as plain text instead.
                </p>
              )}
            </div>
          </aside>
        </div>
      </fieldset>

      {/* ── LOCATION ── */}
      <fieldset className="adm-con-panel">
        <legend>Location</legend>
        <div className="adm-con-split">
          <div className="adm-con-grid">
            <div className="adm-con-field adm-con-wide">
              <label htmlFor="maps_url">Google Maps link</label>
              <input
                id="maps_url"
                className="adm-con-mono"
                placeholder="https://www.google.com/maps/place/…"
                value={v.mapsUrl}
                aria-describedby={described("maps_url")}
                onChange={(e) => update({ mapsUrl: e.target.value })}
                onBlur={(e) => {
                  mark("maps_url");
                  readPin(e.target.value);
                }}
              />
              <Lamp state={lamp("maps_url")} />
              {err("maps_url")}
              {pinNote && <p className="adm-con-hint">{pinNote}</p>}
            </div>

            <div className="adm-con-field">
              <label htmlFor="lat">Latitude</label>
              <input
                id="lat"
                className="adm-con-mono adm-w-coord"
                readOnly={!coordsManual}
                value={v.lat}
                aria-describedby={described("lat")}
                onChange={(e) => update({ lat: e.target.value })}
                onBlur={() => mark("lat")}
              />
              <Lamp state={lamp("lat")} />
              {err("lat")}
            </div>

            <div className="adm-con-field">
              <label htmlFor="lng">Longitude</label>
              <input
                id="lng"
                className="adm-con-mono adm-w-coord"
                readOnly={!coordsManual}
                value={v.lng}
                aria-describedby={described("lng")}
                onChange={(e) => update({ lng: e.target.value })}
                onBlur={() => mark("lng")}
              />
              <Lamp state={lamp("lng")} />
              {err("lng")}
            </div>

            <div className="adm-con-field adm-con-wide">
              <p className="adm-con-hint">
                The link above places the pin — these two are what it read. They also aim the
                weather and air readings on the homepage.{" "}
                <button
                  type="button"
                  className="adm-btn adm-btn--sm"
                  onClick={() => setCoordsManual((m) => !m)}
                >
                  {coordsManual ? "Back to the link" : "Type them by hand"}
                </button>
              </p>
            </div>

            <div className="adm-con-field adm-con-wide">
              <label htmlFor="plus_code">
                Plus code
                <details className="adm-con-help">
                  <summary aria-label="Where to find the plus code">?</summary>
                  <p className="adm-con-help-body">
                    Open Google Maps, search for the hotel, tap its name at the bottom, and scroll
                    to the short code that looks like <b>M9X3+7J Kathmandu</b>. Copy that. It is
                    what the &ldquo;Directions&rdquo; button on the contact page uses.
                  </p>
                </details>
              </label>
              <input
                id="plus_code"
                className="adm-con-mono"
                placeholder="M9X3+7J Kathmandu"
                value={v.plusCode}
                aria-describedby={described("plus_code")}
                onChange={(e) => update({ plusCode: e.target.value })}
                onBlur={() => mark("plus_code")}
              />
              <Lamp state={lamp("plus_code")} />
              {err("plus_code")}
            </div>

            <div className="adm-con-field adm-con-wide">
              <span className="adm-con-legend">Address</span>
              <div className="adm-con-grid">
                <div className="adm-con-field">
                  <label htmlFor="addr_tole">Street / tole</label>
                  <input
                    id="addr_tole"
                    value={v.addr.tole}
                    aria-describedby={described("addr_tole")}
                    onChange={(e) => update({ addr: { ...v.addr, tole: e.target.value } })}
                    onBlur={() => mark("addr_tole")}
                  />
                  <Lamp state={lamp("addr_tole")} />
                  {err("addr_tole")}
                </div>
                <div className="adm-con-field">
                  <label htmlFor="addr_ward">Ward no. — optional</label>
                  <input
                    id="addr_ward"
                    className="adm-con-mono adm-w-ward"
                    inputMode="numeric"
                    value={v.addr.ward}
                    aria-describedby={described("addr_ward")}
                    onChange={(e) => update({ addr: { ...v.addr, ward: e.target.value } })}
                    onBlur={() => mark("addr_ward")}
                  />
                  <Lamp state={v.addr.ward.trim() ? lamp("addr_ward") : "off"} />
                  {err("addr_ward")}
                </div>
                <div className="adm-con-field">
                  <label htmlFor="addr_city">City</label>
                  <input
                    id="addr_city"
                    value={v.addr.city}
                    aria-describedby={described("addr_city")}
                    onChange={(e) => update({ addr: { ...v.addr, city: e.target.value } })}
                    onBlur={() => mark("addr_city")}
                  />
                  <Lamp state={lamp("addr_city")} />
                  {err("addr_city")}
                </div>
                <div className="adm-con-field">
                  <label htmlFor="addr_district">District — optional</label>
                  <input
                    id="addr_district"
                    value={v.addr.district}
                    onChange={(e) => update({ addr: { ...v.addr, district: e.target.value } })}
                  />
                  <Lamp state="off" />
                </div>
                <div className="adm-con-field">
                  <label htmlFor="addr_postal">Postal code</label>
                  <input
                    id="addr_postal"
                    className="adm-con-mono adm-w-post"
                    inputMode="numeric"
                    value={v.addr.postal}
                    aria-describedby={described("addr_postal")}
                    onChange={(e) => update({ addr: { ...v.addr, postal: e.target.value } })}
                    onBlur={() => mark("addr_postal")}
                  />
                  <Lamp state={lamp("addr_postal")} />
                  {err("addr_postal")}
                </div>
              </div>
            </div>

            <div className="adm-con-field adm-con-wide">
              <span className="adm-con-legend">Getting here</span>
              <p className="adm-con-hint">
                One row per thing a guest wants to know before they set off. Most are a
                distance from somewhere; a couple are not — the front desk being staffed
                through the night has no number. Pick which each row is and the boxes
                beside it change to match.
              </p>
              <div className="adm-con-rows">
                {v.arrival.map((r, i) => {
                  const id = `arrival-${i}`;
                  return (
                    <div className="adm-con-row" key={id}>
                      <input
                        id={id}
                        className="adm-con-flex"
                        placeholder="TIA terminal"
                        value={r.place}
                        aria-label={`Place for arrival row ${i + 1}`}
                        aria-describedby={described(id)}
                        onChange={(e) => update({ arrival: setRow(v.arrival, i, { place: e.target.value }) })}
                        onBlur={() => mark(id)}
                      />
                      <select
                        value={r.kind}
                        aria-label={`Kind of arrival row ${i + 1}`}
                        onChange={(e) =>
                          update({
                            arrival: setRow(v.arrival, i, { kind: e.target.value as ArrivalRow["kind"] }),
                          })
                        }
                      >
                        <option value="distance">how far away it is</option>
                        <option value="note">something to say about it</option>
                      </select>
                      {r.kind === "distance" ? (
                        <>
                          <input
                            className="adm-con-mono adm-w-num"
                            inputMode="decimal"
                            placeholder="950"
                            value={r.value}
                            aria-label={`Distance for arrival row ${i + 1}`}
                            onChange={(e) => update({ arrival: setRow(v.arrival, i, { value: e.target.value }) })}
                            onBlur={() => mark(id)}
                          />
                          <select
                            className="adm-w-unit"
                            value={r.unit}
                            aria-label={`Unit for arrival row ${i + 1}`}
                            onChange={(e) => update({ arrival: setRow(v.arrival, i, { unit: e.target.value }) })}
                          >
                            {ARRIVAL_UNITS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <input
                          className="adm-con-flex"
                          placeholder="Through the night"
                          value={r.value}
                          aria-label={`Note for arrival row ${i + 1}`}
                          onChange={(e) => update({ arrival: setRow(v.arrival, i, { value: e.target.value }) })}
                          onBlur={() => mark(id)}
                        />
                      )}
                      <Lamp state={lamp(id)} />
                      <button
                        type="button"
                        className="adm-btn adm-btn--x"
                        aria-label={`Remove arrival row ${i + 1}`}
                        onClick={() => update({ arrival: dropRow(v.arrival, i) })}
                      >
                        ×
                      </button>
                      {err(id) && <div className="adm-con-note">{err(id)}</div>}
                    </div>
                  );
                })}
              </div>
              <p className="adm-con-hint">
                <button
                  type="button"
                  className="adm-btn adm-btn--sm"
                  onClick={() =>
                    update({
                      arrival: [
                        ...v.arrival,
                        { place: "", kind: "distance", value: "", unit: ARRIVAL_UNITS[0] },
                      ],
                    })
                  }
                >
                  + Add a row
                </button>{" "}
                The first two distances also write the &ldquo;950&nbsp;m from…&rdquo; line under
                Rooms, so that line can never disagree with this one.
              </p>
            </div>
          </div>

          <aside className="adm-con-preview">
            <h3>On the site</h3>
            <div className="adm-con-preview-body">
              <p>{rows.address || "— no address —"}</p>
              {coordsOk && v.lat && v.lng ? (
                <iframe
                  className="adm-con-map"
                  src={mapEmbedUrl(v.lat, v.lng)}
                  title="Where the pin currently sits"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <p className="adm-con-hint">Paste the Google Maps link to see the pin.</p>
              )}
              <dl>
                {v.arrival
                  .filter((r) => r.place.trim())
                  .map((r, i) => (
                    <div key={`${r.place}-${i}`}>
                      <dt>{r.place}</dt>
                      <dd>{r.kind === "distance" ? `${r.value} ${r.unit}` : r.value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </aside>
        </div>
      </fieldset>

      {/* ── ROOMS ── */}
      <fieldset className="adm-con-panel">
        <legend>Rooms</legend>
        <div className="adm-con-split">
          <div className="adm-con-grid">
            <div className="adm-con-field adm-con-wide">
              <span className="adm-con-legend" id="amenities">
                What every room has
              </span>
              <div className="adm-con-ticks">
                {AMENITIES.map((a) => (
                  <label className="adm-con-tick" key={a}>
                    <input
                      type="checkbox"
                      checked={v.amenPicked.includes(a)}
                      onChange={() => {
                        mark("amenities");
                        toggleAmenity(a);
                      }}
                    />
                    <span>{a}</span>
                  </label>
                ))}
              </div>
              <Lamp state={lamp("amenities")} />
              {err("amenities")}

              {v.amenCustom.length > 0 && (
                <div className="adm-con-chips">
                  {v.amenCustom.map((c, i) => (
                    <span className="adm-con-chip" key={`${c}-${i}`}>
                      {c}
                      <button
                        type="button"
                        className="adm-btn adm-btn--x"
                        aria-label={`Remove ${c}`}
                        onClick={() => update({ amenCustom: dropRow(v.amenCustom, i) })}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="adm-con-pair" style={{ marginTop: 10 }}>
                <input
                  className="adm-con-flex"
                  placeholder="Something not on the list"
                  aria-label="Add an amenity that is not listed"
                  value={customDraft}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  onKeyDown={(e) => {
                    /* Enter here adds the amenity. Without this it submits the
                       whole form, which is the classic way a half-typed value
                       gets saved. */
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (!customDraft.trim()) return;
                    update({ amenCustom: [...v.amenCustom, customDraft.trim()] });
                    setCustomDraft("");
                  }}
                />
                <button
                  type="button"
                  className="adm-btn adm-btn--sm"
                  disabled={!customDraft.trim()}
                  onClick={() => {
                    update({ amenCustom: [...v.amenCustom, customDraft.trim()] });
                    setCustomDraft("");
                  }}
                >
                  + Add
                </button>
              </div>
            </div>

            <div className="adm-con-field adm-con-wide">
              <span className="adm-con-legend" id="room_sizes">
                Room sizes
              </span>
              <div className="adm-con-pair">
                <span className="adm-con-rowlabel">measured in</span>
                <select
                  className="adm-w-unit"
                  value={v.sizeUnit}
                  aria-label="Unit for all room sizes"
                  onChange={(e) => update({ sizeUnit: e.target.value as RoomSizeUnit })}
                >
                  <option value="m2">m²</option>
                  <option value="sqft">sq ft</option>
                </select>
                <label className="adm-con-tick">
                  <input
                    type="checkbox"
                    checked={v.sizeBathroom}
                    onChange={(e) => update({ sizeBathroom: e.target.checked })}
                  />
                  <span>bathroom included in these figures</span>
                </label>
              </div>

              <div className="adm-con-rows">
                {v.rooms.length === 0 && (
                  <p className="adm-con-empty">
                    No rooms found. Add them under Pages, rooms &amp; photos first.
                  </p>
                )}
                {v.rooms.map((r, i) => {
                  const id = `room-${i}`;
                  const pair = composeSizePair(r.value, v.sizeUnit);
                  return (
                    <div className="adm-con-row" key={r.slug}>
                      <span className="adm-con-rowlabel">{r.title}</span>
                      <input
                        id={id}
                        className="adm-con-mono adm-w-num"
                        inputMode="decimal"
                        placeholder="42"
                        value={r.value}
                        aria-label={`Size of the ${r.title}`}
                        aria-describedby={described(id)}
                        onChange={(e) => update({ rooms: setRow(v.rooms, i, { value: e.target.value }) })}
                        onBlur={() => mark(id)}
                      />
                      <span className="adm-con-readout adm-con-flex">{pair || "not measured yet"}</span>
                      <Lamp state={r.value.trim() ? lamp(id) : "req"} />
                      {err(id) && <div className="adm-con-note">{err(id)}</div>}
                    </div>
                  );
                })}
              </div>
              {err("room_sizes")}
              <p className="adm-con-readout">{rows.rooms_size || "—"}</p>
              <p className="adm-con-hint">
                One unit for all three, so a guest comparing two cards is comparing two
                numbers rather than doing arithmetic. The other unit is worked out from
                this one, and the &ldquo;rooms start at about…&rdquo; line above is the
                smallest of them — leave a room blank until you have actually measured it
                rather than guessing.
              </p>
            </div>

            <div className="adm-con-field adm-con-wide">
              <span className="adm-con-legend">Meals</span>
              <div className="adm-con-rows">
                {v.meals.length === 0 && <p className="adm-con-empty">No meals listed.</p>}
                {v.meals.map((m, i) => {
                  const id = `meal-${i}`;
                  return (
                    <div className="adm-con-row adm-con-row--wrap" key={id}>
                      <select
                        id={id}
                        value={m.meal}
                        aria-label={`Which meal, row ${i + 1}`}
                        aria-describedby={described(id)}
                        onChange={(e) => update({ meals: setRow(v.meals, i, { meal: e.target.value }) })}
                        onBlur={() => mark(id)}
                      >
                        {!MEALS.includes(m.meal) && <option value={m.meal}>{m.meal || "— pick one —"}</option>}
                        {MEALS.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </select>
                      <select
                        value={m.style}
                        aria-label={`How ${m.meal || "it"} is served`}
                        onChange={(e) => update({ meals: setRow(v.meals, i, { style: e.target.value }) })}
                      >
                        <option value="">no style given</option>
                        {MEAL_STYLES.map((x) => (
                          <option key={x} value={x}>
                            {x.toLowerCase()}
                          </option>
                        ))}
                      </select>
                      <span className="adm-con-rowlabel">served</span>
                      <input
                        type="time"
                        className="adm-con-mono"
                        value={m.from}
                        aria-label={`Time ${m.meal || "this meal"} starts`}
                        onChange={(e) => update({ meals: setRow(v.meals, i, { from: e.target.value }) })}
                        onBlur={() => mark(id)}
                      />
                      <span className="adm-con-rowlabel">to</span>
                      <input
                        type="time"
                        className="adm-con-mono"
                        value={m.to}
                        aria-label={`Time ${m.meal || "this meal"} ends`}
                        onChange={(e) => update({ meals: setRow(v.meals, i, { to: e.target.value }) })}
                        onBlur={() => mark(id)}
                      />
                      <Choice<Meal["cost"]>
                        label={`Whether ${m.meal || "this meal"} is included`}
                        value={m.cost}
                        options={[
                          { value: "included", label: "included" },
                          { value: "paid", label: "paid" },
                        ]}
                        onPick={(cost) => {
                          mark(id);
                          update({ meals: setRow(v.meals, i, { cost }) });
                        }}
                      />
                      {/* Only exists when there is something to charge — an
                          always-present price box on an included meal is one
                          more blank someone feels obliged to fill. */}
                      {m.cost === "paid" && (
                        <input
                          className="adm-con-flex"
                          placeholder="Rs 500 per person"
                          value={m.price}
                          aria-label={`What ${m.meal || "this meal"} costs`}
                          onChange={(e) => update({ meals: setRow(v.meals, i, { price: e.target.value }) })}
                          onBlur={() => mark(id)}
                        />
                      )}
                      <Lamp state={lamp(id)} />
                      <button
                        type="button"
                        className="adm-btn adm-btn--x"
                        aria-label={`Remove ${m.meal || "this meal"}`}
                        onClick={() => update({ meals: dropRow(v.meals, i) })}
                      >
                        ×
                      </button>
                      {err(id) && <div className="adm-con-note">{err(id)}</div>}
                    </div>
                  );
                })}
              </div>
              <p className="adm-con-hint">
                {MEALS.filter((x) => !v.meals.some((m) => m.meal === x)).map((x) => (
                  <button
                    key={x}
                    type="button"
                    className="adm-btn adm-btn--sm"
                    onClick={() =>
                      update({
                        meals: [
                          ...v.meals,
                          { meal: x, style: "", from: "", to: "", cost: "included", price: "" },
                        ],
                      })
                    }
                  >
                    + {x}
                  </button>
                ))}{" "}
                Only breakfast is served today. Lunch and dinner have a row waiting for the
                day they are.
              </p>
            </div>

            <div className="adm-con-field adm-con-wide">
              <span className="adm-con-legend">Rooms — good to know</span>
              <div className="adm-con-rows">
                {v.good.length === 0 && <p className="adm-con-empty">No points yet.</p>}
                {v.good.map((g, i) => {
                  const id = `good-${i}`;
                  return (
                    <div className="adm-con-row adm-con-row--wrap" key={id}>
                      <input
                        id={id}
                        className="adm-con-flex"
                        placeholder="Airport shuttle"
                        value={g.text}
                        aria-label={`Good-to-know point ${i + 1}`}
                        aria-describedby={described(id)}
                        onChange={(e) => update({ good: setRow(v.good, i, { text: e.target.value }) })}
                        onBlur={() => mark(id)}
                      />
                      <label className="adm-con-tick">
                        <input
                          type="checkbox"
                          checked={g.onRequest}
                          onChange={(e) => update({ good: setRow(v.good, i, { onRequest: e.target.checked }) })}
                        />
                        <span>on request</span>
                      </label>
                      {/* "Airport shuttle on request, paid" was one sentence
                          holding three separate facts. This is those three. */}
                      <Choice<GoodRow["cost"]>
                        label={`Whether ${g.text || "this"} costs anything`}
                        value={g.cost}
                        options={[
                          { value: "", label: "—" },
                          { value: "included", label: "included" },
                          { value: "paid", label: "paid" },
                        ]}
                        onPick={(cost) => update({ good: setRow(v.good, i, { cost }) })}
                      />
                      <Lamp state={lamp(id)} />
                      <button
                        type="button"
                        className="adm-btn adm-btn--x"
                        aria-label={`Remove point ${i + 1}`}
                        onClick={() => update({ good: dropRow(v.good, i) })}
                      >
                        ×
                      </button>
                      {err(id) && <div className="adm-con-note">{err(id)}</div>}
                    </div>
                  );
                })}
              </div>
              <p className="adm-con-hint">
                <button
                  type="button"
                  className="adm-btn adm-btn--sm"
                  onClick={() => update({ good: [...v.good, { text: "", onRequest: false, cost: "" }] })}
                >
                  + Add a point
                </button>{" "}
                Meal times and arrival distances write their own lines — this is for
                everything else.
              </p>
            </div>
          </div>

          <aside className="adm-con-preview">
            <h3>On the site</h3>
            <div className="adm-con-preview-body">
              <p>{composeAmenities(v.amenPicked, v.amenCustom) || "— nothing ticked —"}</p>
              <p>{composeRoomSize(smallestRoomSize(v.rooms), v.sizeUnit, v.sizeBathroom)}</p>
              <dl>
                {v.rooms
                  .filter((r) => composeSizePair(r.value, v.sizeUnit))
                  .map((r) => (
                    <div key={r.slug}>
                      <dt>{r.title}</dt>
                      <dd>{composeSizePair(r.value, v.sizeUnit)}</dd>
                    </div>
                  ))}
              </dl>
              {/* The exact array about to be stored, in order — meals, then the
                  points, then the distances — so the composition is visible
                  rather than something to trust. */}
              <ul>
                {composeGoodToKnow(v.meals, v.good, v.arrival).map((g, i) => (
                  <li key={`${g}-${i}`}>{g}</li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </fieldset>

      {/* ── EFFECTS ── */}
      <fieldset className="adm-con-panel">
        <legend>Effects</legend>
        <div className="adm-con-grid">
          <div className="adm-con-field">
            <label className="adm-con-tick">
              <input
                type="checkbox"
                checked={v.rainDay}
                onChange={(e) => update({ rainDay: e.target.checked })}
              />
              <span>Rain on glass — day</span>
            </label>
            <p className="adm-con-hint">
              Droplets on the homepage hero during the day — and only while it is actually raining in
              Kathmandu. Dry weather shows nothing either way.
            </p>
          </div>
          <div className="adm-con-field">
            <label className="adm-con-tick">
              <input
                type="checkbox"
                checked={v.rainNight}
                onChange={(e) => update({ rainNight: e.target.checked })}
              />
              <span>Rain on glass — night</span>
            </label>
            <p className="adm-con-hint">
              The same, for night, dawn and dusk. Changes take a couple of minutes to reach the site.
            </p>
          </div>
        </div>
      </fieldset>

      <div className="adm-con-bar">
        <SubmitButton type="submit" className="adm-btn adm-btn--go" pendingText="Saving…">
          Save
        </SubmitButton>
        <button
          type="button"
          className="adm-btn"
          disabled={!dirty}
          onClick={() => {
            setV(initial);
            setDismissed(state);
            setSubmitted(false);
            setTouched({});
          }}
        >
          Discard changes
        </button>
        <span
          className="adm-con-bar-state"
          data-state={problems.length ? "bad" : dirty ? "dirty" : "clean"}
          role="status"
        >
          {problems.length
            ? `${problems.length} ${problems.length === 1 ? "problem" : "problems"} — save is blocked`
            : dirty
              ? "Unsaved changes"
              : "Everything matches the live site"}
        </span>
      </div>
    </form>
  );
}
