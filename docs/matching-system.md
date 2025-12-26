# Matching & Suggestions Overview

This document describes how the matching system and daily suggestions work in the Uni Dating Beta app, and how suggestions are presented in the UI.

## Data model

Key tables and concepts (based on usage in the code):

- **profiles**
  - Stores user profile data such as:
    - `id`, `name`, `age`, `gender`, `gender_preference`, `city`, `country`
    - `relationship_goal`, `bio`, `interests`
    - `profile_photos` and `photos` (arrays of image URLs)
- **likes**
  - Represents a one-way like from one user to another:
    - `liker_id`: the user who liked
    - `liked_id`: the user who was liked
- **matches**
  - Represents a mutual like (match) between two users:
    - `user1_id`, `user2_id`
- **blocks**
  - Represents one user blocking another, used to hide matches and messages.
- **messages**
  - Chat messages tied to a match via `match_id`.

These tables are accessed via Supabase in `src/services/matching.ts`, `src/services/likes.ts`, and `src/services/chat.ts`.

## How suggestions are generated

Suggestions are produced by the matching service in `src/services/matching.ts`.

### 1. `fetchSuggestionsRpc`

```ts
export const fetchSuggestionsRpc = async (
  ageWindow = 5,
  limit = 20,
): Promise<SuggestionProfile[]> => {
  const { data: sessionData, error: sErr } = await supabase.auth.getSession();
  if (sErr || !sessionData.session) throw new Error('Not authenticated');
  const userId = sessionData.session.user.id;

  const { data, error } = await supabase.rpc('get_suggestions', {
    p_user_id: userId,
    p_age_window: ageWindow,
    p_limit: limit,
  });

  if (error) throw error;
  return (data as SuggestionProfile[]) ?? [];
};
```

- Uses a Supabase RPC function `get_suggestions`.
- Inputs:
  - `p_user_id`: current user id.
  - `p_age_window`: allowed age difference around the current user.
  - `p_limit`: max number of suggestions.
- Output: `SuggestionProfile[]` with fields like
  - `id`, `name`, `age`, `gender`, `gender_preference`, `city`, `country`, `relationship_goal`, `bio`, `interests`, `profile_photos`, `score`.

The **exact matching rules** (who is compatible with whom, how the `score` is calculated) live inside the `get_suggestions` SQL function in the database, not in the TypeScript code. From the types and usage, it likely considers:

- Gender and `gender_preference`.
- Location (`city`, `country`).
- Age difference (limited by `ageWindow`).
- Possibly `relationship_goal`, `interests`, and other profile fields.

### 2. `getDailySuggestions` and caching

```ts
export const getDailySuggestions = async (
  ageWindow = 5,
  limit = 20,
): Promise<SuggestionProfile[]> => {
  const today = new Date().toISOString().substring(0, 10);
  const raw = await AsyncStorage.getItem(DAILY_SUGGESTIONS_KEY);

  if (raw) {
    try {
      const parsed: CachedSuggestions = JSON.parse(raw);
      if (parsed.generatedAt === today) {
        return parsed.profiles;
      }
    } catch {
      // ignore and regenerate
    }
  }

  const profiles = await fetchSuggestionsRpc(ageWindow, limit);
  const payload: CachedSuggestions = {
    generatedAt: today,
    profiles,
  };
  await AsyncStorage.setItem(DAILY_SUGGESTIONS_KEY, JSON.stringify(payload));
  return profiles;
};
```

- Caches a set of suggestions per day in `AsyncStorage` under `matching.daily_suggestions`.
- If suggestions have already been generated **for today**, it reuses them (same order, same people) instead of calling the RPC again.
- Next day, it calls `fetchSuggestionsRpc` again and refreshes the cache.

This gives users a stable daily set of suggested profiles, and resets each day.

## How suggestions are displayed in the UI

Suggestions are shown on the **Home screen** (`src/screens/home/HomeScreen.tsx`).

### 1. Loading suggestions

- On mount, `HomeScreen` calls:
  - `getDailySuggestions(5, 20)` to get up to 20 profiles within an age window of ±5 years.
- It logs some debug info: how many suggestions came back and the first one.

### 2. Enriching photos

`HomeScreen` further enriches each suggestion with photos if needed:

- For each suggestion `p`:
  - Reads `p.profile_photos` (could be an array or string, depending on the RPC).
  - If there are no usable `profile_photos`, it looks up the user in the `profiles` table:
    - `select('photos').eq('id', p.id).maybeSingle()`.
  - If `profiles.photos` is a non-empty array:
    - It returns a new profile object with `profile_photos: prof.photos`.

This makes sure the suggestion cards have at least one usable photo, even if the RPC didn’t attach them.

### 3. Swipe-like card UI (carousel)

Suggestions are rendered as a **horizontal, full-screen style carousel** (not a vertical list):

- `FlatList` with `horizontal` and `pagingEnabled` is used.
- Each item fills almost the whole screen height.
- The UI feels like swiping between large cards, even though it’s implemented as a paged horizontal list.

For each suggestion card (`renderSuggestionItem`):

- It computes a `photo` URL from:
  - `profile_photos[0]` if available.
  - Falls back to `photos[0]` or string fields if they exist.
- If `photo` is present:
  - Renders a full-screen `Image` as the background.
- Otherwise:
  - Shows a dark placeholder with "No Photo" text.
- Overlays text on top of the image:
  - Name and age.
  - Location with a location icon.
- Shows large floating action buttons at the bottom:
  - **Pass** (X icon): calls `handlePass` which advances to the next suggestion.
  - **Like** (heart icon): calls `handleLike` (sends like via Supabase, may show a match alert, and also advances).
  - **Message** (paper-plane icon): currently shows an alert placeholder.

So the **current behavior** is closer to a Tinder-style card swipe experience (horizontal cards with big image and actions) than a simple text list.

## What the app considers when matching (from code perspective)

From the frontend code we can see:

- The app relies on the **`get_suggestions` RPC** to select and rank candidates and return a `score`.
- The frontend passes:
  - Current user id.
  - An age window.
  - A limit.
- The `SuggestionProfile` type suggests that server-side logic probably considers:
  - **Age**: via `ageWindow`.
  - **Gender + gender preference**: `gender`, `gender_preference`.
  - **Location**: `city`, `country`.
  - **Relationship goal** and `interests`.
  - Possibly other profile fields and the `score` field.

The **exact scoring and filtering rules** are *not* defined in TypeScript; they’re encoded in SQL on the Supabase side.

## How likes and matches interact with suggestions

- When you **like** a suggestion on the Home screen:
  - `sendLike(targetProfileId)` is called.
  - This inserts a row into the `likes` table: `liker_id = me`, `liked_id = targetProfileId`.
  - Then it checks the `matches` table to see if a reciprocal like already exists:
    - If a match row exists (either order of user1/user2), it treats it as a match (`isMatch = true`).
- If it is a match, the UI shows an "It’s a match!" alert.
- The user is then advanced to the next suggestion (`handlePass`).

**Incoming likes**:

- Separate logic in `src/services/likes.ts` and `LikesScreen.tsx` handles users who liked you:
  - `fetchIncomingLikes(currentUserId)` looks up likes where `liked_id = current user` and joins `profiles` to show their data.
  - `LikesScreen` shows these as a list, letting you **Like back** or **Deny**.
  - If you like back, a `likes` row is inserted in the opposite direction and the original like is removed from the incoming list.

**Matches & Messages**:

- When there is a mutual like, a row in `matches` is created (by backend logic).
- `fetchMatchesWithLastMessage`:
  - Joins `matches` with `profiles` to get the other user’s data.
  - Resolves `other_user_photo` from either `profile_photos[0]` or `photos[0]`.
  - Fetches the latest message per match (if any).
  - Used by `MatchesScreen` (Messages Beta) to show a list of conversations.

## Summary

- **Who is suggested** is determined primarily by the Supabase RPC `get_suggestions`, which uses profile fields and preferences to find compatible users.
- **Frontend logic**:
  - Adds a daily caching layer (`getDailySuggestions`).
  - Enriches suggestions with photos from `profiles.photos` if needed.
- **UI**:
  - Suggestions are shown on the Home screen as a horizontal, full-screen carousel with big images, not a simple list.
  - Users can pass or like from there; likes may create matches.
- **Matches and messages** are then surfaced in the Messages (Beta) screen using `fetchMatchesWithLastMessage`, and chats happen inside `ChatScreen`.
