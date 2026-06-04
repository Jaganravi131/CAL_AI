import React, { useState, useEffect, useRef } from 'react'
import { View, StyleSheet, TextInput, FlatList, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Text } from '@/components/ui/Text'
import { Card } from '@/components/ui/Card'
import { BG, BORDER, ACCENT, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_TERTIARY, SURFACE } from '@/lib/theme'
import { sendAssistantMessage } from '@/lib/aiAssistant'
import { useTodaySummary } from '@/hooks/useNutrition'
import { useProfile } from '@/hooks/useProfile'
import { TAB_BAR_HEIGHT } from '@/components/TabBar'

type Message = { id: string; text: string; author: 'user' | 'assistant'; isSpeaking?: boolean }

export default function AssistantScreen() {
  const insets = useSafeAreaInsets()
  const { data: summary } = useTodaySummary()
  const { data: profile } = useProfile()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isSending, setIsSending] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [currentSpeakingId, setCurrentSpeakingId] = useState<string | null>(null)
  
  const flatListRef = useRef<FlatList>(null)
  const recognitionRef = useRef<any>(null)

  const firstName = (profile?.fullName ?? '').split(' ')[0] || 'there'

  // Initialize with greeting
  useEffect(() => {
    setMessages([
      {
        id: 'greet',
        text: `Hi ${firstName}! I'm your Cal AI nutrition coach. 🍎\n\nAsk me "How am I doing today?", "List high protein foods", or click the 🎙️ mic button below to talk to me!`,
        author: 'assistant',
      },
    ])
  }, [firstName])

  // Stop synthesis on unmount
  useEffect(() => {
    return () => {
      if (Platform.OS === 'web' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  // ── Text to Speech (Voice Playback) ──────────────────────────────────────────
  function speakText(text: string, messageId: string) {
    if (Platform.OS !== 'web' || !('speechSynthesis' in window)) {
      return
    }

    // Toggle stop if already speaking this message
    if (currentSpeakingId === messageId) {
      window.speechSynthesis.cancel()
      setCurrentSpeakingId(null)
      return
    }

    window.speechSynthesis.cancel()
    setCurrentSpeakingId(messageId)

    const cleanText = text.replace(/[*#_]/g, '') // remove markdown styling chars
    const utterance = new SpeechSynthesisUtterance(cleanText)
    
    // Choose a voice if available
    const voices = window.speechSynthesis.getVoices()
    const preferredVoice = voices.find(
      (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural'))
    )
    if (preferredVoice) utterance.voice = preferredVoice

    utterance.onend = () => {
      setCurrentSpeakingId(null)
    }
    utterance.onerror = () => {
      setCurrentSpeakingId(null)
    }

    window.speechSynthesis.speak(utterance)
  }

  // ── Speech to Text (Microphone Capture) ──────────────────────────────────────
  function toggleListening() {
    if (Platform.OS !== 'web') {
      showToastWeb('Voice input is supported in browser mode.')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      showToastWeb('Voice recognition is not supported in this browser. Try Chrome/Safari.')
      return
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      setIsListening(false)
      return
    }

    setIsListening(true)
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      if (transcript) {
        setInput(transcript)
        handleSendAuto(transcript)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.start()
  }

  function showToastWeb(msg: string) {
    console.log('[Voice Assist]', msg)
  }

  // Send function with auto-speak on reply
  async function handleSendAuto(overrideText?: string) {
    const textToSend = (overrideText || input).trim()
    if (!textToSend) return
    
    const userMsg: Message = { id: `u-${Date.now()}`, text: textToSend, author: 'user' }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setIsSending(false)
    setIsSending(true)

    // Scroll to bottom
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)

    try {
      // Map message history
      const history = messages.map((m) => ({
        author: m.author,
        text: m.text,
      }))

      const res = await sendAssistantMessage({
        message: textToSend,
        summary: summary || undefined,
        history,
      })

      const assistantMsgId = `a-${Date.now()}`
      const assistantMsg: Message = {
        id: assistantMsgId,
        text: res.reply ?? 'Sorry, I could not respond.',
        author: 'assistant',
      }

      setMessages((m) => [...m, assistantMsg])

      // Auto-Speak if active
      if (autoSpeak) {
        // small timeout to let the UI update first
        setTimeout(() => speakText(assistantMsg.text, assistantMsgId), 150)
      }
    } catch (err) {
      const errMsg: Message = {
        id: `a-${Date.now()}`,
        text: 'Assistant temporarily unavailable. Please try again.',
        author: 'assistant',
      }
      setMessages((m) => [...m, errMsg])
    } finally {
      setIsSending(false)
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[s.container, { paddingTop: insets.top + 12 }]}>
        {/* Header */}
        <View style={s.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View style={s.avatarCircle}>
              <Ionicons name="sparkles" size={16} color="#fff" />
            </View>
            <View>
              <Text style={s.title}>Cal AI Coach</Text>
              <Text style={s.subtitle}>Groq Llama 3 & voice powered</Text>
            </View>
          </View>

          {/* Auto-Speak Toggle */}
          <Pressable onPress={() => setAutoSpeak(!autoSpeak)} style={[s.autoSpeakBtn, autoSpeak && s.autoSpeakBtnActive]}>
            <Ionicons name={autoSpeak ? "volume-medium" : "volume-mute"} size={16} color={autoSpeak ? "#000000" : TEXT_SECONDARY} />
            <Text style={[s.autoSpeakText, autoSpeak && s.autoSpeakTextActive]}>Auto-Speak</Text>
          </Pressable>
        </View>

        {/* Message List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[s.listContent, { paddingBottom: 24 }]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isUser = item.author === 'user'
            const isSpeaking = currentSpeakingId === item.id
            return (
              <View style={[s.msgWrapper, isUser ? s.msgWrapperUser : s.msgWrapperAssistant]}>
                <View style={[s.msgBubble, isUser ? s.msgUser : s.msgAssistant, isSpeaking && s.msgAssistantSpeaking]}>
                  <Text style={[s.msgText, isUser ? s.msgTextUser : s.msgTextAssistant]}>
                    {item.text}
                  </Text>
                  
                  {/* Speaker Button (only for Assistant replies) */}
                  {!isUser && (
                    <Pressable 
                      onPress={() => speakText(item.text, item.id)} 
                      style={s.speakerIconWrap}
                      hitSlop={8}
                    >
                      <Ionicons 
                        name={isSpeaking ? "stop-circle" : "volume-medium-outline"} 
                        size={17} 
                        color={isSpeaking ? "#ef4444" : TEXT_SECONDARY} 
                      />
                    </Pressable>
                  )}
                </View>
              </View>
            )
          }}
        />

        {/* Loading Indicator */}
        {isSending && (
          <View style={s.loadingBubbleRow}>
            <View style={s.msgAssistantLoading}>
              <ActivityIndicator size="small" color={ACCENT} />
            </View>
          </View>
        )}

        {/* Chat Input Row */}
        <View style={[s.inputRow, { paddingBottom: TAB_BAR_HEIGHT + Math.max(12, insets.bottom) }]}>
          {isListening ? (
            /* Pulsing Audio Wave Visualizer */
            <View style={s.voiceVisualizerContainer}>
              <Text style={s.listeningText}>Listening to your voice...</Text>
              <View style={s.waveRow}>
                <View style={[s.waveBar, s.waveBar1]} />
                <View style={[s.waveBar, s.waveBar2]} />
                <View style={[s.waveBar, s.waveBar3]} />
                <View style={[s.waveBar, s.waveBar4]} />
              </View>
              <Pressable onPress={toggleListening} style={s.cancelMicBtn}>
                <Ionicons name="close" size={18} color="#ff3b30" />
              </Pressable>
            </View>
          ) : (
            /* Keyboard Standard Input */
            <View style={s.inputContainer}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask about progress, macros, recipes..."
                placeholderTextColor={TEXT_TERTIARY}
                style={s.input}
                onSubmitEditing={() => handleSendAuto()}
                blurOnSubmit={false}
              />
              
              {/* Mic Icon Trigger */}
              <Pressable onPress={toggleListening} style={s.micBtn}>
                <Ionicons name="mic-outline" size={19} color="#000000" />
              </Pressable>

              {/* Send Button */}
              <Pressable onPress={() => handleSendAuto()} disabled={!input.trim()} style={[s.sendBtn, !input.trim() && s.sendBtnDisabled]}>
                <Ionicons name="arrow-up" size={18} color="#fff" />
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: TEXT_PRIMARY },
  subtitle: { fontSize: 11.5, color: TEXT_SECONDARY },
  
  // Auto speak button
  autoSpeakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f5f5f7',
    borderWidth: 1,
    borderColor: BORDER,
  },
  autoSpeakBtnActive: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderColor: 'rgba(0,0,0,0.12)',
  },
  autoSpeakText: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  autoSpeakTextActive: {
    color: '#000000',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  msgWrapper: {
    flexDirection: 'row',
    width: '100%',
  },
  msgWrapperUser: {
    justifyContent: 'flex-end',
  },
  msgWrapperAssistant: {
    justifyContent: 'flex-start',
  },
  msgBubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    maxWidth: '85%',
    position: 'relative',
  },
  msgUser: {
    backgroundColor: ACCENT,
    borderTopRightRadius: 4,
  },
  msgAssistant: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderTopLeftRadius: 4,
    paddingRight: 24, // spacing for speaker button
  },
  msgAssistantSpeaking: {
    borderColor: '#ff9500',
    borderWidth: 1.5,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  msgTextUser: {
    color: '#fff',
    fontWeight: '500',
  },
  msgTextAssistant: {
    color: TEXT_PRIMARY,
  },
  speakerIconWrap: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingBubbleRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: 'flex-start',
  },
  msgAssistantLoading: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },

  inputRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: BG,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 24,
    paddingLeft: 14,
    paddingRight: 6,
    height: 46,
  },
  input: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 14.5,
    padding: 0,
  },
  micBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    backgroundColor: '#f5f5f7',
    borderWidth: 1,
    borderColor: BORDER,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    opacity: 0.5,
  },

  // Voice Visualizer
  voiceVisualizerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 46,
  },
  listeningText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  waveBar: {
    width: 3,
    backgroundColor: ACCENT,
    borderRadius: 9,
  },
  waveBar1: { height: 16, opacity: 0.8 },
  waveBar2: { height: 26, opacity: 1 },
  waveBar3: { height: 18, opacity: 0.9 },
  waveBar4: { height: 10, opacity: 0.6 },
  cancelMicBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,59,48,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
})
