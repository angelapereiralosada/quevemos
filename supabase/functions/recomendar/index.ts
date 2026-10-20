// ¿Qué vemos? · Función "recomendar" de Supabase
// Recibe la conversación del móvil, comprueba el PIN de casa y le pregunta a una IA.
// Usa Gemini (gratis, secreto GEMINI_API_KEY) o Claude (de pago, secreto ANTHROPIC_API_KEY), el que esté puesto.
// Las instrucciones de cómo debe hablar vienen de la app (campo "system"), así se pueden
// mejorar sin volver a desplegar esta función. Las claves viven en los Secrets de Supabase.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const DEFAULT_SYSTEM = `Eres el dependiente del videoclub "¿Qué vemos?", la app con la que Oswaldo, Ana y Ángela (España) deciden qué ver.
Hablas en español de España, cercano y natural. Recomiendas poco y bien.
Responde SOLO con JSON: {"reply":"texto","picks":[{"title":"","original_title":"","year":2020,"type":"movie|tv","why":""}],"quick":["respuestas cortas"]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const { pin, messages = [], context = "", system = "" } = await req.json();
    if (!Array.isArray(messages) || !messages.length) return json({ error: "messages" }, 400);

    // 1) PIN de casa
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const hd: Record<string, string> = { apikey: anon, "Content-Type": "application/json" };
    if (anon.startsWith("eyJ")) hd.Authorization = `Bearer ${anon}`;
    const ok = await fetch(`${url}/rest/v1/rpc/qv_login`, { method: "POST", headers: hd, body: JSON.stringify({ p_pin: String(pin || "") }) })
      .then((r) => r.json()).catch(() => false);
    if (ok !== true) return json({ error: "pin" }, 401);

    // 2) Conversación: el contexto va como primer mensaje, luego el historial
    const SYSTEM = String(system || DEFAULT_SYSTEM).slice(0, 12000);
    const turns: { role: string; content: string }[] = [
      { role: "user", content: "CONTEXTO DE LA CASA (no lo repitas, úsalo):\n" + String(context).slice(0, 40000) },
      { role: "assistant", content: '{"reply":"Entendido, tengo el contexto.","picks":[],"quick":[]}' },
      ...messages.slice(-16).map((m: { role: string; text: string }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.text || "").slice(0, 4000),
      })),
    ];

    let text = "";
    const gkey = Deno.env.get("GEMINI_API_KEY"), akey = Deno.env.get("ANTHROPIC_API_KEY");
    if (gkey) {
      const model = Deno.env.get("GEMINI_MODEL") || "gemini-flash-latest";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": gkey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
          generationConfig: { responseMimeType: "application/json", temperature: 0.9, maxOutputTokens: 4096 },
        }),
      });
      const data = await r.json();
      if (!r.ok) return json({ error: "ai", detail: data?.error?.message || r.status }, 502);
      text = (data?.candidates?.[0]?.content?.parts || []).filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || "").join("");
    } else if (akey) {
      const model = Deno.env.get("CLAUDE_MODEL") || "claude-sonnet-5-5";
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": akey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 2000, system: SYSTEM, messages: turns }),
      });
      const data = await r.json();
      if (!r.ok) return json({ error: "ai", detail: data?.error?.message || r.status }, 502);
      text = (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    } else return json({ error: "nokey" }, 500);

    let out;
    try { out = JSON.parse(text); }
    catch { const m = text.match(/\{[\s\S]*\}/); try { out = m ? JSON.parse(m[0]) : null; } catch { out = null; } }
    if (!out) out = { reply: text, picks: [] };
    if (!Array.isArray(out.picks)) out.picks = [];
    if (!Array.isArray(out.quick)) out.quick = [];
    return json({ reply: String(out.reply || ""), picks: out.picks.slice(0, 8), quick: out.quick.slice(0, 4).map(String) });
  } catch (e) {
    return json({ error: "server", detail: String(e) }, 500);
  }
});
