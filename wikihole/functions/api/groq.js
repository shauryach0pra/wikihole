/**
 * Cloudflare Pages Function - Groq API Proxy
 * 
 * This function acts as a secure proxy between the frontend and Groq API.
 * It handles CORS headers and keeps the API key secure in environment variables.
 * 
 * Environment variables required:
 * - GROQ_API_KEY: Your Groq API key (stored in Cloudflare secrets)
 */

/**
 * Handle POST requests to the Groq API
 * @param {Object} context - Cloudflare context containing request and environment
 * @returns {Promise<Response>} Response with Groq API data or error
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers to allow frontend to access this API from any domain
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    // Parse the request body from frontend
    const body = await request.json();

    // Forward the request to Groq API with secure API key
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // API key lives in Cloudflare env secrets — never in your code
        'Authorization': `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    // Handle Groq API errors and forward them to frontend
    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: err }), {
        status: response.status,
        headers: corsHeaders,
      });
    }

    // Parse Groq response and forward to frontend
    const data = await response.json();
    return new Response(JSON.stringify(data), { headers: corsHeaders });

  // Handle unexpected errors (network issues, malformed JSON, etc.)
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * Handle CORS preflight OPTIONS requests
 * Required for browsers to allow cross-origin requests
 * @returns {Promise<Response>} Empty response with CORS headers
 */
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
