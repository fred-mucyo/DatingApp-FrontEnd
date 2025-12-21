# Uni Dating Beta – Project Overview

This document explains what is currently implemented in the app, the main workflows, how to test them, and suggested next steps.

---

## 1. Tech Stack

- **Frontend**: React Native (Expo, TypeScript)
- **Backend**: Supabase (Postgres, Auth, Realtime, RLS)
- **Images**: Cloudinary unsigned uploads (via REST API)
- **Storage**: AsyncStorage (sessions, daily limits, caching)

No custom backend servers or edge functions are used.

---

## 2. Environment & Setup

### Env vars (`.env`)

- `SUPABASE_URL` – your Supabase project URL
- `SUPABASE_ANON_KEY` – public anon key
- `CLOUDINARY_CLOUD_NAME` – Cloudinary cloud name
- `CLOUDINARY_UPLOAD_PRESET` – unsigned upload preset

### Run the app

From `uni-dating-beta`:

```bash
npm install
npm run android   # or: npx expo start
```

---

## 3. Auth & Session Flow

**Files**:
- `src/config/supabaseClient.ts`
- `src/context/AuthContext.tsx`
- `src/navigation/RootNavigator.tsx`
- `src/screens/auth/LoginScreen.tsx`
- `src/screens/auth/SignUpScreen.tsx`

### What it does

- Email **+ username + password** sign up using Supabase Auth (`signUp`).
- **Username + password** sign in, using the `profiles` table to map a username back to the user’s email.
- Email confirmations are **not enforced in the app** (you can disable them in Supabase Dashboard).
- Session is persisted in AsyncStorage via the Supabase client config.
- Auth state is managed by `AuthContext` and used by `RootNavigator` to decide which screens to show.

### Sign Up flow (email + username + password)

1. User opens the app with **no existing session** → `LoginScreen` is shown.
2. On `LoginScreen`, user taps **"Sign up"** to go to `SignUpScreen`.
3. On `SignUpScreen` the user enters:
   - **Email** (for password reset / contact)
   - **Username** (must be unique across users)
   - **Password** and **Confirm password**
4. The app validates:
   - Email has a basic valid format.
   - Username is non-empty.
   - Password is strong (length + character rules) and matches confirmation.
5. The app calls `signUpWithEmailPassword(email, password, username)` in `AuthContext`, which:
   - Calls `supabase.auth.signUp({ email, password, options: { data: { username } } })`.
   - Lets the `handle_new_user` trigger create a minimal row in `public.profiles` with `id` and `email`.
   - Immediately updates `public.profiles` to set `username` for that email.
6. On success, the user sees **"Account created. You can now sign in."** and can go back to the Login screen.

> Note: Supabase still stores emails and passwords securely. Email confirmation is not required; you can turn off email confirmations in the Supabase Dashboard.

### Sign In flow (username + password)

1. When there is **no active session**, `RootNavigator` shows the unauthenticated stack:
   - `Login` (username + password)
   - `SignUp` (email + username + password)
2. On `LoginScreen`, the user enters:
   - **Username**
   - **Password**
3. `LoginScreen` calls `signInWithUsernamePassword(username, password)` in `AuthContext`, which:
   - Queries `public.profiles` for a row with that `username`.
   - Reads the associated **email** from the profile.
   - Calls `supabase.auth.signInWithPassword({ email, password })`.
4. If the username does not exist, the user sees: **"User not found. Please check your username."**
5. If the password is incorrect, Supabase returns an auth error which is surfaced as a **"Sign-in error"** alert.
6. On success:
   - `AuthContext` stores the `session` and `user`.
   - The `profiles` row is loaded for that user.
   - `RootNavigator` switches to either the profile wizard (if incomplete) or the main app.

### Forgot password

- `LoginScreen` exposes a **"Forgot password?"** action.
- For password reset we still rely on Supabase’s email-based reset:
  - Internally, `resetPasswordForEmail(email)` is used.
  - You can decide how you want to ask for or handle the email in the UI (e.g. type the same email used at signup).

### How to test

1. Start the app on emulator/device.
2. On the Login screen, tap **Sign up**.
3. Enter **email + username + password + confirm password** and submit.
4. Go back to Login and sign in with **username + password**.
5. Confirm you are taken into the profile wizard (for first-time users).

---

## 4. Profile Creation Wizard

**Files**:
- `src/screens/profile/ProfileWizardScreen.tsx`
- `src/types/profile.ts`
- `src/constants/interests.ts`
- `src/utils/cloudinary.ts`

**DB**:
- `profiles` table with:
  - basic info (name, age, gender, city, country)
  - preferences (relationship_goal, gender_preference)
  - `bio`, `interests` (text[]), `profile_photos` (text[]), `is_complete`
  - RLS so users only update their own profile.

### Steps (6-step wizard)

1. **Step 1**: Name, age (18+), gender.
2. **Step 2**: City, country, short bio (max 500 chars + counter).
3. **Step 3**: Relationship goal (serious / casual / both).
4. **Step 4**: Gender preference (male / female / other / all).
5. **Step 5**: Interests (3–10 tags from predefined list).
6. **Step 6**: Upload 3–5 photos via Cloudinary (using expo-image-picker).

User cannot continue unless each step is valid. On finishing:

- All local photo URIs are uploaded to Cloudinary (unsigned preset).
- The wizard `upsert`s into `profiles` with `is_complete = true`.
- `AuthContext` reloads profile and `RootNavigator` then allows access to the main app.

### How to test

1. Log in via OTP (first time user).
2. Complete all 6 steps (try invalid values to see validation).
3. Confirm profile row exists in Supabase `profiles` with `is_complete = true` and `profile_photos` set.

---

## 5. Discovery & Matching

**Files**:
- `src/services/matching.ts`
- `src/screens/discovery/DiscoveryScreen.tsx`
- `src/navigation/RootNavigator.tsx` (Discovery route)

**DB**:
- `profiles`, `likes`, `matches`, `blocks` tables.
- `get_suggestions(p_user_id, p_age_window, p_limit)` SQL function.
- Trigger to auto-create `matches` on mutual `likes`.
- RLS so users only see their own likes/matches.

### What it does

- Curated daily suggestions per user (15–20 profiles max per day), cached in AsyncStorage.
- Filters out:
  - self, already liked, already matched,
  - blocked users (both directions),
  - non-compatible by gender, age, relationship goal.
- Scores candidates by city/country, relationship goal, shared interests, age proximity.
- Shows 5 at a time with **Like / Pass** buttons.

### Matching flow

1. `DiscoveryScreen` calls `getDailySuggestions` → RPC `get_suggestions`.
2. User **Passes** → next profile.
3. User **Likes** → `sendLike`:
   - Inserts into `likes`.
   - Trigger or client logic checks for mutual like and creates a `match` if both liked each other.
   - If mutual, app can show "It	s a match!".

### How to test

1. Create two test accounts (User A & User B) with valid profiles.
2. Log in as A → Discovery → like B.
3. Log in as B → Discovery → like A.
4. Check `matches` table in Supabase for a row linking A and B.
5. See that mutual matches appear under **Messages (Matches)** later.

---

## 6. Chat System (Messages)

**Files**:
- `src/services/chat.ts`
- `src/screens/chat/MatchesScreen.tsx`
- `src/screens/chat/ChatScreen.tsx`
- `src/hooks/useRealtimeMessages.ts` (generic hook, optional)
- `src/navigation/RootNavigator.tsx` (Matches + Chat routes)

**DB**:
- `messages` table (match_id, sender_id, content, created_at).
- RLS so users only see messages for matches they belong to.

### Matches list

- `MatchesScreen`:
  - Fetches all matches for current user (`fetchMatchesWithLastMessage`).
  - Joins other user	s `profiles` to show name & photo.
  - Fetches last message per match for preview.
  - Skips any matches where either side has blocked the other.
  - Tapping a match → navigates to `ChatScreen` with `{ matchId, otherUserId, otherUserName, otherUserPhoto }`.

### Chat screen

- Loads last ~100 messages for the match (ascending by time).
- Subscribes to Supabase **Realtime** on `messages` with `match_id = current match`:
  - On new insert → append message → scroll to bottom.
- Input:
  - 500 char limit with live counter.
  - Shows **"X messages left today"** based on client-side daily limit.

### Message limits

- **Client-side** (in `chat.ts`):
  - `DAILY_MESSAGE_LIMIT = 50` messages/day/user (all chats combined).
  - Uses AsyncStorage key `message_count_${userId}_${YYYY-MM-DD}` to track.
  - `sendChatMessage` also enforces **10 messages/minute per chat** by querying recent messages.
- **Optional DB-side backup**:
  - `user_stats` table + `enforce_daily_message_limit` trigger (SQL you can run in Supabase) to hard-enforce 50/day.

### How to test

1. Ensure two users have a match in `matches`.
2. Log in as one user → Home → **Messages (Beta)** → open the match.
3. Send a few messages and confirm:
   - Messages appear immediately on both devices via Realtime.
   - After many messages, daily limit enforcement kicks in.

---

## 7. Safety Features (Block / Unmatch / Basic Report infra)

**Files**:
- `src/services/chat.ts` (skips blocked users in matches)
- `src/screens/chat/ChatScreen.tsx` (Unmatch/Block button)
- Discovery SQL (`get_suggestions`) and previous DB schema (blocks).

### Block

- `blocks` table + RLS:
  - Any user can block any other.
  - We filter **blocked both ways** in:
    - Discovery suggestions.
    - Matches list (`fetchMatchesWithLastMessage`).
- **From chat**:
  - "Unmatch" button in `ChatScreen` inserts into `blocks`.
  - After blocking:
    - User is informed and navigated back.
    - That match disappears from matches list and discovery.

### Unmatch

- Current implementation: Chat header "Unmatch" acts as **block + unmatch** (since blocked pairs are removed from matches queries and discovery).
- You can later separate pure "Unmatch" (delete from `matches`) and "Block" (insert into `blocks`).

### Report (DB ready; UI optional)

- `reports` table + RLS SQL prepared (you can run it in Supabase):
  - Users can file reports against other users / specific messages.
  - Stored for manual review; reporter can see their own reports.
- UI for report dialogs is not yet created; easy next step.

---

## 8. Navigation Map

**Root stack (in `RootNavigator.tsx`)**:

- Unauthenticated:
  - `Login` (username + password)
  - `SignUp` (email + username + password)
- Authenticated but profile incomplete:
  - `ProfileWizard`
- Authenticated + profile complete:
  - `Home`
  - `Discovery` (daily suggestions, Like/Pass)
  - `Matches` (list of matches)
  - `Chat` (per-match chat)

**Home screen buttons**:
- Browse matches (Beta) → `Discovery`.
- Messages (Beta) → `Matches`.
- Sign out.

---

## 9. How to Test End-to-End (Typical User Journey)

1. **Sign up / login**
   - Open app → Login screen is shown.
   - Tap **Sign up**, then enter: email + username + password + confirm password.
   - After account creation, go back to Login.
   - Enter **username + password** and sign in.

2. **Complete profile**
   - Go through 6-step wizard, upload 3–5 photos.

3. **Discovery & matching**
   - Log in as User A on one device, User B on another.
   - Both complete profiles.
   - User A likes User B; User B likes User A → mutual match.

4. **Messages**
   - Open **Messages (Beta)** as User A → see match with B.
   - Open chat, send messages; watch them appear live for User B.

5. **Block / Unmatch**
   - In chat, tap **Unmatch** → this inserts a block.
   - Verify that:
     - The match disappears from **Messages** for blocker.
     - Blocked user no longer appears in Discovery for blocker.

6. **Daily limits**
   - As a single user, send many messages until client-side limit is reached (50/day).
   - Verify you see the warning and the send button is effectively disabled.

---

## 10. Next Steps / Roadmap

Suggested priorities:

1. **Settings & Safety UI**
   - Add a `Settings` screen with:
     - Blocked Users list (read from `blocks` joined with `profiles`).
     - My Reports list (once reports UI is added).
     - Safety Tips (static text).
     - Delete Account (soft-delete + sign out).

2. **Report UI**
   - Implement dialogs/components for reporting a user from:
     - Profile view
     - Chat screen (optionally per message)
   - Use `reports` table SQL already defined.

3. **Separate Unmatch vs Block**
   - Change Chat header to show a menu: `Unmatch`, `Block`, `Report`.
   - Implement pure unmatch by deleting from `matches` and using the cleanup trigger.

4. **Admin / Founder Tools (for you)**
   - Mark your profile as `role = 'admin'`.
   - Build a simple internal web page (separate small project) to:
     - List pending reports.
     - View reported profiles.
     - Manually mark `banned = true` for bad actors.

5. **Polish & Performance**
   - Optimize `fetchMatchesWithLastMessage` to batch blocked checks.
   - Add basic skeleton loaders and error states across screens.
   - Use smaller Cloudinary thumbnail URLs where appropriate.

6. **Optional: Delete Account Automation**
   - If you’re willing to host a tiny secure script somewhere with the Supabase service key:
     - Hook `delete_user_account(user_id)` to also call `auth.admin.deleteUser`.
     - Ensure hard-delete for users who trigger account deletion.

---

If you want, we can next focus on one specific area (e.g. Settings + Blocked Users screen, or Report dialog) and I	ll implement those screens directly in the project for you.
