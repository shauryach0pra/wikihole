export async function onRequestPost(context) {
  const { request, env } = context;

  // Allow CORS for your domain
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = await request.json();

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // API key lives in Cloudflare env secrets — never in your code
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: err }), {
        status: response.status,
        headers: corsHeaders,
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), { headers: corsHeaders });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

// Handle preflight OPTIONS
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
