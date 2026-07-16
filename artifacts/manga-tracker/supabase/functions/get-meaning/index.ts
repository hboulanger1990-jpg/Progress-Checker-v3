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
    const { word, reading } = await req.json();
    if (!word) {
      return new Response(JSON.stringify({ error: "word is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");

    // 呼び出し側（フォーム）にすでに読みが入力されていれば、それをヒントとして渡す。
    // 読みを渡すことで、表記や音が似た別語（例：「いぎたない」→「いたしかたない」）への
    // 取り違えを減らす狙い。
    const readingHint = reading
      ? `\nこの単語の読みは「${reading}」です。読みも手がかりにして、表記・読みの両方が一致する語義だけを探してください。`
      : "";

    const prompt = `日本語の単語「${word}」について調べてください。${readingHint}

重要な注意点：
- 「${word}」という表記・送り仮名を一字一句そのまま扱ってください。表記や音が似ている別の単語に言い換えたり、誤字だと推測して別の単語として解釈したりしないでください（例：「いぎたない」を「いたしかたない」のような別語として扱うのは禁止）。
- 「${word}」に確信を持って一致する語義が見つかった場合のみ回答してください。少しでも別語の可能性があると感じた場合は、無理に答えを作らないでください。
- よみがなも、送り仮名を含めて正確に答えてください（例：「気振り」なら「きぶり」であり「きぶれ」ではない、のように一字ずつ確認すること）。
- 該当する語が見つからない・確信が持てない場合は、matchedをfalseにし、reading・meaningは空文字""にしてください。

以下の形式のJSONだけを返してください。前後に説明や\`\`\`などのコードブロック記号は付けないこと。

{"matched": true または false（「${word}」という表記に確信を持って一致する語義が見つかったか）, "reading": "ひらがなのよみがな。よみがなが不要、または分からない場合は空文字\"\"", "meaning": "辞書のように簡潔な1〜2文の意味の説明。matchedがfalseの場合は空文字\"\""}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // 低めのtemperatureで「取得のたびに全く違う意味が返る」ブレを抑える。
          // 0にはせず、複数の語義がある単語では多少の揺らぎを許容する。
          generationConfig: { temperature: 0.25 },
        }),
      }
    );

    if (res.status === 429) {
      return new Response(
        JSON.stringify({ error: "rate_limited", message: "AIの利用が混み合っています。1分ほど待ってからもう一度お試しください。" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rawText) throw new Error("no response: " + JSON.stringify(data));

    // Geminiが ```json ... ``` のようにコードブロックで返してくることがあるので除去してからパース
    // また、Thinking機能の思考ブロック（THOUGHT:〜で始まる行）が漏れてくることがあるので除去する
    const cleaned = rawText
      .replace(/^```json\s*|^```\s*|```$/gm, "")
      .replace(/THOUGHT:[\s\S]*?(?=\{)/i, "")
      .trim();

    let matched = true;
    let reading_ = "";
    let meaning = "";
    try {
      const parsed = JSON.parse(cleaned);
      matched = typeof parsed.matched === "boolean" ? parsed.matched : true;
      reading_ = typeof parsed.reading === "string" ? parsed.reading.trim() : "";
      meaning = typeof parsed.meaning === "string" ? parsed.meaning.trim() : "";
    } catch {
      // JSONとして解釈できなかった場合は、意味の説明文だけが返ってきたものとして扱う
      meaning = cleaned;
    }
    if (!matched || !meaning) throw new Error("no matching meaning in response: " + rawText);

    return new Response(JSON.stringify({ meaning, reading: reading_ }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});