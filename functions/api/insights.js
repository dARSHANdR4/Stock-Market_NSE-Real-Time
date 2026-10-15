export async function onRequestPost({ request, env }) {
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });

  if (!env.GROQ_API_KEY) {
    return json({ error: "AI service is not configured: set the GROQ_API_KEY secret in Cloudflare Pages." }, 503);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid JSON request." }, 400);
  }

  const stock = String(input?.stock || "").trim().slice(0, 40);
  const history = Array.isArray(input?.history) ? input.history.slice(-250) : [];
  if (!stock || history.length < 2) {
    return json({ error: "Provide a stock symbol and at least two historical data points." }, 400);
  }

  const clean = history.map((point) => ({
    date: String(point?.x || "").slice(0, 10),
    open: Number(point?.o),
    high: Number(point?.h),
    low: Number(point?.l),
    close: Number(point?.c)
  })).filter((p) =>
    p.date && Number.isFinite(p.close) && Number.isFinite(p.high) && Number.isFinite(p.low)
  );

  if (clean.length < 2) {
    return json({ error: "Historical data did not contain enough valid price points." }, 400);
  }

  const first = clean[0];
  const last = clean[clean.length - 1];
  const change = first.close ? ((last.close - first.close) / first.close * 100).toFixed(2) : "N/A";
  const highest = Math.max(...clean.map((p) => p.high));
  const lowest = Math.min(...clean.map((p) => p.low));

  const prompt = [
    `Stock: NSE:${stock}`,
    `Period: ${first.date} to ${last.date}`,
    `First close: ₹${first.close}`,
    `Last close: ₹${last.close}`,
    `Change across supplied period: ${change}%`,
    `Highest supplied high: ₹${highest}`,
    `Lowest supplied low: ₹${lowest}`,
    "Daily OHLC data (oldest first):",
    JSON.stringify(clean),
    "",
    "Analyze only the supplied historical price data. Do not claim to have checked news or external information. State uncertainty and avoid presenting this as personalized financial advice."
  ].join("\n");

  const model = String(env.GROQ_MODEL || "openai/gpt-oss-120b").trim();
  let upstream;
  try {
    upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content: "You are a careful market-data analyst. Give exactly four numbered points, about 150-170 words total, describing the supplied historical price action, trend, volatility, and limitations. Do not invent news, fundamentals, or events. End with a final line containing exactly one of these labels: BULLISH, BEARISH, NEUTRAL. This is educational information, not investment advice."
          },
          { role: "user", content: prompt }
        ]
      })
    });
  } catch {
    return json({ error: "Could not connect to the Groq API. Please try again later." }, 502);
  }

  const responseBody = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const message = responseBody?.error?.message || "Groq rejected the request.";
    const status = upstream.status === 429 ? 429 : (upstream.status === 401 ? 502 : 502);
    return json({ error: `Groq API error (${upstream.status}): ${message}` }, status);
  }

  const result = responseBody?.choices?.[0]?.message?.content;
  if (typeof result !== "string" || !result.trim()) {
    return json({ error: "Groq returned an empty response." }, 502);
  }

  return json({ model, insights: result.trim() });
}
