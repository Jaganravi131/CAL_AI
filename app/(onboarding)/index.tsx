import { useState } from 'react'
import {
  View, Pressable, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView,
} from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import { supabase, isSupabaseEnabled } from '@/lib/supabase'
import { track } from '@/lib/analytics'
import {
  ACCENT, ACCENT_DIM, ACCENT_BORDER, BG, SURFACE, BORDER,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY
} from '@/lib/theme'
import { LinearGradient } from 'expo-linear-gradient'
import { adjustBrightness } from '@/lib/utils'
import { Fonts } from '@/lib/typography'
import { saveLocalGoals } from '@/lib/localStorage'

type GoalType = 'lose' | 'maintain' | 'gain'
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active'
type Gender = 'male' | 'female'

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Onboarding answers state
  const [displayName, setDisplayName] = useState('')
  const [gender, setGender] = useState<Gender>('male')
  const [age, setAge] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [goal, setGoal] = useState<GoalType>('maintain')
  const [activity, setActivity] = useState<ActivityLevel>('light')

  track('onboarding_started')

  // Mifflin-St Jeor and TDEE calorie/macro calculator
  function calculateGoals() {
    const ageNum = parseInt(age, 10) || 25
    const heightNum = parseFloat(height) || 170
    const weightNum = parseFloat(weight) || 70

    // 1. Calculate BMR
    let bmr = 0
    if (gender === 'male') {
      bmr = 10 * weightNum + 6.25 * heightNum - 5 * ageNum + 5
    } else {
      bmr = 10 * weightNum + 6.25 * heightNum - 5 * ageNum - 161
    }

    // 2. Calculate TDEE (multiplier based on activity level)
    let tdee = bmr
    switch (activity) {
      case 'sedentary': tdee = bmr * 1.2; break
      case 'light':     tdee = bmr * 1.375; break
      case 'moderate':  tdee = bmr * 1.55; break
      case 'active':    tdee = bmr * 1.725; break
    }

    // 3. Adjust for Fitness Goal
    let calories = Math.round(tdee)
    if (goal === 'lose') {
      calories = Math.max(1200, Math.round(tdee - 500))
    } else if (goal === 'gain') {
      calories = Math.round(tdee + 300)
    }

    // 4. Calculate macros
    // Protein: 2.0g per kg of weight
    const protein = Math.round(weightNum * 2.0)
    // Fat: 0.9g per kg of weight
    const fat = Math.round(weightNum * 0.9)
    // Carbs: remainder of calories
    const carbs = Math.max(50, Math.round((calories - (protein * 4) - (fat * 9)) / 4))

    return {
      caloriesTarget: calories,
      proteinTargetG: protein,
      carbsTargetG: carbs,
      fatTargetG: fat,
      waterTargetMl: goal === 'lose' ? 3000 : 2500,
      stepsTarget: activity === 'active' ? 10000 : activity === 'moderate' ? 8000 : 6000,
    }
  }

  async function handleNext() {
    setError(null)
    if (step === 1) {
      if (!displayName.trim()) {
        setError('Please enter your name.')
        return
      }
      setStep(2)
    } else if (step === 2) {
      const ageNum = parseInt(age, 10)
      const heightNum = parseFloat(height)
      const weightNum = parseFloat(weight)

      if (!ageNum || ageNum < 10 || ageNum > 100) {
        setError('Please enter a valid age (10-100).')
        return
      }
      if (!heightNum || heightNum < 100 || heightNum > 250) {
        setError('Please enter a valid height (100-250 cm).')
        return
      }
      if (!weightNum || weightNum < 30 || weightNum > 250) {
        setError('Please enter a valid weight (30-250 kg).')
        return
      }
      setStep(3)
    } else if (step === 3) {
      await handleComplete()
    }
  }

  async function handleComplete() {
    setLoading(true)
    setError(null)

    const finalGoals = calculateGoals()

    try {
      // 1. Save user profile metadata in Supabase Auth
      if (isSupabaseEnabled) {
        const { error: err } = await supabase.auth.updateUser({
          data: {
            onboarding_completed: true,
            full_name: displayName.trim(),
            gender,
            age: parseInt(age, 10),
            height: parseFloat(height),
            weight: parseFloat(weight),
            fitness_goal: goal,
            activity_level: activity,
          },
        })
        if (err) throw err

        // 2. Upsert profile record
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase
            .from('profiles')
            .upsert({ id: user.id, display_name: displayName.trim() })

          // 3. Save goals to Supabase DB
          await supabase
            .from('daily_goals')
            .upsert({
              user_id: user.id,
              calories_target: finalGoals.caloriesTarget,
              protein_target_g: finalGoals.proteinTargetG,
              carbs_target_g: finalGoals.carbsTargetG,
              fat_target_g: finalGoals.fatTargetG,
              water_target_ml: finalGoals.waterTargetMl,
              steps_target: finalGoals.stepsTarget,
            }, { onConflict: 'user_id' })
        }
      }

      // Always save to local storage as the primary state / fallback
      await saveLocalGoals(finalGoals)

      track('onboarding_completed', { skipped: false, goal, activity })
    } catch (err: any) {
      console.error('[Onboarding Error]', err)
      setError('Could not complete setup. Saving goals offline.')
      // Fallback: complete local save anyway so user can continue
      await saveLocalGoals(finalGoals)
      if (!isSupabaseEnabled) {
        track('onboarding_completed', { skipped: false, goal, activity })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[s.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        {/* Step Indicator */}
        <View style={s.progressBarRow}>
          {[1, 2, 3].map((stepNum) => (
            <View
              key={stepNum}
              style={[
                s.progressBar,
                stepNum <= step ? s.progressBarActive : s.progressBarInactive
              ]}
            />
          ))}
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 && (
            <Animated.View entering={FadeInDown.delay(80).duration(300)} style={s.content}>
              <View style={s.header}>
                <View style={s.iconBadge}>
                  <Ionicons name="person-outline" size={32} color={ACCENT} />
                </View>
                <Text style={s.title}>What is your name?</Text>
                <Text style={s.subtitle}>
                  Let's personalize your Cal AI tracking dashboard.
                </Text>
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.label}>DISPLAY NAME</Text>
                <TextInput
                  value={displayName}
                  onChangeText={(v) => { setDisplayName(v); setError(null) }}
                  placeholder="Enter your full name"
                  placeholderTextColor={TEXT_TERTIARY}
                  style={s.input}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={handleNext}
                  autoFocus
                />
              </View>
            </Animated.View>
          )}

          {step === 2 && (
            <Animated.View entering={FadeInDown.delay(80).duration(300)} style={s.content}>
              <View style={s.header}>
                <View style={s.iconBadge}>
                  <Ionicons name="body-outline" size={32} color={ACCENT} />
                </View>
                <Text style={s.title}>Tell us about yourself</Text>
                <Text style={s.subtitle}>
                  Used to estimate your biological calorie expenditure (BMR) accurately.
                </Text>
              </View>

              {/* Gender selector */}
              <View style={s.fieldGroup}>
                <Text style={s.label}>BIOLOGICAL SEX</Text>
                <View style={s.genderRow}>
                  <Pressable
                    onPress={() => setGender('male')}
                    style={[s.genderBtn, gender === 'male' && s.genderBtnSelected]}
                  >
                    <Ionicons name="male" size={16} color={gender === 'male' ? '#fff' : TEXT_SECONDARY} />
                    <Text style={[s.genderBtnText, gender === 'male' && s.genderBtnTextSelected]}>Male</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setGender('female')}
                    style={[s.genderBtn, gender === 'female' && s.genderBtnSelected]}
                  >
                    <Ionicons name="female" size={16} color={gender === 'female' ? '#fff' : TEXT_SECONDARY} />
                    <Text style={[s.genderBtnText, gender === 'female' && s.genderBtnTextSelected]}>Female</Text>
                  </Pressable>
                </View>
              </View>

              {/* Age, Height, Weight inputs */}
              <View style={s.inputsRow}>
                <View style={[s.fieldGroup, { flex: 1 }]}>
                  <Text style={s.label}>AGE</Text>
                  <TextInput
                    value={age}
                    onChangeText={(v) => { setAge(v.replace(/\D/g, '')); setError(null) }}
                    placeholder="25"
                    placeholderTextColor={TEXT_TERTIARY}
                    keyboardType="number-pad"
                    maxLength={3}
                    style={s.input}
                  />
                </View>

                <View style={[s.fieldGroup, { flex: 1 }]}>
                  <Text style={s.label}>HEIGHT (CM)</Text>
                  <TextInput
                    value={height}
                    onChangeText={(v) => { setHeight(v.replace(/\D/g, '')); setError(null) }}
                    placeholder="175"
                    placeholderTextColor={TEXT_TERTIARY}
                    keyboardType="number-pad"
                    maxLength={3}
                    style={s.input}
                  />
                </View>

                <View style={[s.fieldGroup, { flex: 1 }]}>
                  <Text style={s.label}>WEIGHT (KG)</Text>
                  <TextInput
                    value={weight}
                    onChangeText={(v) => { setWeight(v.replace(/[^0-9.]/g, '')); setError(null) }}
                    placeholder="70"
                    placeholderTextColor={TEXT_TERTIARY}
                    keyboardType="decimal-pad"
                    maxLength={5}
                    style={s.input}
                  />
                </View>
              </View>
            </Animated.View>
          )}

          {step === 3 && (
            <Animated.View entering={FadeInDown.delay(80).duration(300)} style={s.content}>
              <View style={s.header}>
                <View style={s.iconBadge}>
                  <Ionicons name="trending-up-outline" size={32} color={ACCENT} />
                </View>
                <Text style={s.title}>Goals & Activity</Text>
                <Text style={s.subtitle}>
                  We'll calculate your daily targets based on your goals.
                </Text>
              </View>

              {/* Fitness Goal options */}
              <View style={s.fieldGroup}>
                <Text style={s.label}>MY GOAL</Text>
                <View style={s.goalsColumn}>
                  <Pressable
                    onPress={() => setGoal('lose')}
                    style={[s.optionCard, goal === 'lose' && s.optionCardSelected]}
                  >
                    <Ionicons name="flame-outline" size={18} color={goal === 'lose' ? ACCENT : TEXT_SECONDARY} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.optionTitle}>Lose Weight</Text>
                      <Text style={s.optionDesc}>Calorie deficit to burn fat</Text>
                    </View>
                    {goal === 'lose' && <Ionicons name="checkmark-circle" size={18} color={ACCENT} />}
                  </Pressable>

                  <Pressable
                    onPress={() => setGoal('maintain')}
                    style={[s.optionCard, goal === 'maintain' && s.optionCardSelected]}
                  >
                    <Ionicons name="git-commit-outline" size={18} color={goal === 'maintain' ? ACCENT : TEXT_SECONDARY} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.optionTitle}>Maintain Weight</Text>
                      <Text style={s.optionDesc}>TDEE balancing for weight lock</Text>
                    </View>
                    {goal === 'maintain' && <Ionicons name="checkmark-circle" size={18} color={ACCENT} />}
                  </Pressable>

                  <Pressable
                    onPress={() => setGoal('gain')}
                    style={[s.optionCard, goal === 'gain' && s.optionCardSelected]}
                  >
                    <Ionicons name="barbell-outline" size={18} color={goal === 'gain' ? ACCENT : TEXT_SECONDARY} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.optionTitle}>Build Muscle</Text>
                      <Text style={s.optionDesc}>Calorie surplus for strength</Text>
                    </View>
                    {goal === 'gain' && <Ionicons name="checkmark-circle" size={18} color={ACCENT} />}
                  </Pressable>
                </View>
              </View>

              {/* Activity Level options */}
              <View style={s.fieldGroup}>
                <Text style={s.label}>ACTIVITY LEVEL</Text>
                <View style={s.genderRow}>
                  {(['sedentary', 'light', 'moderate', 'active'] as ActivityLevel[]).map((level) => (
                    <Pressable
                      key={level}
                      onPress={() => setActivity(level)}
                      style={[s.activityBtn, activity === level && s.activityBtnSelected]}
                    >
                      <Text style={[s.activityBtnText, activity === level && s.activityBtnTextSelected]}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Animated.View>
          )}

          {error ? (
            <Animated.View entering={FadeIn.duration(180)} style={s.errorBox}>
              <Text style={{ color: '#ff3b30', fontSize: 13, fontWeight: '500' }}>{error}</Text>
            </Animated.View>
          ) : null}
        </ScrollView>

        {/* Buttons */}
        <View style={s.buttons}>
          {step > 1 && (
            <Pressable
              onPress={() => setStep(step - 1)}
              disabled={loading}
              style={[s.backBtn, loading && { opacity: 0.5 }]}
            >
              <Text style={s.backBtnText}>Back</Text>
            </Pressable>
          )}
          <Pressable
            onPress={handleNext}
            disabled={loading}
            style={({ pressed }) => ({
              flex: 1,
              opacity: loading ? 0.5 : pressed ? 0.85 : 1,
              borderRadius: 16, overflow: 'hidden',
            })}
          >
            <LinearGradient
              colors={[ACCENT, adjustBrightness(ACCENT, -25)]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.primaryBtn}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                  {step === 3 ? 'Save & Finish  →' : 'Continue  →'}
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  progressBarRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressBarActive: {
    backgroundColor: ACCENT,
  },
  progressBarInactive: {
    backgroundColor: BORDER,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  content: { gap: 20 },
  header: { gap: 8, alignItems: 'center', paddingBottom: 6 },
  iconBadge: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: ACCENT_DIM, borderWidth: 1, borderColor: ACCENT_BORDER,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 24, fontWeight: '800', color: TEXT_PRIMARY, letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: 13.5, color: TEXT_SECONDARY, textAlign: 'center', lineHeight: 20, maxWidth: 280 },

  fieldGroup: { gap: 8 },
  label: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: TEXT_TERTIARY },
  input: {
    height: 52, backgroundColor: SURFACE,
    borderWidth: 1, borderColor: BORDER, borderRadius: 14,
    paddingHorizontal: 16, color: TEXT_PRIMARY, fontSize: 15,
    fontFamily: Fonts.regular,
  },
  errorBox: {
    backgroundColor: 'rgba(255,59,48,0.08)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,59,48,0.2)',
    paddingHorizontal: 14, paddingVertical: 10,
    marginTop: 10,
  },
  
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  genderBtnSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  genderBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  genderBtnTextSelected: {
    color: '#ffffff',
  },

  inputsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  goalsColumn: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    gap: 12,
  },
  optionCardSelected: {
    borderColor: ACCENT,
    borderWidth: 1.5,
  },
  optionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  optionDesc: {
    fontSize: 11.5,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },

  activityBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBtnSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  activityBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  activityBtnTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },

  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  backBtn: {
    width: 80,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  primaryBtn: { height: 52, alignItems: 'center', justifyContent: 'center' },
})
