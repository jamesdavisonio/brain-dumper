# Claude Voice Assistant - Technical Specification

**Version:** 1.0.0
**Last Updated:** January 2026
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [Feature Specifications](#3-feature-specifications)
4. [User Flow Diagrams](#4-user-flow-diagrams)
5. [Data Models](#5-data-models)
6. [System Prompts](#6-system-prompts)
7. [Widget Implementation](#7-widget-implementation)
8. [State Machine Diagrams](#8-state-machine-diagrams)
9. [API Design](#9-api-design)
10. [Privacy and Permissions](#10-privacy-and-permissions)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Cost Estimates](#12-cost-estimates)
13. [Technical Architecture](#13-technical-architecture)

---

## 1. Executive Summary

Claude Voice Assistant is a React Native mobile application providing two distinct voice interaction paradigms for conversing with Claude AI. The app prioritizes a minimal, distraction-free UI while maintaining robust backend systems for conversation management, intelligent model routing, and seamless cross-platform functionality.

### Key Differentiators
- **Dual-mode voice interaction** catering to different use cases and contexts
- **Intelligent model routing** between Opus and Haiku based on query complexity
- **Voice-optimized responses** designed for spoken delivery
- **Automatic conversation organization** with AI-generated summaries
- **Home screen widgets** for instant access

---

## 2. Product Vision

### 2.1 Core Philosophy
Build a voice-first AI assistant that feels natural to use whether hands-free while driving or in a focused push-to-talk session. The interface should disappear, leaving only the conversation.

### 2.2 Target Users
- **Commuters**: Hands-free mode during driving
- **Multitaskers**: Voice interaction while cooking, exercising, etc.
- **Accessibility users**: Voice-first interface as primary interaction
- **Power users**: Quick queries via widget without full app launch
- **Deep thinkers**: Extended brainstorming sessions with Opus

### 2.3 Design Principles
1. **Voice-First**: Every feature accessible without touching the screen
2. **Context-Aware**: Adapt responses for spoken delivery
3. **Intelligent Defaults**: Auto-route to appropriate model
4. **Privacy-Conscious**: On-device wake word, clear data handling
5. **Battery-Respectful**: Efficient background processing

---

## 3. Feature Specifications

### 3.1 Hands-Free Mode

#### 3.1.1 Wake Word Detection
```
Technology: Picovoice Porcupine SDK
Wake Phrase: "Hey Claude"
Processing: 100% on-device
Accuracy Target: >95% in quiet environments, >85% in noisy
False Positive Rate: <1 per 8 hours of ambient listening
```

**Configuration Options:**
| Setting | Default | Range |
|---------|---------|-------|
| Sensitivity | 0.5 | 0.0 - 1.0 |
| Audio Gain | 1.0 | 0.5 - 2.0 |
| Background Listening | Enabled | On/Off |

#### 3.1.2 Voice Activity Detection (VAD)
```
Technology: WebRTC VAD (via native modules)
Silence Threshold: 1.5 seconds
Max Recording Duration: 60 seconds
Min Recording Duration: 0.5 seconds
```

**VAD States:**
- `WAITING_FOR_SPEECH`: Post wake-word, listening for user
- `SPEECH_DETECTED`: Active recording
- `SILENCE_DETECTED`: Counting down to submission
- `PROCESSING`: Transcribing and sending to Claude

#### 3.1.3 Voice Commands
| Command | Aliases | Action |
|---------|---------|--------|
| "Send it" | "Submit", "Go ahead" | Submit current transcription |
| "Cancel" | "Never mind", "Stop" | Discard current recording |
| "Read that again" | "Repeat", "Say again" | Replay last response |
| "New conversation" | "Fresh start" | Begin new session |
| "Stop talking" | "Quiet", "Shut up" | Interrupt TTS playback |

#### 3.1.4 Background Service
```
Android: Foreground Service with persistent notification
iOS: Background Audio mode + Location (for extended background)
Wake Lock: Partial wake lock during active listening
```

**Notification Actions:**
- Pause/Resume listening
- Start new conversation
- Open full app
- Disable hands-free mode

#### 3.1.5 Audio Feedback
| Event | Sound | Duration |
|-------|-------|----------|
| Wake word detected | Soft chime up | 200ms |
| Recording started | Double beep | 150ms |
| Recording ended | Single beep down | 100ms |
| Error occurred | Low tone | 300ms |
| Ready for next query | Subtle ping | 100ms |

---

### 3.2 Push-to-Talk Mode

#### 3.2.1 Button Design
```
Size: 120dp diameter (primary action)
States: Idle, Recording, Processing, Playing
Animation: Pulsing ring during recording
Haptic: Medium impact on press, light on release
```

**Visual States:**
```
IDLE:        [  Claude Icon  ]  - Blue fill, white icon
RECORDING:   [  Waveform     ]  - Red fill, animated waves
PROCESSING:  [  Spinner      ]  - Gray fill, rotating dots
PLAYING:     [  Speaker      ]  - Green fill, sound waves
```

#### 3.2.2 Interruption Handling
- **During Recording**: Tap to cancel
- **During Processing**: Tap to cancel request
- **During TTS Playback**: Tap to stop immediately
- **After Playback**: Tap to start new recording

#### 3.2.3 Visual Feedback
```typescript
interface RecordingFeedback {
  waveformVisualization: boolean;  // Real-time amplitude
  recordingTimer: boolean;         // Elapsed time display
  transcriptionPreview: boolean;   // Live transcription (optional)
  volumeIndicator: boolean;        // Input level meter
}
```

---

### 3.3 Shared Features

#### 3.3.1 Speech Recognition

**Android Implementation:**
```typescript
import Voice from '@react-native-voice/voice';

const SpeechConfig = {
  EXTRA_LANGUAGE_MODEL: 'LANGUAGE_MODEL_FREE_FORM',
  EXTRA_PARTIAL_RESULTS: true,
  EXTRA_MAX_RESULTS: 3,
  EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 500,
  EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1500,
};
```

**iOS Implementation:**
```typescript
const SpeechConfig = {
  taskHint: 'dictation',
  shouldReportPartialResults: true,
  requiresOnDeviceRecognition: false,  // Cloud for accuracy
  contextualStrings: ['Claude', 'Opus', 'Haiku'],
};
```

#### 3.3.2 Text-to-Speech

**Configuration:**
```typescript
interface TTSConfig {
  defaultRate: 0.5;        // 0.0 - 1.0 (platform normalized)
  defaultPitch: 1.0;       // 0.5 - 2.0
  defaultLanguage: 'en-US';

  // Platform-specific voices
  android: {
    engine: 'com.google.android.tts';
    voice: 'en-us-x-tpf-local';  // Preferred neural voice
    fallback: 'en-us-x-sfg-local';
  };
  ios: {
    voice: 'com.apple.voice.enhanced.en-US.Samantha';
    fallback: 'com.apple.ttsbundle.Samantha-compact';
  };
}
```

**Voice Settings UI:**
- Rate slider (Slow / Normal / Fast)
- Pitch slider (Low / Normal / High)
- Voice selection (platform voices)
- Preview button

#### 3.3.3 Session Management

**Session Lifecycle:**
```
APP_OPEN  --> New Session Created (UUID + timestamp)
              |
CONVERSATION --> Messages added to session
              |
APP_BACKGROUND --> Session marked as "paused"
              |
APP_CLOSED --> AI summary generated
              --> Session archived
              --> Topic classification runs
```

**Auto-Summary Trigger:**
```typescript
const SUMMARY_TRIGGERS = {
  messageCount: 10,           // After 10+ messages
  sessionDuration: 300,       // After 5+ minutes
  appBackground: true,        // When app backgrounds
  manualRequest: true,        // User requests
};
```

#### 3.3.4 Conversation Organization

**Auto-Topic Classification:**
```typescript
const TOPIC_CATEGORIES = [
  'work',
  'personal',
  'learning',
  'creative',
  'planning',
  'research',
  'coding',
  'writing',
  'health',
  'finance',
  'travel',
  'general',
];

// Classification runs on:
// 1. Session end
// 2. Every 5 messages during session
// 3. Manual reorganization
```

**Swipe Gestures:**
```
LEFT  SHORT  --> Archive conversation
LEFT  LONG   --> Delete conversation
RIGHT SHORT  --> Star/Unstar
RIGHT LONG   --> Move to folder
```

#### 3.3.5 Search

**Search Capabilities:**
- Full-text search across all messages
- Filter by: date range, starred, archived, topic
- Search within specific conversation
- Voice-initiated search in hands-free mode

**Search Index:**
```typescript
interface SearchIndex {
  conversationId: string;
  sessionId: string;
  content: string;          // Message content
  role: 'user' | 'assistant';
  timestamp: number;
  topics: string[];
  starred: boolean;
}
```

---

## 4. User Flow Diagrams

### 4.1 Hands-Free Mode Flow

```
                                    ┌─────────────────────┐
                                    │     APP LAUNCH      │
                                    └──────────┬──────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │  Initialize Audio   │
                                    │  - Request perms    │
                                    │  - Load Porcupine   │
                                    │  - Start service    │
                                    └──────────┬──────────┘
                                               │
                         ┌─────────────────────┴─────────────────────┐
                         │                                           │
                         ▼                                           ▼
              ┌─────────────────────┐                     ┌─────────────────────┐
              │   FOREGROUND MODE   │                     │   BACKGROUND MODE   │
              │  (Full UI visible)  │                     │  (Notification UI)  │
              └──────────┬──────────┘                     └──────────┬──────────┘
                         │                                           │
                         └─────────────────────┬─────────────────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │  LISTENING STATE    │
                                    │  Wake word active   │
                                    │  "Hey Claude..."    │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────┴──────────┐
                                    │   Wake Word         │
                                    │   Detected?         │
                                    └──────────┬──────────┘
                                               │ YES
                                               ▼
                                    ┌─────────────────────┐
                                    │    AUDIO CHIME      │
                                    │    Start VAD        │
                                    │    Begin Recording  │
                                    └──────────┬──────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │  RECORDING STATE    │◄────────┐
                                    │  VAD monitoring     │         │
                                    │  Live transcription │         │
                                    └──────────┬──────────┘         │
                                               │                    │
                         ┌─────────────────────┼─────────────────────┐
                         │                     │                     │
                         ▼                     ▼                     │
              ┌──────────────────┐  ┌──────────────────┐            │
              │ "Cancel" heard   │  │ Silence 1.5s OR  │            │
              │                  │  │ "Send it" heard  │            │
              └────────┬─────────┘  └────────┬─────────┘            │
                       │                     │                      │
                       ▼                     ▼                      │
              ┌──────────────────┐  ┌──────────────────┐            │
              │  Discard audio   │  │   PROCESSING     │            │
              │  Return to       │  │   Transcribe     │            │
              │  LISTENING       │  │   Route model    │            │
              └──────────────────┘  │   Send to Claude │            │
                                    └────────┬─────────┘            │
                                             │                      │
                                             ▼                      │
                                    ┌──────────────────┐            │
                                    │  SPEAKING STATE  │            │
                                    │  TTS playback    │            │
                                    │  Interruptible   │            │
                                    └────────┬─────────┘            │
                                             │                      │
                         ┌───────────────────┼───────────────────┐  │
                         │                   │                   │  │
                         ▼                   ▼                   │  │
              ┌──────────────────┐ ┌──────────────────┐         │  │
              │ "Stop talking"   │ │ Playback         │         │  │
              │ Interrupt TTS    │ │ Complete         │         │  │
              └────────┬─────────┘ └────────┬─────────┘         │  │
                       │                    │                   │  │
                       └────────────────────┴───────────────────┘  │
                                            │                      │
                                            ▼                      │
                                    ┌──────────────────┐           │
                                    │  Ready chime     │           │
                                    │  Resume VAD      ├───────────┘
                                    │  (Follow-up?)    │
                                    └──────────────────┘
```

### 4.2 Push-to-Talk Mode Flow

```
                                    ┌─────────────────────┐
                                    │     APP LAUNCH      │
                                    └──────────┬──────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │    IDLE STATE       │
                                    │                     │
                                    │  ┌───────────────┐  │
                                    │  │               │  │
                                    │  │   [BUTTON]    │  │
                                    │  │   "Tap to     │  │
                                    │  │    Talk"      │  │
                                    │  │               │  │
                                    │  └───────────────┘  │
                                    └──────────┬──────────┘
                                               │
                                               │ TAP
                                               ▼
                                    ┌─────────────────────┐
                                    │  RECORDING STATE    │
                                    │                     │
                                    │  ┌───────────────┐  │
                                    │  │  ~~~████~~~   │  │
                                    │  │   Recording   │  │
                                    │  │    0:05       │  │
                                    │  └───────────────┘  │
                                    │                     │
                                    │  [Tap to Stop]      │
                                    └──────────┬──────────┘
                                               │
                         ┌─────────────────────┼─────────────────────┐
                         │                     │                     │
                         │ TAP                 │ TIMEOUT             │
                         │ (Cancel)            │ (60s max)           │
                         ▼                     ▼                     │
              ┌──────────────────┐  ┌──────────────────┐            │
              │  Discard & Reset │  │   PROCESSING     │            │
              │  Return to IDLE  │  │                  │◄───────────┘
              └──────────────────┘  │  ┌───────────────┐│  TAP (Stop)
                                    │  │   ◠ ◡ ◠      ││
                                    │  │  Thinking... ││
                                    │  └───────────────┘│
                                    └────────┬─────────┘
                                             │
                                             ▼
                                    ┌──────────────────┐
                                    │  SPEAKING STATE  │
                                    │                  │
                                    │  ┌───────────────┐│
                                    │  │   🔊 )))     ││
                                    │  │  Speaking... ││
                                    │  └───────────────┘│
                                    │                  │
                                    │  [Tap to Stop]   │
                                    └────────┬─────────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         │                   │                   │
                         │ TAP               │ COMPLETE          │
                         │ (Interrupt)       │                   │
                         ▼                   ▼                   │
              ┌──────────────────┐ ┌──────────────────┐         │
              │  Stop TTS        │ │  Show response   │         │
              │  Show partial    │ │  text (optional) │         │
              └────────┬─────────┘ └────────┬─────────┘         │
                       │                    │                   │
                       └────────────────────┴───────────────────┘
                                            │
                                            ▼
                                    ┌──────────────────┐
                                    │  Return to IDLE  │
                                    │  Ready for next  │
                                    └──────────────────┘
```

### 4.3 Widget Activation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HOME SCREEN                                  │
│                                                                      │
│    ┌─────────────────────┐                                          │
│    │  Claude Voice       │                                          │
│    │  ┌───────────────┐  │                                          │
│    │  │   🎙️ Talk     │  │ ◄──── Small Widget (2x1)                │
│    │  └───────────────┘  │                                          │
│    └─────────────────────┘                                          │
│                                                                      │
│    ┌─────────────────────────────────────┐                          │
│    │  Claude Voice Assistant             │                          │
│    │  ┌─────────────┐ ┌─────────────┐   │                          │
│    │  │  🎙️ Talk    │ │  📝 Recent  │   │ ◄──── Medium Widget (4x2)│
│    │  └─────────────┘ └─────────────┘   │                          │
│    │  Last: "What's the weather..."     │                          │
│    └─────────────────────────────────────┘                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │ TAP "Talk"
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      OVERLAY MODE                                    │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │                     ┌─────────────────┐                       │  │
│  │                     │                 │                       │  │
│  │                     │   ~~~████~~~    │                       │  │
│  │                     │   Recording...  │                       │  │
│  │                     │                 │                       │  │
│  │                     └─────────────────┘                       │  │
│  │                                                               │  │
│  │                        [X] Cancel                             │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │ RESPONSE READY
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      RESPONSE OVERLAY                                │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │    Claude:                                                    │  │
│  │    "The weather today is sunny with a                        │  │
│  │     high of 72°F..."                                         │  │
│  │                                                               │  │
│  │    🔊 Speaking...                                            │  │
│  │                                                               │  │
│  │    [Open App]            [Done]                              │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Data Models

### 5.1 Core Entities

```typescript
// ============================================
// USER
// ============================================
interface User {
  id: string;                          // Firebase Auth UID
  email: string;
  displayName?: string;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;

  settings: UserSettings;
  subscription: SubscriptionInfo;

  // Usage tracking
  usage: {
    currentPeriodStart: Timestamp;
    opusTokensUsed: number;
    haikuTokensUsed: number;
    minutesRecorded: number;
  };
}

interface UserSettings {
  // Voice settings
  voiceMode: 'hands-free' | 'push-to-talk';
  wakeWordSensitivity: number;         // 0.0 - 1.0
  silenceThreshold: number;            // seconds

  // TTS settings
  ttsRate: number;                     // 0.0 - 1.0
  ttsPitch: number;                    // 0.5 - 2.0
  ttsVoice: string;                    // Platform voice ID

  // Model preferences
  preferredModel: 'auto' | 'opus' | 'haiku';

  // Privacy
  saveConversations: boolean;
  analyticsEnabled: boolean;
  crashReportingEnabled: boolean;

  // Notifications
  reminderEnabled: boolean;
  reminderTime?: string;               // HH:mm format
}

interface SubscriptionInfo {
  tier: 'free' | 'pro' | 'unlimited';
  status: 'active' | 'canceled' | 'expired';
  expiresAt?: Timestamp;

  limits: {
    opusTokensPerMonth: number;
    haikuTokensPerMonth: number;
    backgroundMinutesPerDay: number;
  };
}

// ============================================
// CONVERSATION
// ============================================
interface Conversation {
  id: string;                          // Firestore document ID
  userId: string;                      // Owner

  // Metadata
  title: string;                       // AI-generated or user-set
  summary?: string;                    // AI-generated summary
  topics: string[];                    // Auto-classified topics

  // Organization
  starred: boolean;
  archived: boolean;
  folderId?: string;                   // Optional folder
  order: number;                       // For manual sorting

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessageAt: Timestamp;

  // Stats
  messageCount: number;
  totalDurationSeconds: number;

  // Sessions within this conversation
  sessionIds: string[];
}

// ============================================
// SESSION
// ============================================
interface Session {
  id: string;                          // Firestore document ID
  conversationId: string;              // Parent conversation
  userId: string;                      // Owner

  // Timing
  startedAt: Timestamp;
  endedAt?: Timestamp;
  status: 'active' | 'paused' | 'completed';

  // Context
  voiceMode: 'hands-free' | 'push-to-talk';
  deviceInfo: {
    platform: 'ios' | 'android';
    model: string;
    osVersion: string;
  };

  // Summary (generated on completion)
  summary?: string;
  keyPoints?: string[];

  // Usage
  opusTokens: number;
  haikuTokens: number;
  recordingDurationSeconds: number;
}

// ============================================
// MESSAGE
// ============================================
interface Message {
  id: string;                          // Firestore document ID
  sessionId: string;                   // Parent session
  conversationId: string;              // For efficient querying
  userId: string;                      // Owner

  // Content
  role: 'user' | 'assistant' | 'system';
  content: string;                     // Text content

  // For user messages
  audioUrl?: string;                   // Cloud Storage URL
  audioDurationSeconds?: number;
  transcriptionConfidence?: number;

  // For assistant messages
  model?: 'opus' | 'haiku';
  routingReason?: string;              // Why this model was chosen
  tokenCount?: number;
  generationTimeMs?: number;

  // Timestamps
  createdAt: Timestamp;

  // Optional metadata
  metadata?: {
    interrupted?: boolean;             // TTS was interrupted
    edited?: boolean;                  // User edited transcription
    regenerated?: boolean;             // Response was regenerated
  };
}

// ============================================
// FOLDER
// ============================================
interface Folder {
  id: string;
  userId: string;
  name: string;
  color?: string;
  icon?: string;
  order: number;
  createdAt: Timestamp;
}

// ============================================
// SEARCH INDEX (for offline search)
// ============================================
interface LocalSearchDocument {
  messageId: string;
  conversationId: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
  topics: string[];
  starred: boolean;
  archived: boolean;
}
```

### 5.2 Firestore Structure

```
/users/{userId}
  - User document

/users/{userId}/conversations/{conversationId}
  - Conversation document

/users/{userId}/conversations/{conversationId}/sessions/{sessionId}
  - Session document

/users/{userId}/conversations/{conversationId}/messages/{messageId}
  - Message document

/users/{userId}/folders/{folderId}
  - Folder document

/users/{userId}/searchIndex/{indexId}
  - Search index chunks (for large users)
```

### 5.3 Local Storage (AsyncStorage / MMKV)

```typescript
interface LocalCache {
  // Quick access
  'user:settings': UserSettings;
  'user:subscription': SubscriptionInfo;

  // Recent conversations (for offline access)
  'cache:recentConversations': Conversation[];  // Last 10
  'cache:recentMessages': {
    [conversationId: string]: Message[];        // Last 50 per convo
  };

  // Pending sync
  'pending:messages': Message[];                // Not yet synced
  'pending:sessions': Session[];

  // Search
  'search:index': LocalSearchDocument[];
  'search:lastUpdate': number;

  // Audio cache
  'audio:pending': {
    localUri: string;
    messageId: string;
    uploadStatus: 'pending' | 'uploading' | 'failed';
  }[];
}
```

---

## 6. System Prompts

### 6.1 Voice-Optimized Base Prompt

```typescript
const VOICE_SYSTEM_PROMPT = `You are Claude, an AI assistant engaged in a voice conversation. Your responses will be read aloud using text-to-speech, so follow these guidelines:

## Response Format
- Use natural, conversational language suitable for speaking
- Avoid bullet points, numbered lists, and markdown formatting
- Never use asterisks, headers, or code blocks
- Keep responses concise - aim for 2-4 sentences for simple queries
- For complex topics, break into digestible spoken paragraphs

## Spoken Clarity
- Spell out abbreviations on first use (e.g., "API, which stands for Application Programming Interface")
- Use words instead of symbols ("percent" not "%", "at" not "@")
- Avoid URLs - describe where to find things instead
- Don't use parenthetical asides - work that information into the flow

## Tone
- Be warm and conversational, like a knowledgeable friend
- Use contractions naturally ("I'll", "you're", "that's")
- Acknowledge when you're thinking through complex questions
- It's okay to be brief - silence isn't awkward in voice

## Structure for Longer Responses
- Start with the key answer or insight
- Add context or explanation if needed
- End with a natural conclusion, not a list of caveats

## What NOT to Do
- Don't say "Here's a summary:" or similar meta-commentary
- Don't start with "Certainly!" or "Of course!" repeatedly
- Don't end with "Is there anything else?" - let the user lead
- Don't include citations like [1] or (Source: X)`;
```

### 6.2 Opus-Specific Prompt Addition

```typescript
const OPUS_ADDITION = `

## Extended Thinking for Complex Topics
Since you're Claude Opus handling a complex query:
- Take time to think through nuanced aspects
- Offer multiple perspectives when relevant
- Engage creatively with brainstorming requests
- Don't simplify unnecessarily - the user chose depth`;
```

### 6.3 Haiku-Specific Prompt Addition

```typescript
const HAIKU_ADDITION = `

## Quick Response Mode
Since this is a straightforward query:
- Get straight to the answer
- One to three sentences is often enough
- Skip preamble and get to the point
- If it's a simple fact, just state it`;
```

### 6.4 Context-Specific Prompts

```typescript
const CONTEXT_PROMPTS = {
  driving: `The user is in hands-free mode, likely driving. Keep responses brief and avoid anything requiring visual attention. Prioritize safety - if they ask something that needs focused attention, suggest they check later.`,

  followUp: `This is a follow-up in an ongoing conversation. You have context from previous messages. Build on what was discussed without re-explaining basics.`,

  newSession: `This is the start of a new conversation session. The user has just activated the assistant.`,

  widgetQuery: `This query came from the home screen widget for a quick answer. Be especially concise - the user wants a fast response without opening the full app.`,
};
```

### 6.5 Summary Generation Prompt

```typescript
const SUMMARY_PROMPT = `Analyze this conversation and provide:

1. A brief title (5-7 words) capturing the main topic
2. A one-paragraph summary (2-3 sentences) of what was discussed
3. 2-4 key points or takeaways as simple phrases
4. 1-3 topic classifications from: work, personal, learning, creative, planning, research, coding, writing, health, finance, travel, general

Format as JSON:
{
  "title": "...",
  "summary": "...",
  "keyPoints": ["...", "..."],
  "topics": ["...", "..."]
}`;
```

---

## 7. Widget Implementation

### 7.1 Android Widget

#### 7.1.1 Widget Configuration

```xml
<!-- res/xml/voice_widget_info.xml -->
<appwidget-provider
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="110dp"
    android:minHeight="40dp"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/voice_widget"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:previewImage="@drawable/widget_preview">
</appwidget-provider>
```

#### 7.1.2 Widget Sizes

| Size | Dimensions | Features |
|------|------------|----------|
| Small (2x1) | 110dp x 40dp | Talk button only |
| Medium (4x2) | 250dp x 110dp | Talk + Recent + Last query preview |
| Large (4x4) | 250dp x 250dp | Talk + Recent + Last 3 conversations |

#### 7.1.3 React Native Integration

```typescript
// Using react-native-android-widget
import { requestWidgetUpdate } from 'react-native-android-widget';

interface WidgetData {
  lastQuery?: string;
  lastResponse?: string;
  recentConversations: Array<{
    id: string;
    title: string;
    preview: string;
  }>;
}

const updateWidget = async (data: WidgetData) => {
  await requestWidgetUpdate({
    widgetName: 'VoiceWidget',
    renderWidget: () => <VoiceWidgetUI {...data} />,
  });
};
```

#### 7.1.4 Widget Click Handlers

```typescript
const WIDGET_ACTIONS = {
  'com.claudevoice.WIDGET_TALK': async () => {
    // Launch overlay recording mode
    await launchRecordingOverlay();
  },

  'com.claudevoice.WIDGET_RECENT': async () => {
    // Open app to conversations list
    await launchApp({ screen: 'Conversations' });
  },

  'com.claudevoice.WIDGET_CONVERSATION': async (conversationId: string) => {
    // Open specific conversation
    await launchApp({
      screen: 'Conversation',
      params: { conversationId }
    });
  },
};
```

### 7.2 iOS Widget

#### 7.2.1 Widget Extension Structure

```
ClaudeVoiceWidget/
├── ClaudeVoiceWidget.swift          // Main widget
├── VoiceWidgetProvider.swift        // Timeline provider
├── VoiceWidgetEntryView.swift       // SwiftUI view
├── WidgetIntents.swift              // Intents for actions
└── Assets.xcassets/                 // Widget assets
```

#### 7.2.2 Widget Family Support

```swift
@main
struct ClaudeVoiceWidgets: WidgetBundle {
    var body: some Widget {
        VoiceWidget()
    }
}

struct VoiceWidget: Widget {
    let kind: String = "VoiceWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: VoiceWidgetProvider()) { entry in
            VoiceWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Claude Voice")
        .description("Quick access to Claude voice assistant")
        .supportedFamilies([
            .systemSmall,      // Talk button only
            .systemMedium,     // Talk + recent
            .systemLarge,      // Full features
            .accessoryCircular, // Watch complication
            .accessoryRectangular
        ])
    }
}
```

#### 7.2.3 Widget Timeline Provider

```swift
struct VoiceWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> VoiceWidgetEntry {
        VoiceWidgetEntry(
            date: Date(),
            lastQuery: "Tap to talk to Claude",
            recentConversations: []
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (VoiceWidgetEntry) -> Void) {
        let entry = fetchLatestData()
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<VoiceWidgetEntry>) -> Void) {
        let entry = fetchLatestData()
        // Update every 15 minutes or on significant changes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}
```

#### 7.2.4 React Native Bridge

```typescript
// iOS widget data sync via App Groups
import { NativeModules } from 'react-native';

const { WidgetBridge } = NativeModules;

interface WidgetBridgeInterface {
  updateWidgetData(data: WidgetData): Promise<void>;
  getWidgetLaunchAction(): Promise<WidgetAction | null>;
  clearWidgetLaunchAction(): Promise<void>;
}

// Call after any relevant data change
const syncWidgetData = async () => {
  const data: WidgetData = {
    lastQuery: await getLastQuery(),
    recentConversations: await getRecentConversations(3),
  };
  await WidgetBridge.updateWidgetData(data);
};
```

### 7.3 Widget Deep Linking

```typescript
const DEEP_LINKS = {
  talk: 'claudevoice://talk',
  talkHandsFree: 'claudevoice://talk?mode=hands-free',
  talkPushToTalk: 'claudevoice://talk?mode=push-to-talk',
  conversation: 'claudevoice://conversation/{id}',
  search: 'claudevoice://search',
  settings: 'claudevoice://settings',
};

// Handle incoming deep links
const handleDeepLink = async (url: string) => {
  const parsed = parseDeepLink(url);

  switch (parsed.action) {
    case 'talk':
      const mode = parsed.params?.mode || userSettings.voiceMode;
      await startRecording(mode);
      break;

    case 'conversation':
      navigation.navigate('Conversation', { id: parsed.params.id });
      break;

    default:
      navigation.navigate('Home');
  }
};
```

---

## 8. State Machine Diagrams

### 8.1 Hands-Free Mode State Machine

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           HANDS-FREE MODE STATE MACHINE                          │
└─────────────────────────────────────────────────────────────────────────────────┘

States: INITIALIZING, LISTENING, WAKE_DETECTED, RECORDING, PROCESSING, SPEAKING, ERROR

                                    ┌──────────────┐
                                    │ INITIALIZING │
                                    │              │
                                    │ - Load model │
                                    │ - Init audio │
                                    │ - Get perms  │
                                    └──────┬───────┘
                                           │
                         ┌─────────────────┼─────────────────┐
                         │ SUCCESS         │                 │ FAILURE
                         ▼                 │                 ▼
                  ┌──────────────┐         │          ┌──────────────┐
        ┌────────│  LISTENING   │◄────────┴──────────│    ERROR     │
        │        │              │                     │              │
        │        │ - Porcupine  │     RETRY (3x)     │ - Show error │
        │        │   active     │◄────────────────────│ - Log issue  │
        │        │ - Low power  │                     │              │
        │        └──────┬───────┘                     └──────────────┘
        │               │                                    ▲
        │               │ WAKE_WORD                          │
        │               ▼                                    │
        │        ┌──────────────┐                            │
        │        │WAKE_DETECTED │                            │
        │        │              │         TIMEOUT (5s)       │
        │        │ - Chime      │────────────────────────────┤
        │        │ - Start VAD  │                            │
        │        │ - Begin rec  │                            │
        │        └──────┬───────┘                            │
        │               │                                    │
        │               │ SPEECH_START                       │
        │               ▼                                    │
        │        ┌──────────────┐                            │
        │        │  RECORDING   │◄───────┐                   │
        │        │              │        │                   │
        │        │ - VAD active │        │ CONTINUE_SPEECH   │
        │        │ - Streaming  │        │                   │
        │        │   STT        │────────┘                   │
        │        └──────┬───────┘                            │
        │               │                                    │
        │     ┌─────────┼─────────┬───────────┐             │
        │     │         │         │           │             │
        │     │ SILENCE │ "CANCEL"│ "SEND IT" │ TIMEOUT     │
        │     │ (1.5s)  │         │           │ (60s)       │
        │     │         │         │           │             │
        │     │         ▼         ▼           │             │
        │     │  ┌─────────┐    ┌─────────┐  │             │
        │     │  │ DISCARD │    │ PROCESS │◄─┘             │
        │     │  │         │    │         │                │
        │     │  │ - Clear │    │ - Final │                │
        └─────┴──│   audio │    │   STT   │                │
                 │ - Chime │    │ - Route │                │
                 └────┬────┘    │   model │                │
                      │         │ - API   │                │
                      │         └────┬────┘                │
                      │              │                     │
                      │              │ RESPONSE            │
                      │              ▼                     │
                      │       ┌──────────────┐            │
                      │       │   SPEAKING   │            │
                      │       │              │            │
                      │       │ - TTS active │            │
                      │       │ - Can inter- │            │
                      │       │   rupt       │            │
                      │       └──────┬───────┘            │
                      │              │                     │
                      │    ┌─────────┼─────────┐          │
                      │    │         │         │          │
                      │    │ DONE    │ "STOP   │ API_ERROR │
                      │    │         │ TALKING"│          │
                      │    ▼         ▼         ▼          │
                      │ ┌─────────────────────────┐       │
                      └─│     Return to LISTENING │───────┘
                        │     (Ready chime)       │
                        └─────────────────────────┘


TRANSITIONS TABLE:
┌─────────────────┬────────────────────┬─────────────────┬────────────────────────┐
│ Current State   │ Event              │ Next State      │ Actions                │
├─────────────────┼────────────────────┼─────────────────┼────────────────────────┤
│ INITIALIZING    │ init_complete      │ LISTENING       │ Start Porcupine        │
│ INITIALIZING    │ init_failed        │ ERROR           │ Log, show error UI     │
│ LISTENING       │ wake_word          │ WAKE_DETECTED   │ Play chime, start VAD  │
│ WAKE_DETECTED   │ speech_start       │ RECORDING       │ Start STT streaming    │
│ WAKE_DETECTED   │ timeout (5s)       │ LISTENING       │ Play timeout sound     │
│ RECORDING       │ silence (1.5s)     │ PROCESSING      │ Finalize transcription │
│ RECORDING       │ "send it"          │ PROCESSING      │ Finalize transcription │
│ RECORDING       │ "cancel"           │ LISTENING       │ Discard, play sound    │
│ RECORDING       │ timeout (60s)      │ PROCESSING      │ Finalize transcription │
│ PROCESSING      │ response_ready     │ SPEAKING        │ Start TTS              │
│ PROCESSING      │ api_error          │ ERROR           │ Speak error message    │
│ SPEAKING        │ tts_complete       │ LISTENING       │ Play ready chime       │
│ SPEAKING        │ "stop talking"     │ LISTENING       │ Stop TTS, ready chime  │
│ ERROR           │ retry              │ INITIALIZING    │ Reset state            │
│ ERROR           │ dismiss            │ LISTENING       │ Clear error            │
└─────────────────┴────────────────────┴─────────────────┴────────────────────────┘
```

### 8.2 Push-to-Talk Mode State Machine

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PUSH-TO-TALK MODE STATE MACHINE                          │
└─────────────────────────────────────────────────────────────────────────────────┘

States: IDLE, RECORDING, PROCESSING, SPEAKING, ERROR

                              ┌────────────────┐
                              │      IDLE      │
              ┌───────────────│                │◄──────────────────┐
              │               │  ┌──────────┐  │                   │
              │               │  │  Button  │  │                   │
              │               │  │  Ready   │  │                   │
              │               │  └──────────┘  │                   │
              │               └───────┬────────┘                   │
              │                       │                            │
              │                       │ BUTTON_PRESS               │
              │                       ▼                            │
              │               ┌────────────────┐                   │
              │               │   RECORDING    │                   │
              │               │                │                   │
              │               │  ┌──────────┐  │                   │
              │               │  │ Waveform │  │                   │
              │     CANCEL    │  │ 0:05     │  │                   │
              │     (tap)     │  └──────────┘  │                   │
              │◄──────────────│                │                   │
              │               │  [Tap to Stop] │                   │
              │               └───────┬────────┘                   │
              │                       │                            │
              │          ┌────────────┼────────────┐               │
              │          │            │            │               │
              │          │ BUTTON     │ TIMEOUT    │               │
              │          │ _RELEASE   │ (60s)      │               │
              │          ▼            ▼            │               │
              │    ┌─────────────────────────┐    │               │
              │    │       PROCESSING        │◄───┘               │
              │    │                         │                     │
              │    │      ┌──────────┐       │                     │
              │    │      │ Spinner  │       │     TAP             │
              │    │      │ Thinking │       │     (cancel)        │
              │    │      └──────────┘       │─────────────────────┤
              │    │                         │                     │
              │    │    [Tap to Cancel]      │                     │
              │    └────────────┬────────────┘                     │
              │                 │                                  │
              │    ┌────────────┼────────────┐                    │
              │    │            │            │                    │
              │    │ SUCCESS    │ ERROR      │                    │
              │    ▼            ▼            │                    │
              │ ┌─────────┐ ┌─────────┐      │                    │
              │ │SPEAKING │ │  ERROR  │      │                    │
              │ │         │ │         │      │                    │
              │ │ 🔊 )))  │ │  ⚠️     │      │                    │
              │ │         │ │ Retry?  │──────┘                    │
              │ │[Tap to  │ └─────────┘                           │
              │ │ Stop]   │      │                                │
              │ └────┬────┘      │ DISMISS                        │
              │      │           │                                │
              │      │ COMPLETE  │                                │
              │      │ or TAP    │                                │
              │      ▼           ▼                                │
              │    ┌─────────────────────────┐                    │
              └────│   RETURN TO IDLE        │────────────────────┘
                   │   Display response text │
                   │   (optional)            │
                   └─────────────────────────┘


TRANSITIONS TABLE:
┌─────────────────┬────────────────────┬─────────────────┬────────────────────────┐
│ Current State   │ Event              │ Next State      │ Actions                │
├─────────────────┼────────────────────┼─────────────────┼────────────────────────┤
│ IDLE            │ button_press       │ RECORDING       │ Start audio, haptic    │
│ RECORDING       │ button_release     │ PROCESSING      │ Stop audio, transcribe │
│ RECORDING       │ tap (cancel)       │ IDLE            │ Discard audio          │
│ RECORDING       │ timeout (60s)      │ PROCESSING      │ Auto-stop, transcribe  │
│ PROCESSING      │ response_ready     │ SPEAKING        │ Start TTS              │
│ PROCESSING      │ tap (cancel)       │ IDLE            │ Cancel API request     │
│ PROCESSING      │ api_error          │ ERROR           │ Show error message     │
│ SPEAKING        │ tts_complete       │ IDLE            │ Show response text     │
│ SPEAKING        │ tap (interrupt)    │ IDLE            │ Stop TTS, show partial │
│ ERROR           │ retry              │ PROCESSING      │ Retry API call         │
│ ERROR           │ dismiss            │ IDLE            │ Clear error            │
└─────────────────┴────────────────────┴─────────────────┴────────────────────────┘
```

### 8.3 XState Implementation

```typescript
import { createMachine, assign } from 'xstate';

// Hands-Free Mode Machine
const handsFreeModeMachine = createMachine({
  id: 'handsFreeMode',
  initial: 'initializing',

  context: {
    transcript: '',
    audioBuffer: null,
    error: null,
    retryCount: 0,
    sessionId: null,
    response: null,
  },

  states: {
    initializing: {
      invoke: {
        src: 'initializeAudioServices',
        onDone: 'listening',
        onError: {
          target: 'error',
          actions: assign({ error: (_, event) => event.data }),
        },
      },
    },

    listening: {
      entry: ['startWakeWordDetection', 'resetContext'],
      on: {
        WAKE_WORD_DETECTED: 'wakeDetected',
        ERROR: {
          target: 'error',
          actions: assign({ error: (_, event) => event.error }),
        },
      },
    },

    wakeDetected: {
      entry: ['playChime', 'startVAD', 'startRecording'],
      after: {
        5000: 'listening', // Timeout if no speech
      },
      on: {
        SPEECH_START: 'recording',
      },
    },

    recording: {
      entry: ['startTranscription'],
      on: {
        TRANSCRIPT_UPDATE: {
          actions: assign({ transcript: (_, event) => event.text }),
        },
        SILENCE_DETECTED: 'processing',
        VOICE_COMMAND_SEND: 'processing',
        VOICE_COMMAND_CANCEL: {
          target: 'listening',
          actions: ['discardRecording', 'playCancelSound'],
        },
      },
      after: {
        60000: 'processing', // Max recording time
      },
    },

    processing: {
      entry: ['stopRecording', 'finalizeTranscription'],
      invoke: {
        src: 'sendToClaudeAPI',
        onDone: {
          target: 'speaking',
          actions: assign({ response: (_, event) => event.data }),
        },
        onError: {
          target: 'error',
          actions: assign({ error: (_, event) => event.data }),
        },
      },
    },

    speaking: {
      entry: ['startTTS'],
      on: {
        TTS_COMPLETE: {
          target: 'listening',
          actions: 'playReadyChime',
        },
        VOICE_COMMAND_STOP: {
          target: 'listening',
          actions: ['stopTTS', 'playReadyChime'],
        },
      },
    },

    error: {
      entry: ['logError', 'speakErrorMessage'],
      on: {
        RETRY: {
          target: 'initializing',
          cond: 'canRetry',
          actions: assign({ retryCount: (ctx) => ctx.retryCount + 1 }),
        },
        DISMISS: 'listening',
      },
    },
  },
}, {
  guards: {
    canRetry: (context) => context.retryCount < 3,
  },
});

// Push-to-Talk Mode Machine
const pushToTalkModeMachine = createMachine({
  id: 'pushToTalkMode',
  initial: 'idle',

  context: {
    transcript: '',
    audioBuffer: null,
    error: null,
    response: null,
    recordingDuration: 0,
  },

  states: {
    idle: {
      entry: ['resetContext'],
      on: {
        BUTTON_PRESS: {
          target: 'recording',
          actions: ['triggerHaptic', 'startRecording'],
        },
      },
    },

    recording: {
      entry: ['startTranscription', 'startDurationTimer'],
      on: {
        BUTTON_RELEASE: 'processing',
        TAP_CANCEL: {
          target: 'idle',
          actions: 'discardRecording',
        },
        DURATION_UPDATE: {
          actions: assign({ recordingDuration: (_, event) => event.duration }),
        },
        TRANSCRIPT_UPDATE: {
          actions: assign({ transcript: (_, event) => event.text }),
        },
      },
      after: {
        60000: 'processing',
      },
    },

    processing: {
      entry: ['stopRecording', 'finalizeTranscription'],
      invoke: {
        src: 'sendToClaudeAPI',
        onDone: {
          target: 'speaking',
          actions: assign({ response: (_, event) => event.data }),
        },
        onError: {
          target: 'error',
          actions: assign({ error: (_, event) => event.data }),
        },
      },
      on: {
        TAP_CANCEL: {
          target: 'idle',
          actions: 'cancelAPIRequest',
        },
      },
    },

    speaking: {
      entry: ['startTTS'],
      on: {
        TTS_COMPLETE: 'idle',
        TAP_INTERRUPT: {
          target: 'idle',
          actions: 'stopTTS',
        },
      },
    },

    error: {
      on: {
        RETRY: 'processing',
        DISMISS: 'idle',
      },
    },
  },
});
```

---

## 9. API Design

### 9.1 Model Routing Logic

```typescript
// ============================================
// COMPLEXITY DETECTION
// ============================================

interface ComplexitySignals {
  // Text analysis
  wordCount: number;
  questionCount: number;
  hasCodeKeywords: boolean;
  hasCreativeKeywords: boolean;
  hasAnalyticalKeywords: boolean;
  sentimentComplexity: number;

  // Context analysis
  conversationLength: number;
  topicDepth: number;
  previousModelUsed: 'opus' | 'haiku' | null;

  // User signals
  explicitModelRequest: 'opus' | 'haiku' | null;
  userPreference: 'auto' | 'opus' | 'haiku';
}

const COMPLEXITY_KEYWORDS = {
  creative: [
    'brainstorm', 'imagine', 'creative', 'story', 'write',
    'poem', 'design', 'invent', 'compose', 'dream up',
  ],
  analytical: [
    'analyze', 'compare', 'evaluate', 'pros and cons',
    'implications', 'strategy', 'deep dive', 'nuance',
  ],
  coding: [
    'code', 'function', 'debug', 'implement', 'algorithm',
    'refactor', 'architecture', 'optimize',
  ],
  quick: [
    'what is', 'when did', 'how do i', 'define',
    'quick question', 'remind me', 'what time',
  ],
};

function analyzeComplexity(
  transcript: string,
  context: ConversationContext
): ComplexitySignals {
  const words = transcript.toLowerCase().split(/\s+/);
  const sentences = transcript.split(/[.!?]+/);

  return {
    wordCount: words.length,
    questionCount: (transcript.match(/\?/g) || []).length,
    hasCodeKeywords: COMPLEXITY_KEYWORDS.coding.some(kw =>
      transcript.toLowerCase().includes(kw)
    ),
    hasCreativeKeywords: COMPLEXITY_KEYWORDS.creative.some(kw =>
      transcript.toLowerCase().includes(kw)
    ),
    hasAnalyticalKeywords: COMPLEXITY_KEYWORDS.analytical.some(kw =>
      transcript.toLowerCase().includes(kw)
    ),
    sentimentComplexity: calculateSentimentComplexity(transcript),
    conversationLength: context.messageCount,
    topicDepth: context.topicDepth,
    previousModelUsed: context.lastModel,
    explicitModelRequest: detectExplicitModelRequest(transcript),
    userPreference: context.userSettings.preferredModel,
  };
}

// ============================================
// MODEL ROUTER
// ============================================

interface RoutingDecision {
  model: 'opus' | 'haiku';
  confidence: number;
  reason: string;
}

function routeToModel(
  signals: ComplexitySignals
): RoutingDecision {
  // Explicit user request always wins
  if (signals.explicitModelRequest) {
    return {
      model: signals.explicitModelRequest,
      confidence: 1.0,
      reason: 'User explicitly requested this model',
    };
  }

  // User preference (non-auto)
  if (signals.userPreference !== 'auto') {
    return {
      model: signals.userPreference,
      confidence: 0.9,
      reason: 'User preference setting',
    };
  }

  // Calculate complexity score
  let complexityScore = 0;

  // Word count factor
  if (signals.wordCount > 50) complexityScore += 2;
  else if (signals.wordCount > 20) complexityScore += 1;

  // Creative/analytical keywords
  if (signals.hasCreativeKeywords) complexityScore += 3;
  if (signals.hasAnalyticalKeywords) complexityScore += 3;
  if (signals.hasCodeKeywords) complexityScore += 2;

  // Multiple questions
  if (signals.questionCount > 2) complexityScore += 2;

  // Conversation depth
  if (signals.conversationLength > 10) complexityScore += 1;
  if (signals.topicDepth > 3) complexityScore += 1;

  // Sentiment complexity
  complexityScore += signals.sentimentComplexity;

  // Decision threshold
  const OPUS_THRESHOLD = 5;

  if (complexityScore >= OPUS_THRESHOLD) {
    return {
      model: 'opus',
      confidence: Math.min(0.95, 0.6 + complexityScore * 0.05),
      reason: `Complexity score ${complexityScore} (creative/analytical query)`,
    };
  } else {
    return {
      model: 'haiku',
      confidence: Math.min(0.95, 0.7 + (OPUS_THRESHOLD - complexityScore) * 0.05),
      reason: `Complexity score ${complexityScore} (straightforward query)`,
    };
  }
}

// ============================================
// API CLIENT
// ============================================

import Anthropic from '@anthropic-ai/sdk';

interface APIConfig {
  opus: {
    model: 'claude-opus-4-5-20251101';
    maxTokens: 2048;
    temperature: 0.7;
  };
  haiku: {
    model: 'claude-3-5-haiku-20241022';
    maxTokens: 1024;
    temperature: 0.5;
  };
}

class ClaudeVoiceAPI {
  private client: Anthropic;
  private config: APIConfig;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
    this.config = {
      opus: {
        model: 'claude-opus-4-5-20251101',
        maxTokens: 2048,
        temperature: 0.7,
      },
      haiku: {
        model: 'claude-3-5-haiku-20241022',
        maxTokens: 1024,
        temperature: 0.5,
      },
    };
  }

  async sendMessage(
    transcript: string,
    context: ConversationContext,
    options?: {
      forceModel?: 'opus' | 'haiku';
      voiceMode?: 'hands-free' | 'push-to-talk' | 'widget';
    }
  ): Promise<APIResponse> {
    // Analyze and route
    const signals = analyzeComplexity(transcript, context);
    const routing = options?.forceModel
      ? { model: options.forceModel, confidence: 1, reason: 'Forced' }
      : routeToModel(signals);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(
      routing.model,
      options?.voiceMode || context.voiceMode
    );

    // Build messages array
    const messages = this.buildMessages(transcript, context);

    // Get model config
    const modelConfig = this.config[routing.model];

    const startTime = Date.now();

    try {
      const response = await this.client.messages.create({
        model: modelConfig.model,
        max_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        system: systemPrompt,
        messages,
      });

      const generationTime = Date.now() - startTime;

      return {
        content: response.content[0].type === 'text'
          ? response.content[0].text
          : '',
        model: routing.model,
        routingReason: routing.reason,
        routingConfidence: routing.confidence,
        tokenCount: response.usage.input_tokens + response.usage.output_tokens,
        generationTimeMs: generationTime,
      };
    } catch (error) {
      throw new APIError(error, routing.model);
    }
  }

  private buildSystemPrompt(
    model: 'opus' | 'haiku',
    voiceMode: string
  ): string {
    let prompt = VOICE_SYSTEM_PROMPT;

    // Add model-specific additions
    prompt += model === 'opus' ? OPUS_ADDITION : HAIKU_ADDITION;

    // Add context-specific prompts
    if (voiceMode === 'hands-free') {
      prompt += '\n\n' + CONTEXT_PROMPTS.driving;
    } else if (voiceMode === 'widget') {
      prompt += '\n\n' + CONTEXT_PROMPTS.widgetQuery;
    }

    return prompt;
  }

  private buildMessages(
    transcript: string,
    context: ConversationContext
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add conversation history (limited to last N messages)
    const historyLimit = 20;
    const recentHistory = context.messages.slice(-historyLimit);

    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current message
    messages.push({
      role: 'user',
      content: transcript,
    });

    return messages;
  }

  async generateSummary(
    messages: Message[]
  ): Promise<ConversationSummary> {
    const conversationText = messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');

    const response = await this.client.messages.create({
      model: 'claude-3-5-haiku-20241022', // Use Haiku for summaries
      max_tokens: 500,
      system: SUMMARY_PROMPT,
      messages: [{
        role: 'user',
        content: conversationText,
      }],
    });

    const text = response.content[0].type === 'text'
      ? response.content[0].text
      : '{}';

    return JSON.parse(text);
  }
}

interface APIResponse {
  content: string;
  model: 'opus' | 'haiku';
  routingReason: string;
  routingConfidence: number;
  tokenCount: number;
  generationTimeMs: number;
}

interface ConversationSummary {
  title: string;
  summary: string;
  keyPoints: string[];
  topics: string[];
}
```

### 9.2 API Error Handling

```typescript
class APIError extends Error {
  public readonly model: 'opus' | 'haiku';
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly userMessage: string;

  constructor(error: any, model: 'opus' | 'haiku') {
    super(error.message);
    this.model = model;

    // Classify error
    if (error.status === 429) {
      this.code = 'RATE_LIMITED';
      this.retryable = true;
      this.userMessage = "I'm getting a lot of requests right now. Let me try again in a moment.";
    } else if (error.status === 503) {
      this.code = 'SERVICE_UNAVAILABLE';
      this.retryable = true;
      this.userMessage = "I'm having trouble connecting. Give me a second to try again.";
    } else if (error.status === 401) {
      this.code = 'UNAUTHORIZED';
      this.retryable = false;
      this.userMessage = "There's an issue with the app configuration. Please contact support.";
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      this.code = 'TIMEOUT';
      this.retryable = true;
      this.userMessage = "The request took too long. Let me try again.";
    } else {
      this.code = 'UNKNOWN';
      this.retryable = false;
      this.userMessage = "Something went wrong. Please try again.";
    }
  }
}

// Retry logic with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
  }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!(error instanceof APIError) || !error.retryable) {
        throw error;
      }

      if (attempt < options.maxAttempts - 1) {
        const delay = Math.min(
          options.baseDelayMs * Math.pow(2, attempt),
          options.maxDelayMs
        );
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}
```

---

## 10. Privacy and Permissions

### 10.1 Required Permissions

#### Android (AndroidManifest.xml)

```xml
<!-- Core functionality -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />

<!-- Background operation (hands-free mode) -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- Widget functionality -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<!-- Optional: Bluetooth for car integration -->
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

<!-- Notification for background service -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

#### iOS (Info.plist)

```xml
<!-- Microphone access -->
<key>NSMicrophoneUsageDescription</key>
<string>Claude Voice needs microphone access to hear your questions and have conversations with you.</string>

<!-- Speech recognition -->
<key>NSSpeechRecognitionUsageDescription</key>
<string>Claude Voice uses speech recognition to convert your voice to text for processing.</string>

<!-- Background modes -->
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
    <string>fetch</string>
    <string>processing</string>
</array>

<!-- Siri integration (optional) -->
<key>NSSiriUsageDescription</key>
<string>Enable Siri shortcuts to quickly start Claude Voice conversations.</string>
```

### 10.2 Permission Request Flow

```typescript
interface PermissionState {
  microphone: 'granted' | 'denied' | 'undetermined';
  speechRecognition: 'granted' | 'denied' | 'undetermined';
  notifications: 'granted' | 'denied' | 'undetermined';
  backgroundAudio: 'granted' | 'denied' | 'undetermined'; // iOS only
}

const requestPermissions = async (): Promise<PermissionState> => {
  // Request in order of importance

  // 1. Microphone (required)
  const micPermission = await requestMicrophonePermission();
  if (micPermission === 'denied') {
    showPermissionDeniedScreen('microphone');
    return { ...initialState, microphone: 'denied' };
  }

  // 2. Speech Recognition (required)
  const speechPermission = await requestSpeechRecognitionPermission();
  if (speechPermission === 'denied') {
    showPermissionDeniedScreen('speechRecognition');
    return { ...initialState, speechRecognition: 'denied' };
  }

  // 3. Notifications (optional but recommended for hands-free)
  const notifPermission = await requestNotificationPermission();

  return {
    microphone: micPermission,
    speechRecognition: speechPermission,
    notifications: notifPermission,
    backgroundAudio: 'granted', // Assumed if others granted
  };
};
```

### 10.3 Data Privacy Policy

```typescript
const PRIVACY_POLICY = {
  dataCollection: {
    voiceRecordings: {
      stored: false,  // Audio deleted after transcription
      sentToServer: false,  // Transcription is local
      exception: 'Optional cloud backup of transcriptions',
    },

    transcriptions: {
      stored: true,  // In Firestore
      encrypted: true,  // At rest
      retention: 'Until user deletion',
    },

    conversationHistory: {
      stored: true,
      location: 'Firebase Firestore',
      encryption: 'AES-256 at rest',
      userControl: 'Full deletion capability',
    },

    analytics: {
      collected: 'Only if opted in',
      data: ['App usage patterns', 'Feature usage', 'Crash reports'],
      pii: false,  // No personally identifiable information
    },
  },

  thirdPartySharing: {
    anthropic: {
      what: 'Conversation text only (not audio)',
      purpose: 'AI response generation',
      retention: 'Per Anthropic data retention policy',
    },

    picovoice: {
      what: 'Nothing - wake word detection is fully on-device',
      retention: 'N/A',
    },

    firebase: {
      what: 'Encrypted conversation data, auth tokens',
      purpose: 'Data storage and authentication',
      retention: 'Per user settings',
    },
  },

  userRights: {
    access: 'Export all data via Settings',
    deletion: 'Delete all data via Settings',
    correction: 'Edit any conversation/message',
    portability: 'JSON export available',
  },
};
```

### 10.4 Security Measures

```typescript
const SECURITY_MEASURES = {
  transport: {
    protocol: 'TLS 1.3',
    certificatePinning: true,
    apiCommunication: 'HTTPS only',
  },

  storage: {
    sensitiveData: 'Encrypted Keychain/Keystore',
    conversationData: 'Firebase with encryption at rest',
    localCache: 'AsyncStorage (non-sensitive only)',
  },

  authentication: {
    method: 'Firebase Auth',
    tokens: 'Secure storage in Keychain/Keystore',
    sessions: 'Auto-refresh with secure token rotation',
  },

  apiKey: {
    storage: 'Server-side only',
    clientAccess: 'Via authenticated API proxy',
    rotation: 'Supported without app update',
  },
};
```

---

## 11. Implementation Roadmap

### 11.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              IMPLEMENTATION PHASES                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  PHASE 1: Foundation (Weeks 1-4)                                                │
│  ════════════════════════════════                                               │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                                                                  │
│  PHASE 2: Core Features (Weeks 5-8)                                             │
│  ═══════════════════════════════════                                            │
│  ░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                                                                  │
│  PHASE 3: Intelligence (Weeks 9-12)                                             │
│  ═══════════════════════════════════                                            │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░  │
│                                                                                  │
│  PHASE 4: Polish & Launch (Weeks 13-16)                                         │
│  ═══════════════════════════════════════                                        │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Phase 1: Foundation (Weeks 1-4)

**Goal**: Basic app structure with push-to-talk working end-to-end

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 1 | Project setup, navigation structure | - RN project with TypeScript<br>- Navigation (React Navigation)<br>- Basic screens (Home, Settings, Conversations) |
| 2 | Speech recognition integration | - @react-native-voice/voice integration<br>- Permission handling<br>- Basic recording UI |
| 3 | TTS + Claude API | - react-native-tts setup<br>- Anthropic SDK integration<br>- Basic message flow |
| 4 | Firebase + Data layer | - Firebase Auth<br>- Firestore setup<br>- Message persistence |

**Milestone**: Can record voice, send to Claude Haiku, hear response via TTS

### 11.3 Phase 2: Core Features (Weeks 5-8)

**Goal**: Both voice modes functional with conversation management

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 5 | Push-to-talk polish | - Full state machine<br>- Visual feedback (waveform)<br>- Interruption handling |
| 6 | Hands-free mode basics | - Picovoice integration<br>- Wake word detection<br>- VAD implementation |
| 7 | Hands-free completion | - Voice commands<br>- Background service<br>- Audio feedback system |
| 8 | Conversation management | - Session handling<br>- Conversation list UI<br>- Search functionality |

**Milestone**: Both modes fully functional, conversations persist and searchable

### 11.4 Phase 3: Intelligence (Weeks 9-12)

**Goal**: Smart features and organization

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 9 | Model routing | - Complexity detection<br>- Opus/Haiku routing<br>- User preference handling |
| 10 | Auto-organization | - AI summaries<br>- Topic classification<br>- Auto-titling |
| 11 | Widgets - Android | - Widget layouts<br>- Deep linking<br>- Quick recording |
| 12 | Widgets - iOS | - Widget extension<br>- App Groups data sharing<br>- Siri shortcuts |

**Milestone**: Intelligent model selection, auto-organized conversations, working widgets

### 11.5 Phase 4: Polish & Launch (Weeks 13-16)

**Goal**: Production-ready quality

| Week | Tasks | Deliverables |
|------|-------|--------------|
| 13 | UX Polish | - Animations and transitions<br>- Loading states<br>- Error handling UX |
| 14 | Performance | - App startup optimization<br>- Memory management<br>- Battery optimization |
| 15 | Testing & QA | - Unit tests<br>- E2E tests (Detox)<br>- Beta testing |
| 16 | Launch prep | - App store assets<br>- Privacy policy<br>- Documentation |

**Milestone**: App store submission

### 11.6 Post-Launch Roadmap

| Version | Timeline | Features |
|---------|----------|----------|
| 1.1 | +4 weeks | - Folders for organization<br>- Export conversations<br>- Voice selection UI |
| 1.2 | +8 weeks | - Watch OS app<br>- Car Play / Android Auto<br>- Multi-language support |
| 2.0 | +16 weeks | - Proactive suggestions<br>- Scheduled check-ins<br>- Third-party integrations |

---

## 12. Cost Estimates

### 12.1 API Usage Costs

**Pricing (as of January 2026)**:
- Claude Opus: $15 per million input tokens, $75 per million output tokens
- Claude Haiku: $0.80 per million input tokens, $4 per million output tokens

### 12.2 Usage Scenarios

```typescript
interface UsageScenario {
  name: string;
  queriesPerDay: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  opusPercentage: number;  // Percent routed to Opus
}

const SCENARIOS: UsageScenario[] = [
  {
    name: 'Light User',
    queriesPerDay: 5,
    avgInputTokens: 150,
    avgOutputTokens: 300,
    opusPercentage: 20,
  },
  {
    name: 'Moderate User',
    queriesPerDay: 20,
    avgInputTokens: 200,
    avgOutputTokens: 400,
    opusPercentage: 30,
  },
  {
    name: 'Heavy User',
    queriesPerDay: 50,
    avgInputTokens: 300,
    avgOutputTokens: 500,
    opusPercentage: 40,
  },
];
```

### 12.3 Cost Calculations

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        MONTHLY COST PER USER (30 days)                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  LIGHT USER (5 queries/day)                                                     │
│  ═══════════════════════════                                                    │
│  Haiku queries: 120/month × (150 input + 300 output tokens)                    │
│    = 18K input tokens × $0.0008  = $0.014                                       │
│    = 36K output tokens × $0.004  = $0.144                                       │
│                                                                                  │
│  Opus queries: 30/month × (150 input + 300 output tokens)                       │
│    = 4.5K input tokens × $0.015  = $0.068                                       │
│    = 9K output tokens × $0.075   = $0.675                                       │
│                                                                                  │
│  TOTAL: ~$0.90/month                                                            │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  MODERATE USER (20 queries/day)                                                 │
│  ═════════════════════════════                                                  │
│  Haiku queries: 420/month × (200 input + 400 output tokens)                    │
│    = 84K input tokens × $0.0008  = $0.067                                       │
│    = 168K output tokens × $0.004 = $0.672                                       │
│                                                                                  │
│  Opus queries: 180/month × (200 input + 400 output tokens)                      │
│    = 36K input tokens × $0.015   = $0.540                                       │
│    = 72K output tokens × $0.075  = $5.400                                       │
│                                                                                  │
│  TOTAL: ~$6.68/month                                                            │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  HEAVY USER (50 queries/day)                                                    │
│  ═══════════════════════════                                                    │
│  Haiku queries: 900/month × (300 input + 500 output tokens)                    │
│    = 270K input tokens × $0.0008 = $0.216                                       │
│    = 450K output tokens × $0.004 = $1.800                                       │
│                                                                                  │
│  Opus queries: 600/month × (300 input + 500 output tokens)                      │
│    = 180K input tokens × $0.015  = $2.700                                       │
│    = 300K output tokens × $0.075 = $22.500                                      │
│                                                                                  │
│  TOTAL: ~$27.22/month                                                           │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 12.4 Subscription Tiers

```typescript
const SUBSCRIPTION_TIERS = {
  free: {
    price: 0,
    limits: {
      queriesPerDay: 10,
      opusQueriesPerDay: 2,
      backgroundMinutesPerDay: 15,
    },
    estimatedCostToServe: 1.50,  // Per user per month
  },

  pro: {
    price: 9.99,
    limits: {
      queriesPerDay: 100,
      opusQueriesPerDay: 30,
      backgroundMinutesPerDay: 120,
    },
    estimatedCostToServe: 8.00,
    margin: 0.20,  // 20% margin
  },

  unlimited: {
    price: 24.99,
    limits: {
      queriesPerDay: Infinity,
      opusQueriesPerDay: Infinity,
      backgroundMinutesPerDay: Infinity,
    },
    estimatedCostToServe: 18.00,  // Assumes heavy user
    margin: 0.28,  // 28% margin
  },
};
```

### 12.5 Infrastructure Costs

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Firebase Firestore | ~$0.01/user | At scale with efficient queries |
| Firebase Auth | Free tier | Up to 50K MAU |
| Cloud Storage (audio backup) | ~$0.02/user | If enabled |
| Picovoice Porcupine | $0/user | On-device, no cloud costs |
| **Total Infrastructure** | **~$0.03/user/month** | |

### 12.6 Break-Even Analysis

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           BREAK-EVEN ANALYSIS                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Assumptions:                                                                   │
│  - 70% Free users, 25% Pro users, 5% Unlimited users                           │
│  - Free users cost $1.50/month (limited usage)                                  │
│  - Pro users cost $8/month, pay $9.99                                           │
│  - Unlimited users cost $18/month, pay $24.99                                   │
│                                                                                  │
│  Per 1000 Users:                                                                │
│  ─────────────────                                                              │
│  Revenue:                                                                       │
│    700 × $0     = $0                                                            │
│    250 × $9.99  = $2,497.50                                                     │
│    50  × $24.99 = $1,249.50                                                     │
│    TOTAL REVENUE = $3,747.00                                                    │
│                                                                                  │
│  Costs:                                                                         │
│    700 × $1.50  = $1,050.00                                                     │
│    250 × $8.00  = $2,000.00                                                     │
│    50  × $18.00 = $900.00                                                       │
│    TOTAL COSTS  = $3,950.00                                                     │
│                                                                                  │
│  NET = -$203.00 per 1000 users (loss)                                          │
│                                                                                  │
│  Break-even requires:                                                           │
│  - Higher conversion to paid (30%+ paid users)                                  │
│  - OR lower free tier limits                                                    │
│  - OR higher prices ($12.99 Pro, $29.99 Unlimited)                             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Technical Architecture

### 13.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLAUDE VOICE ASSISTANT ARCHITECTURE                    │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │   USER DEVICE   │
                                    │  (iOS/Android)  │
                                    └────────┬────────┘
                                             │
         ┌───────────────────────────────────┼───────────────────────────────────┐
         │                                   │                                    │
         │                          REACT NATIVE APP                              │
         │  ┌─────────────────────────────────────────────────────────────────┐  │
         │  │                         UI LAYER                                 │  │
         │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │  │
         │  │  │   Screens    │  │  Components  │  │    Widgets           │   │  │
         │  │  │  - Home      │  │  - VoiceBtn  │  │  - Android Widget    │   │  │
         │  │  │  - Convo     │  │  - Waveform  │  │  - iOS WidgetKit     │   │  │
         │  │  │  - Settings  │  │  - ChatList  │  │                      │   │  │
         │  │  └──────────────┘  └──────────────┘  └──────────────────────┘   │  │
         │  └─────────────────────────────────────────────────────────────────┘  │
         │                                   │                                    │
         │  ┌─────────────────────────────────────────────────────────────────┐  │
         │  │                       STATE LAYER                                │  │
         │  │  ┌──────────────────────────────────────────────────────────┐   │  │
         │  │  │                    XState Machines                        │   │  │
         │  │  │  ┌─────────────────┐      ┌─────────────────┐            │   │  │
         │  │  │  │ Hands-Free FSM  │      │ Push-to-Talk FSM│            │   │  │
         │  │  │  └─────────────────┘      └─────────────────┘            │   │  │
         │  │  └──────────────────────────────────────────────────────────┘   │  │
         │  │  ┌──────────────────────────────────────────────────────────┐   │  │
         │  │  │                    Zustand Store                          │   │  │
         │  │  │  - User Settings  - Conversations  - Current Session     │   │  │
         │  │  └──────────────────────────────────────────────────────────┘   │  │
         │  └─────────────────────────────────────────────────────────────────┘  │
         │                                   │                                    │
         │  ┌─────────────────────────────────────────────────────────────────┐  │
         │  │                      SERVICE LAYER                               │  │
         │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │  │
         │  │  │   Voice    │ │    TTS     │ │   Audio    │ │  Storage   │    │  │
         │  │  │  Service   │ │  Service   │ │  Service   │ │  Service   │    │  │
         │  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘    │  │
         │  │  ┌────────────┐ ┌────────────┐ ┌────────────┐                   │  │
         │  │  │ Porcupine  │ │   Claude   │ │  Firebase  │                   │  │
         │  │  │  Service   │ │    API     │ │   Client   │                   │  │
         │  │  └────────────┘ └────────────┘ └────────────┘                   │  │
         │  └─────────────────────────────────────────────────────────────────┘  │
         │                                   │                                    │
         └───────────────────────────────────┼───────────────────────────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
         ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
         │   NATIVE LAYER   │    │   NATIVE LAYER   │    │   NATIVE LAYER   │
         │                  │    │                  │    │                  │
         │  ┌────────────┐  │    │  ┌────────────┐  │    │  ┌────────────┐  │
         │  │ Porcupine  │  │    │  │   Speech   │  │    │  │    TTS     │  │
         │  │    SDK     │  │    │  │ Recognizer │  │    │  │   Engine   │  │
         │  │ (On-device)│  │    │  │            │  │    │  │            │  │
         │  └────────────┘  │    │  └────────────┘  │    │  └────────────┘  │
         │                  │    │                  │    │                  │
         │  Wake Word       │    │  Platform STT    │    │  Platform TTS    │
         │  Detection       │    │  (Google/Apple)  │    │  (Google/Apple)  │
         └──────────────────┘    └──────────────────┘    └──────────────────┘
                                             │
                                             │ HTTPS
                                             ▼
         ┌───────────────────────────────────────────────────────────────────────┐
         │                            CLOUD SERVICES                              │
         │                                                                        │
         │  ┌─────────────────────┐              ┌─────────────────────┐         │
         │  │    ANTHROPIC API    │              │      FIREBASE       │         │
         │  │                     │              │                     │         │
         │  │  ┌───────────────┐  │              │  ┌───────────────┐  │         │
         │  │  │  Claude Opus  │  │              │  │   Firestore   │  │         │
         │  │  │ (Complex Q's) │  │              │  │  (User Data)  │  │         │
         │  │  └───────────────┘  │              │  └───────────────┘  │         │
         │  │  ┌───────────────┐  │              │  ┌───────────────┐  │         │
         │  │  │ Claude Haiku  │  │              │  │     Auth      │  │         │
         │  │  │ (Quick Q's)   │  │              │  │   (Login)     │  │         │
         │  │  └───────────────┘  │              │  └───────────────┘  │         │
         │  │                     │              │  ┌───────────────┐  │         │
         │  │  Model Routing      │              │  │Cloud Storage  │  │         │
         │  │  (Client-side)      │              │  │(Audio backup) │  │         │
         │  │                     │              │  └───────────────┘  │         │
         │  └─────────────────────┘              └─────────────────────┘         │
         │                                                                        │
         └───────────────────────────────────────────────────────────────────────┘
```

### 13.2 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW - VOICE QUERY                            │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  User   │     │ Audio   │     │  STT    │     │ Model   │     │ Claude  │
│  Speaks │────▶│ Capture │────▶│ Engine  │────▶│ Router  │────▶│   API   │
│         │     │         │     │         │     │         │     │         │
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
                   │                │               │               │
                   │ PCM Audio      │ Transcript    │ Routing       │ Response
                   │ (16kHz)        │ + Confidence  │ Decision      │ Text
                   ▼                ▼               ▼               ▼
              ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
              │  VAD    │     │ Message │     │ System  │     │   TTS   │
              │ Check   │     │ Store   │     │ Prompt  │     │ Engine  │
              │         │     │         │     │ Build   │     │         │
              └─────────┘     └─────────┘     └─────────┘     └─────────┘
                                  │                               │
                                  │ Firestore                     │ Audio
                                  │ Write                         │ Output
                                  ▼                               ▼
                             ┌─────────┐                     ┌─────────┐
                             │ Sync to │                     │  User   │
                             │ Cloud   │                     │  Hears  │
                             │         │                     │         │
                             └─────────┘                     └─────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW - SESSION LIFECYCLE                           │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│   App    │    │  Create  │    │   Add    │    │  App     │    │ Generate │
│  Opens   │───▶│ Session  │───▶│ Messages │───▶│ Closes   │───▶│ Summary  │
│          │    │          │    │          │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                    │               │               │               │
                    │ UUID          │ User/         │ Session       │ AI
                    │ Timestamp     │ Assistant     │ End Time      │ Summary
                    ▼               ▼               ▼               ▼
               ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
               │ Session  │    │ Message  │    │ Status:  │    │ Topic    │
               │ Doc in   │    │ Docs in  │    │ Completed│    │ Classify │
               │ Firestore│    │ Firestore│    │          │    │          │
               └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                                    │
                                                                    ▼
                                                               ┌──────────┐
                                                               │ Update   │
                                                               │ Convo    │
                                                               │ Metadata │
                                                               └──────────┘
```

### 13.3 Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | React Native 0.73+ | Cross-platform mobile |
| **Language** | TypeScript 5.x | Type safety |
| **State** | Zustand + XState | App state + FSM |
| **Navigation** | React Navigation 6 | Screen navigation |
| **Voice Input** | @react-native-voice/voice | Speech-to-text |
| **Voice Output** | react-native-tts | Text-to-speech |
| **Wake Word** | Picovoice Porcupine | On-device detection |
| **AI** | @anthropic-ai/sdk | Claude API client |
| **Backend** | Firebase | Auth, Firestore, Storage |
| **Local Storage** | MMKV | Fast key-value storage |
| **Testing** | Jest + Detox | Unit + E2E testing |
| **Widgets** | react-native-android-widget + WidgetKit | Home screen widgets |

### 13.4 Directory Structure

```
claude-voice-assistant/
├── android/                      # Android native code
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/.../
│   │   │   │   ├── VoiceWidgetProvider.kt
│   │   │   │   ├── VoiceForegroundService.kt
│   │   │   │   └── MainApplication.kt
│   │   │   └── res/
│   │   │       └── xml/voice_widget_info.xml
│   │   └── build.gradle
│   └── build.gradle
│
├── ios/                          # iOS native code
│   ├── ClaudeVoice/
│   │   ├── AppDelegate.mm
│   │   └── Info.plist
│   ├── ClaudeVoiceWidget/        # Widget Extension
│   │   ├── ClaudeVoiceWidget.swift
│   │   └── Assets.xcassets/
│   └── Podfile
│
├── src/
│   ├── app/                      # App entry and config
│   │   ├── App.tsx
│   │   ├── Navigation.tsx
│   │   └── providers/
│   │
│   ├── screens/                  # Screen components
│   │   ├── HomeScreen.tsx
│   │   ├── ConversationsScreen.tsx
│   │   ├── ConversationDetailScreen.tsx
│   │   ├── SettingsScreen.tsx
│   │   └── OnboardingScreen.tsx
│   │
│   ├── components/               # Reusable components
│   │   ├── voice/
│   │   │   ├── PushToTalkButton.tsx
│   │   │   ├── HandsFreeIndicator.tsx
│   │   │   ├── Waveform.tsx
│   │   │   └── VoiceCommandOverlay.tsx
│   │   ├── conversation/
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── ConversationList.tsx
│   │   │   └── SearchBar.tsx
│   │   └── common/
│   │       ├── Button.tsx
│   │       └── LoadingSpinner.tsx
│   │
│   ├── services/                 # Business logic
│   │   ├── voice/
│   │   │   ├── VoiceService.ts
│   │   │   ├── TTSService.ts
│   │   │   ├── WakeWordService.ts
│   │   │   └── VADService.ts
│   │   ├── api/
│   │   │   ├── ClaudeAPI.ts
│   │   │   ├── ModelRouter.ts
│   │   │   └── PromptBuilder.ts
│   │   ├── storage/
│   │   │   ├── FirebaseService.ts
│   │   │   ├── LocalStorage.ts
│   │   │   └── SyncService.ts
│   │   └── analytics/
│   │       └── AnalyticsService.ts
│   │
│   ├── machines/                 # XState machines
│   │   ├── handsFreeModeMachine.ts
│   │   ├── pushToTalkModeMachine.ts
│   │   └── sessionMachine.ts
│   │
│   ├── store/                    # Zustand stores
│   │   ├── useUserStore.ts
│   │   ├── useConversationStore.ts
│   │   └── useSettingsStore.ts
│   │
│   ├── hooks/                    # Custom hooks
│   │   ├── useVoiceMode.ts
│   │   ├── useConversation.ts
│   │   └── usePermissions.ts
│   │
│   ├── types/                    # TypeScript types
│   │   ├── conversation.ts
│   │   ├── user.ts
│   │   └── api.ts
│   │
│   ├── utils/                    # Utilities
│   │   ├── audio.ts
│   │   ├── formatting.ts
│   │   └── constants.ts
│   │
│   └── config/                   # Configuration
│       ├── firebase.ts
│       ├── prompts.ts
│       └── theme.ts
│
├── __tests__/                    # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── assets/                       # Static assets
│   ├── sounds/
│   ├── images/
│   └── fonts/
│
├── .env.example                  # Environment template
├── app.json                      # Expo/RN config
├── babel.config.js
├── metro.config.js
├── package.json
├── tsconfig.json
└── README.md
```

---

## Appendix A: Voice Command Grammar

```
WAKE_PHRASE     := "hey claude"

SUBMIT_COMMAND  := "send it" | "submit" | "go ahead" | "that's it"

CANCEL_COMMAND  := "cancel" | "never mind" | "stop" | "forget it"

REPEAT_COMMAND  := "read that again" | "repeat" | "say again" | "what?"

STOP_TTS        := "stop talking" | "quiet" | "shut up" | "okay"

NEW_CONVO       := "new conversation" | "fresh start" | "start over"

MODEL_REQUEST   := "use opus" | "think deeply" | "use haiku" | "quick answer"
```

---

## Appendix B: Error Codes

| Code | Name | User Message | Recovery |
|------|------|--------------|----------|
| E001 | MIC_PERMISSION | "I need microphone access to hear you" | Prompt permission |
| E002 | STT_UNAVAILABLE | "Speech recognition isn't working" | Check network |
| E003 | API_RATE_LIMIT | "I need a moment to catch up" | Auto-retry |
| E004 | API_ERROR | "Something went wrong on my end" | Retry with backoff |
| E005 | TTS_FAILURE | "I can't speak right now" | Show text instead |
| E006 | NETWORK_OFFLINE | "I can't reach the internet" | Queue for later |
| E007 | WAKE_WORD_INIT | "Hands-free mode isn't starting" | Fallback to PTT |
| E008 | SESSION_EXPIRED | "Please sign in again" | Re-authenticate |

---

## Appendix C: Analytics Events

```typescript
const ANALYTICS_EVENTS = {
  // Session events
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',

  // Voice events
  WAKE_WORD_DETECTED: 'wake_word_detected',
  RECORDING_START: 'recording_start',
  RECORDING_END: 'recording_end',

  // API events
  API_REQUEST: 'api_request',
  API_RESPONSE: 'api_response',
  MODEL_ROUTED: 'model_routed',

  // User actions
  MODE_SWITCHED: 'mode_switched',
  CONVERSATION_CREATED: 'conversation_created',
  CONVERSATION_ARCHIVED: 'conversation_archived',
  SEARCH_PERFORMED: 'search_performed',

  // Widget events
  WIDGET_TAP: 'widget_tap',
  WIDGET_QUERY_COMPLETE: 'widget_query_complete',

  // Errors
  ERROR_OCCURRED: 'error_occurred',
};
```

---

*Document generated for Claude Voice Assistant v1.0.0*
*Last updated: January 2026*
