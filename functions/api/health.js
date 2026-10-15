/** Simple deployment check: GET /api/health */
export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, service: "stockpulse-api" }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
