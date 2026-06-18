import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { word } = await req.json();
    if (!word) {
      return new Response(JSON.stringify({ error: "word is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    const prompt = `日本語の単語「${word}」について調べてください。
以下の形式のJSONだけを返してください。前後に説明や\`\`\`などのコードブロック記号は付けないこと。

{"reading": "ひらがなのよみがな。よみがなが分からない場合や、もともとひらがな・カタカナ・外来語などでよみがなを付ける必要がない場合は空文字\"\"", "meaning": "辞書のように簡潔な1〜2文の意味の説明"}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rawText) throw new Error("no response: " + JSON.stringify(data));

    // Geminiが ```json ... ``` のようにコードブロックで返してくることがあるので除去してからパース
    const cleaned = rawText.replace(/^```json\s*|^```\s*|```$/g, "").trim();

    let reading = "";
    let meaning = "";
    try {
      const parsed = JSON.parse(cleaned);
      reading = typeof parsed.reading === "string" ? parsed.reading.trim() : "";
      meaning = typeof parsed.meaning === "string" ? parsed.meaning.trim() : "";
    } catch {
      // JSONとして解釈できなかった場合は、意味の説明文だけが返ってきたものとして扱う
      meaning = cleaned;
    }
    if (!meaning) throw new Error("no meaning in response: " + rawText);

    return new Response(JSON.stringify({ meaning, reading }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});