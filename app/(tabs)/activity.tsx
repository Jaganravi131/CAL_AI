import { useMemo, useState } from 'react'
import { View, ScrollView, StyleSheet, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import CalendarStrip from '@/components/CalendarStrip'
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
import { useMacroProgress, useMealLogs, useTodaySummary, type MealLog } from '@/hooks/useNutrition'

type TabType = 'all' | 'photo_ai'

function todayDate() {
    return new Date().toISOString().slice(0, 10)
}

const MEAL_SECTIONS: Array<{
    key: 'breakfast' | 'lunch' | 'dinner' | 'snack'
    label: string
    emoji: string
    icon: keyof typeof Ionicons.glyphMap
}> = [
    { key: 'breakfast', label: 'Breakfast', emoji: '🍳', icon: 'sunny-outline' },
    { key: 'lunch', label: 'Lunch', emoji: '🥗', icon: 'restaurant-outline' },
    { key: 'dinner', label: 'Dinner', emoji: '🥩', icon: 'moon-outline' },
    { key: 'snack', label: 'Snack', emoji: '🍎', icon: 'nutrition-outline' },
]

export default function ActivityScreen() {
    const insets = useSafeAreaInsets()
    const [activeTab, setActiveTab] = useState<TabType>('all')
    const [selectedDate, setSelectedDate] = useState(todayDate())
    const { data: summary } = useTodaySummary(selectedDate)
    const { data: logs = [] } = useMealLogs(selectedDate)

    if (!summary) {
        return (
            <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: TEXT_SECONDARY }}>Loading...</Text>
            </View>
        )
    }

    const progress = useMacroProgress(summary)

    const filteredLogs = useMemo(() => {
        if (activeTab === 'all') return logs
        return logs.filter((item) => item.source === 'photo_ai')
    }, [activeTab, logs])

    const grouped = useMemo(() => {
        const map: Record<string, MealLog[]> = {
            breakfast: [],
            lunch: [],
            dinner: [],
            snack: [],
        }
        for (const log of filteredLogs) {
            if (map[log.mealType]) {
                map[log.mealType].push(log)
            }
        }
        return map
    }, [filteredLogs])

    const aiCount = useMemo(() => logs.filter((item) => item.source === 'photo_ai').length, [logs])
    const caloriesRemaining = Math.max(0, summary.caloriesGoal - summary.caloriesConsumed)

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: BG }}
            contentContainerStyle={[s.container, { paddingTop: insets.top + 16, paddingBottom: TAB_BAR_CLEARANCE + 16 }]}
            showsVerticalScrollIndicator={false}
        >
            <View style={s.header}>
                <View>
                    <Text style={s.title}>Diary</Text>
                    <Text style={s.subtitle}>Track your daily meals and macros</Text>
                </View>

                <Pressable onPress={() => router.push('/(tabs)/explore')} style={({ pressed }) => [s.addBtn, pressed && { opacity: 0.75 }]}>
                    <Ionicons name="add" size={18} color={TEXT_PRIMARY} />
                    <Text style={s.addBtnText}>Log</Text>
                </Pressable>
            </View>

            <CalendarStrip selectedDate={selectedDate} onDateSelect={setSelectedDate} />

            {/* Daily summary card */}
            <Card style={s.summaryCard}>
                <View style={s.summaryRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.summaryCalories}>{summary.caloriesConsumed.toFixed(0)} kcal</Text>
                        <Text style={s.summaryRemaining}>{caloriesRemaining.toFixed(0)} remaining of {summary.caloriesGoal.toFixed(0)}</Text>
                    </View>
                    <View style={s.summaryPct}>
                        <Text style={s.summaryPctText}>{progress.caloriesPct}%</Text>
                    </View>
                </View>
                <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${Math.min(100, Math.max(2, progress.caloriesPct))}%` }]} />
                </View>
                <View style={s.macroMinRow}>
                    <MacroMini label="Protein" value={`${summary.proteinConsumed.toFixed(0)}g`} color="#f97316" />
                    <MacroMini label="Carbs" value={`${summary.carbsConsumed.toFixed(0)}g`} color="#a855f7" />
                    <MacroMini label="Fat" value={`${summary.fatConsumed.toFixed(0)}g`} color="#3b82f6" />
                </View>
            </Card>

            {/* Tab filter */}
            <View style={s.segmentRow}>
                <Pressable
                    onPress={() => setActiveTab('all')}
                    style={[s.segmentItem, activeTab === 'all' && s.segmentItemActive]}
                >
                    <Text style={[s.segmentText, activeTab === 'all' && s.segmentTextActive]}>All ({filteredLogs.length})</Text>
                </Pressable>
                <Pressable
                    onPress={() => setActiveTab('photo_ai')}
                    style={[s.segmentItem, activeTab === 'photo_ai' && s.segmentItemActive]}
                >
                    <Text style={[s.segmentText, activeTab === 'photo_ai' && s.segmentTextActive]}>AI Scan ({aiCount})</Text>
                </Pressable>
            </View>

            {/* Grouped meal sections */}
            {MEAL_SECTIONS.map((section) => {
                const items = grouped[section.key] || []
                const sectionCals = items.reduce((sum, l) => sum + l.calories, 0)

                return (
                    <View key={section.key}>
                        <View style={s.sectionHeader}>
                            <Text style={s.sectionEmoji}>{section.emoji}</Text>
                            <Text style={s.sectionLabel}>{section.label}</Text>
                            {items.length > 0 && (
                                <Text style={s.sectionCals}>{sectionCals.toFixed(0)} kcal</Text>
                            )}
                        </View>

                        {items.length === 0 ? (
                            <Pressable
                                onPress={() => router.push('/(tabs)/explore')}
                                style={({ pressed }) => [s.addMealBtn, pressed && { opacity: 0.7 }]}
                            >
                                <Ionicons name="add-circle-outline" size={16} color={TEXT_TERTIARY} />
                                <Text style={s.addMealText}>Add {section.label.toLowerCase()}</Text>
                            </Pressable>
                        ) : (
                            <Card style={s.listCard}>
                                {items.map((item, index) => (
                                    <Pressable
                                        key={item.id}
                                        onPress={() => router.push(`/detail/${item.id}`)}
                                        style={[s.row, index < items.length - 1 && s.rowDivider]}
                                    >
                                        <View style={s.iconWrap}>
                                            <Ionicons name={section.icon} size={14} color={ACCENT} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.rowTitle}>{item.notes || 'Meal log entry'}</Text>
                                            <View style={s.rowMeta}>
                                                <Text style={s.rowTime}>
                                                    {new Date(item.eatenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </Text>
                                                {item.source === 'photo_ai' && (
                                                    <View style={s.aiBadge}>
                                                        <Text style={s.aiBadgeText}>AI</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <Text style={s.calories}>{item.calories.toFixed(0)} kcal</Text>
                                    </Pressable>
                                ))}
                            </Card>
                        )}
                    </View>
                )
            })}
        </ScrollView>
    )
}

function MacroMini({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <View style={s.macroMini}>
            <View style={[s.macroDot, { backgroundColor: color }]} />
            <Text style={s.macroMiniLabel}>{label}</Text>
            <Text style={s.macroMiniValue}>{value}</Text>
        </View>
    )
}

const s = StyleSheet.create({
    container: { paddingHorizontal: 20, gap: 12 },
    header: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' },
    title: { fontSize: 24, fontWeight: '800', color: TEXT_PRIMARY, letterSpacing: -0.5 },
    subtitle: { marginTop: 3, fontSize: 13, color: TEXT_SECONDARY },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 9,
    },
    addBtnText: { fontSize: 12, color: TEXT_PRIMARY, fontWeight: '600' },

    // Summary card
    summaryCard: { gap: 10 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    summaryCalories: { fontSize: 28, fontWeight: '800', color: TEXT_PRIMARY, letterSpacing: -0.8 },
    summaryRemaining: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 },
    summaryPct: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: ACCENT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryPctText: { fontSize: 13, fontWeight: '800', color: ACCENT },
    progressTrack: {
        height: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
    },
    progressFill: {
        height: 6,
        borderRadius: 999,
        backgroundColor: ACCENT,
    },
    macroMinRow: { flexDirection: 'row', gap: 16, marginTop: 2 },
    macroMini: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    macroDot: { width: 8, height: 8, borderRadius: 4 },
    macroMiniLabel: { fontSize: 11, color: TEXT_TERTIARY },
    macroMiniValue: { fontSize: 11, color: TEXT_PRIMARY, fontWeight: '700' },

    // Segment tabs
    segmentRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 11,
        padding: 3,
    },
    segmentItem: {
        flex: 1,
        borderRadius: 8,
        alignItems: 'center',
        paddingVertical: 7,
    },
    segmentItemActive: {
        backgroundColor: 'rgba(255,255,255,0.14)',
    },
    segmentText: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600' },
    segmentTextActive: { color: TEXT_PRIMARY },

    // Meal sections
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        marginBottom: 4,
    },
    sectionEmoji: { fontSize: 16 },
    sectionLabel: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY, flex: 1 },
    sectionCals: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },

    addMealBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 14,
        borderStyle: 'dashed',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    addMealText: { fontSize: 13, color: TEXT_TERTIARY },

    // Meal list
    listCard: { paddingVertical: 2, paddingHorizontal: 0 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
    iconWrap: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ACCENT_DIM,
    },
    rowTitle: { fontSize: 13.5, color: TEXT_PRIMARY, fontWeight: '700' },
    rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
    rowTime: { fontSize: 11, color: TEXT_TERTIARY },
    aiBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        backgroundColor: 'rgba(14,165,164,0.15)',
    },
    aiBadgeText: { fontSize: 9, fontWeight: '700', color: ACCENT },
    calories: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '700' },
})
