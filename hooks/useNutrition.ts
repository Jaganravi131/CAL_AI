import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseEnabled } from '@/lib/supabase'
import type { FoodScanResult } from '@/lib/foodScan'
import {
  getLocalTodaySummary,
  getLocalMealLogs,
  getLocalMealLog,
  getLocalMealLogItems,
  createLocalMealLog,
  deleteLocalMealLog,
  getLocalWeeklySummaries,
  getLocalStreak,
  getLocalGoals,
  saveLocalGoals,
  updateLocalWater,
} from '@/lib/localStorage'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type ScanSource = 'photo_ai' | 'barcode' | 'nutrition_label' | 'manual'

export interface DailySummary {
  date: string
  caloriesGoal: number
  caloriesConsumed: number
  proteinGoal: number
  proteinConsumed: number
  carbsGoal: number
  carbsConsumed: number
  fatGoal: number
  fatConsumed: number
  waterGoalMl: number
  waterMl: number
  stepsGoal: number
  steps: number
}

export interface MealLog {
  id: string
  mealType: MealType
  eatenAt: string
  source: ScanSource
  calories: number
  protein: number
  carbs: number
  fat: number
  notes: string
}

export interface MealLogItem {
  id: string
  mealLogId: string
  displayName: string
  servingG: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface FoodSearchResult {
  id: string
  name: string
  brand: string
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
}

export interface CreateMealLogInput {
  scan: FoodScanResult
  mealType: MealType
  source?: ScanSource
  eatenAt?: string
  notes?: string
}

function todayDate() {
  return new Date().toISOString().slice(0, 10)
}

function toNum(value: unknown, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

// ── Today Summary ─────────────────────────────────────────────────────────────

export function useTodaySummary(date = todayDate()) {
  return useQuery<DailySummary>({
    queryKey: ['nutrition', 'summary', date],
    queryFn: async () => {
      if (!isSupabaseEnabled) {
        return getLocalTodaySummary(date)
      }
      try {
        const [{ data: userRes }, goalsRes, summaryRes] = await Promise.all([
          supabase.auth.getUser(),
          supabase.from('daily_goals').select('*').maybeSingle(),
          supabase
            .from('daily_summaries')
            .select('*')
            .eq('summary_date', date)
            .maybeSingle(),
        ])

        const user = userRes.user
        if (!user) return getLocalTodaySummary(date)

        const goals = goalsRes.data
        const summary = summaryRes.data

        return {
          date,
          caloriesGoal: toNum(goals?.calories_target, 2200),
          caloriesConsumed: toNum(summary?.calories_consumed, 0),
          proteinGoal: toNum(goals?.protein_target_g, 140),
          proteinConsumed: toNum(summary?.protein_consumed_g, 0),
          carbsGoal: toNum(goals?.carbs_target_g, 220),
          carbsConsumed: toNum(summary?.carbs_consumed_g, 0),
          fatGoal: toNum(goals?.fat_target_g, 70),
          fatConsumed: toNum(summary?.fat_consumed_g, 0),
          waterGoalMl: toNum(goals?.water_target_ml, 2500),
          waterMl: toNum(summary?.water_ml, 0),
          stepsGoal: toNum(goals?.steps_target, 8000),
          steps: toNum(summary?.steps, 0),
        }
      } catch {
        return getLocalTodaySummary(date)
      }
    },
  })
}

// ── Meal Logs ─────────────────────────────────────────────────────────────────

export function useMealLogs(date = todayDate()) {
  return useQuery<MealLog[]>({
    queryKey: ['nutrition', 'meal-logs', date],
    queryFn: async () => {
      if (!isSupabaseEnabled) {
        return getLocalMealLogs(date)
      }
      try {
        const start = `${date}T00:00:00.000Z`
        const end = `${date}T23:59:59.999Z`
        const { data, error } = await supabase
          .from('meal_logs')
          .select('*')
          .gte('eaten_at', start)
          .lte('eaten_at', end)
          .order('eaten_at', { ascending: false })

        if (error) throw error

        return (data ?? []).map((row: any) => ({
          id: row.id,
          mealType: row.meal_type as MealType,
          eatenAt: row.eaten_at,
          source: row.scan_source as ScanSource,
          calories: toNum(row.total_calories),
          protein: toNum(row.total_protein_g),
          carbs: toNum(row.total_carbs_g),
          fat: toNum(row.total_fat_g),
          notes: row.notes ?? '',
        }))
      } catch {
        return getLocalMealLogs(date)
      }
    },
  })
}

// ── Single Meal Log ───────────────────────────────────────────────────────────

export function useMealLog(id: string) {
  return useQuery<MealLog | null>({
    queryKey: ['nutrition', 'meal-log', id],
    queryFn: async () => {
      if (!id) return null
      if (!isSupabaseEnabled) {
        return getLocalMealLog(id)
      }
      try {
        const { data, error } = await supabase.from('meal_logs').select('*').eq('id', id).maybeSingle()
        if (error) throw error
        if (!data) return null
        return {
          id: data.id,
          mealType: data.meal_type as MealType,
          eatenAt: data.eaten_at,
          source: data.scan_source as ScanSource,
          calories: toNum(data.total_calories),
          protein: toNum(data.total_protein_g),
          carbs: toNum(data.total_carbs_g),
          fat: toNum(data.total_fat_g),
          notes: data.notes ?? '',
        }
      } catch {
        return getLocalMealLog(id)
      }
    },
  })
}

// ── Meal Items ────────────────────────────────────────────────────────────────

export function useMealLogItems(mealLogId: string) {
  return useQuery<MealLogItem[]>({
    queryKey: ['nutrition', 'meal-log-items', mealLogId],
    queryFn: async () => {
      if (!mealLogId) return []
      if (!isSupabaseEnabled) {
        return getLocalMealLogItems(mealLogId)
      }
      try {
        const { data, error } = await supabase
          .from('meal_log_items')
          .select('*')
          .eq('meal_log_id', mealLogId)
          .order('created_at', { ascending: true })

        if (error) throw error

        return (data ?? []).map((row: any) => ({
          id: row.id,
          mealLogId: row.meal_log_id,
          displayName: row.display_name,
          servingG: toNum(row.serving_g, 100),
          calories: toNum(row.calories),
          protein: toNum(row.protein_g),
          carbs: toNum(row.carbs_g),
          fat: toNum(row.fat_g),
        }))
      } catch {
        return getLocalMealLogItems(mealLogId)
      }
    },
  })
}

// ── Food Search ───────────────────────────────────────────────────────────────

const localCommonFoods: FoodSearchResult[] = [
  { id: 'f-1', name: 'Chicken Breast, Cooked', brand: 'Generic', caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 },
  { id: 'f-2', name: 'White Rice, Cooked', brand: 'Generic', caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3 },
  { id: 'f-3', name: 'Whole Eggs, Boiled', brand: 'Generic', caloriesPer100g: 155, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 11 },
  { id: 'f-4', name: 'Oatmeal, Cooked', brand: 'Generic', caloriesPer100g: 68, proteinPer100g: 2.5, carbsPer100g: 12, fatPer100g: 1.4 },
  { id: 'f-5', name: 'Greek Yogurt, Nonfat', brand: 'Chobani', caloriesPer100g: 59, proteinPer100g: 10, carbsPer100g: 3.6, fatPer100g: 0.4 },
  { id: 'f-6', name: 'Banana', brand: 'Generic', caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3 },
  { id: 'f-7', name: 'Apple', brand: 'Generic', caloriesPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 14, fatPer100g: 0.2 },
  { id: 'f-8', name: 'Avocado', brand: 'Generic', caloriesPer100g: 160, proteinPer100g: 2, carbsPer100g: 9, fatPer100g: 15 },
  { id: 'f-9', name: 'Whey Protein Powder', brand: 'Optimum Nutrition', caloriesPer100g: 390, proteinPer100g: 78, carbsPer100g: 9.7, fatPer100g: 4.8 },
  { id: 'f-10', name: 'Salmon, Cooked', brand: 'Generic', caloriesPer100g: 206, proteinPer100g: 22, carbsPer100g: 0, fatPer100g: 12 },
  { id: 'f-11', name: 'Peanut Butter', brand: 'Skippy', caloriesPer100g: 588, proteinPer100g: 25, carbsPer100g: 20, fatPer100g: 50 },
  { id: 'f-12', name: 'Almonds', brand: 'Blue Diamond', caloriesPer100g: 579, proteinPer100g: 21, carbsPer100g: 22, fatPer100g: 49 },
  { id: 'f-13', name: 'Tofu, Firm', brand: 'House Foods', caloriesPer100g: 144, proteinPer100g: 17, carbsPer100g: 2.8, fatPer100g: 8.8 },
  { id: 'f-14', name: 'Broccoli, Steamed', brand: 'Generic', caloriesPer100g: 35, proteinPer100g: 2.4, carbsPer100g: 7, fatPer100g: 0.4 },
  { id: 'f-15', name: 'Sweet Potato, Baked', brand: 'Generic', caloriesPer100g: 86, proteinPer100g: 1.6, carbsPer100g: 20, fatPer100g: 0.1 },
  { id: 'f-16', name: 'Paneer (Indian Cottage Cheese)', brand: 'Amul', caloriesPer100g: 265, proteinPer100g: 18, carbsPer100g: 1.2, fatPer100g: 20 },
  { id: 'f-17', name: 'Whole Wheat Bread', brand: 'Generic', caloriesPer100g: 247, proteinPer100g: 13, carbsPer100g: 41, fatPer100g: 3.4 },
  { id: 'f-18', name: 'Egg Whites', brand: 'Generic', caloriesPer100g: 52, proteinPer100g: 11, carbsPer100g: 0.7, fatPer100g: 0.2 },
]

export function useFoodSearch(rawQuery: string) {
  const query = rawQuery.trim()
  return useQuery<FoodSearchResult[]>({
    queryKey: ['nutrition', 'food-search', query],
    enabled: query.length > 0,
    queryFn: async () => {
      if (!isSupabaseEnabled) {
        const q = query.toLowerCase()
        return localCommonFoods.filter((food) => food.name.toLowerCase().includes(q))
      }
      try {
        const { data, error } = await supabase
          .from('foods')
          .select('id,name,brand,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g')
          .ilike('name', `%${query}%`)
          .limit(12)

        if (error) throw error

        return (data ?? []).map((row: any) => ({
          id: row.id,
          name: row.name,
          brand: row.brand ?? 'Generic',
          caloriesPer100g: toNum(row.calories_per_100g),
          proteinPer100g: toNum(row.protein_per_100g),
          carbsPer100g: toNum(row.carbs_per_100g),
          fatPer100g: toNum(row.fat_per_100g),
        }))
      } catch {
        const q = query.toLowerCase()
        return localCommonFoods.filter((food) => food.name.toLowerCase().includes(q))
      }
    },
    placeholderData: [],
  })
}

// ── Create Meal Log ───────────────────────────────────────────────────────────

export function useCreateMealLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ scan, mealType, source = 'photo_ai', eatenAt, notes }: CreateMealLogInput) => {
      if (!isSupabaseEnabled) {
        return createLocalMealLog({ scan, mealType, source, eatenAt, notes })
      }
      
      try {
        const { data: userRes } = await supabase.auth.getUser()
        const user = userRes?.user
        if (!user) {
          return createLocalMealLog({ scan, mealType, source, eatenAt, notes })
        }

        const { data: mealLog, error: mealError } = await supabase
          .from('meal_logs')
          .insert({
            user_id: user.id,
            meal_type: mealType,
            eaten_at: eatenAt ?? new Date().toISOString(),
            scan_source: source,
            total_calories: scan.calories,
            total_protein_g: scan.protein,
            total_carbs_g: scan.carbs,
            total_fat_g: scan.fat,
            ai_confidence: Math.round(scan.confidence * 100),
            notes: notes ?? scan.notes ?? scan.title,
          })
          .select('id')
          .single()

        if (mealError) throw mealError

        if (scan.items.length > 0) {
          const { error: itemError } = await supabase.from('meal_log_items').insert(
            scan.items.map((item) => ({
              meal_log_id: mealLog.id,
              user_id: user.id,
              display_name: item.displayName,
              serving_g: item.servingG,
              calories: item.calories,
              protein_g: item.protein,
              carbs_g: item.carbs,
              fat_g: item.fat,
            }))
          )

          if (itemError) throw itemError
        }

        return mealLog
      } catch (err) {
        console.warn('Supabase createMealLog failed, falling back to local database:', err)
        return createLocalMealLog({ scan, mealType, source, eatenAt, notes })
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['nutrition'] })
    },
  })
}

// ── Weekly Summaries ──────────────────────────────────────────────────────────

export function useWeeklySummaries() {
  return useQuery<DailySummary[]>({
    queryKey: ['nutrition', 'weekly-summaries'],
    queryFn: async () => {
      if (!isSupabaseEnabled) {
        return getLocalWeeklySummaries()
      }
      try {
        const { data, error } = await supabase
          .from('daily_summaries')
          .select('*')
          .order('summary_date', { ascending: false })
          .limit(7)

        if (error) throw error

        const mapped = (data ?? []).map((row: any) => ({
          date: row.summary_date,
          caloriesGoal: 2200,
          caloriesConsumed: toNum(row.calories_consumed),
          proteinGoal: 140,
          proteinConsumed: toNum(row.protein_consumed_g),
          carbsGoal: 220,
          carbsConsumed: toNum(row.carbs_consumed_g),
          fatGoal: 70,
          fatConsumed: toNum(row.fat_consumed_g),
          waterGoalMl: 2500,
          waterMl: toNum(row.water_ml),
          stepsGoal: 8000,
          steps: toNum(row.steps),
        }))

        // Sort descending
        return mapped.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      } catch {
        return getLocalWeeklySummaries()
      }
    },
  })
}

// ── Macro Progress Helpers ────────────────────────────────────────────────────

export function useMacroProgress(summary: DailySummary) {
  return useMemo(() => {
    const pct = (value: number, goal: number) => (goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0)
    return {
      caloriesPct: pct(summary.caloriesConsumed, summary.caloriesGoal),
      proteinPct: pct(summary.proteinConsumed, summary.proteinGoal),
      carbsPct: pct(summary.carbsConsumed, summary.carbsGoal),
      fatPct: pct(summary.fatConsumed, summary.fatGoal),
      waterPct: pct(summary.waterMl, summary.waterGoalMl),
      stepsPct: pct(summary.steps, summary.stepsGoal),
    }
  }, [summary])
}

// ── Streak ────────────────────────────────────────────────────────────────────

export function useStreak() {
  return useQuery<number>({
    queryKey: ['nutrition', 'streak'],
    queryFn: async () => {
      if (!isSupabaseEnabled) {
        return getLocalStreak()
      }
      try {
        const { data, error } = await supabase
          .from('daily_summaries')
          .select('summary_date, calories_consumed')
          .order('summary_date', { ascending: false })
          .limit(30)

        if (error) throw error
        if (!data || data.length === 0) return 0

        let streak = 0
        const today = new Date()

        for (let i = 0; i < 30; i++) {
          const checkDate = new Date(today)
          checkDate.setDate(today.getDate() - i)
          const dateStr = checkDate.toISOString().slice(0, 10)
          const entry = data.find((d: { summary_date: string; calories_consumed: number }) => d.summary_date === dateStr)
          if (entry && Number(entry.calories_consumed) > 0) {
            streak++
          } else if (i === 0) {
            continue
          } else {
            break
          }
        }
        return streak
      } catch {
        return getLocalStreak()
      }
    },
  })
}

// ── Delete Meal Log ───────────────────────────────────────────────────────────

export function useDeleteMealLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!isSupabaseEnabled) {
        return deleteLocalMealLog(id)
      }
      try {
        const { error } = await supabase.from('meal_logs').delete().eq('id', id)
        if (error) throw error
      } catch (err) {
        console.warn('Supabase deleteMealLog failed, falling back to local database:', err)
        return deleteLocalMealLog(id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition'] })
    },
  })
}

// ── Goals ─────────────────────────────────────────────────────────────────────

export interface DailyGoals {
  caloriesTarget: number
  proteinTargetG: number
  carbsTargetG: number
  fatTargetG: number
  waterTargetMl: number
  stepsTarget: number
}

export function useGoals() {
  return useQuery<DailyGoals>({
    queryKey: ['nutrition', 'goals'],
    queryFn: async () => {
      if (!isSupabaseEnabled) {
        return getLocalGoals()
      }
      try {
        const { data, error } = await supabase
          .from('daily_goals')
          .select('*')
          .maybeSingle()
        if (error) throw error
        if (!data) return getLocalGoals()
        return {
          caloriesTarget: toNum(data.calories_target, 2000),
          proteinTargetG: toNum(data.protein_target_g, 140),
          carbsTargetG: toNum(data.carbs_target_g, 200),
          fatTargetG: toNum(data.fat_target_g, 70),
          waterTargetMl: toNum(data.water_target_ml, 2500),
          stepsTarget: toNum(data.steps_target, 8000),
        }
      } catch {
        return getLocalGoals()
      }
    },
  })
}

// ── Update Goals ──────────────────────────────────────────────────────────────

export function useUpdateGoals() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (goals: DailyGoals) => {
      if (!isSupabaseEnabled) {
        return saveLocalGoals(goals)
      }
      try {
        const { data: userRes } = await supabase.auth.getUser()
        const user = userRes.user
        if (!user) {
          return saveLocalGoals(goals)
        }

        const { error } = await supabase
          .from('daily_goals')
          .upsert({
            user_id: user.id,
            calories_target: goals.caloriesTarget,
            protein_target_g: goals.proteinTargetG,
            carbs_target_g: goals.carbsTargetG,
            fat_target_g: goals.fatTargetG,
            water_target_ml: goals.waterTargetMl,
            steps_target: goals.stepsTarget,
          }, { onConflict: 'user_id' })

        if (error) throw error
      } catch (err) {
        console.warn('Supabase updateGoals failed, falling back to local database:', err)
        return saveLocalGoals(goals)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition'] })
    },
  })
}

// ── Update Water ──────────────────────────────────────────────────────────────

export function useUpdateWater() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ date, ml }: { date: string; ml: number }) => {
      if (!isSupabaseEnabled) {
        return updateLocalWater(date, ml)
      }
      try {
        const { data: userRes } = await supabase.auth.getUser()
        const user = userRes.user
        if (!user) return updateLocalWater(date, ml)

        // Read current summary to get water
        const { data: currentSummary } = await supabase
          .from('daily_summaries')
          .select('water_ml')
          .eq('summary_date', date)
          .maybeSingle()

        const currentWater = toNum(currentSummary?.water_ml, 0)
        const updatedWater = Math.max(0, currentWater + ml)

        const { error } = await supabase
          .from('daily_summaries')
          .upsert({
            user_id: user.id,
            summary_date: date,
            water_ml: updatedWater,
          }, { onConflict: 'user_id,summary_date' })

        if (error) throw error
        return updatedWater
      } catch {
        return updateLocalWater(date, ml)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition'] })
    },
  })
}
