// ¿Qué vemos? · Función "recomendar" de Supabase
// Recibe la petición del móvil, comprueba el PIN de casa y le pregunta a Claude.
// La clave de Anthropic vive en los Secrets de Supabase (ANTHROPIC_API_KEY), nunca en la web.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SYSTEM = `Eres el asistente de "¿Qué vemos?", la app con la que Oswaldo, Ana y Ángela, que viven en España, deciden qué películas y series ver.
Hablas en español de España, cercano y breve, como un amigo que sabe muchísimo de cine y series.

En cada mensaje recibes un CONTEXTO con: la fecha, quién pregunta, sus plataformas, lo que cada uno tiene en su lista, lo que ha visto, lo que ha descartado, la lista de todos con sus comentarios, y lo más visto esta semana en España.

Tu trabajo:
1. Entiende lo que piden de verdad: ánimo, con quién lo ven, tiempo disponible, lo que NO quieren, y títulos de referencia ("algo como...").
2. Propón entre 4 y 6 títulos que estén con mucha probabilidad en SUS plataformas en España ahora mismo. La app comprobará la disponibilidad real después.
3. Usa sus gustos: si a quien pregunta (o a quien lo va a ver con él) le gustó algo parecido, dilo en el motivo. Si algo está en la lista de otro, puedes sugerirlo diciendo que a esa persona también le apetece.
4. Nunca propongas lo que quien pregunta ya ha visto o ha descartado. No repitas lo que ya propusiste en esta conversación salvo que lo pidan.
5. Mezcla algo conocido con alguna joya menos obvia. Si piden un título concreto, ponlo el primero.
6. Si el mensaje no va de ver algo, contesta breve y propón 3 ideas para esa noche.

Responde SOLO con un objeto JSON, sin texto alrededor, con esta forma exacta:
{"reply":"1 o 2 frases con tu propuesta, en tono cercano","picks":[{"title":"título como se conoce en España","original_title":"título original","year":2021,"type":"movie","why":"motivo concreto, máximo 18 palabras"}]}
"type" es "movie" para películas y "tv" para series.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const { pin, messages = [], context = "" } = await req.json();
    if (!Array.isArray(messages) || !messages.length) return json({ error: "messages" }, 400);

    // 1) PIN de casa
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ok = await fetch(`${url}/rest/v1/rpc/qv_login`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_pin: String(pin || "") }),
    }).then((r) => r.json()).catch(() => false);
    if (ok !== true) return json({ error: "pin" }, 401);

    // 2) Claude
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "nokey" }, 500);
    const model = Deno.env.get("CLAUDE_MODEL") || "claude-sonnet-5-5";
    const turns = messages.slice(-10).map((m: { role: string; text: string }) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.text || "").slice(0, 3000),
    }));
    // El contexto va delante del último mensaje del usuario
    const last = turns[turns.length - 1];
    last.content = "CONTEXTO (no lo repitas):\n" + String(context).slice(0, 40000) + "\n\nMENSAJE:\n" + last.content;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 1500, system: SYSTEM, messages: turns }),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: "claude", detail: data?.error?.message || r.status }, 502);
    const text = (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    let out;
    try { out = JSON.parse(text); }
    catch { const m = text.match(/\{[\s\S]*\}/); try { out = m ? JSON.parse(m[0]) : null; } catch { out = null; } }
    if (!out) out = { reply: text, picks: [] };
    if (!Array.isArray(out.picks)) out.picks = [];
    return json({ reply: String(out.reply || ""), picks: out.picks.slice(0, 8) });
  } catch (e) {
    return json({ error: "server", detail: String(e) }, 500);
  }
});
