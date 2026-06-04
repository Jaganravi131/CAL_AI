import { useRef, useEffect } from 'react'
import { View, ScrollView, Pressable, StyleSheet } from 'react-native'
import { Text } from '@/components/ui/Text'
import { ACCENT, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY } from '@/lib/theme'

interface CalendarStripProps {
  selectedDate: string // 'YYYY-MM-DD'
  onDateSelect: (date: string) => void
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PILL_WIDTH = 48
const PILL_GAP = 8

function getDays(count: number): Array<{ date: string; dayName: string; dayNum: number; isToday: boolean }> {
  const today = new Date()
  const days: Array<{ date: string; dayName: string; dayNum: number; isToday: boolean }> = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push({
      date: d.toISOString().slice(0, 10),
      dayName: DAY_NAMES[d.getDay()],
      dayNum: d.getDate(),
      isToday: i === 0,
    })
  }
  return days
}

export default function CalendarStrip({ selectedDate, onDateSelect }: CalendarStripProps) {
  const scrollRef = useRef<ScrollView>(null)
  const days = getDays(7)

  useEffect(() => {
    const idx = days.findIndex((d) => d.date === selectedDate)
    if (idx >= 0 && scrollRef.current) {
      const offset = Math.max(0, idx * (PILL_WIDTH + PILL_GAP) - 100)
      scrollRef.current.scrollTo({ x: offset, animated: false })
    }
  }, [selectedDate])

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.container}
    >
      {days.map((day) => {
        const active = day.date === selectedDate
        return (
          <Pressable
            key={day.date}
            onPress={() => onDateSelect(day.date)}
            style={[s.pill, active && s.pillActive]}
          >
            <Text style={[s.dayName, active && s.dayNameActive]}>{day.dayName}</Text>
            <Text style={[s.dayNum, active && s.dayNumActive]}>{day.dayNum}</Text>
            {day.isToday && <View style={[s.todayDot, active && s.todayDotActive]} />}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { gap: PILL_GAP, paddingHorizontal: 4, paddingVertical: 4 },
  pill: {
    width: PILL_WIDTH,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#ffffff',
    gap: 3,
  },
  pillActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  dayName: { fontSize: 11, fontWeight: '600', color: TEXT_TERTIARY },
  dayNameActive: { color: '#ffffff' },
  dayNum: { fontSize: 16, fontWeight: '800', color: TEXT_SECONDARY },
  dayNumActive: { color: '#ffffff' },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ACCENT,
    marginTop: 1,
  },
  todayDotActive: { backgroundColor: '#ffffff' },
})
