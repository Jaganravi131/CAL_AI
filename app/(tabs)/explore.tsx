import { useState, useMemo, useRef, useEffect } from 'react'
import {
    ActivityIndicator,
    View,
    ScrollView,
    StyleSheet,
    Pressable,
    Modal,
    TextInput,
    Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import TextInputField from '@/components/ui/TextInputField'
import { Button } from '@/components/ui/Button'
import {
    ACCENT,
    BG,
    BORDER,
    TEXT_PRIMARY,
    TEXT_SECONDARY,
    TEXT_TERTIARY,
    SURFACE,
    SUCCESS,
} from '@/lib/theme'
import { TAB_BAR_CLEARANCE } from '@/components/TabBar'
import { useToast } from '@/contexts/ToastContext'
import { MealType, useCreateMealLog, useFoodSearch, FoodSearchResult } from '@/hooks/useNutrition'
import { scanFoodPhoto, type FoodScanResult } from '@/lib/foodScan'
import { getCurrentLocale } from '@/lib/i18n'

const MEAL_TYPES: Array<{ key: MealType; label: string }> = [
    { key: 'breakfast', label: 'Breakfast' },
    { key: 'lunch', label: 'Lunch' },
    { key: 'dinner', label: 'Dinner' },
    { key: 'snack', label: 'Snack' },
]

const BARCODE_DB: Record<string, { name: string; brand: string; caloriesPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; defaultServingG: number }> = {
  '041570110199': { name: 'Classic Rolled Oats', brand: 'Quaker', caloriesPer100g: 375, proteinPer100g: 12.5, carbsPer100g: 67.5, fatPer100g: 6.25, defaultServingG: 40 },
  '021130709971': { name: 'Plain Nonfat Greek Yogurt', brand: 'Chobani', caloriesPer100g: 53, proteinPer100g: 9.4, carbsPer100g: 3.5, fatPer100g: 0, defaultServingG: 170 },
  '012345678901': { name: 'Whey Gold Standard (Chocolate)', brand: 'Optimum Nutrition', caloriesPer100g: 387, proteinPer100g: 77.4, carbsPer100g: 9.6, fatPer100g: 4.8, defaultServingG: 31 },
  '737628011860': { name: 'Organic Firm Tofu', brand: 'House Foods', caloriesPer100g: 105, proteinPer100g: 11.7, carbsPer100g: 2.3, fatPer100g: 5.8, defaultServingG: 85 },
  '034000002284': { name: 'Milk Chocolate Candy Bar', brand: "Hershey's", caloriesPer100g: 511, proteinPer100g: 6.9, carbsPer100g: 58.1, fatPer100g: 30.2, defaultServingG: 43 },
}

export default function ExploreScreen() {
    const insets = useSafeAreaInsets()
    const [query, setQuery] = useState('')
    const [mealType, setMealType] = useState<MealType>('lunch')
    
    // Scans & Modals States
    const [scanResult, setScanResult] = useState<FoodScanResult | null>(null)
    const [scanImageUri, setScanImageUri] = useState<string | null>(null)
    const [isScanning, setIsScanning] = useState(false)
    const [servingMultiplier, setServingMultiplier] = useState(1)
    
    // Modals
    const [isAiAssistVisible, setIsAiAssistVisible] = useState(false)
    const [aiDescription, setAiDescription] = useState('')
    
    const [isBarcodeVisible, setIsBarcodeVisible] = useState(false)
    const [barcodeInput, setBarcodeInput] = useState('')
    
    const [isEditorVisible, setIsEditorVisible] = useState(false)
    const [selectedFood, setSelectedFood] = useState<FoodSearchResult | null>(null)
    const [servingSize, setServingSize] = useState('100')

    const { showToast } = useToast()
    const createMealLog = useCreateMealLog()
    const { data: foods = [] } = useFoodSearch(query)

    // Webcam States for Web Browser camera capture support
    const [isWebCamVisible, setIsWebCamVisible] = useState(false)
    const [webcamStream, setWebcamStream] = useState<any>(null)
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
    const videoRef = useRef<any>(null)
    const VideoTag = 'video' as any

    // Clean up webcam streams on unmount or visibility change
    useEffect(() => {
        return () => {
            if (Platform.OS === 'web' && webcamStream) {
                webcamStream.getTracks().forEach((track: any) => track.stop())
            }
        }
    }, [webcamStream])

    // Webcam stream lifecycle
    async function startWebcamStream(mode: 'user' | 'environment' = 'environment') {
        if (webcamStream) {
            webcamStream.getTracks().forEach((track: any) => track.stop())
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: mode }
            })
            setWebcamStream(stream)
            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }
        } catch (err) {
            console.error('Webcam stream error:', err)
            showToast('Unable to access camera. Please allow camera permissions.', 'error')
            setIsWebCamVisible(false)
        }
    }

    function stopWebcam() {
        if (webcamStream) {
            webcamStream.getTracks().forEach((track: any) => track.stop())
            setWebcamStream(null)
        }
    }

    async function toggleFacingMode() {
        const nextMode = facingMode === 'user' ? 'environment' : 'user'
        setFacingMode(nextMode)
        await startWebcamStream(nextMode)
    }

    async function triggerDirectAnalysis(imageUri: string) {
        setIsScanning(true)
        setIsAiAssistVisible(false)
        try {
            const scan = await scanFoodPhoto({ 
                imageUri, 
                mealType, 
                description: '',
                locale: getCurrentLocale()
            })
            setScanResult(scan)
            setServingMultiplier(1)
            showToast('Photo analyzed successfully!', 'success')
        } catch (error) {
            showToast('Could not analyze photo', 'error')
        } finally {
            setIsScanning(false)
        }
    }

    function captureWebcamPhoto() {
        if (!videoRef.current) return
        const video = videoRef.current
        if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
            showToast('Camera feed is still loading. Please try again in a moment.', 'error')
            return
        }
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
        const ctx = canvas.getContext('2d')
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.3)
            stopWebcam()
            setIsWebCamVisible(false)
            setScanImageUri(dataUrl)
            setAiDescription('')
            triggerDirectAnalysis(dataUrl)
        } else {
            showToast('Failed to capture frame from webcam.', 'error')
        }
    }

    // Image scan trigger
    async function startScanFlow(source: 'camera' | 'library') {
        try {
            if (Platform.OS === 'web' && source === 'camera') {
                setIsWebCamVisible(true)
                setFacingMode('environment')
                await startWebcamStream('environment')
                return
            }

            if (source === 'camera') {
                const { status } = await ImagePicker.requestCameraPermissionsAsync()
                if (status !== 'granted') {
                    showToast('Camera permission is required to capture photos.', 'error')
                    return
                }
            } else {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
                if (status !== 'granted') {
                    showToast('Photo library permission is required to upload images.', 'error')
                    return
                }
            }

            const picker = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync
            const result = await picker({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.3,
            })

            if (result.canceled || !result.assets[0]) return

            const asset = result.assets[0]
            const selectedUri = asset.uri
            setScanImageUri(selectedUri)
            setAiDescription('')
            triggerDirectAnalysis(selectedUri)
        } catch (err) {
            console.error('Image picker error:', err)
            showToast('Failed to access camera or library.', 'error')
        }
    }

    // Run AI scanning parser
    async function handleAiAnalysis() {
        if (!scanImageUri) return
        setIsAiAssistVisible(false)
        setIsScanning(true)

        try {
            const scan = await scanFoodPhoto({ 
                imageUri: scanImageUri, 
                mealType, 
                description: aiDescription.trim(),
                locale: getCurrentLocale()
            })
            setScanResult(scan)
            setServingMultiplier(1)
            showToast('Photo analyzed successfully!', 'success')
        } catch (error) {
            showToast('Could not analyze photo', 'error')
        } finally {
            setIsScanning(false)
        }
    }

    // Save scan results with multiplier applied
    async function saveScan() {
        if (!scanResult) return

        try {
            const scaledScan: FoodScanResult = {
                ...scanResult,
                calories: scanResult.calories * servingMultiplier,
                protein: scanResult.protein * servingMultiplier,
                carbs: scanResult.carbs * servingMultiplier,
                fat: scanResult.fat * servingMultiplier,
                items: scanResult.items.map(item => ({
                    ...item,
                    servingG: item.servingG * servingMultiplier,
                    calories: item.calories * servingMultiplier,
                    protein: item.protein * servingMultiplier,
                    carbs: item.carbs * servingMultiplier,
                    fat: item.fat * servingMultiplier,
                }))
            }
            await createMealLog.mutateAsync({ scan: scaledScan, mealType })
            showToast('Scan saved to diary', 'success')
            setScanResult(null)
            setScanImageUri(null)
            setServingMultiplier(1)
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'Could not save scan', 'error')
        }
    }

    // Quick log at 100g
    async function handleQuickLog(item: FoodSearchResult) {
        try {
            const scan: FoodScanResult = {
                mealType,
                title: item.name,
                notes: `Logged via quick search (${item.brand})`,
                confidence: 1.0,
                calories: item.caloriesPer100g,
                protein: item.proteinPer100g,
                carbs: item.carbsPer100g,
                fat: item.fatPer100g,
                items: [
                    {
                        displayName: item.name,
                        servingG: 100,
                        calories: item.caloriesPer100g,
                        protein: item.proteinPer100g,
                        carbs: item.carbsPer100g,
                        fat: item.fatPer100g
                    }
                ]
            }
            await createMealLog.mutateAsync({ scan, mealType, source: 'manual' })
            showToast(`${item.name} logged successfully!`, 'success')
        } catch {
            showToast('Could not quick log item', 'error')
        }
    }

    // Open detailed serving size editor
    function openEditor(item: FoodSearchResult) {
        setSelectedFood(item)
        setServingSize('100')
        setIsEditorVisible(true)
    }

    // Log custom serving size to database
    async function handleLogServing() {
        if (!selectedFood) return
        const grams = parseFloat(servingSize)
        if (isNaN(grams) || grams <= 0) {
            showToast('Please enter a valid serving weight', 'error')
            return
        }

        const factor = grams / 100
        const calories = selectedFood.caloriesPer100g * factor
        const protein = selectedFood.proteinPer100g * factor
        const carbs = selectedFood.carbsPer100g * factor
        const fat = selectedFood.fatPer100g * factor

        try {
            const scan: FoodScanResult = {
                mealType,
                title: selectedFood.name,
                notes: `${Math.round(grams)}g serving of ${selectedFood.name}`,
                confidence: 1.0,
                calories,
                protein,
                carbs,
                fat,
                items: [
                    {
                        displayName: selectedFood.name,
                        servingG: grams,
                        calories,
                        protein,
                        carbs,
                        fat,
                    }
                ]
            }
            await createMealLog.mutateAsync({ scan, mealType, source: 'manual' })
            showToast(`Logged ${Math.round(grams)}g of ${selectedFood.name}`, 'success')
            setIsEditorVisible(false)
            setSelectedFood(null)
        } catch {
            showToast('Failed to log food item', 'error')
        }
    }

    // Barcode Lookup Trigger
    function handleBarcodeSearch() {
        const barcode = barcodeInput.trim()
        if (!barcode) return

        const match = BARCODE_DB[barcode]
        if (match) {
            showToast(`Product recognized: ${match.name}`, 'success')
            setIsBarcodeVisible(false)
            setBarcodeInput('')
            
            const result: FoodSearchResult = {
                id: `barcode-${barcode}`,
                name: match.name,
                brand: match.brand,
                caloriesPer100g: match.caloriesPer100g,
                proteinPer100g: match.proteinPer100g,
                carbsPer100g: match.carbsPer100g,
                fatPer100g: match.fatPer100g,
            }
            openEditor(result)
        } else {
            showToast('Barcode not recognized. Try one of the test codes.', 'error')
        }
    }

    // Dynamic macros preview inside Editor
    const editorPreview = useMemo(() => {
        if (!selectedFood) return null
        const grams = parseFloat(servingSize) || 0
        const factor = grams / 100
        return {
            calories: (selectedFood.caloriesPer100g * factor).toFixed(0),
            protein: (selectedFood.proteinPer100g * factor).toFixed(1),
            carbs: (selectedFood.carbsPer100g * factor).toFixed(1),
            fat: (selectedFood.fatPer100g * factor).toFixed(1),
        }
    }, [selectedFood, servingSize])

    // Scaled scan results values based on multiplier
    const scaledScanValues = useMemo(() => {
        if (!scanResult) return null
        return {
            calories: (scanResult.calories * servingMultiplier).toFixed(0),
            protein: (scanResult.protein * servingMultiplier).toFixed(1),
            carbs: (scanResult.carbs * servingMultiplier).toFixed(1),
            fat: (scanResult.fat * servingMultiplier).toFixed(1),
        }
    }, [scanResult, servingMultiplier])

    // Macro ratios calculations
    const macroRatios = useMemo(() => {
        if (!scanResult) return null
        const pG = scanResult.protein * servingMultiplier
        const cG = scanResult.carbs * servingMultiplier
        const fG = scanResult.fat * servingMultiplier
        
        const pCal = pG * 4
        const cCal = cG * 4
        const fCal = fG * 9
        const totalCal = pCal + cCal + fCal
        
        if (totalCal <= 0 || isNaN(totalCal)) return { protein: 33, carbs: 33, fat: 34 }
        
        const pPct = Math.round((pCal / totalCal) * 100)
        const cPct = Math.round((cCal / totalCal) * 100)
        const fPct = 100 - pPct - cPct
        
        return { protein: pPct, carbs: cPct, fat: fPct }
    }, [scanResult, servingMultiplier])

    // RENDER: DEDICATED SCAN RESULTS VIEW (Matches Cal AI see the calories screenshot)
    if (scanImageUri && scanResult && scaledScanValues) {
        return (
            <View style={[s.fullScreenContainer, { paddingTop: insets.top }]}>
                <View style={s.scanResultHeader}>
                    <Pressable onPress={() => { setScanResult(null); setScanImageUri(null) }} style={s.backCircle}>
                        <Ionicons name="chevron-back" size={22} color="#000000" />
                    </Pressable>
                    <Text style={s.scanHeaderTitle}>Nutrition</Text>
                    <View style={s.shareCircle}>
                        <Ionicons name="share-outline" size={20} color="#000000" />
                    </View>
                </View>

                <ScrollView contentContainerStyle={s.scanResultScroll} showsVerticalScrollIndicator={false}>
                    <View style={s.bowlImageContainer}>
                        <Image source={{ uri: scanImageUri }} style={s.bowlImage as any} contentFit="cover" />
                    </View>

                    <View style={s.sheetCard}>
                        <View style={s.titleStepperRow}>
                            <Text style={s.sheetFoodName}>{scanResult.title}</Text>
                            <View style={s.stepperControl}>
                                <Pressable 
                                    onPress={() => setServingMultiplier(prev => Math.max(0.5, prev - 0.5))} 
                                    style={s.stepperBtnSmall}
                                >
                                    <Ionicons name="remove" size={16} color="#000000" />
                                </Pressable>
                                <Text style={s.stepperQtyText}>{servingMultiplier}x</Text>
                                <Pressable 
                                    onPress={() => setServingMultiplier(prev => prev + 0.5)} 
                                    style={s.stepperBtnSmall}
                                >
                                    <Ionicons name="add" size={16} color="#000000" />
                                </Pressable>
                            </View>
                        </View>

                        <View style={s.wideCaloriePill}>
                            <Ionicons name="flame" size={20} color="#ff9500" />
                            <Text style={s.wideCalorieText}>Calories {scaledScanValues.calories}</Text>
                        </View>

                        <View style={s.macrosGrid}>
                            <View style={s.macroGridCol}>
                                <Text style={s.macroGridLabel}>Protein</Text>
                                <Text style={[s.macroGridVal, { color: '#ff3b30' }]}>{scaledScanValues.protein}g</Text>
                            </View>
                            <View style={s.macroGridCol}>
                                <Text style={s.macroGridLabel}>Carbs</Text>
                                <Text style={[s.macroGridVal, { color: '#ff9500' }]}>{scaledScanValues.carbs}g</Text>
                            </View>
                            <View style={s.macroGridCol}>
                                <Text style={s.macroGridLabel}>Fat</Text>
                                <Text style={[s.macroGridVal, { color: '#007aff' }]}>{scaledScanValues.fat}g</Text>
                            </View>
                        </View>

                        {macroRatios && (
                            <View style={s.ratioSection}>
                                <View style={s.ratioLabelsRow}>
                                    <Text style={s.ratioLabel}>Calorie Split</Text>
                                    <Text style={s.ratioValueText}>
                                        Protein {macroRatios.protein}%  •  Carbs {macroRatios.carbs}%  •  Fat {macroRatios.fat}%
                                    </Text>
                                </View>
                                <View style={s.ratioBarContainer}>
                                    <View style={[s.ratioBarSegment, { flex: Math.max(1, macroRatios.protein), backgroundColor: '#ff3b30' }]} />
                                    <View style={[s.ratioBarSegment, { flex: Math.max(1, macroRatios.carbs), backgroundColor: '#ff9500' }]} />
                                    <View style={[s.ratioBarSegment, { flex: Math.max(1, macroRatios.fat), backgroundColor: '#007aff' }]} />
                                </View>
                            </View>
                        )}

                        <Card style={s.insightCard}>
                            <View style={s.insightHeader}>
                                <Ionicons name="sparkles" size={16} color="#5856d6" />
                                <Text style={s.insightHeaderTitle}>AI Nutrition Coach Insight</Text>
                            </View>
                            <Text style={s.insightText}>
                                {scanResult.notes || "Balanced portion containing standard protein, carbohydrate, and fat elements."}
                            </Text>
                        </Card>

                        <View style={s.ingredientsSection}>
                            <View style={s.ingredientsHeader}>
                                <Text style={s.ingredientsTitle}>Ingredients</Text>
                                <Pressable onPress={() => { setIsAiAssistVisible(true); setAiDescription(scanResult.title) }}>
                                    <Text style={s.addIngredientsText}>+ Add details</Text>
                                </Pressable>
                            </View>
                            <View style={s.ingredientsListWrap}>
                                {scanResult.items.map((item, idx) => (
                                    <View key={idx} style={[s.ingredientItemRow, idx < scanResult.items.length - 1 && s.ingredientDivider]}>
                                        <View>
                                            <Text style={s.ingredientName}>{item.displayName}</Text>
                                            <Text style={s.ingredientQty}>{(item.servingG * servingMultiplier).toFixed(0)}g</Text>
                                        </View>
                                        <Text style={s.ingredientCal}>{(item.calories * servingMultiplier).toFixed(0)} cal</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        <View style={s.sheetActionButtonsRow}>
                            <Pressable 
                                onPress={() => { setIsAiAssistVisible(true); setAiDescription(scanResult.title) }} 
                                style={({ pressed }) => [s.fixResultsBtn, pressed && s.btnPressed]}
                            >
                                <Text style={s.fixResultsBtnText}>Fix Results</Text>
                            </Pressable>
                            <Pressable 
                                onPress={saveScan} 
                                style={({ pressed }) => [s.doneBtn, pressed && s.btnPressed]}
                            >
                                <Text style={s.doneBtnText}>Done</Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </View>
        )
    }

    // RENDER: STANDARD SCAN & SEARCH VIEWS
    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: BG }}
            contentContainerStyle={[s.container, { paddingTop: insets.top + 16, paddingBottom: TAB_BAR_CLEARANCE + 16 }]}
            showsVerticalScrollIndicator={false}
        >
            <View style={s.header}>
                <Text style={s.title}>Log Food</Text>
                <Text style={s.subtitle}>Photo scan, barcode, or manual search.</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
                {MEAL_TYPES.map((filter) => {
                    const active = filter.key === mealType
                    return (
                        <Pressable
                            key={filter.key}
                            onPress={() => setMealType(filter.key)}
                            style={[s.filterChip, active && s.filterChipActive]}
                        >
                            <Text style={[s.filterText, active && s.filterTextActive]}>{filter.label}</Text>
                        </Pressable>
                    )
                })}
            </ScrollView>

            <View style={s.scanRow}>
                <Pressable onPress={() => startScanFlow('camera')} style={({ pressed }) => [s.scanCard, pressed && s.scanPressed]}>
                    <Card style={s.scanCardInner}>
                        <Ionicons name="camera" size={20} color="#000000" />
                        <Text style={s.scanTitle}>Take Photo</Text>
                        <Text style={s.scanSub}>Instant AI macro breakdown</Text>
                    </Card>
                </Pressable>
                <Pressable onPress={() => startScanFlow('library')} style={({ pressed }) => [s.scanCard, pressed && s.scanPressed]}>
                    <Card style={s.scanCardInner}>
                        <Ionicons name="images" size={20} color="#000000" />
                        <Text style={s.scanTitle}>Upload Photo</Text>
                        <Text style={s.scanSub}>Pick from your gallery</Text>
                    </Card>
                </Pressable>
            </View>

            <Pressable onPress={() => setIsBarcodeVisible(true)}>
                <Card style={s.barcodeCard}>
                    <View style={s.barcodeRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.scanTitle}>Barcode scan</Text>
                            <Text style={s.scanSub}>Type barcode to lookup items instantly.</Text>
                        </View>
                        <Ionicons name="barcode" size={20} color="#000000" />
                    </View>
                </Card>
            </Pressable>

            {isScanning && (
                <Card style={s.scanningCard}>
                    <ActivityIndicator color={ACCENT} />
                    <Text style={{ fontSize: 13, color: TEXT_SECONDARY, fontWeight: '600' }}>AI is analyzing food image...</Text>
                </Card>
            )}

            <Text style={s.sectionTitle}>MANUAL SEARCH</Text>
            <TextInputField
                value={query}
                onChangeText={setQuery}
                placeholder="Search foods (e.g. chicken, egg, banana, oats)"
            />

            {query.length > 0 && (
                <View style={{ gap: 10 }}>
                    {foods.length === 0 ? (
                        <Card style={s.emptyCard}>
                            <Text style={s.emptyTitle}>No matches found</Text>
                            <Text style={s.emptySub}>Try searching egg, rice, banana, salmon, or oats.</Text>
                        </Card>
                    ) : (
                        foods.map((item) => (
                            <Card key={item.id} style={s.itemCard}>
                                <View style={s.topRow}>
                                    <Text style={s.itemName}>{item.name}</Text>
                                    <Text style={s.brandText}>{item.brand}</Text>
                                </View>

                                <View style={s.metaRow}>
                                    <Text style={s.metaText}>{item.caloriesPer100g.toFixed(0)} kcal/100g</Text>
                                    <Text style={[s.metaText, { color: '#ff3b30', fontWeight: '600' }]}>P {item.proteinPer100g.toFixed(0)}g</Text>
                                    <Text style={[s.metaText, { color: '#ff9500', fontWeight: '600' }]}>C {item.carbsPer100g.toFixed(0)}g</Text>
                                    <Text style={[s.metaText, { color: '#007aff', fontWeight: '600' }]}>F {item.fatPer100g.toFixed(0)}g</Text>
                                </View>

                                <View style={s.actionButtonsRow}>
                                    <Button label="Quick Log" size="sm" onPress={() => handleQuickLog(item)} style={{ flex: 1 }} />
                                    <Button label="Details" size="sm" variant="outline" onPress={() => openEditor(item)} style={{ flex: 1 }} />
                                </View>
                            </Card>
                        ))
                    )}
                </View>
            )}

            <Modal visible={isAiAssistVisible} animationType="slide" transparent>
                <View style={s.modalOverlay}>
                    <View style={s.modalSheet}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Describe Your Food</Text>
                            <Pressable onPress={() => { setIsAiAssistVisible(false); setScanImageUri(null) }}>
                                <Ionicons name="close" size={22} color={TEXT_SECONDARY} />
                            </Pressable>
                        </View>
                        <Text style={s.modalSubtitle}>
                            Tell us what you ate to help the AI scanner analyze the picture accurately.
                        </Text>
                        
                        <TextInput
                            value={aiDescription}
                            onChangeText={setAiDescription}
                            placeholder="e.g. 2 fried eggs, 1 slice of whole wheat toast, and half an avocado"
                            placeholderTextColor={TEXT_TERTIARY}
                            multiline
                            numberOfLines={3}
                            style={s.textArea}
                        />

                        <Button label="Analyze Photo" size="lg" onPress={handleAiAnalysis} fullWidth style={{ marginTop: 8 }} />
                    </View>
                </View>
            </Modal>

            <Modal visible={isBarcodeVisible} animationType="slide" transparent>
                <View style={s.modalOverlay}>
                    <View style={s.modalSheet}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Barcode Search</Text>
                            <Pressable onPress={() => setIsBarcodeVisible(false)}>
                                <Ionicons name="close" size={22} color={TEXT_SECONDARY} />
                            </Pressable>
                        </View>
                        <Text style={s.modalSubtitle}>
                            Enter a barcode UPC number to look up products instantly.
                        </Text>
                        
                        <TextInput
                            value={barcodeInput}
                            onChangeText={setBarcodeInput}
                            placeholder="Enter 12-digit barcode"
                            keyboardType="numeric"
                            maxLength={12}
                            style={s.numericInput}
                        />

                        <View style={s.barcodeListWrap}>
                            <Text style={s.barcodeTipHeading}>TEST BARCODES IN DATABASE:</Text>
                            <Pressable onPress={() => setBarcodeInput('041570110199')} style={s.barcodeRowItem}>
                                <Text style={s.barcodeRowText}>Quaker Rolled Oats: `041570110199`</Text>
                            </Pressable>
                            <Pressable onPress={() => setBarcodeInput('021130709971')} style={s.barcodeRowItem}>
                                <Text style={s.barcodeRowText}>Chobani Greek Yogurt: `021130709971`</Text>
                            </Pressable>
                            <Pressable onPress={() => setBarcodeInput('012345678901')} style={s.barcodeRowItem}>
                                <Text style={s.barcodeRowText}>Whey Protein Powder: `012345678901`</Text>
                            </Pressable>
                        </View>

                        <Button label="Search Product" size="lg" onPress={handleBarcodeSearch} fullWidth style={{ marginTop: 8 }} />
                    </View>
                </View>
            </Modal>

            <Modal visible={isEditorVisible} animationType="slide" transparent>
                <View style={s.modalOverlay}>
                    <View style={s.modalSheet}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Adjust Serving</Text>
                            <Pressable onPress={() => { setIsEditorVisible(false); setSelectedFood(null) }}>
                                <Ionicons name="close" size={22} color={TEXT_SECONDARY} />
                            </Pressable>
                        </View>

                        {selectedFood && (
                            <View style={{ gap: 12 }}>
                                <View>
                                    <Text style={s.editorFoodName}>{selectedFood.name}</Text>
                                    <Text style={s.editorFoodBrand}>{selectedFood.brand}</Text>
                                </View>

                                {editorPreview && (
                                    <View style={s.editorSummaryRow}>
                                        <View style={s.editorCalCount}>
                                            <Text style={s.editorCalVal}>{editorPreview.calories}</Text>
                                            <Text style={s.editorCalLabel}>kcal</Text>
                                        </View>
                                        <View style={s.editorMacroCol}>
                                            <Text style={s.editorMacroText}>Protein: <Text style={{ color: '#ff3b30', fontWeight: '700' }}>{editorPreview.protein}g</Text></Text>
                                            <Text style={s.editorMacroText}>Carbs: <Text style={{ color: '#ff9500', fontWeight: '700' }}>{editorPreview.carbs}g</Text></Text>
                                            <Text style={s.editorMacroText}>Fat: <Text style={{ color: '#007aff', fontWeight: '700' }}>{editorPreview.fat}g</Text></Text>
                                        </View>
                                    </View>
                                )}

                                <Text style={s.weightInputLabel}>SERVING SIZE (GRAMS):</Text>
                                <View style={s.weightControlsRow}>
                                    <Pressable
                                        onPress={() => setServingSize((prev) => Math.max(10, (parseFloat(prev) || 100) - 25).toString())}
                                        style={s.stepperBtn}
                                    >
                                        <Ionicons name="remove" size={18} color="#000000" />
                                    </Pressable>
                                    <TextInput
                                        value={servingSize}
                                        onChangeText={setServingSize}
                                        keyboardType="numeric"
                                        style={s.weightInput}
                                    />
                                    <Pressable
                                        onPress={() => setServingSize((prev) => ((parseFloat(prev) || 100) + 25).toString())}
                                        style={s.stepperBtn}
                                    >
                                        <Ionicons name="add" size={18} color="#000000" />
                                    </Pressable>
                                </View>

                                <View style={s.presetsRow}>
                                    {['50', '100', '150', '200', '300'].map((preset) => (
                                        <Pressable
                                            key={preset}
                                            onPress={() => setServingSize(preset)}
                                            style={[s.presetChip, servingSize === preset && s.presetChipActive]}
                                        >
                                            <Text style={[s.presetText, servingSize === preset && s.presetTextActive]}>{preset}g</Text>
                                        </Pressable>
                                    ))}
                                </View>

                                <Button label={`Log to ${mealType.toUpperCase()}`} size="lg" onPress={handleLogServing} fullWidth style={{ marginTop: 12 }} />
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {Platform.OS === 'web' && (
                <Modal visible={isWebCamVisible} animationType="fade" transparent>
                    <View style={s.webcamOverlay}>
                        <View style={s.webcamContainer}>
                            <View style={s.webcamHeader}>
                                <Text style={s.webcamTitle}>Instant Camera</Text>
                                <Pressable onPress={() => { stopWebcam(); setIsWebCamVisible(false); }} style={s.webcamCloseBtn}>
                                    <Ionicons name="close" size={24} color="#ffffff" />
                                </Pressable>
                            </View>

                            <View style={s.videoWrapper}>
                                {webcamStream ? (
                                    <VideoTag
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            borderRadius: 16,
                                            backgroundColor: '#000000',
                                        }}
                                    />
                                ) : (
                                    <View style={s.webcamLoader}>
                                        <ActivityIndicator size="large" color="#ffffff" />
                                        <Text style={s.webcamLoaderText}>Accessing Camera...</Text>
                                    </View>
                                )}
                            </View>

                            <View style={s.webcamControls}>
                                <Pressable onPress={toggleFacingMode} style={s.webcamIconBtn}>
                                    <Ionicons name="camera-reverse" size={24} color="#ffffff" />
                                </Pressable>

                                <Pressable onPress={captureWebcamPhoto} style={s.shutterBtnOuter}>
                                    <View style={s.shutterBtnInner} />
                                </Pressable>

                                <View style={{ width: 44 }} />
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </ScrollView>
    )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    // Standard layouts
    container: { paddingHorizontal: 20, gap: 12 },
    header: { gap: 4, marginBottom: 2 },
    title: { fontSize: 24, fontWeight: '900', color: TEXT_PRIMARY, letterSpacing: -0.5 },
    subtitle: { fontSize: 13, color: TEXT_SECONDARY },
    
    // Dedicated Scan Results View (Cal AI layout style)
    fullScreenContainer: {
        flex: 1,
        backgroundColor: '#000000', // Dark contrast background like in Cal AI see the calories uploader
    },
    scanResultHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 14,
        zIndex: 10,
    },
    backCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scanHeaderTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#ffffff',
    },
    shareCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scanResultScroll: {
        flexGrow: 1,
        justifyContent: 'space-between',
    },
    bowlImageContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 16,
        height: 220,
    },
    bowlImage: {
        width: 220,
        height: 220,
        borderRadius: 110, // Circular crop like in screenshot
        borderWidth: 6,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
    },
    sheetCard: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 22,
        gap: 16,
        paddingBottom: 40 + TAB_BAR_CLEARANCE,
    },
    titleStepperRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    sheetFoodName: {
        fontSize: 19,
        fontWeight: '900',
        color: TEXT_PRIMARY,
        flex: 1,
        letterSpacing: -0.3,
    },
    stepperControl: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f7',
        borderRadius: 12,
        padding: 3,
        borderWidth: 1,
        borderColor: BORDER,
    },
    stepperBtnSmall: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: BORDER,
    },
    stepperQtyText: {
        fontSize: 13.5,
        fontWeight: '800',
        color: TEXT_PRIMARY,
        paddingHorizontal: 12,
    },
    wideCaloriePill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,149,0,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,149,0,0.18)',
        borderRadius: 14,
        paddingVertical: 12,
    },
    wideCalorieText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#ff9500',
    },
    macrosGrid: {
        flexDirection: 'row',
        gap: 8,
    },
    macroGridCol: {
        flex: 1,
        backgroundColor: '#f5f5f7',
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 14,
        paddingVertical: 12,
        alignItems: 'center',
        gap: 2,
    },
    macroGridLabel: {
        fontSize: 10.5,
        fontWeight: '600',
        color: TEXT_SECONDARY,
    },
    macroGridVal: {
        fontSize: 14.5,
        fontWeight: '800',
    },
    ingredientsSection: {
        gap: 8,
        marginTop: 4,
    },
    ingredientsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    ingredientsTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: TEXT_PRIMARY,
    },
    addIngredientsText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#007aff',
    },
    ingredientsListWrap: {
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#f5f5f7',
    },
    ingredientItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    ingredientDivider: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: BORDER,
    },
    ingredientName: {
        fontSize: 13,
        fontWeight: '700',
        color: TEXT_PRIMARY,
    },
    ingredientQty: {
        fontSize: 11,
        color: TEXT_SECONDARY,
        marginTop: 1,
    },
    ingredientCal: {
        fontSize: 13,
        fontWeight: '600',
        color: TEXT_SECONDARY,
    },
    sheetActionButtonsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 6,
    },
    fixResultsBtn: {
        flex: 3.5,
        height: 48,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
    },
    fixResultsBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#000000',
    },
    doneBtn: {
        flex: 6.5,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
    btnPressed: {
        opacity: 0.8,
    },

    // Meal Filters
    filterRow: { gap: 8, paddingVertical: 4 },
    filterChip: {
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 7,
        backgroundColor: '#ffffff',
    },
    filterChipActive: {
        backgroundColor: ACCENT,
        borderColor: ACCENT,
    },
    filterText: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600' },
    filterTextActive: { color: '#ffffff' },

    scanRow: { flexDirection: 'row', gap: 10 },
    scanCard: { flex: 1 },
    scanPressed: { opacity: 0.82 },
    scanCardInner: { gap: 6, borderWidth: 1, borderColor: BORDER },
    scanTitle: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '700' },
    scanSub: { fontSize: 11.5, color: TEXT_SECONDARY, lineHeight: 15 },
    
    barcodeCard: { marginTop: 2, borderWidth: 1, borderColor: BORDER },
    barcodeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    
    scanningCard: { marginTop: 2, alignItems: 'center', gap: 10, paddingVertical: 20, borderWidth: 1, borderColor: BORDER },
    
    resultCard: { gap: 12, borderWidth: 1, borderColor: BORDER },
    resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    resultTitle: { fontSize: 17, color: TEXT_PRIMARY, fontWeight: '800' },
    resultSub: { marginTop: 2, fontSize: 12, color: TEXT_SECONDARY },
    confidencePill: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderWidth: 1,
        borderColor: BORDER,
    },
    confidenceText: { fontSize: 12, fontWeight: '700', color: TEXT_PRIMARY },
    previewImage: { width: '100%', height: 180, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.03)' },
    
    // Macro Chips
    macroRow: { flexDirection: 'row', gap: 8 },
    macroChip: {
        flex: 1,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: '#ffffff',
    },
    macroLabel: { fontSize: 11, color: TEXT_SECONDARY, fontWeight: '600' },
    macroValue: { marginTop: 2, fontSize: 13, fontWeight: '700' },
    resultNotes: { fontSize: 12.5, lineHeight: 18, color: TEXT_SECONDARY },
    
    // Detailed Scan List
    itemsList: { gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER, paddingTop: 10 },
    itemsHeading: { fontSize: 9.5, fontWeight: '700', color: TEXT_TERTIARY, letterSpacing: 0.5 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    itemLabel: { flex: 1, fontSize: 12.5, color: TEXT_PRIMARY, fontWeight: '600' },
    itemValue: { fontSize: 12.5, color: TEXT_SECONDARY },
    resultActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    
    sectionTitle: { fontSize: 10, fontWeight: '700', color: TEXT_TERTIARY, letterSpacing: 0.8, marginTop: 4 },
    
    // Manual search card
    emptyCard: { alignItems: 'center', paddingVertical: 24, gap: 4, marginTop: 8, borderWidth: 1, borderColor: BORDER },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
    emptySub: { fontSize: 13, color: TEXT_SECONDARY, textAlign: 'center', paddingHorizontal: 16 },
    
    itemCard: { gap: 8, paddingVertical: 12, borderWidth: 1, borderColor: BORDER },
    topRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    itemName: { flex: 1, fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
    brandText: { fontSize: 11.5, color: TEXT_TERTIARY },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    metaText: { fontSize: 11.5, color: TEXT_SECONDARY },
    actionButtonsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },

    // Modals Styling
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
    modalSubtitle: {
        fontSize: 13,
        color: TEXT_SECONDARY,
        lineHeight: 18,
        marginTop: -6,
    },
    textArea: {
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 14,
        padding: 12,
        fontSize: 13.5,
        color: TEXT_PRIMARY,
        backgroundColor: '#f5f5f7',
        height: 70,
        textAlignVertical: 'top',
    },
    numericInput: {
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 14,
        padding: 12,
        fontSize: 16,
        color: TEXT_PRIMARY,
        backgroundColor: '#f5f5f7',
        textAlign: 'center',
        fontWeight: '700',
        letterSpacing: 2,
    },
    barcodeListWrap: {
        gap: 6,
        marginVertical: 4,
    },
    barcodeTipHeading: {
        fontSize: 9.5,
        fontWeight: '700',
        color: TEXT_TERTIARY,
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    barcodeRowItem: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#f5f5f7',
        borderWidth: 1,
        borderColor: BORDER,
    },
    barcodeRowText: {
        fontSize: 12,
        color: TEXT_SECONDARY,
        fontWeight: '600',
    },

    // Editor Modal inside details
    editorFoodName: {
        fontSize: 18,
        fontWeight: '800',
        color: TEXT_PRIMARY,
    },
    editorFoodBrand: {
        fontSize: 13,
        color: TEXT_TERTIARY,
        marginTop: 1,
    },
    editorSummaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        backgroundColor: '#f5f5f7',
        borderWidth: 1,
        borderColor: BORDER,
        gap: 16,
    },
    editorCalCount: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: BORDER,
    },
    editorCalVal: {
        fontSize: 18,
        fontWeight: '800',
        color: TEXT_PRIMARY,
    },
    editorCalLabel: {
        fontSize: 10,
        color: TEXT_SECONDARY,
        fontWeight: '600',
    },
    editorMacroCol: {
        flex: 1,
        gap: 4,
    },
    editorMacroText: {
        fontSize: 13,
        color: TEXT_SECONDARY,
        fontWeight: '500',
    },
    weightInputLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: TEXT_TERTIARY,
        letterSpacing: 0.5,
        marginTop: 4,
    },
    weightControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    stepperBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f5f5f7',
        borderWidth: 1,
        borderColor: BORDER,
        alignItems: 'center',
        justifyContent: 'center',
    },
    weightInput: {
        flex: 1,
        height: 44,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 14,
        backgroundColor: '#ffffff',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '800',
        color: TEXT_PRIMARY,
    },
    presetsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
        marginTop: 2,
    },
    presetChip: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#f5f5f7',
        borderWidth: 1,
        borderColor: BORDER,
        alignItems: 'center',
    },
    presetChipActive: {
        backgroundColor: ACCENT,
        borderColor: ACCENT,
    },
    presetText: {
        fontSize: 12,
        fontWeight: '600',
        color: TEXT_SECONDARY,
    },
    presetTextActive: {
        color: '#ffffff',
    },
    webcamOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    webcamContainer: {
        width: '100%',
        maxWidth: 500,
        backgroundColor: '#1c1c1e',
        borderRadius: 24,
        padding: 16,
        gap: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    webcamHeader: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    webcamTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#ffffff',
    },
    webcamCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoWrapper: {
        width: '100%',
        aspectRatio: 3 / 4,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    webcamLoader: {
        alignItems: 'center',
        gap: 10,
    },
    webcamLoaderText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '500',
    },
    webcamControls: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    webcamIconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shutterBtnOuter: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shutterBtnInner: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#ffffff',
    },
    ratioSection: {
        gap: 6,
        marginTop: 4,
    },
    ratioLabelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    ratioLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: TEXT_PRIMARY,
    },
    ratioValueText: {
        fontSize: 11,
        color: TEXT_SECONDARY,
        fontWeight: '600',
    },
    ratioBarContainer: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.05)',
    },
    ratioBarSegment: {
        height: '100%',
    },
    insightCard: {
        backgroundColor: 'rgba(88,86,214,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(88,86,214,0.12)',
        borderRadius: 16,
        padding: 14,
        gap: 6,
        marginTop: 4,
    },
    insightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    insightHeaderTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#5856d6',
    },
    insightText: {
        fontSize: 12.5,
        lineHeight: 18,
        color: TEXT_SECONDARY,
        fontWeight: '500',
    },
})
