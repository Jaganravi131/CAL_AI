import AsyncStorage from '@react-native-async-storage/async-storage'
import type { DailySummary, MealLog, MealLogItem, DailyGoals } from '@/hooks/useNutrition'

// Keys
const GOALS_KEY = 'cal_ai_goals'
const MEALS_KEY = 'cal_ai_meals'
const WATER_KEY = 'cal_ai_water'
const STEPS_KEY = 'cal_ai_steps'

const defaultGoals: DailyGoals = {
  caloriesTarget: 2200,
  proteinTargetG: 140,
  carbsTargetG: 220,
  fatTargetG: 70,
  waterTargetMl: 2500,
  stepsTarget: 8000,
}

// Seed data
const initialMeals = (): MealLog[] => {
  const today = new Date().toISOString().slice(0, 10)
  return [
    {
      id: 'meal-seed-1',
      mealType: 'breakfast',
      eatenAt: `${today}T08:30:00.000Z`,
      source: 'manual',
      calories: 420,
      protein: 28,
      carbs: 44,
      fat: 14,
      notes: 'Greek yogurt bowl with granola and berries',
    },
    {
      id: 'meal-seed-2',
      mealType: 'lunch',
      eatenAt: `${today}T13:15:00.000Z`,
      source: 'photo_ai',
      calories: 610,
      protein: 38,
      carbs: 62,
      fat: 22,
      notes: 'Chicken rice bowl with veggies',
    },
  ]
}

const initialMealItems = (mealLogId: string): MealLogItem[] => {
  if (mealLogId === 'meal-seed-1') {
    return [
      { id: 'item-seed-1', mealLogId, displayName: 'Greek yogurt', servingG: 180, calories: 160, protein: 18, carbs: 7, fat: 5 },
      { id: 'item-seed-2', mealLogId, displayName: 'Granola', servingG: 35, calories: 160, protein: 4, carbs: 22, fat: 6 },
      { id: 'item-seed-3', mealLogId, displayName: 'Banana + berries', servingG: 120, calories: 100, protein: 6, carbs: 15, fat: 3 },
    ]
  }
  if (mealLogId === 'meal-seed-2') {
    return [
      { id: 'item-seed-4', mealLogId, displayName: 'Chicken breast', servingG: 160, calories: 260, protein: 34, carbs: 0, fat: 8 },
      { id: 'item-seed-5', mealLogId, displayName: 'Steamed rice', servingG: 180, calories: 235, protein: 4, carbs: 52, fat: 1 },
      { id: 'item-seed-6', mealLogId, displayName: 'Mixed vegetables', servingG: 120, calories: 115, protein: 0, carbs: 10, fat: 13 },
    ]
  }
  return []
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getStorageData<T>(key: string, fallback: T): Promise<T> {
  try {
    const val = await AsyncStorage.getItem(key)
    return val ? JSON.parse(val) : fallback
  } catch {
    return fallback
  }
}

async function setStorageData<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data))
  } catch (err) {
    console.error('AsyncStorage error:', err)
  }
}

// Initialize seed data on first run
export async function initializeLocalStorage(): Promise<void> {
  const isInitialized = await AsyncStorage.getItem('cal_ai_initialized')
  if (!isInitialized) {
    await setStorageData(GOALS_KEY, defaultGoals)
    await setStorageData(MEALS_KEY, initialMeals())
    
    // Store individual items for seeds
    const allItems = [...initialMealItems('meal-seed-1'), ...initialMealItems('meal-seed-2')]
    await setStorageData('cal_ai_meal_items', allItems)

    const today = new Date().toISOString().slice(0, 10)
    await setStorageData(WATER_KEY, { [today]: 1200 })
    await setStorageData(STEPS_KEY, { [today]: 4300 })

    await AsyncStorage.setItem('cal_ai_initialized', 'true')
  }
}

// ── Goals ─────────────────────────────────────────────────────────────────────

export async function getLocalGoals(): Promise<DailyGoals> {
  await initializeLocalStorage()
  return getStorageData<DailyGoals>(GOALS_KEY, defaultGoals)
}

export async function saveLocalGoals(goals: DailyGoals): Promise<void> {
  await setStorageData(GOALS_KEY, goals)
}

// ── Meals ─────────────────────────────────────────────────────────────────────

export async function getLocalMeals(): Promise<MealLog[]> {
  await initializeLocalStorage()
  return getStorageData<MealLog[]>(MEALS_KEY, [])
}

export async function saveLocalMeals(meals: MealLog[]): Promise<void> {
  await setStorageData(MEALS_KEY, meals)
}

export async function getLocalMealItems(): Promise<MealLogItem[]> {
  return getStorageData<MealLogItem[]>('cal_ai_meal_items', [])
}

export async function saveLocalMealItems(items: MealLogItem[]): Promise<void> {
  await setStorageData('cal_ai_meal_items', items)
}

// Get meal logs for a specific day
export async function getLocalMealLogs(date: string): Promise<MealLog[]> {
  const meals = await getLocalMeals()
  return meals.filter((meal) => meal.eatenAt.startsWith(date))
}

// Get single meal log
export async function getLocalMealLog(id: string): Promise<MealLog | null> {
  const meals = await getLocalMeals()
  return meals.find((meal) => meal.id === id) ?? null
}

// Get items for a meal log
export async function getLocalMealLogItems(mealLogId: string): Promise<MealLogItem[]> {
  const allItems = await getLocalMealItems()
  const filtered = allItems.filter((item) => item.mealLogId === mealLogId)
  if (filtered.length === 0 && mealLogId.startsWith('meal-seed-')) {
    return initialMealItems(mealLogId)
  }
  return filtered
}

// Log a meal
export async function createLocalMealLog(input: {
  scan: {
    calories: number
    protein: number
    carbs: number
    fat: number
    title: string
    notes?: string
    confidence: number
    items: Array<{ displayName: string; servingG: number; calories: number; protein: number; carbs: number; fat: number }>
  }
  mealType: string
  source?: string
  eatenAt?: string
  notes?: string
}): Promise<{ id: string }> {
  const meals = await getLocalMeals()
  const mealItems = await getLocalMealItems()
  
  const id = `meal-${Date.now()}`
  const eatenAt = input.eatenAt ?? new Date().toISOString()
  
  const newMeal: MealLog = {
    id,
    mealType: input.mealType as any,
    eatenAt,
    source: (input.source ?? 'photo_ai') as any,
    calories: input.scan.calories,
    protein: input.scan.protein,
    carbs: input.scan.carbs,
    fat: input.scan.fat,
    notes: input.notes ?? input.scan.notes ?? input.scan.title,
  }

  const newItems: MealLogItem[] = input.scan.items.map((item, index) => ({
    id: `item-${id}-${index}`,
    mealLogId: id,
    displayName: item.displayName,
    servingG: item.servingG,
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
  }))

  await saveLocalMeals([newMeal, ...meals])
  await saveLocalMealItems([...newItems, ...mealItems])

  return { id }
}

// Delete a meal
export async function deleteLocalMealLog(id: string): Promise<void> {
  const meals = await getLocalMeals()
  const mealItems = await getLocalMealItems()

  await saveLocalMeals(meals.filter((m) => m.id !== id))
  await saveLocalMealItems(mealItems.filter((i) => i.mealLogId !== id))
}

// ── Water & Steps ─────────────────────────────────────────────────────────────

export async function getLocalWater(date: string): Promise<number> {
  await initializeLocalStorage()
  const dict = await getStorageData<Record<string, number>>(WATER_KEY, {})
  return dict[date] ?? 0
}

export async function updateLocalWater(date: string, delta: number): Promise<number> {
  await initializeLocalStorage()
  const dict = await getStorageData<Record<string, number>>(WATER_KEY, {})
  const current = dict[date] ?? 0
  const updated = Math.max(0, current + delta)
  dict[date] = updated
  await setStorageData(WATER_KEY, dict)
  return updated
}

export async function getLocalSteps(date: string): Promise<number> {
  await initializeLocalStorage()
  const dict = await getStorageData<Record<string, number>>(STEPS_KEY, {})
  return dict[date] ?? 0
}

// ── Summaries & Streak ─────────────────────────────────────────────────────────

export async function getLocalTodaySummary(date: string): Promise<DailySummary> {
  const goals = await getLocalGoals()
  const meals = await getLocalMealLogs(date)
  const water = await getLocalWater(date)
  const steps = await getLocalSteps(date)

  let caloriesConsumed = 0
  let proteinConsumed = 0
  let carbsConsumed = 0
  let fatConsumed = 0

  meals.forEach((m) => {
    caloriesConsumed += m.calories
    proteinConsumed += m.protein
    carbsConsumed += m.carbs
    fatConsumed += m.fat
  })

  return {
    date,
    caloriesGoal: goals.caloriesTarget,
    caloriesConsumed,
    proteinGoal: goals.proteinTargetG,
    proteinConsumed,
    carbsGoal: goals.carbsTargetG,
    carbsConsumed,
    fatGoal: goals.fatTargetG,
    fatConsumed,
    waterGoalMl: goals.waterTargetMl,
    waterMl: water,
    stepsGoal: goals.stepsTarget,
    steps,
  }
}

export async function getLocalWeeklySummaries(): Promise<DailySummary[]> {
  const summaries: DailySummary[] = []
  const today = new Date()

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const summary = await getLocalTodaySummary(dateStr)
    summaries.push(summary)
  }

  return summaries
}

export async function getLocalStreak(): Promise<number> {
  const meals = await getLocalMeals()
  if (meals.length === 0) return 0

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Find unique dates where calories were logged
  const loggedDates = new Set(
    meals
      .filter((m) => m.calories > 0)
      .map((m) => m.eatenAt.slice(0, 10))
  )

  // Go backwards day by day
  for (let i = 0; i < 30; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(today.getDate() - i)
    const dateStr = checkDate.toISOString().slice(0, 10)

    if (loggedDates.has(dateStr)) {
      streak++
    } else {
      // If we miss today, the streak might still be active if yesterday was logged
      if (i === 0) {
        continue
      }
      break
    }
  }

  return streak
}
