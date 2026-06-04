import React, { useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg'
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import { Text } from '@/components/ui/Text'
import { ACCENT, TEXT_TERTIARY } from '@/lib/theme'

// ── Animated SVG Rect ─────────────────────────────────────────────────────────
const AnimatedRect = Animated.createAnimatedComponent(Rect)

// ── Constants ─────────────────────────────────────────────────────────────────
const CHART_HEIGHT = 140
const BAR_RADIUS = 6
const EXCEED_COLOR = '#f97316'
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const LABEL_HEIGHT = 24
const VALUE_HEIGHT = 18
const TOTAL_HEIGHT = CHART_HEIGHT + LABEL_HEIGHT + VALUE_HEIGHT

// ── Props ─────────────────────────────────────────────────────────────────────
interface WeeklyChartProps {
  data: Array<{ date: string; consumed: number; goal: number }>
}

// ── Single Animated Bar ───────────────────────────────────────────────────────
interface BarProps {
  x: number
  barWidth: number
  maxVal: number
  consumed: number
  goal: number
  index: number
}

function AnimatedBar({ x, barWidth, maxVal, consumed, goal, index }: BarProps) {
  const targetHeight = maxVal > 0 ? (consumed / maxVal) * CHART_HEIGHT : 0
  const anim = useSharedValue(0)

  useEffect(() => {
    anim.value = withDelay(
      index * 80,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })
    )
  }, [consumed, maxVal])

  const animatedProps = useAnimatedProps(() => {
    const h = targetHeight * anim.value
    return {
      y: VALUE_HEIGHT + CHART_HEIGHT - h,
      height: Math.max(0, h),
    }
  })

  const exceeds = consumed > goal
  const color = exceeds ? EXCEED_COLOR : ACCENT

  return (
    <AnimatedRect
      x={x}
      rx={BAR_RADIUS}
      ry={BAR_RADIUS}
      width={barWidth}
      fill={color}
      animatedProps={animatedProps}
    />
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function WeeklyChart({ data }: WeeklyChartProps) {
  // Pad to 7 items if needed
  const items = React.useMemo(() => {
    const padded = [...data]
    while (padded.length < 7) {
      padded.unshift({ date: '', consumed: 0, goal: 2200 })
    }
    return padded.slice(-7)
  }, [data])

  const goalValue = items[0]?.goal ?? 2200
  const maxVal = Math.max(...items.map((d) => d.consumed), goalValue) * 1.12

  // Calculate bar layout
  const PADDING_H = 8
  const GAP = 8
  const totalGaps = GAP * 6
  const svgWidth = 100 // percentage width — we'll use viewBox scaling
  const contentWidth = svgWidth - PADDING_H * 2
  const barWidth = (contentWidth - totalGaps) / 7

  // Goal line Y
  const goalY = maxVal > 0
    ? VALUE_HEIGHT + CHART_HEIGHT - (goalValue / maxVal) * CHART_HEIGHT
    : VALUE_HEIGHT + CHART_HEIGHT

  // Day label from date string
  const getDayLabel = (dateStr: string, idx: number): string => {
    if (!dateStr) return DAY_LABELS[idx % 7]
    try {
      const d = new Date(dateStr + 'T12:00:00')
      return DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]
    } catch {
      return DAY_LABELS[idx % 7]
    }
  }

  return (
    <View style={s.container}>
      <Svg
        width="100%"
        height={TOTAL_HEIGHT}
        viewBox={`0 0 ${svgWidth} ${TOTAL_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Dashed goal line */}
        <Line
          x1={PADDING_H - 2}
          y1={goalY}
          x2={svgWidth - PADDING_H + 2}
          y2={goalY}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={0.6}
          strokeDasharray="3 2"
        />

        {/* Bars + Labels */}
        {items.map((item, i) => {
          const x = PADDING_H + i * (barWidth + GAP)
          const centerX = x + barWidth / 2
          return (
            <React.Fragment key={i}>
              {/* Calorie value above bar */}
              <SvgText
                x={centerX}
                y={VALUE_HEIGHT - 4}
                textAnchor="middle"
                fontSize={5.5}
                fontWeight="600"
                fill="rgba(255,255,255,0.50)"
              >
                {item.consumed > 0 ? Math.round(item.consumed).toString() : ''}
              </SvgText>

              {/* Animated bar */}
              <AnimatedBar
                x={x}
                barWidth={barWidth}
                maxVal={maxVal}
                consumed={item.consumed}
                goal={item.goal}
                index={i}
              />

              {/* Day label below */}
              <SvgText
                x={centerX}
                y={VALUE_HEIGHT + CHART_HEIGHT + 14}
                textAnchor="middle"
                fontSize={5.5}
                fontWeight="500"
                fill="rgba(255,255,255,0.35)"
              >
                {getDayLabel(item.date, i)}
              </SvgText>
            </React.Fragment>
          )
        })}
      </Svg>

      {/* Goal legend */}
      <View style={s.legend}>
        <View style={s.legendDash} />
        <Text style={s.legendText}>Goal: {goalValue} kcal</Text>
      </View>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    width: '100%',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  legendDash: {
    width: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  legendText: {
    fontSize: 10,
    color: TEXT_TERTIARY,
  },
})
