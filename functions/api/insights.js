/**
 * Cloudflare Pages Function: POST /api/insights
 * Required secret: GROQ_API_KEY
 * Optional variable: GROQ_MODEL (defaults to openai/gpt-oss-120b)
 */
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

export async function onRequestPost({ request, env }) {
  if (!env.GROQ_API_KEY) return json({ error: "AI service is not configured on the server." }, 503);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Request body must be valid JSON." }, 400); }

  const stock = String(body?.stockName ?? "").trim().toUpperCase();
  const history = Array.isArray(body?.history) ? body.history : [];
  if (!/^[A-Z0-9.&_-]{1,30}$/.test(stock)) return json({ error: "Enter a valid NSE stock symbol." }, 400);
  if (!history.length || history.length > 500) return json({ error: "Historical data is missing or exceeds the allowed size." }, 400);

  const points = history.filter(p => Number.isFinite(Number(p?.c)) && Number.isFinite(Number(p?.h)) && Number.isFinite(Number(p?.l)) && typeof p?.x === "string");
  if (!points.length) return json({ error: "No valid historical price points were provided." }, 400);
  const first = points[0], last = points[points.length - 1];
  const change = Number(first.c) ? ((Number(last.c) - Number(first.c)) / Number(first.c) * 100).toFixed(2) : "N/A";
  const context = `\nHistorical data supplied by the application (not live news):\n- First point (${first.x}): close ₹${first.c}\n- Last point (${last.x}): close ₹${last.c}\n- Net change: ${change}%\n- Highest observed high: ₹${Math.max(...points.map(p => Number(p.h)))}\n- Lowest observed low: ₹${Math.min(...points.map(p => Number(p.l)))}\n- Observations: ${points.length}`;

  let upstream;
  try {
    upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: env.GROQ_MODEL || "openai/gpt-oss-120b",
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          { role: "system", content: "You are a cautious financial-analysis assistant. Use only the supplied historical price data; do not invent news, fundamentals, or live market facts. Provide exactly four numbered, concise analytical points covering trend, momentum, range/risk, and limitations. On the final line output exactly one of: BULLISH, BEARISH, NEUTRAL. State that this is educational analysis, not investment advice." },
          { role: "user", content: `Analyze ${stock} from the supplied observations.${context}` }
        ]
      })
    });
  } catch {
    return json({ error: "Could not connect to the AI provider. Please try again later." }, 502);
  }

  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const providerMessage = payload?.error?.message || `Groq returned HTTP ${upstream.status}.`;
    const safeMessage = upstream.status === 401 ? "AI credentials were rejected. Check the server-side GROQ_API_KEY." :
      upstream.status === 404 ? "The configured Groq model is unavailable. Check GROQ_MODEL against the models enabled for your account." :
      upstream.status === 429 ? "The AI provider rate limit was reached. Please try again shortly." : providerMessage;
    return json({ error: safeMessage, providerStatus: upstream.status }, upstream.status === 429 ? 429 : 502);
  }

  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) return json({ error: "The AI provider returned an empty response." }, 502);
  return json({ text });
}
