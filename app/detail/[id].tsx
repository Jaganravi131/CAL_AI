import { useState } from 'react'
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQueryClient } from '@tanstack/react-query'
import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AlertModal } from '@/components/ui/AppModal'
import { useToast } from '@/contexts/ToastContext'
import { supabase } from '@/lib/supabase'
import {
    BG,
    BORDER,
    TEXT_PRIMARY,
    TEXT_SECONDARY,
    TEXT_TERTIARY,
    ACCENT,
    ERROR,
} from '@/lib/theme'
import { useMealLog, useMealLogItems } from '@/hooks/useNutrition'

export default function DetailScreen() {
    const insets = useSafeAreaInsets()
    const { id } = useLocalSearchParams<{ id: string }>()
    const { showToast } = useToast()
    const queryClient = useQueryClient()

    const { data: meal, isLoading } = useMealLog(id)
    const { data: items = [] } = useMealLogItems(id)

    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    async function handleDelete() {
        setIsDeleting(true)
        try {
            const { error } = await supabase.from('meal_logs').delete().eq('id', id)
            if (error) throw error
            await queryClient.invalidateQueries({ queryKey: ['nutrition'] })
            showToast('Meal deleted', 'success')
            router.back()
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Could not delete meal', 'error')
        } finally {
            setIsDeleting(false)
            setShowDeleteModal(false)
        }
    }

    if (isLoading) {
        return (
            <View style={[s.centered, { backgroundColor: BG }]}>
                <ActivityIndicator color={ACCENT} />
            </View>
        )
    }

    if (!meal) {
        return (
            <View style={[s.centered, { backgroundColor: BG }]}>
                <Text style={s.notFoundTitle}>Meal not found</Text>
                <Pressable onPress={() => router.back()} style={s.notFoundBtn}>
                    <Text style={s.notFoundBtnText}>Go back</Text>
                </Pressable>
            </View>
        )
    }

    return (
        <View style={{ flex: 1, backgroundColor: BG }}>
            <View style={[s.header, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
                </Pressable>
                <Text style={s.headerTitle} numberOfLines={1}>Meal Details</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 28 }]}
                showsVerticalScrollIndicator={false}
            >
                <Card style={s.summaryCard}>
                    <View style={s.summaryTop}>
                        <Text style={s.mealType}>{meal.mealType.toUpperCase()}</Text>
                        <Text style={s.updatedText}>{new Date(meal.eatenAt).toLocaleString()}</Text>
                    </View>

                    <Text style={s.summaryText}>{meal.notes || 'Meal entry'}</Text>

                    <View style={s.metricsRow}>
                        <MetricItem label="Calories" value={`${meal.calories.toFixed(0)} kcal`} />
                        <MetricItem label="Protein" value={`${meal.protein.toFixed(1)} g`} />
                        <MetricItem label="Carbs" value={`${meal.carbs.toFixed(1)} g`} />
                        <MetricItem label="Fat" value={`${meal.fat.toFixed(1)} g`} />
                    </View>
                </Card>

                <Text style={s.sectionTitle}>Food Items</Text>
                <Card compact style={s.listCard}>
                    {items.length === 0 && (
                        <View style={s.emptyItems}>
                            <Text style={s.taskSub}>No line items found for this meal.</Text>
                        </View>
                    )}

                    {items.map((food, index) => (
                        <View key={food.id} style={[s.taskRow, index < items.length - 1 && s.taskDivider]}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.taskTitle}>{food.displayName}</Text>
                                <Text style={s.taskSub}>{food.servingG.toFixed(0)}g serving</Text>
                            </View>
                            <View style={s.priorityPill}>
                                <Text style={s.priorityText}>{food.calories.toFixed(0)} kcal</Text>
                            </View>
                        </View>
                    ))}
                </Card>

                {/* Delete button */}
                <Pressable
                    onPress={() => setShowDeleteModal(true)}
                    style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.7 }]}
                >
                    <Ionicons name="trash-outline" size={16} color={ERROR} />
                    <Text style={s.deleteBtnText}>Delete Meal</Text>
                </Pressable>
            </ScrollView>

            {/* Delete confirmation modal */}
            <AlertModal
                visible={showDeleteModal}
                title="Delete Meal"
                message="Delete this meal log? This cannot be undone."
                buttons={[
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: handleDelete,
                    },
                    {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => setShowDeleteModal(false),
                    },
                ]}
                onDismiss={() => setShowDeleteModal(false)}
            />
        </View>
    )
}

function MetricItem({ label, value }: { label: string; value: string }) {
    return (
        <View style={s.metricItem}>
            <Text style={s.metricLabel}>{label}</Text>
            <Text style={s.metricValue}>{value}</Text>
        </View>
    )
}

const s = StyleSheet.create({
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    notFoundTitle: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: '700' },
    notFoundBtn: {
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    notFoundBtnText: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: BORDER,
    },
    headerTitle: { flex: 1, color: TEXT_PRIMARY, fontSize: 16.5, fontWeight: '700', textAlign: 'center' },
    body: { padding: 20, gap: 12 },
    summaryCard: { gap: 8 },
    summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    mealType: { fontSize: 11, fontWeight: '700', color: ACCENT, letterSpacing: 0.8 },
    updatedText: { fontSize: 11, color: TEXT_TERTIARY },
    summaryText: { fontSize: 13, lineHeight: 19, color: TEXT_SECONDARY },
    metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
    metricItem: {
        minWidth: 120,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 9,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    metricLabel: { fontSize: 11, color: TEXT_TERTIARY },
    metricValue: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '700', marginTop: 2 },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: TEXT_TERTIARY,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginTop: 3,
    },
    listCard: { padding: 0, overflow: 'hidden' },
    emptyItems: { paddingHorizontal: 13, paddingVertical: 14 },
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 13,
        paddingVertical: 11,
    },
    taskDivider: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: BORDER,
    },
    taskTitle: { fontSize: 13.5, color: TEXT_PRIMARY, fontWeight: '600' },
    taskSub: { marginTop: 2, fontSize: 12, color: TEXT_SECONDARY },
    priorityPill: {
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    priorityText: { fontSize: 11, color: TEXT_PRIMARY, fontWeight: '700' },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        marginTop: 8,
        borderWidth: 1,
        borderColor: 'rgba(248,113,113,0.22)',
        borderRadius: 14,
        backgroundColor: 'rgba(248,113,113,0.06)',
    },
    deleteBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: ERROR,
    },
})
