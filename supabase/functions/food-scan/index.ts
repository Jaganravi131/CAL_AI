import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

type ScanItem = {
  displayName: string
  servingG: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

type FoodScanResult = {
  mealType: MealType
  title: string
  notes: string
  confidence: number
  calories: number
  protein: number
  carbs: number
  fat: number
  items: ScanItem[]
}

const DEMO_RESULTS: Record<MealType, FoodScanResult> = {
  breakfast: {
    mealType: 'breakfast',
    title: 'Yogurt bowl',
    notes: 'Fallback scan. Configure OPENAI_API_KEY to enable real food recognition.',
    confidence: 0.82,
    calories: 420,
    protein: 28,
    carbs: 45,
    fat: 14,
    items: [
      { displayName: 'Greek yogurt', servingG: 180, calories: 160, protein: 18, carbs: 7, fat: 5 },
      { displayName: 'Granola', servingG: 35, calories: 160, protein: 4, carbs: 22, fat: 6 },
      { displayName: 'Fruit', servingG: 120, calories: 100, protein: 1, carbs: 16, fat: 0.5 },
    ],
  },
  lunch: {
    mealType: 'lunch',
    title: 'Chicken rice bowl',
    notes: 'Fallback scan. Configure OPENAI_API_KEY to enable real food recognition.',
    confidence: 0.86,
    calories: 610,
    protein: 42,
    carbs: 58,
    fat: 22,
    items: [
      { displayName: 'Chicken breast', servingG: 160, calories: 260, protein: 38, carbs: 0, fat: 8 },
      { displayName: 'Steamed rice', servingG: 180, calories: 235, protein: 4, carbs: 52, fat: 1 },
      { displayName: 'Vegetables + sauce', servingG: 120, calories: 115, protein: 0, carbs: 6, fat: 13 },
    ],
  },
  dinner: {
    mealType: 'dinner',
    title: 'Salmon plate',
    notes: 'Fallback scan. Configure OPENAI_API_KEY to enable real food recognition.',
    confidence: 0.8,
    calories: 680,
    protein: 39,
    carbs: 46,
    fat: 34,
    items: [
      { displayName: 'Salmon', servingG: 170, calories: 350, protein: 34, carbs: 0, fat: 22 },
      { displayName: 'Potatoes', servingG: 180, calories: 210, protein: 4, carbs: 35, fat: 6 },
      { displayName: 'Greens', servingG: 90, calories: 120, protein: 1, carbs: 11, fat: 6 },
    ],
  },
  snack: {
    mealType: 'snack',
    title: 'Protein snack',
    notes: 'Fallback scan. Configure OPENAI_API_KEY to enable real food recognition.',
    confidence: 0.78,
    calories: 280,
    protein: 24,
    carbs: 21,
    fat: 8,
    items: [
      { displayName: 'Protein shake', servingG: 300, calories: 180, protein: 24, carbs: 6, fat: 4 },
      { displayName: 'Apple', servingG: 140, calories: 100, protein: 0, carbs: 15, fat: 0 },
    ],
  },
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  })
}

function fallback(mealType: MealType) {
  return new Response(JSON.stringify(DEMO_RESULTS[mealType]), {
    headers: { 'Content-Type': 'application/json' },
  })
}

async function openAiScan(imageBytes: Uint8Array, mealType: MealType) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return DEMO_RESULTS[mealType]

  const base64 = btoa(String.fromCharCode(...imageBytes))
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You estimate food nutrition from a meal photo. Return JSON only with keys mealType,title,notes,confidence,calories,protein,carbs,fat,items. items is an array of {displayName,servingG,calories,protein,carbs,fat}. Keep values realistic and consistent.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Analyze this ${mealType} meal photo.` },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    return DEMO_RESULTS[mealType]
  }

  const payload = await response.json()
  const content = payload?.choices?.[0]?.message?.content
  if (!content) return DEMO_RESULTS[mealType]

  try {
    const parsed = JSON.parse(content)
    return {
      mealType: (parsed.mealType ?? mealType) as MealType,
      title: String(parsed.title ?? 'Meal scan'),
      notes: String(parsed.notes ?? ''),
      confidence: Number(parsed.confidence ?? 0.8),
      calories: Number(parsed.calories ?? 0),
      protein: Number(parsed.protein ?? 0),
      carbs: Number(parsed.carbs ?? 0),
      fat: Number(parsed.fat ?? 0),
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item: Record<string, unknown>) => ({
            displayName: String(item.displayName ?? 'Food item'),
            servingG: Number(item.servingG ?? 100),
            calories: Number(item.calories ?? 0),
            protein: Number(item.protein ?? 0),
            carbs: Number(item.carbs ?? 0),
            fat: Number(item.fat ?? 0),
          }))
        : [],
    }
  } catch {
    return DEMO_RESULTS[mealType]
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return badRequest('Use POST')
  }

  const formData = await req.formData().catch(() => null)
  if (!formData) return badRequest('Expected multipart form data')

  const mealType = String(formData.get('meal_type') ?? 'lunch') as MealType
  const image = formData.get('image')

  if (!image || !(image instanceof File)) {
    return badRequest('Missing image file')
  }

  const bytes = new Uint8Array(await image.arrayBuffer())
  const result = await openAiScan(bytes, mealType)

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
})