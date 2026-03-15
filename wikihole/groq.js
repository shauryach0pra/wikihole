/* ============================================================
   WIKIHOLE — Groq API Integration
   ============================================================ */

/**
 * GROQ API Configuration and Integration
 * 
 * This module handles all communication with the Groq AI API to generate
 * surprising connections between topics. It provides specialized functions
 * for different interaction modes in the WikiHole application.
 * 
 * The API key is stored as a Cloudflare secret for security.
 */
const GROQ = {
  // API endpoint - proxied through Cloudflare Pages Function to hide API key
url: '/wikihole/api/groq',
  // Groq model to use - Llama 3.3 70B for high-quality reasoning
  model: 'llama-3.3-70b-versatile',

  /**
   * System prompt that defines the AI's personality and response format.
   * Designed to generate surprising, non-obvious connections between topics
   * with specific formatting rules for consistency.
   */
  systemPrompt: `You are WikiHole's hidden-connections engine. Surface SURPRISING, NON-OBVIOUS connections written like a brilliant friend sharing a revelation — punchy, specific, fun.

RULES:
- Every "fact" = exactly 2 sentences. No more, no less.
- Sentence 1: State the surprising connection using ONE real specific detail (a name, number, date, or place).
- Sentence 2: Explain WHY it's connected or what makes it wild — land the punchline.
- Openers: "Plot twist:", "Turns out,", "Weirdly,", "Here's the wild part:", "Nobody mentions this but,"
- Zero vague generalisations. Every sentence must be concrete.
- Cross domains wildly — music to math, biology to ancient history, etc.
- Respond ONLY with valid JSON. No markdown, no preamble.`
};

/**
 * Internal function to make API calls to Groq
 * @param {string} userContent - The user prompt to send to the AI
 * @returns {Promise<Object>} Parsed JSON response from the AI
 * @throws {Error} If API call fails or response can't be parsed as JSON
 */
async function _call(userContent) {
  // Make the API request with proper headers and body structure
  const res = await fetch(GROQ.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
      // No API key here — handled by the Cloudflare Pages Function proxy
    },
    body: JSON.stringify({
      model: GROQ.model,
      messages: [
        { role: 'system', content: GROQ.systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.92,        // High creativity for surprising connections
      max_tokens: 1000,        // Limit response length
      response_format: { type: 'json_object' } // Force JSON response
    })
  });

  // Handle API errors with detailed error messages
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq ${res.status}: ${text.slice(0, 200)}`);
  }

  // Extract and parse the JSON response
  const data = await res.json();
  const raw = data.choices[0].message.content;

  // Try to parse JSON directly, fallback to extracting JSON object from text
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Could not parse JSON from Groq response');
  }
}

/**
 * Explore Mode: Generate initial connections for a new topic
 * 
 * Creates a central fact about the topic and 3 unexpected connections
 * that branch out from it, forming the starting point of exploration.
 * 
 * @param {string} topic - The topic to explore
 * @returns {Promise<Object>} Object with centerFact and branches array
 */
async function groqExplore(topic) {
  return _call(`Reveal 1 punchy fact about "${topic}" and 3 wildly unexpected topics it secretly connects to.

Return ONLY this JSON:
{
  "centerFact": "Exactly 2 sentences. Sentence 1: one specific surprising fact about ${topic} (real name/number/date). Sentence 2: why it matters or what makes it strange.",
  "branches": [
    {
      "topic": "Unexpected Topic Name",
      "fact": "Exactly 2 sentences. Sentence 1: the specific surprising link between this and ${topic} with one real detail. Sentence 2: the punchline that makes it click.",
      "link": "5-word punchy bridge phrase"
    },
    {
      "topic": "Another Unexpected Topic",
      "fact": "Exactly 2 sentences. Same rules — one concrete detail, one punchline.",
      "link": "5-word punchy bridge phrase"
    },
    {
      "topic": "Yet Another Unexpected Topic",
      "fact": "Exactly 2 sentences. One concrete detail, one punchline.",
      "link": "5-word punchy bridge phrase"
    }
  ]
}`);
}

/**
 * Explore Mode: Expand an existing node with more connections
 * 
 * Takes an existing topic and generates 3 new unexpected connections
 * that branch from it, allowing deeper exploration of the knowledge graph.
 * 
 * @param {string} topic - The topic to expand with new connections
 * @returns {Promise<Object>} Object with branches array of new connections
 */
async function groqExpand(topic) {
  return _call(`Branch "${topic}" into 3 wildly unexpected hidden connections. Cross-domain surprises only.

Return ONLY this JSON:
{
  "branches": [
    {
      "topic": "Unexpected Topic Name",
      "fact": "Exactly 2 sentences. Sentence 1: specific surprising link to ${topic} with one real detail (name/number/date). Sentence 2: the punchline.",
      "link": "5-word punchy bridge phrase"
    },
    {
      "topic": "Another Unexpected Topic",
      "fact": "Exactly 2 sentences. Specific and concrete.",
      "link": "5-word punchy bridge phrase"
    },
    {
      "topic": "Yet Another Unexpected Topic",
      "fact": "Exactly 2 sentences. End on something that feels like a revelation.",
      "link": "5-word punchy bridge phrase"
    }
  ]
}`);
}

/**
 * Bridge Mode: Create a chain of connections between two topics
 * 
 * Generates 4-5 stepping stones that create a surprising path
 * from the starting topic to the destination topic.
 * 
 * @param {string} from - The starting topic
 * @param {string} to - The destination topic
 * @returns {Promise<Object>} Object with path array of connected topics
 */
async function groqBridge(from, to) {
  return _call(`Find 4-5 surprising stepping stones that secretly chain "${from}" to "${to}". Each step = a plot twist.

CRITICAL: Each "fact" field must be EXACTLY 2 sentences. Stop after the second sentence. Do NOT continue.

Return ONLY this JSON:
{
  "path": [
    {
      "topic": "${from}",
      "fact": "EXACTLY 2 sentences. Sentence 1: one surprising specific fact about ${from}. Sentence 2: the hook that pulls toward the next step. STOP HERE."
    },
    {
      "topic": "Pivot Concept",
      "fact": "EXACTLY 2 sentences. Sentence 1: the specific surprising bridge. Sentence 2: why this connection is wild. STOP HERE."
    },
    {
      "topic": "Another Pivot",
      "fact": "EXACTLY 2 sentences. Keep the chain moving with a concrete detail. STOP HERE."
    },
    {
      "topic": "${to}",
      "fact": "EXACTLY 2 sentences. Sentence 1: the final surprising link. Sentence 2: the satisfying punchline that closes the chain. STOP HERE."
    }
  ]
}`);
}

/**
 * Drag Connect: Find bridge concepts between two existing nodes
 * 
 * When a user manually drags between two nodes, this function finds
 * 2 surprising bridge concepts that connect them both.
 * 
 * @param {string} topicA - First topic to connect
 * @param {string} topicB - Second topic to connect
 * @returns {Promise<Object>} Object with bridges array of connecting concepts
 */
async function groqConnect(topicA, topicB) {
  return _call(`Find 2 surprising hidden bridge concepts connecting "${topicA}" and "${topicB}".

Return ONLY this JSON:
{
  "bridges": [
    {
      "topic": "Bridge Concept",
      "fact": "Exactly 2 sentences. Sentence 1: specific link tying both topics via one real detail. Sentence 2: why it is a hidden wormhole.",
      "link": "5-word punchy bridge phrase"
    },
    {
      "topic": "Another Bridge",
      "fact": "Exactly 2 sentences. Concrete and surprising.",
      "link": "5-word punchy bridge phrase"
    }
  ]
}`);
}