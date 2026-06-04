import { useState } from 'react'
import { View, ScrollView, StyleSheet, Pressable, DeviceEventEmitter, Modal } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import { AlertModal } from '@/components/ui/AppModal'
import SettingsRow from '@/components/ui/SettingsRow'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { logoutRevenueCat } from '@/lib/purchases'
import { supabase, isSupabaseEnabled } from '@/lib/supabase'
import { track } from '@/lib/analytics'
import { adjustBrightness } from '@/lib/utils'
import {
    ACCENT,
    ACCENT_BORDER,
    BORDER,
    SURFACE,
    BG,
    TEXT_PRIMARY,
    TEXT_SECONDARY,
    TEXT_TERTIARY,
} from '@/lib/theme'
import { TAB_BAR_CLEARANCE } from '@/components/TabBar'
import { demoUser } from '@/lib/mockData'
import { useProfile } from '@/hooks/useProfile'
import { useTranslation } from 'react-i18next'
import { getCurrentLocale, setLanguage, localeNames, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n'

export default function ProfileScreen() {
    const insets = useSafeAreaInsets()
    const { t } = useTranslation()
    const currentLocale = getCurrentLocale()
    const { isPremium, customerInfo } = useSubscription()
    const { data: profile } = useProfile()
    const [signOutModal, setSignOutModal] = useState(false)
    const [signingOut, setSigningOut] = useState(false)
    const [errorModal, setErrorModal] = useState<string | null>(null)
    const [languageModalVisible, setLanguageModalVisible] = useState(false)

    const expiryMs = customerInfo?.entitlements.active['premium']?.expirationDate
    const expiryDate = expiryMs
        ? new Date(expiryMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : null

    async function handleSignOut() {
        setSigningOut(true)
        try {
            track('logout')
            await logoutRevenueCat()
            if (!isSupabaseEnabled) {
                DeviceEventEmitter.emit('__dev_logout__')
            } else {
                const { error } = await supabase.auth.signOut()
                if (error) throw error
            }
        } catch (e: any) {
            setErrorModal(e?.message ?? 'Sign out failed. Please try again.')
        } finally {
            setSigningOut(false)
        }
    }

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: BG }}
            contentContainerStyle={[s.container, { paddingTop: insets.top + 16, paddingBottom: TAB_BAR_CLEARANCE + 16 }]}
            showsVerticalScrollIndicator={false}
        >
            <Card style={s.heroCard}>
                <LinearGradient
                    colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.02)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                />

                <View style={s.avatarWrap}>
                    <Text style={s.avatarText}>{profile?.initials ?? demoUser.initials}</Text>
                    {isPremium && (
                        <View style={s.premiumDot}>
                            <Ionicons name="sparkles" size={10} color="#fff" />
                        </View>
                    )}
                </View>

                <Text style={s.name}>{profile?.fullName ?? demoUser.fullName}</Text>
                <Text style={s.metaText}>{demoUser.role} · {demoUser.teamName}</Text>
                <Text style={s.metaText}>{profile?.email ?? demoUser.email}</Text>
            </Card>

            {isPremium ? (
                <Card style={[s.planCard, { borderColor: ACCENT_BORDER }]}>
                    <View style={s.planTop}>
                        <View style={s.planBadge}>
                            <Ionicons name="sparkles" size={11} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.planTitle}>Premium Active</Text>
                            <Text style={s.planSub}>{expiryDate ? `Renews ${expiryDate}` : 'Billing cycle active'}</Text>
                        </View>
                        <Pressable onPress={() => router.push('/upgrade')} style={s.manageBtn}>
                            <Text style={s.manageBtnText}>Manage</Text>
                        </Pressable>
                    </View>
                </Card>
            ) : (
                <Pressable onPress={() => router.push('/upgrade')} style={s.upgradeCard}>
                    <LinearGradient
                        colors={[ACCENT, adjustBrightness(ACCENT, -18)]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFillObject}
                    />
                    <Ionicons name="sparkles" size={15} color="#fff" />
                    <View style={{ flex: 1 }}>
                        <Text style={s.upgradeTitle}>Upgrade to Premium</Text>
                        <Text style={s.upgradeSub}>Advanced controls, faster support, and all modules.</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.8)" />
                </Pressable>
            )}

            <Text style={s.sectionTitle}>Account</Text>
            <Card compact style={s.sectionCard}>
                <SettingsRow icon="globe-outline" label={t('Profile.language')} value={localeNames[currentLocale]} onPress={() => setLanguageModalVisible(true)} />
                <SettingsRow icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
                <SettingsRow icon="help-buoy-outline" label="Support" onPress={() => router.push('/support')} />
                <SettingsRow icon="document-text-outline" label={t('Profile.privacy')} onPress={() => router.push('/privacy')} />
                <SettingsRow icon="shield-checkmark-outline" label={t('Profile.terms')} onPress={() => router.push('/terms')} last={true} />
            </Card>

            <Pressable
                onPress={() => setSignOutModal(true)}
                disabled={signingOut}
                style={({ pressed }) => [s.signOutBtn, (pressed || signingOut) && { opacity: 0.72 }]}
            >
                <Ionicons name="log-out-outline" size={17} color="#ff3b30" />
                <Text style={s.signOutText}>{signingOut ? `${t('Profile.signOut')}...` : t('Profile.signOut')}</Text>
            </Pressable>

            <AlertModal
                visible={signOutModal}
                title={t('Profile.signOutTitle')}
                message={t('Profile.signOutSubtitle')}
                buttons={[
                    { text: t('Common.cancel'), style: 'cancel', onPress: () => setSignOutModal(false) },
                    { text: t('Profile.signOutConfirm'), style: 'destructive', onPress: () => { setSignOutModal(false); handleSignOut() } },
                ]}
                onDismiss={() => setSignOutModal(false)}
            />

            <AlertModal
                visible={!!errorModal}
                title="Error"
                message={errorModal ?? ''}
                buttons={[{ text: 'OK', onPress: () => setErrorModal(null) }]}
                onDismiss={() => setErrorModal(null)}
            />

            <Modal visible={languageModalVisible} animationType="slide" transparent>
                <View style={s.modalOverlay}>
                    <View style={s.modalSheet}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>{t('Profile.language')}</Text>
                            <Pressable onPress={() => setLanguageModalVisible(false)}>
                                <Ionicons name="close" size={22} color={TEXT_SECONDARY} />
                            </Pressable>
                        </View>

                        <View style={{ gap: 10, marginTop: 8 }}>
                            {SUPPORTED_LOCALES.map((locale) => {
                                const active = locale === currentLocale
                                return (
                                    <Pressable
                                        key={locale}
                                        onPress={async () => {
                                            await setLanguage(locale)
                                            setLanguageModalVisible(false)
                                        }}
                                        style={[s.langOptionRow, active && s.langOptionActive]}
                                    >
                                        <Text style={[s.langOptionText, active && s.langOptionTextActive]}>
                                            {localeNames[locale]}
                                        </Text>
                                        {active && (
                                            <Ionicons name="checkmark-circle" size={20} color="#000000" />
                                        )}
                                    </Pressable>
                                )
                            })}
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    )
}


const s = StyleSheet.create({
    container: { paddingHorizontal: 20, gap: 14 },
    heroCard: {
        overflow: 'hidden',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 16,
    },
    avatarWrap: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ACCENT,
        marginBottom: 4,
    },
    avatarText: { fontSize: 24, fontWeight: '800', color: '#fff' },
    premiumDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 20,
        height: 20,
        borderRadius: 999,
        backgroundColor: ACCENT,
        borderWidth: 2,
        borderColor: BG,
        alignItems: 'center',
        justifyContent: 'center',
    },
    name: { fontSize: 22, fontWeight: '800', color: TEXT_PRIMARY, letterSpacing: -0.4 },
    metaText: { fontSize: 12.5, color: TEXT_SECONDARY },
    planCard: {
        borderWidth: 1,
        paddingVertical: 12,
    },
    planTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    planBadge: {
        width: 30,
        height: 30,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ACCENT,
    },
    planTitle: { color: ACCENT, fontSize: 14.5, fontWeight: '700' },
    planSub: { color: TEXT_SECONDARY, fontSize: 12 },
    manageBtn: {
        borderWidth: 1,
        borderColor: ACCENT_BORDER,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    manageBtnText: { color: ACCENT, fontSize: 12, fontWeight: '600' },
    upgradeCard: {
        minHeight: 66,
        borderRadius: 16,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
    },
    upgradeTitle: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
    upgradeSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: TEXT_TERTIARY,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginTop: 3,
        marginBottom: -4,
    },
    sectionCard: { padding: 0, overflow: 'hidden' },
    signOutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingVertical: 12,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        borderRadius: 14,
        marginTop: 12,
    },
    signOutText: { color: '#ff3b30', fontSize: 14, fontWeight: '600' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: SURFACE,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: 36,
        gap: 14,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: TEXT_PRIMARY,
    },
    langOptionRow: {
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#f5f5f7',
        borderWidth: 1,
        borderColor: BORDER,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    langOptionActive: {
        backgroundColor: 'rgba(0,0,0,0.04)',
        borderColor: '#000000',
    },
    langOptionText: {
        fontSize: 15,
        fontWeight: '600',
        color: TEXT_PRIMARY,
    },
    langOptionTextActive: {
        color: '#000000',
        fontWeight: '700',
    },
})
