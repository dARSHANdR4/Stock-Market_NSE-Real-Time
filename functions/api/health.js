export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, service: "stockpulse-api" }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
