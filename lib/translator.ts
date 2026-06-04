const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? ''
const GROQ_MODEL = 'llama-3.3-70b-versatile'

export async function translateText(text: string, targetLocale: string): Promise<string> {
  if (!text || targetLocale === 'en') return text
  try {
    const localeNames: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      hi: 'Hindi',
    }
    const targetLanguage = localeNames[targetLocale] ?? 'English'

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are an expert translator. Translate the user text precisely to ${targetLanguage}. Keep formatting, paragraphs, bullet points, numbers, and carriage returns exactly as is. Only return the translated text, with no extra conversational comments, markdown wrappers, or introduction.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.1,
      })
    })

    if (!response.ok) {
      throw new Error(`Translation status: ${response.status}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content?.trim() ?? text
  } catch (error) {
    console.error('Translation error via Groq:', error)
    return text
  }
}
