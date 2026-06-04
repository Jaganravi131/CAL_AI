import type { DailySummary } from '@/hooks/useNutrition'

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? ''
const GROQ_MODEL = 'llama-3.3-70b-versatile'

export async function sendAssistantMessage(payload: {
  message: string
  summary?: DailySummary
  history?: Array<{ author: 'user' | 'assistant'; text: string }>
  locale?: string
}) {
  try {
    const localeNames: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      hi: 'Hindi',
    }
    const targetLanguage = localeNames[payload.locale ?? 'en'] ?? 'English'

    const messages = [
      {
        role: 'system',
        content: `You are Cal AI Coach, a supportive, motivating, and professional personal nutritionist and fitness coach.
You help users log food, analyze their macros, and offer fat loss, muscle building, and hydration advice.

You must respond, explain, and translate all your advice precisely in the following language: ${targetLanguage}.

Current user stats for today:
- Calories Consumed: ${payload.summary?.caloriesConsumed ?? 0} kcal (Goal: ${payload.summary?.caloriesGoal ?? 2200} kcal)
- Protein Consumed: ${payload.summary?.proteinConsumed ?? 0}g (Goal: ${payload.summary?.proteinGoal ?? 140}g)
- Carbs Consumed: ${payload.summary?.carbsConsumed ?? 0}g (Goal: ${payload.summary?.carbsGoal ?? 220}g)
- Fat Consumed: ${payload.summary?.fatConsumed ?? 0}g (Goal: ${payload.summary?.fatGoal ?? 70}g)
- Water Logged: ${payload.summary?.waterMl ?? 0}ml (Goal: ${payload.summary?.waterGoalMl ?? 2500}ml)

Respond in a conversational, supportive, and concise manner in ${targetLanguage}. Keep responses short (under 3 sentences) so they are easy to read and play aloud. Always refer to their actual calorie/macro balances today to give personalized advice.`,
      },
    ]

    // Feed conversation history
    if (payload.history) {
      payload.history.slice(-6).forEach((h) => {
        messages.push({
          role: h.author === 'user' ? 'user' : 'assistant',
          content: h.text,
        })
      });
    }

    // Append current user message
    messages.push({
      role: 'user',
      content: payload.message,
    })

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 250,
      }),
    })

    if (!res.ok) {
      throw new Error(`Groq request failed: ${res.status}`)
    }

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content ?? 'I could not process that request.'
    return { reply }
  } catch (err) {
    console.error('Groq Assistant Error:', err)
    return { reply: 'Sorry, I am having trouble connecting to my brain right now.' }
  }
}

export type AssistantResponse = { reply: string }
