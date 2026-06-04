import { useState, useEffect } from 'react'
import { View, ScrollView, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import TextInputField from '@/components/ui/TextInputField'
import { useGoals, useUpdateGoals, type DailyGoals } from '@/hooks/useNutrition'
import { useToast } from '@/contexts/ToastContext'
import {
  BG, SURFACE, BORDER, ACCENT,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY,
} from '@/lib/theme'

interface GoalFieldConfig {
  key: keyof DailyGoals
  label: string
  unit: string
  icon: string
  color: string
}

const GOAL_FIELDS: GoalFieldConfig[] = [
  { key: 'caloriesTarget',  label: 'Calories',  unit: 'kcal', icon: 'flame-outline',      color: '#f97316' },
  { key: 'proteinTargetG',  label: 'Protein',   unit: 'g',    icon: 'barbell-outline',    color: '#818cf8' },
  { key: 'carbsTargetG',    label: 'Carbs',     unit: 'g',    icon: 'leaf-outline',       color: '#34d399' },
  { key: 'fatTargetG',      label: 'Fat',       unit: 'g',    icon: 'water-outline',      color: '#fbbf24' },
  { key: 'waterTargetMl',   label: 'Water',     unit: 'ml',   icon: 'water-outline',      color: '#38bdf8' },
  { key: 'stepsTarget',     label: 'Steps',     unit: 'steps', icon: 'footsteps-outline', color: '#a78bfa' },
]

export default function GoalsScreen() {
  const insets = useSafeAreaInsets()
  const { data: goals } = useGoals()
  const updateGoals = useUpdateGoals()
  const toast = useToast()

  const [draft, setDraft] = useState<DailyGoals>({
    caloriesTarget: 2000,
    proteinTargetG: 140,
    carbsTargetG: 200,
    fatTargetG: 70,
    waterTargetMl: 2500,
    stepsTarget: 8000,
  })

  useEffect(() => {
    if (goals) setDraft(goals)
  }, [goals])

  function handleChange(key: keyof DailyGoals, text: string) {
    const num = parseInt(text, 10)
    setDraft((prev) => ({ ...prev, [key]: Number.isFinite(num) ? num : 0 }))
  }

  async function handleSave() {
    try {
      await updateGoals.mutateAsync(draft)
      toast.showToast('Goals updated!', 'success')
      router.back()
    } catch {
      toast.showToast('Failed to save goals', 'error')
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
        </Pressable>
        <Text style={s.headerTitle}>Daily Goals</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section header */}
          <View style={s.sectionHeader}>
            <Ionicons name="nutrition-outline" size={18} color={ACCENT} />
            <Text style={s.sectionTitle}>Nutrition & Activity</Text>
          </View>
          <Text style={s.sectionSubtitle}>
            Set your daily targets. These are used to track your progress throughout the day.
          </Text>

          {/* Goal cards */}
          <View style={s.cardsContainer}>
            {GOAL_FIELDS.map((field) => (
              <Card key={field.key} style={s.goalCard}>
                <View style={s.goalCardHeader}>
                  <View style={[s.iconCircle, { backgroundColor: `${field.color}18` }]}>
                    <Ionicons name={field.icon as any} size={18} color={field.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.goalLabel}>{field.label}</Text>
                    <Text style={s.goalUnit}>{field.unit}</Text>
                  </View>
                </View>
                <TextInputField
                  value={String(draft[field.key])}
                  onChangeText={(text) => handleChange(field.key, text)}
                  keyboardType="numeric"
                  placeholder="0"
                  selectTextOnFocus
                />
              </Card>
            ))}
          </View>

          {/* Save button */}
          <Button
            label="Save Goals"
            onPress={handleSave}
            loading={updateGoals.isPending}
            fullWidth
            size="lg"
            style={s.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: '700',
  },
  body: {
    padding: 20,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 19,
    marginTop: -4,
  },
  cardsContainer: {
    gap: 12,
  },
  goalCard: {
    padding: 16,
    gap: 14,
  },
  goalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalLabel: {
    fontSize: 14.5,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  goalUnit: {
    fontSize: 12,
    color: TEXT_TERTIARY,
    marginTop: 1,
  },
  saveBtn: {
    marginTop: 8,
  },
})
