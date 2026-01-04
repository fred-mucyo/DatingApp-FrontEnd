# Uni Dating Beta - Detailed Project Analysis

This document provides a comprehensive analysis of how the Uni Dating Beta project works, including the matching algorithm, badge system, and synchronization mechanisms.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Matching Algorithm](#matching-algorithm)
4. [Badge System](#badge-system)
5. [Synchronization Mechanisms](#synchronization-mechanisms)
6. [Data Flow Diagrams](#data-flow-diagrams)
7. [Key Components Breakdown](#key-components-breakdown)

---

## Project Overview

**Uni Dating Beta** is a React Native dating application built with Expo that connects university students. The app allows users to:
- Create detailed profiles with photos, interests, and preferences
- Discover and like other users
- Receive and respond to incoming likes
- Chat with matched users
- Manage their dating experience with safety features

### Core Features

1. **Authentication**: Username + password login (maps to email internally)
2. **Profile Management**: 6-step wizard for profile creation
3. **Discovery**: Daily curated suggestions of potential matches
4. **Likes System**: Like/Pass on profiles, view incoming likes
5. **Matching**: Automatic match creation when two users like each other
6. **Messaging**: Real-time chat with matched users
7. **Badge Notifications**: Visual indicators for unread messages and new likes
8. **Safety Features**: Block/unmatch functionality

---

## Architecture & Tech Stack

### Frontend
- **Framework**: React Native (Expo ~52.0.0)
- **Language**: TypeScript
- **Navigation**: React Navigation (Native Stack)
- **State Management**: React Context API (`AuthContext`)
- **Storage**: AsyncStorage for local caching and session persistence
- **UI Components**: Custom components with React Native primitives

### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime subscriptions
- **Storage**: Cloudinary (for image uploads)
- **Security**: Row Level Security (RLS) policies

### Key Database Tables

1. **`profiles`**: User profile information
   - Basic info: name, age, gender, city, country
   - Preferences: relationship_goal, gender_preference
   - Content: bio, interests (array), profile_photos (array)
   - Status: is_complete flag

2. **`likes`**: Like relationships
   - `liker_id`: User who sent the like
   - `liked_id`: User who received the like
   - `created_at`: Timestamp

3. **`matches`**: Mutual matches
   - `user1_id`, `user2_id`: The two matched users
   - `created_at`: Match timestamp
   - Created automatically when mutual likes occur

4. **`messages`**: Chat messages
   - `match_id`: Reference to the match
   - `sender_id`: User who sent the message
   - `content`: Message text
   - `created_at`: Timestamp

5. **`blocks`**: Blocked relationships
   - `blocker_id`: User who blocked
   - `blocked_id`: User who was blocked

---

## Matching Algorithm

### Overview

The matching algorithm uses a **two-phase approach**:
1. **Suggestion Generation**: Client-side filtering and scoring
2. **Match Detection**: Server-side trigger or client-side check for mutual likes

### Phase 1: Daily Suggestions Generation

**Location**: `src/services/matching.ts` - `getDailySuggestions()`

#### Caching Strategy
- Suggestions are **cached per day** in AsyncStorage
- Cache key: `matching.daily_suggestions:${userId}`
- Cache includes `generatedAt` date (YYYY-MM-DD format)
- If cache exists and is from today, returns cached suggestions
- Otherwise, generates new suggestions and caches them

#### Filtering Logic (`fetchLooseSuggestions`)

The algorithm filters candidates through multiple layers:

**1. Hard Exclusions** (always filtered out):
- Self (current user's own profile)
- Already liked users (from `likes` table where `liker_id = current_user`)
- Blocked users (from `blocks` table, both directions)
- Locally passed users (stored in AsyncStorage per user)

**2. Availability-First Approach**:
- The algorithm prioritizes **showing users** over strict filtering
- If no candidates remain after filtering, it falls back to showing all users except self
- This ensures users always see suggestions, even in small user bases

#### Scoring System

Candidates are scored based on compatibility factors:

```typescript
Score Calculation:
- Same city: +4 points
- Same country (if not same city): +2 points
- Same relationship goal: +1 point
- Gender matches preference: +1 point
```

**Scoring Details**:
- Scores are calculated by comparing the current user's profile with each candidate
- Higher scores indicate better compatibility
- Candidates are sorted by score (descending) and limited to top 20

**Note**: The current implementation uses **loose filtering** - it doesn't strictly exclude users based on preferences. Instead, it uses preferences for **ordering/ranking** only. This means users might see profiles that don't perfectly match their gender preference, but they'll be ranked lower.

#### Code Flow

```typescript
getDailySuggestions() 
  → Checks AsyncStorage cache
  → If cache valid: return cached
  → If not: fetchLooseSuggestions()
    → Load current user profile
    → Fetch all profiles, likes, blocks, passed IDs
    → Filter out: self, liked, blocked, passed
    → Score remaining candidates
    → Sort by score (descending)
    → Take top 20
    → Cache and return
```

### Phase 2: Match Detection

**Location**: `src/services/matching.ts` - `sendLike()`

#### Like Flow

1. **User likes a profile**:
   - `sendLike(targetProfileId)` is called
   - Checks if like already exists (prevents duplicates)
   - If not exists, inserts into `likes` table:
     ```sql
     INSERT INTO likes (liker_id, liked_id) 
     VALUES (current_user_id, target_profile_id)
     ```

2. **Match Detection**:
   - After inserting the like, checks for mutual like:
     ```typescript
     // Query matches table for existing match
     SELECT * FROM matches 
     WHERE (user1_id = me AND user2_id = target) 
        OR (user1_id = target AND user2_id = me)
     ```
   - If match exists, returns `{ isMatch: true, match }`
   - If no match, returns `{ isMatch: false, match: null }`

#### Match Creation

**Important**: The actual match creation happens via **database trigger** (not shown in frontend code, but referenced in documentation). When a like is inserted:

1. Database trigger checks if reciprocal like exists
2. If both users have liked each other, creates a match row
3. The match is then available for both users in their matches list

**Alternative**: The frontend code in `sendLike()` checks for matches immediately after inserting a like, but the actual match creation is likely handled by a Supabase database trigger or function.

### Incoming Likes Flow

**Location**: `src/services/likes.ts` - `fetchIncomingLikes()`

Users can see who liked them:

1. **Fetch Incoming Likes**:
   ```typescript
   SELECT likes.*, profiles.* 
   FROM likes 
   JOIN profiles ON likes.liker_id = profiles.id 
   WHERE likes.liked_id = current_user_id
   ORDER BY likes.created_at DESC
   ```

2. **Like Back or Deny**:
   - **Like Back**: 
     - Inserts reciprocal like: `INSERT INTO likes (liker_id, liked_id) VALUES (me, them)`
     - Deletes the original incoming like (so it doesn't appear twice)
     - If mutual, match is created (via trigger)
   - **Deny**: 
     - Simply deletes the incoming like: `DELETE FROM likes WHERE id = like_id`

### Matching Summary

**Key Points**:
- Matching is **mutual** - both users must like each other
- Matches are created automatically via database trigger
- The frontend checks for matches immediately after sending a like
- Incoming likes are separate from matches - they're one-way until reciprocated
- Daily suggestions exclude already-liked users to prevent duplicates

---

## Badge System

The badge system provides visual indicators for:
1. **New Likes**: Count of users who liked you (that you haven't responded to)
2. **Unread Messages**: Count of matches with unread messages

### Badge Component

**Location**: `src/screens/home/HomeScreen.tsx` - `Badge` component (lines 389-478)

#### Visual Design

- **Position**: Absolute positioning, top-right corner of navigation icon
- **Styling**: 
  - Circular badge with colored background
  - White border (2px)
  - White text
  - Shadow for depth
  - Minimum width: 18px, height: 18px
- **Display Logic**:
  - Shows count if > 0
  - Displays "9+" if count > 9
  - Hidden if count = 0

#### Animation

The badge includes smooth animations:

1. **Appear Animation**:
   - Opacity: 0 → 1 (200ms)
   - Scale: 1 → 1.3 (on increase) or 1.15 (on decrease) → 1
   - Glow effect: shadow opacity pulses

2. **Disappear Animation**:
   - Opacity: 1 → 0 (150ms)
   - Component returns `null` when count = 0

### Badge 1: New Likes Count

**Location**: `src/screens/home/HomeScreen.tsx`

#### How It Works

1. **State Management**:
   ```typescript
   const [newLikesCount, setNewLikesCount] = useState(0);
   ```

2. **Loading Function** (`loadNewLikesCount`):
   ```typescript
   // Fetches incoming likes from database
   const incoming = await fetchIncomingLikes(user.id);
   setNewLikesCount(incoming.length);
   ```
   
   **What it counts**:
   - All likes where `liked_id = current_user_id`
   - Filters out users you've already liked back (in `LikesScreen.tsx`)
   - Only counts "new" incoming likes you haven't responded to

3. **Display**:
   - Badge appears on the "Likes" navigation icon
   - Color: `#EC4899` (pink)
   - Shows count of unresponded incoming likes

#### When Badge Updates

**Increases**:
- When someone likes you (detected via periodic refresh)
- When app returns to foreground
- Every 30 seconds (auto-refresh)

**Decreases/Removed**:
- When you navigate to Likes screen (manually reset to 0)
- When you "Like Back" a user (like is removed from incoming list)
- When you "Deny" a like (like is deleted)
- When you like them back from Discovery/Home (they're no longer "incoming")

**Code**:
```typescript
// In HomeScreen.tsx, when navigating to Likes:
onPress={() => {
  setNewLikesCount(0);  // Reset badge count
  navigation.navigate('Likes');
}}
```

#### Sync Mechanism

1. **Initial Load**: On component mount and when user changes
2. **Periodic Refresh**: Every 30 seconds via `setInterval`
3. **App State Change**: Refreshes when app returns to foreground
4. **Pull to Refresh**: Manual refresh on HomeScreen

**Refresh Triggers**:
```typescript
// Auto-refresh every 30 seconds
useEffect(() => {
  const id = setInterval(() => {
    loadNewLikesCount();
  }, 30000);
  return () => clearInterval(id);
}, [user?.id, loadNewLikesCount]);

// Refresh on app foreground
useEffect(() => {
  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active' && user) {
      loadNewLikesCount();
    }
  };
  const sub = AppState.addEventListener('change', handleAppStateChange);
  return () => sub.remove();
}, [user, loadNewLikesCount]);
```

### Badge 2: Unread Messages Count

**Location**: `src/screens/home/HomeScreen.tsx` and `src/screens/chat/MatchesScreen.tsx`

#### How It Works

1. **State Management**:
   ```typescript
   const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
   ```

2. **Loading Function** (`loadUnreadMessagesCount`):
   ```typescript
   // Fetches all matches for current user
   const matches = await fetchMatchesWithLastMessage(user.id);
   
   let unread = 0;
   for (const match of matches) {
     // Check AsyncStorage for last read timestamp
     const lastKey = `last_read_${match.id}`;
     const lastRead = await AsyncStorage.getItem(lastKey);
     const lastMessageTime = match.last_message_created_at ?? match.created_at;
     
     // If no last read OR last read is before last message = unread
     if (!lastRead || new Date(lastRead) < new Date(lastMessageTime)) {
       unread += 1;
     }
   }
   setUnreadMessagesCount(unread);
   ```

3. **Display**:
   - Badge appears on the "Chat" navigation icon
   - Color: `#EF4444` (red)
   - Shows count of matches with unread messages

#### Unread Detection Logic

**How "unread" is determined**:

1. **Last Read Timestamp**: Stored in AsyncStorage per match
   - Key format: `last_read_${matchId}`
   - Value: ISO timestamp string

2. **Comparison**:
   - Get last message time for each match
   - Compare with stored "last read" timestamp
   - If `lastRead < lastMessageTime` → unread
   - If no `lastRead` exists → unread

3. **Marking as Read**:
   - When user opens a chat: `AsyncStorage.setItem(lastKey, new Date().toISOString())`
   - This happens in `MatchesScreen.handleOpenChat()`:
     ```typescript
     await AsyncStorage.setItem(
       `last_read_${match.id}`, 
       new Date().toISOString()
     );
     ```

#### When Badge Updates

**Increases**:
- When you receive a new message in any match (detected via realtime or refresh)
- When app returns to foreground
- Every 30 seconds (auto-refresh)

**Decreases/Removed**:
- When you navigate to Matches screen (manually reset to 0)
- When you open a chat (last read timestamp is updated)
- When you read messages in a match

**Code**:
```typescript
// In HomeScreen.tsx, when navigating to Matches:
onPress={() => {
  setUnreadMessagesCount(0);  // Reset badge count
  navigation.navigate('Matches');
}}
```

#### Sync Mechanism

Same as Likes badge:
1. **Initial Load**: On component mount
2. **Periodic Refresh**: Every 30 seconds
3. **App State Change**: On foreground
4. **Pull to Refresh**: Manual refresh

**Additional**: Real-time message updates via Supabase Realtime (see Chat section)

### Badge Display in UI

**Location**: Bottom navigation bar in `HomeScreen.tsx`

```typescript
// Likes Badge
<TouchableOpacity onPress={() => {
  setNewLikesCount(0);
  navigation.navigate('Likes');
}}>
  <View style={styles.navIconCircle}>
    <LikesNavIcon />
    <Badge
      count={newLikesCount}
      color="#EC4899"
      accessibilityLabel={`${newLikesCount} new likes`}
    />
  </View>
  <Text style={styles.navLabel}>Likes</Text>
</TouchableOpacity>

// Messages Badge
<TouchableOpacity onPress={() => {
  setUnreadMessagesCount(0);
  navigation.navigate('Matches');
}}>
  <View style={styles.navIconCircle}>
    <MessagesNavIcon />
    <Badge
      count={unreadMessagesCount}
      color="#EF4444"
      accessibilityLabel={`${unreadMessagesCount} unread messages`}
    />
  </View>
  <Text style={styles.navLabel}>Chat</Text>
</TouchableOpacity>
```

### Badge Removal Logic

#### Manual Reset

When user taps the navigation icon:
- Badge count is **immediately reset to 0** in state
- User navigates to the screen
- This provides instant feedback, even if data hasn't refreshed yet

#### Automatic Removal

**Likes Badge**:
- Removed when you "Like Back" (like is deleted from incoming list)
- Removed when you "Deny" (like is deleted)
- Removed when you like them from Discovery (they're no longer "incoming")

**Messages Badge**:
- Removed when you open a chat (last read timestamp updated)
- Removed when you read messages (timestamp comparison updates)

---

## Synchronization Mechanisms

### 1. Real-time Message Sync

**Location**: `src/screens/chat/ChatScreen.tsx`

#### Supabase Realtime Subscription

```typescript
const channel = supabase
  .channel(`chat:${matchId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `match_id=eq.${matchId}`,
    },
    (payload) => {
      const newMessage = payload.new as MessageItem;
      setMessages((prev) => [...prev, newMessage]);
      setTimeout(scrollToBottom, 50);
    },
  )
  .subscribe();
```

**How it works**:
- Subscribes to INSERT events on `messages` table
- Filters by `match_id` to only receive messages for current chat
- Automatically appends new messages to the chat
- Scrolls to bottom when new message arrives

**Cleanup**:
- Unsubscribes when component unmounts or matchId changes
- Prevents memory leaks and duplicate subscriptions

### 2. Periodic Badge Refresh

**Location**: `src/screens/home/HomeScreen.tsx`

#### Auto-refresh Interval

```typescript
useEffect(() => {
  if (!user) return;
  const id = setInterval(() => {
    loadUnreadMessagesCount();
    loadNewLikesCount();
  }, 30000);  // Every 30 seconds

  return () => clearInterval(id);
}, [user?.id, loadUnreadMessagesCount, loadNewLikesCount]);
```

**Purpose**:
- Keeps badge counts up-to-date even when user isn't actively using those screens
- Ensures badges reflect current state from database
- Runs in background while user is on Home screen

### 3. App State Change Sync

**Location**: `src/screens/home/HomeScreen.tsx`

```typescript
useEffect(() => {
  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active' && user) {
      loadUnreadMessagesCount();
      loadNewLikesCount();
    }
  };

  const sub = AppState.addEventListener('change', handleAppStateChange);
  return () => sub.remove();
}, [user, loadUnreadMessagesCount, loadNewLikesCount]);
```

**Purpose**:
- Refreshes badges when app returns to foreground
- Ensures user sees latest counts after switching apps
- Handles cases where user receives notifications while app is backgrounded

### 4. Pull-to-Refresh Sync

**Location**: `src/screens/home/HomeScreen.tsx`

```typescript
const handlePullToRefresh = useCallback(async () => {
  if (refreshing) return;
  setRefreshing(true);
  try {
    await Promise.all([
      loadSuggestions(),
      loadLikesToday(),
      loadUnreadMessagesCount(),
      loadNewLikesCount(),
    ]);
  } finally {
    setRefreshing(false);
  }
}, [refreshing, loadSuggestions, loadLikesToday, loadUnreadMessagesCount, loadNewLikesCount]);
```

**Purpose**:
- Allows manual refresh of all data
- Updates suggestions, likes count, and badge counts
- Provides user control over data freshness

### 5. AsyncStorage for Last Read Tracking

**Location**: `src/screens/chat/MatchesScreen.tsx` and `src/screens/chat/ChatScreen.tsx`

#### Storing Last Read

```typescript
// When opening a chat
await AsyncStorage.setItem(
  `last_read_${match.id}`, 
  new Date().toISOString()
);
```

#### Reading Last Read

```typescript
// When checking unread status
const lastKey = `last_read_${match.id}`;
const lastRead = await AsyncStorage.getItem(lastKey);
const lastMessageTime = match.last_message_created_at;

if (!lastRead || new Date(lastRead) < new Date(lastMessageTime)) {
  // Mark as unread
}
```

**Purpose**:
- Tracks which messages user has seen
- Persists across app sessions
- Enables accurate unread badge counts
- Per-match granularity

### 6. Daily Suggestions Cache Sync

**Location**: `src/services/matching.ts`

#### Cache Strategy

```typescript
const today = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
const cacheKey = `${DAILY_SUGGESTIONS_KEY}:${userId}`;
const raw = await AsyncStorage.getItem(cacheKey);

if (raw) {
  const parsed: CachedSuggestions = JSON.parse(raw);
  if (parsed.generatedAt === today) {
    return parsed.profiles;  // Return cached
  }
}

// Generate new suggestions
const profiles = await fetchLooseSuggestions(limit);
const payload: CachedSuggestions = {
  generatedAt: today,
  profiles,
};
await AsyncStorage.setItem(cacheKey, JSON.stringify(payload));
```

**Purpose**:
- Reduces database queries
- Provides consistent suggestions throughout the day
- Automatically refreshes at midnight (new day)
- Improves performance and user experience

### Sync Summary

**Real-time**:
- Messages: Supabase Realtime subscriptions
- Matches: Available via `useRealtimeMatches` hook (not currently used in main screens)

**Polling**:
- Badge counts: Every 30 seconds
- Suggestions: Daily (cached)

**Event-driven**:
- App state changes: Refresh on foreground
- User actions: Immediate updates (like, deny, open chat)

**Local Storage**:
- Last read timestamps: AsyncStorage
- Daily suggestions cache: AsyncStorage
- Passed profiles: AsyncStorage
- Like counts: AsyncStorage

---

## Data Flow Diagrams

### Like Flow

```
User sees profile
    ↓
User taps "Like"
    ↓
sendLike(profileId)
    ↓
Check if like exists
    ↓
Insert into likes table
    ↓
Check for mutual like (query matches)
    ↓
If match exists → Show "It's a match!"
    ↓
Advance to next suggestion
```

### Match Creation Flow

```
User A likes User B
    ↓
Insert: likes(liker_id=A, liked_id=B)
    ↓
Database trigger checks for reciprocal like
    ↓
If exists: Create match(user1_id=A, user2_id=B)
    ↓
Both users see match in MatchesScreen
```

### Badge Update Flow (Likes)

```
New like received
    ↓
Database: likes(liker_id=other, liked_id=me)
    ↓
Periodic refresh (30s) or app foreground
    ↓
loadNewLikesCount()
    ↓
fetchIncomingLikes(user.id)
    ↓
Filter out already-liked-back users
    ↓
setNewLikesCount(count)
    ↓
Badge displays count
```

### Badge Update Flow (Messages)

```
New message received
    ↓
Database: messages(match_id=X, sender_id=other, content="...")
    ↓
Realtime subscription fires
    ↓
Message appears in ChatScreen
    ↓
Periodic refresh (30s) or app foreground
    ↓
loadUnreadMessagesCount()
    ↓
fetchMatchesWithLastMessage(user.id)
    ↓
For each match:
  - Get last_read timestamp from AsyncStorage
  - Compare with last_message_created_at
  - If last_read < last_message → count as unread
    ↓
setUnreadMessagesCount(count)
    ↓
Badge displays count
```

### Badge Removal Flow

```
User taps navigation icon (Likes or Chat)
    ↓
setBadgeCount(0)  // Immediate UI update
    ↓
Navigate to screen
    ↓
Screen loads data
    ↓
If user interacts (like back, open chat):
  - Update database
  - Update AsyncStorage (for messages)
  - Badge count remains 0 or updates on next refresh
```

---

## Key Components Breakdown

### 1. Matching Service (`src/services/matching.ts`)

**Key Functions**:
- `getDailySuggestions()`: Main entry point for suggestions
- `fetchLooseSuggestions()`: Core filtering and scoring logic
- `sendLike()`: Handles like creation and match detection
- `markProfilePassed()`: Tracks passed profiles locally
- `clearDailySuggestionsCache()`: Cache management

**Dependencies**:
- Supabase client
- AsyncStorage
- Current user session

### 2. Likes Service (`src/services/likes.ts`)

**Key Functions**:
- `fetchIncomingLikes()`: Gets users who liked you
- `likeBackAndRemove()`: Likes back and removes from incoming list
- `denyLike()`: Deletes an incoming like

**Dependencies**:
- Supabase client
- Profiles table join

### 3. Chat Service (`src/services/chat.ts`)

**Key Functions**:
- `fetchMatchesWithLastMessage()`: Gets matches with last message preview
- `fetchMessages()`: Gets messages for a match
- `sendChatMessage()`: Sends a message with rate limiting
- `getMessageCountToday()`: Tracks daily message limit
- `verifyMatchExists()`: Checks if match exists between two users

**Dependencies**:
- Supabase client
- AsyncStorage (for message limits and last read)

### 4. Home Screen (`src/screens/home/HomeScreen.tsx`)

**Responsibilities**:
- Display daily suggestions (card swipe interface)
- Handle like/pass actions
- Manage badge counts (likes and messages)
- Bottom navigation with badges
- Pre-match messaging modal

**State Management**:
- Suggestions list
- Badge counts
- Like limits
- Loading states

### 5. Likes Screen (`src/screens/chat/LikesScreen.tsx`)

**Responsibilities**:
- Display incoming likes
- Handle "Like Back" action
- Handle "Deny" action
- Filter out already-liked-back users

**Key Logic**:
- Fetches incoming likes
- Checks if user already liked them back
- Filters to show only unresponded likes

### 6. Matches Screen (`src/screens/chat/MatchesScreen.tsx`)

**Responsibilities**:
- Display list of matches
- Show last message preview
- Indicate unread matches (blue dot)
- Navigate to chat on tap

**Unread Logic**:
- Compares last read timestamp with last message time
- Shows visual indicator (dot) for unread matches
- Updates last read when opening chat

### 7. Chat Screen (`src/screens/chat/ChatScreen.tsx`)

**Responsibilities**:
- Display messages in real-time
- Send new messages
- Enforce daily message limits
- Subscribe to real-time message updates
- Update last read timestamp

**Real-time**:
- Supabase Realtime subscription
- Auto-updates when new messages arrive
- Scrolls to bottom on new message

### 8. Badge Component (`src/screens/home/HomeScreen.tsx`)

**Features**:
- Animated appearance/disappearance
- Scale and glow animations
- "9+" display for counts > 9
- Accessibility labels
- Conditional rendering (null if count = 0)

---

## Summary

### Matching Algorithm
- **Daily cached suggestions** with compatibility scoring
- **Loose filtering** approach (shows users, ranks by compatibility)
- **Mutual like detection** via database trigger
- **Automatic match creation** when both users like each other

### Badge System
- **Two badge types**: New Likes (pink) and Unread Messages (red)
- **Real-time updates**: Via periodic refresh (30s) and app state changes
- **Manual reset**: Tapping navigation icon resets badge to 0
- **Automatic removal**: When user interacts (like back, open chat)
- **Smooth animations**: Scale, opacity, and glow effects

### Synchronization
- **Real-time**: Messages via Supabase Realtime
- **Polling**: Badge counts every 30 seconds
- **Event-driven**: App foreground, user actions
- **Local caching**: AsyncStorage for performance and offline support

The system is designed to be **responsive**, **efficient**, and **user-friendly**, with multiple layers of synchronization to ensure data consistency while maintaining good performance.

