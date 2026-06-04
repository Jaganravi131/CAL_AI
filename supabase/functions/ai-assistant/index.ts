import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type AssistantRequest = { message: string }

async function callOpenAI(message: string) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return `OpenAI API key not configured.`

  const system = `You are a helpful personal nutrition assistant. Answer concisely. When appropriate, provide calorie/macros estimates, logging suggestions, and simple action steps (e.g., 'Log this meal', 'Set a goal'). Be friendly.`

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: message },
      ],
      temperature: 0.2,
      max_tokens: 500,
    }),
  })

  if (!resp.ok) return `Assistant request failed (${resp.status})`
  const payload = await resp.json()
  const content = payload?.choices?.[0]?.message?.content
  return content ?? `No response from assistant.`
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Use POST', { status: 400 })
  let body: AssistantRequest
  try {
    body = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const reply = await callOpenAI(body.message)
  return new Response(JSON.stringify({ reply }), { headers: { 'Content-Type': 'application/json' } })
})
