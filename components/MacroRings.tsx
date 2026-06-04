import React, { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import { Text } from '@/components/ui/Text'
import { Ionicons } from '@expo/vector-icons'
import { BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY } from '@/lib/theme'

// ── Animated SVG Circle ───────────────────────────────────────────────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// ── Ring colors ───────────────────────────────────────────────────────────────
const COLORS = {
  calories: '#000000',  // Black progress ring
  protein: '#ef4444',   // Cal AI red
  carbs: '#f59e0b',     // Cal AI orange/yellow
  fat: '#3b82f6',       // Cal AI blue
} as const

const TRACK_COLOR = 'rgba(0,0,0,0.035)'

// ── Props ─────────────────────────────────────────────────────────────────────
interface MacroRingsProps {
  calories: number
  caloriesGoal: number
  protein: number
  proteinGoal: number
  carbs: number
  carbsGoal: number
  fat: number
  fatGoal: number
}

// ── Single Ring ───────────────────────────────────────────────────────────────
interface RingProps {
  size: number
  strokeWidth: number
  progress: number   // 0-1
  color: string
  delay?: number
  iconName?: keyof typeof Ionicons.glyphMap
  iconColor?: string
}

function Ring({ size, strokeWidth, progress, color, delay = 0, iconName, iconColor }: RingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(Math.max(progress, 0), 1)

  const animValue = useSharedValue(0)

  useEffect(() => {
    animValue.value = withDelay(
      delay,
      withTiming(clamped, { duration: 900, easing: Easing.out(Easing.cubic) })
    )
  }, [clamped, progress])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animValue.value),
  }))

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={TRACK_COLOR}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {iconName && (
        <Ionicons name={iconName} size={size * 0.38} color={iconColor || color} />
      )}
    </View>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MacroRings({
  calories,
  caloriesGoal,
  protein,
  proteinGoal,
  carbs,
  carbsGoal,
  fat,
  fatGoal,
}: MacroRingsProps) {
  const caloriesProgress = caloriesGoal > 0 ? calories / caloriesGoal : 0

  return (
    <View style={s.container}>
      {/* ── Calorie Progress Card (Full Width) ── */}
      <View style={s.calorieCard}>
        <View style={s.calorieInfo}>
          <Text style={s.calorieHeading}>
            <Text style={s.calorieEaten}>{Math.round(calories)}</Text>
            <Text style={s.calorieGoal}>/{Math.round(caloriesGoal)}</Text>
          </Text>
          <Text style={s.calorieLabel}>Calories eaten</Text>
        </View>

        <View style={s.calorieRingWrap}>
          <Ring
            size={74}
            strokeWidth={7.5}
            progress={caloriesProgress}
            color={COLORS.calories}
            delay={0}
            iconName="flame"
            iconColor="#000000"
          />
        </View>
      </View>

      {/* ── Macro Columns (Side-by-Side Cards) ── */}
      <View style={s.macrosRow}>
        {/* Protein */}
        <View style={s.macroCard}>
          <Ring
            size={48}
            strokeWidth={4.8}
            progress={proteinGoal > 0 ? protein / proteinGoal : 0}
            color={COLORS.protein}
            delay={100}
            iconName="barbell"
          />
          <View style={s.macroTextWrap}>
            <Text style={s.macroTextVal}>
              <Text style={s.boldVal}>{Math.round(protein)}</Text>
              <Text style={s.goalVal}>/{Math.round(proteinGoal)}g</Text>
            </Text>
            <Text style={s.macroLabelText}>Protein eaten</Text>
          </View>
        </View>

        {/* Carbs */}
        <View style={s.macroCard}>
          <Ring
            size={48}
            strokeWidth={4.8}
            progress={carbsGoal > 0 ? carbs / carbsGoal : 0}
            color={COLORS.carbs}
            delay={200}
            iconName="leaf"
          />
          <View style={s.macroTextWrap}>
            <Text style={s.macroTextVal}>
              <Text style={s.boldVal}>{Math.round(carbs)}</Text>
              <Text style={s.goalVal}>/{Math.round(carbsGoal)}g</Text>
            </Text>
            <Text style={s.macroLabelText}>Carbs eaten</Text>
          </View>
        </View>

        {/* Fat */}
        <View style={s.macroCard}>
          <Ring
            size={48}
            strokeWidth={4.8}
            progress={fatGoal > 0 ? fat / fatGoal : 0}
            color={COLORS.fat}
            delay={300}
            iconName="water"
          />
          <View style={s.macroTextWrap}>
            <Text style={s.macroTextVal}>
              <Text style={s.boldVal}>{Math.round(fat)}</Text>
              <Text style={s.goalVal}>/{Math.round(fatGoal)}g</Text>
            </Text>
            <Text style={s.macroLabelText}>Fat eaten</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    width: '100%',
    gap: 12,
  },
  // Calorie Card
  calorieCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: 'rgba(0,0,0,0.02)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 1,
  },
  calorieInfo: {
    gap: 2,
  },
  calorieHeading: {
    fontSize: 34,
    fontWeight: '900',
    color: TEXT_PRIMARY,
    letterSpacing: -0.8,
  },
  calorieEaten: {
    color: TEXT_PRIMARY,
  },
  calorieGoal: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_TERTIARY,
  },
  calorieLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  calorieRingWrap: {
    width: 74,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Macros Row
  macrosRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 10,
    shadowColor: 'rgba(0,0,0,0.02)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 1,
  },
  macroTextWrap: {
    alignItems: 'center',
    gap: 1,
  },
  macroTextVal: {
    fontSize: 12,
  },
  boldVal: {
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  goalVal: {
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  macroLabelText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: TEXT_TERTIARY,
  },
})
