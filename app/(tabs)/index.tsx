import { useMemo, useState } from 'react'
import { View, ScrollView, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
    ACCENT,
    BG,
    BORDER,
    TEXT_PRIMARY,
    TEXT_SECONDARY,
    TEXT_TERTIARY,
    ACCENT_DIM,
} from '@/lib/theme'
import { TAB_BAR_CLEARANCE } from '@/components/TabBar'
import { useProfile } from '@/hooks/useProfile'
import {
    useMacroProgress,
    useMealLogs,
    useTodaySummary,
    useWeeklySummaries,
    useUpdateWater,
    useStreak,
} from '@/hooks/useNutrition'
import type { DailySummary, MealType } from '@/hooks/useNutrition'
import MacroRings from '@/components/MacroRings'
import WeeklyChart from '@/components/WeeklyChart'
import StreakBadge from '@/components/StreakBadge'
import CalendarStrip from '@/components/CalendarStrip'

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayDate() {
    return new Date().toISOString().slice(0, 10)
}

function mealIcon(kind: MealType): keyof typeof Ionicons.glyphMap {
    switch (kind) {
        case 'breakfast':
            return 'sunny-outline'
        case 'lunch':
            return 'restaurant-outline'
        case 'dinner':
            return 'moon-outline'
        case 'snack':
            return 'nutrition-outline'
        default:
            return 'ellipse-outline'
    }
}

// ── Home Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
    const insets = useSafeAreaInsets()
    const [selectedDate, setSelectedDate] = useState(todayDate())
    
    // Fetch queries filtered by the selected date
    const { data: summary } = useTodaySummary(selectedDate)
    const { data: logs = [] } = useMealLogs(selectedDate)
    const { data: profile } = useProfile()
    const { data: weeklySummaries = [] } = useWeeklySummaries()
    const { data: streak = 0 } = useStreak()
    const updateWater = useUpdateWater()

    const topLogs = useMemo(() => logs.slice(0, 4), [logs])

    // Weekly chart data
    const weeklyChartData = useMemo(() => {
        const sorted = [...weeklySummaries].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )
        return sorted.map((day) => ({
            date: day.date,
            consumed: day.caloriesConsumed,
            goal: day.caloriesGoal,
        }))
    }, [weeklySummaries])

    // Greeting
    const greeting = (() => {
        const h = new Date().getHours()
        if (h < 12) return 'Good morning'
        if (h < 17) return 'Good afternoon'
        return 'Good evening'
    })()

    const firstName = (profile?.fullName ?? '').split(' ')[0]

    async function handleWaterChange(amount: number) {
        try {
            await updateWater.mutateAsync({ date: selectedDate, ml: amount })
        } catch (err) {
            console.error('Error changing water:', err)
        }
    }

    if (!summary) {
        return (
            <View style={s.loadingWrap}>
                <Text style={s.loadingText}>Loading dashboard...</Text>
            </View>
        )
    }

    return (
        <ScrollView
            style={s.scroll}
            contentContainerStyle={[
                s.container,
                { paddingTop: insets.top + 16, paddingBottom: TAB_BAR_CLEARANCE + 16 },
            ]}
            showsVerticalScrollIndicator={false}
        >
            {/* ── Header ─────────────────────────────────────────────── */}
            <View style={s.headerRow}>
                <View style={s.headerLeft}>
                    <View style={s.brandRow}>
                        <Ionicons name="logo-apple" size={26} color="#000000" />
                        <Text style={s.greeting}>Cal AI</Text>
                    </View>
                    <Text style={s.subGreeting}>
                        {greeting}, {firstName || 'there'}!
                    </Text>
                </View>
                <StreakBadge count={streak} />
            </View>

            {/* ── Calendar Strip ────────────────────────────────────── */}
            <View style={s.calendarWrap}>
                <CalendarStrip selectedDate={selectedDate} onDateSelect={setSelectedDate} />
            </View>

            {/* ── Macro Rings Card ────────────────────────────────────── */}
            <MacroRings
                calories={summary.caloriesConsumed}
                caloriesGoal={summary.caloriesGoal}
                protein={summary.proteinConsumed}
                proteinGoal={summary.proteinGoal}
                carbs={summary.carbsConsumed}
                carbsGoal={summary.carbsGoal}
                fat={summary.fatConsumed}
                fatGoal={summary.fatGoal}
            />

            {/* ── Action Buttons ──────────────────────────────────────── */}
            <View style={s.actionRow}>
                <Button label="Scan Meal" size="sm" onPress={() => router.push('/(tabs)/explore')} style={s.actionBtn} />
                <Button label="History" size="sm" variant="outline" onPress={() => router.push('/(tabs)/activity')} style={s.actionBtn} />
            </View>

            {/* ── Water Tracking ──────────────────────────────────────── */}
            <Card style={s.waterCard}>
                <View style={s.waterHeader}>
                    <View style={s.waterLabelRow}>
                        <Ionicons name="water" size={18} color="#007aff" />
                        <Text style={s.waterTitle}>Water Tracker</Text>
                    </View>
                    <Text style={s.waterValue}>
                        {summary.waterMl} / {summary.waterGoalMl} ml
                    </Text>
                </View>
                
                <View style={s.waterTrack}>
                    <View
                        style={[
                            s.waterFill,
                            {
                                width: `${Math.min(
                                    100,
                                    summary.waterGoalMl > 0
                                        ? (summary.waterMl / summary.waterGoalMl) * 100
                                        : 0
                                )}%`,
                            },
                        ]}
                    />
                </View>

                {/* Quick Logging Buttons */}
                <View style={s.waterButtonsRow}>
                    <Pressable
                        onPress={() => handleWaterChange(-250)}
                        style={({ pressed }) => [s.waterLogBtn, pressed && s.waterBtnPressed]}
                    >
                        <Ionicons name="remove-circle-outline" size={16} color="#6e6e73" />
                        <Text style={s.waterLogBtnText}>-250 ml</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => handleWaterChange(250)}
                        style={({ pressed }) => [s.waterLogBtn, s.waterLogBtnAdd, pressed && s.waterBtnPressed]}
                    >
                        <Ionicons name="add-circle-outline" size={16} color="#007aff" />
                        <Text style={[s.waterLogBtnText, s.waterLogBtnTextAdd]}>+250 ml</Text>
                    </Pressable>
                </View>
            </Card>

            {/* ── Weekly Chart ────────────────────────────────────────── */}
            <Text style={s.sectionTitle}>7-DAY OVERVIEW</Text>
            <Card style={s.chartCard}>
                <WeeklyChart data={weeklyChartData} />
            </Card>

            {/* ── Recent Meals ────────────────────────────────────────── */}
            <Text style={s.sectionTitle}>MEALS LOGGED FOR THIS DAY</Text>
            <Card style={s.activityCard}>
                {topLogs.length === 0 && (
                    <View style={s.emptyRow}>
                        <Text style={s.emptyText}>No meals logged for this date</Text>
                    </View>
                )}
                {topLogs.map((log, index) => (
                    <Pressable
                        key={log.id}
                        onPress={() => router.push(`/detail/${log.id}`)}
                        style={[s.activityRow, index < topLogs.length - 1 && s.activityDivider]}
                    >
                        <View style={s.activityIconWrap}>
                            <Ionicons name={mealIcon(log.mealType)} size={14} color="#000000" />
                        </View>
                        <View style={s.activityContent}>
                            <Text style={s.activityTitle}>{log.notes || 'Meal entry'}</Text>
                            <Text style={s.activitySub}>
                                {log.mealType.toUpperCase()} • {log.source.replace('_', ' ')}
                            </Text>
                        </View>
                        <Text style={s.activityCal}>{log.calories.toFixed(0)} kcal</Text>
                    </Pressable>
                ))}
            </Card>
        </ScrollView>
    )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    scroll: {
        flex: 1,
        backgroundColor: BG,
    },
    container: {
        paddingHorizontal: 20,
        gap: 14,
    },
    loadingWrap: {
        flex: 1,
        backgroundColor: BG,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: TEXT_SECONDARY,
    },

    // Header
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    headerLeft: {
        flex: 1,
        gap: 2,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    greeting: {
        fontSize: 24,
        fontWeight: '900',
        color: TEXT_PRIMARY,
        letterSpacing: -0.6,
    },
    subGreeting: {
        fontSize: 13,
        color: TEXT_SECONDARY,
        fontWeight: '500',
    },
    calendarWrap: {
        marginVertical: 4,
    },

    // Rings card
    ringsCard: {
        gap: 12,
        borderWidth: 1,
        borderColor: BORDER,
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: TEXT_TERTIARY,
        letterSpacing: 0.8,
    },

    // Action buttons
    actionRow: {
        flexDirection: 'row',
        gap: 10,
    },
    actionBtn: {
        flex: 1,
    },

    // Water card
    waterCard: {
        gap: 10,
        borderWidth: 1,
        borderColor: BORDER,
    },
    waterHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    waterLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    waterTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: TEXT_PRIMARY,
    },
    waterValue: {
        fontSize: 12,
        color: TEXT_SECONDARY,
        fontWeight: '600',
    },
    waterTrack: {
        height: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.03)',
        overflow: 'hidden',
    },
    waterFill: {
        height: '100%',
        borderRadius: 999,
        backgroundColor: '#007aff', // iOS blue
    },
    waterButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10,
        marginTop: 4,
    },
    waterLogBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#f5f5f7',
        borderWidth: 1,
        borderColor: BORDER,
    },
    waterLogBtnAdd: {
        backgroundColor: 'rgba(0,122,255,0.04)',
        borderColor: 'rgba(0,122,255,0.12)',
    },
    waterBtnPressed: {
        opacity: 0.7,
    },
    waterLogBtnText: {
        fontSize: 11.5,
        fontWeight: '600',
        color: TEXT_SECONDARY,
    },
    waterLogBtnTextAdd: {
        color: '#007aff',
    },

    // Section titles
    sectionTitle: {
        fontSize: 10,
        fontWeight: '700',
        color: TEXT_TERTIARY,
        letterSpacing: 0.8,
        marginTop: 4,
    },

    // Chart card
    chartCard: {
        paddingHorizontal: 8,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: BORDER,
    },

    // Activity / Meals
    activityCard: {
        paddingVertical: 4,
        paddingHorizontal: 0,
        borderWidth: 1,
        borderColor: BORDER,
    },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    activityDivider: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: BORDER,
    },
    activityIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f7',
    },
    activityContent: {
        flex: 1,
    },
    activityTitle: {
        fontSize: 13.5,
        color: TEXT_PRIMARY,
        fontWeight: '600',
        marginBottom: 1,
    },
    activitySub: {
        fontSize: 12,
        color: TEXT_SECONDARY,
        lineHeight: 18,
    },
    activityCal: {
        fontSize: 12,
        color: TEXT_PRIMARY,
        fontWeight: '600',
    },

    // Empty state
    emptyRow: {
        paddingHorizontal: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: TEXT_TERTIARY,
    },
})
