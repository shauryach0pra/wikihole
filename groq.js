/* ============================================================
   WIKIHOLE — Groq API Integration (via Cloudflare Worker proxy)
   Safe to open-source — no API key lives here.
   ============================================================ */

const GROQ = {
  // ← Replace with your deployed Worker URL after `wrangler deploy`
  url: 'https://wikihole-api.shaurya-chopra.workers.dev',
  model: 'llama-3.3-70b-versatile',

  systemPrompt: `You are WikiHole's hidden-connections engine. Surface SURPRISING, NON-OBVIOUS connections written like a brilliant friend sharing a revelation — punchy, specific, fun.

RULES:
- Every "fact" = exactly 2 sentences. No more, no less.
- Sentence 1: State the surprising connection using ONE real specific detail (a name, number or date).
- Sentence 2: Explain WHY it's connected or what makes it wild — land the punchline.
- Openers: "Plot twist:", "Turns out,", "Weirdly,", "Here's the wild part:", "Nobody mentions this but,"
- Zero vague generalisations. Every sentence must be concrete.
- Cross domains wildly — music to math, biology to ancient history, etc.
- Respond ONLY with valid JSON. No markdown, no preamble.`
};

async function _call(userContent) {
  const res = await fetch(GROQ.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // No Authorization header — the Worker injects the key
    },
    body: JSON.stringify({
      model: GROQ.model,
      messages: [
        { role: 'system', content: GROQ.systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.92,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Proxy ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data.choices[0].message.content;

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Invalid JSON from API');
    return JSON.parse(match[0]);
  }
}

/* ── Explore Mode: seed a topic ─────────────────────────── */
async function groqExplore(topic) {
  return _call(`Reveal 1 punchy fact about "${topic}" and 3 wildly unexpected topics it secretly connects to.

Return JSON:
{
  "centerFact": "2-sentence punchy fact about the topic",
  "branches": [
    {"topic": "topic1", "fact": "2-sentence connection", "link": "optional-wiki-link"},
    {"topic": "topic2", "fact": "2-sentence connection", "link": "optional-wiki-link"},
    {"topic": "topic3", "fact": "2-sentence connection", "link": "optional-wiki-link"}
  ]
}`);
}

/* ── Explore Mode: expand existing node ─────────────────── */
async function groqExpand(topic) {
  return _call(`Branch "${topic}" into 3 wildly unexpected hidden connections. Cross-domain surprises only.

Return JSON:
{
  "branches": [
    {"topic": "topic1", "fact": "2-sentence connection", "link": "optional-wiki-link"},
    {"topic": "topic2", "fact": "2-sentence connection", "link": "optional-wiki-link"},
    {"topic": "topic3", "fact": "2-sentence connection", "link": "optional-wiki-link"}
  ]
}`);
}

/* ── Bridge Mode: chain two topics ──────────────────────── */
async function groqBridge(from, to) {
  return _call(`Build a full chain from "${from}" to "${to}". The path MUST start with "${from}" as the first node and end with "${to}" as the last node. Fill the middle with 3-4 surprising stepping stones — each a plot twist.

Return JSON:
{
  "path": [
    {"topic": "${from}", "fact": "2-sentence punchy fact about ${from}", "link": "optional-wiki-link"},
    {"topic": "stepping stone 1", "fact": "2-sentence connection", "link": "optional-wiki-link"},
    {"topic": "stepping stone 2", "fact": "2-sentence connection", "link": "optional-wiki-link"},
    {"topic": "stepping stone 3", "fact": "2-sentence connection", "link": "optional-wiki-link"},
    {"topic": "${to}", "fact": "2-sentence punchy fact about ${to}", "link": "optional-wiki-link"}
  ]
}`);
}

/* ── Drag Connect: link two existing nodes ───────────────── */
async function groqConnect(topicA, topicB) {
  return _call(`Find 2 surprising hidden bridge concepts connecting "${topicA}" and "${topicB}".

Return JSON:
{
  "bridges": [
    {"topic": "bridge1", "fact": "2-sentence connection", "link": "optional-wiki-link"},
    {"topic": "bridge2", "fact": "2-sentence connection", "link": "optional-wiki-link"}
  ]
}`);
}