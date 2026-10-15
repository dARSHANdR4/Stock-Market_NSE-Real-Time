/**
 * Cloudflare Pages Function: GET /api/stock?stock=RELIANCE&date=2026-10-13&range=15
 * Proxies the public Apps Script Web App server-side to avoid browser CORS errors.
 */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyGpZiiGaLuUccN6Y0wUIZqb56D5WXSzyu5k3_dCb04sdWplRBwNG_mkQEgd8CU42JY_A/exec";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  }
});

export async function onRequestGet({ request }) {
  const incoming = new URL(request.url);
  const stock = (incoming.searchParams.get("stock") || "").trim().toUpperCase();
  const date = incoming.searchParams.get("date") || "";
  const range = Number.parseInt(incoming.searchParams.get("range") || "15", 10);

  if (!/^[A-Z0-9.&_-]{1,30}$/.test(stock)) {
    return json({ error: "Enter a valid NSE stock symbol." }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return json({ error: "Enter a valid target date in YYYY-MM-DD format." }, 400);
  }
  if (![15, 90, 180].includes(range)) {
    return json({ error: "Unsupported chart range. Choose 15, 90, or 180 days." }, 400);
  }

  const upstreamUrl = new URL(APPS_SCRIPT_URL);
  upstreamUrl.searchParams.set("action", "getStockData");
  upstreamUrl.searchParams.set("stock", stock);
  upstreamUrl.searchParams.set("date", date);
  upstreamUrl.searchParams.set("range", String(range));

  let upstream;
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      method: "GET",
      redirect: "follow",
      headers: { "accept": "application/json" }
    });
  } catch {
    return json({ error: "Could not connect to the Google Apps Script market-data service." }, 502);
  }

  const raw = await upstream.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return json({
      error: "Google Apps Script did not return JSON. Check that its Web App deployment is accessible to anyone with the link."
    }, 502);
  }

  if (!upstream.ok) {
    return json({ error: data?.error || `Google Apps Script returned HTTP ${upstream.status}.` }, 502);
  }
  if (data?.error) return json({ error: data.error }, 502);
  if (!data?.stock || !Array.isArray(data?.history)) {
    return json({ error: "Google Apps Script returned an unexpected data format." }, 502);
  }
  return json(data);
}
