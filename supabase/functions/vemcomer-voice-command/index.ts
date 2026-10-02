import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const has = (text: string, words: string[]) => words.some((word) => text.includes(word));

function classify(transcript: string) {
  const text = normalize(transcript);

  if (has(text, ["estoque", "dar entrada", "lancar estoque", "adicionar estoque"])) return "add_stock";
  if (has(text, ["adicionar prato", "criar prato", "novo item", "novo produto"])) return "create_menu_item";
  if (has(text, ["abrir administracao", "abrir admin", "painel administrativo"])) return "open_admin";
  if (has(text, ["fazer pedido", "quero pedir", "meu pedido"])) return "create_order";
  if (has(text, ["buscar", "procurar", "encontrar"])) return "search_products";
  return "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });
  }

  try {
    const body = await req.json();
    const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
    if (!transcript) {
      return new Response(JSON.stringify({ error: "transcript_required" }), { status: 400, headers });
    }

    const intent = classify(transcript);
    return new Response(JSON.stringify({
      version: "1.0",
      intent,
      confidence: intent === "unknown" ? 0 : 0.8,
      requires_confirmation: intent !== "unknown",
      fields: { raw_text: transcript, source: "voice" },
    }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers });
  }
});
