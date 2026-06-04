import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Text } from '@/components/ui/Text'
import { ACCENT, ACCENT_DIM, TEXT_TERTIARY } from '@/lib/theme'

interface StreakBadgeProps {
  count: number
}

export default function StreakBadge({ count }: StreakBadgeProps) {
  const isActive = count > 0

  return (
    <View style={[s.pill, isActive ? s.pillActive : s.pillInactive]}>
      <Text style={[s.emoji, !isActive && s.emojiMuted]}>🔥</Text>
      <Text style={[s.count, isActive ? s.countActive : s.countInactive]}>
        {count}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillActive: {
    backgroundColor: ACCENT_DIM,
    borderColor: 'rgba(14,165,164,0.25)',
    // Subtle glow via shadow
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  pillInactive: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emoji: {
    fontSize: 14,
  },
  emojiMuted: {
    opacity: 0.35,
  },
  count: {
    fontSize: 13,
    fontWeight: '700',
  },
  countActive: {
    color: ACCENT,
  },
  countInactive: {
    color: TEXT_TERTIARY,
  },
})
