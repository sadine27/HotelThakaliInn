/* Phase 4: /admin/amenities, and the two strips it now drives on /amenities.
   Needs `npm run start` on :8787 with migration 0023 applied locally.

     node scripts/rig/amenities.mjs [shots-dir]

   The save round trip is the point of most of this. A tick on the admin row is
   the only thing standing between an amenity and the highlights grid, and both
   directions are silent when wrong: a lost tick empties a section of the public
   page, and a bad little-touch symbol renders nothing at all. */

import { open, capture, replay, BASE } from "./lib.mjs";

const shots = process.argv[2];
const { page, t, report } = await open();

// ── The screen exists, is grouped, and holds every row ─────────────────────
await page.goto(`${BASE}/admin/amenities`, { waitUntil: "networkidle" });
const rows = await page.locator(".adm-row").count();
t("all 68 amenities are on one screen", rows === 68, `${rows} rows`);
const heads = await page.locator("h2.adm-group-head").allInnerTexts();
t("grouped under their categories", heads.length >= 15, `${heads.length} headings`);
t("no page of forty", (await page.locator(".adm-pager").count()) === 0);

// ── The category picker is the icon picker ─────────────────────────────────
const first = page.locator(".adm-row").first();
await first.locator("> summary").click();
const picks = first.locator('.adm-con-pick input[name="tag"]');
t("seventeen categories offered", (await picks.count()) === 17, `${await picks.count()}`);
t("each draws its own symbol",
  (await first.locator(".adm-con-pick-mark svg").count()) >= 17);
t("the row's own category is the one ticked",
  (await first.locator('.adm-con-pick input[name="tag"]:checked').count()) === 1);
t("there is no icon-path box left", (await first.locator('[name="icon"]:not([type=hidden])').count()) === 0);
t("and an escape hatch for a new one", (await first.locator('[name="tag_other"]').count()) === 1);

// ── paid is a pair of buttons, not a checkbox ──────────────────────────────
t("cost is a two-way choice", (await first.locator('input[name="paid"][type=radio]').count()) === 2);
t("exactly one of them is chosen",
  (await first.locator('input[name="paid"]:checked').count()) === 1);

// ── The two strips are ticks on the row ────────────────────────────────────
t("a highlights tick", (await first.locator('input[name="featured"]').count()) === 1);
const touch = first.locator('input[name="touch"]');
t("seven touch options — six symbols and none", (await touch.count()) === 7, `${await touch.count()}`);
if (shots) await page.screenshot({ path: `${shots}/admin-amenities.png`, fullPage: false });

// ── /admin/content no longer owns amenities ────────────────────────────────
await page.goto(`${BASE}/admin/content`, { waitUntil: "networkidle" });
const tabs = await page.locator(".adm-tabs a").allInnerTexts();
t("content screen has no amenities tab", !tabs.some((x) => /amenit/i.test(x)), tabs.join(" / "));
t("content screen keeps its own four", tabs.length === 4, tabs.join(" / "));

// ── The public page reads the ticks, not two arrays ────────────────────────
await page.goto(`${BASE}/amenities`, { waitUntil: "networkidle" });
const hi = await page.locator(".am-panel-item").count();
const tc = await page.locator(".am-touch").count();
t("the highlights grid still has its twelve", hi === 12, `${hi}`);
t("the touches row still has its six", tc === 6, `${tc}`);
t("every touch drew a symbol", (await page.locator(".am-touch-icon svg").count()) === 6);
t("the full list is still all 68", (await page.locator(".am-card").count()) === 68);

// ── Round trip: tick a row into the highlights, see it arrive, put it back ──
/* Re-navigated and re-opened rather than reusing a locator across a save: the
   row is a <details> that comes back closed and a stale handle resolves to
   something detached. Slippers is chosen because it is in neither strip. */
async function openRow(title) {
  await page.goto(`${BASE}/admin/amenities?q=${encodeURIComponent(title)}`, { waitUntil: "networkidle" });
  const r = page.locator(".adm-row").filter({ hasText: title }).first();
  await r.locator("> summary").click();
  return r;
}

let r = await openRow("Slippers");
t("search narrows the list", (await page.locator(".adm-row").count()) < 68);
t("it starts in neither strip", !(await r.locator('input[name="featured"]').isChecked()));

await r.locator('input[name="featured"]').check();
await Promise.all([
  page.waitForURL(/ok=saved/, { timeout: 15000 }),
  r.locator(".adm-item-bar button").click(),
]);
r = await openRow("Slippers");
t("the tick persisted", await r.locator('input[name="featured"]').isChecked());

await page.goto(`${BASE}/amenities`, { waitUntil: "networkidle" });
const hi2 = await page.locator(".am-panel-item").count();
t("and the public grid grew by one", hi2 === 13, `${hi2}`);
t("in position order, not appended",
  (await page.locator(".am-panel-item h3").allInnerTexts()).includes("Slippers"));

r = await openRow("Slippers");
await r.locator('input[name="featured"]').uncheck();
await Promise.all([
  page.waitForURL(/ok=saved/, { timeout: 15000 }),
  r.locator(".adm-item-bar button").click(),
]);
await page.goto(`${BASE}/amenities`, { waitUntil: "networkidle" });
t("and untick puts it back", (await page.locator(".am-panel-item").count()) === 12);

// ── Nothing else on the row was collateral ─────────────────────────────────
r = await openRow("Towels/sheets");
t("a paid row is still paid", (await r.locator('input[name="paid"]:checked').inputValue()) === "1");
r = await openRow("24-hour front desk");
t("the one row with a photo kept it",
  (await r.locator('input[name="image"]').inputValue()).includes("front-desk"));

// ── The delete refusal is in the action, not in the drawn button ───────────
r = await openRow("Slippers");
await r.locator(".adm-item-danger > summary").click();
const shot = await capture(page, "**/admin/amenities**", () =>
  r.locator(".adm-item-danger form button").click(),
);
t("captured the delete POST", Boolean(shot), shot ? `${shot.body.length} bytes` : "nothing");
if (shot) {
  const staff = await replay(shot, "staff");
  const where = JSON.stringify(staff.headers) + staff.text;
  t("a staff session is refused by the action itself", /err=perm/.test(where),
    `${staff.status} ${(staff.headers["x-action-redirect"] ?? staff.headers.location ?? "").slice(0, 60)}`);
  await page.goto(`${BASE}/admin/amenities?q=Slippers`, { waitUntil: "networkidle" });
  t("and the row is still there",
    (await page.locator(".adm-row").filter({ hasText: "Slippers" }).count()) === 1);
}

await report();
