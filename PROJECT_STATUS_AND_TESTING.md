# shuu App – Current State, Improvements, and Testing Guide

## 1. What we have now

### 1.1 Overall
- **New name/branding**
  - App is now framed as **“shuu”** (modern dating app for students/young adults).
- **Design system applied**
  - Consistent colors (warm coral/orange primary, neutrals, semantic greens/reds).
  - Unified typography scale, spacing, and rounded card/button shapes.
  - Modern card-based layouts, sticky headers, and clear sectioning.
- **Important constraint**
  - All changes so far are **UI/UX only**.
  - **No backend, matching, or chat logic has been changed.**
  - Supabase queries, matching rules, chat send/receive, and auth flows work exactly as before.

### 1.2 Screens and flows

#### Login
- **What’s new (UI only)**
  - Gradient-like warm background and centered auth card.
  - Larger title and subtitle introducing shuu.
  - Inputs styled with icon space, clearer labels, and inline error messages.
  - Clean primary button with loading state and disabled state.
- **Logic**
  - Still calls the **same auth context functions** (`signInWithEmailPassword` style logic).
  - Error handling and navigation after login are unchanged.

#### Sign Up
- **What’s new (UI only)**
  - Same gradient/card visual language as Login.
  - Step-like header that visually breaks signup into phases (username, email, password).
  - Password strength and validation hints *visually* surfaced (length, character types, etc.).
  - Clear error messages for invalid inputs.
- **Logic**
  - Still uses existing signup function and validations.
  - No changes to how accounts are created or how errors are returned.

#### Profile Wizard
- **What’s new (UX + requirements)**
  - Compressed into **3 main steps**:
    - Step 1: Basic info + location + bio.
    - Step 2: Preferences + interests.
    - Step 3: Photos.
  - Photo requirements updated to **1–3 photos** (previously 3–5).
  - Text now emphasizes **main profile picture** requirement.
- **Logic details**
  - Wizard still uploads images to **Cloudinary** and saves profile to **Supabase**.
  - Only change in logic is the **photo count requirement** (now 1–3), which is consistent with MyProfile.

#### My Profile
- **What’s new (UI/UX)**
  - Cleaner, sectioned layout for editing profile fields.
  - Photo section improved with clear actions and visual hierarchy.
  - Added **“Set as main photo”** action:
    - Tapping this moves the selected photo to index `0` in the array (pure rearrange).
- **Logic**
  - Still uploads new photos to Cloudinary and keeps existing URLs.
  - Validation now aligns with new 1–3 photos rule.

#### Home (Main Hub)
- **What’s new (UI/UX)**
  - Sticky header with greeting (time-of-day based where applicable).
  - **Daily suggestions section** redesigned into modern cards.
    - Shows ~15–20 suggestions per day.
    - Client-side 5-at-a-time presentation (pagination feeling) but uses same underlying data.
  - Quick actions grid: navigate to Explore, Matches, My Profile, etc.
  - Refined search by username section.
- **Logic**
  - Still uses existing **daily suggestion logic** and `sendLike`.
  - No change to how suggestions are generated, limited, or stored.

#### Explore
- **What’s new (UI/UX)**
  - Header bar with back button and filter icon, matching shuu’s design system.
  - Collapsible **filter panel** for:
    - Gender.
    - Location.
    - Age range.
  - Results shown as a **2-column grid** with profile cards (photo, name, age, location).
- **Logic**
  - Still uses the same **filter state** and **Supabase query** as before.
  - The `handleSearch` function and filter logic are unchanged; we only changed layout and styling.

#### View User Profile
- **What’s new (UI/UX)**
  - Fully redesigned into an **immersive profile viewer**:
    - Top **photo gallery** (horizontal swipeable images, pagination dots).
    - Overlaid header (back + menu/actions).
    - Scrollable content sections:
      - Basic info (name, age, location, uni if available).
      - Quick stats (relationship goal, gender preference, member since, etc.).
      - Bio with **“Read more / Show less”** when long.
      - Interests and tags.
      - Shared interests banner: **“You both like …”** when there are common interests.
      - Distance / safety hints as copy.
    - Fixed bottom action bar:
      - If not matched: **Like** / **Pass** buttons.
      - If matched: **Message** primary button.
    - Simple **match success modal** when a match is created.
- **Logic**
  - All Supabase reads and matching logic (`sendLike`, `verifyMatchExists`) are unchanged.
  - New shared interests banner is **pure UI** on top of existing `interests` arrays.

#### Matches
- **What’s new (UI/UX)**
  - **Sticky header** with title and basic info.
  - Stats row (e.g. number of matches, unread approximations).
  - Match list presented as **rich cards**:
    - Photo, name, last message preview.
    - Time label (e.g. `2h`, `Yesterday`, date).
    - Unread indicator (dot) based on `AsyncStorage`-backed last-read timestamps.
  - Empty state with illustration-style copy and call-to-action to explore or improve profile.
- **Logic**
  - Still uses existing `fetchMatchesWithLastMessage` and navigation to Chat.
  - Unread approximation logic with `AsyncStorage` is the same, only the visuals changed.

#### Chat
- **What’s new (UI/UX)**
  - **Custom header bar**:
    - Shows other user’s photo, name, status/last seen text.
    - Three-dot menu button.
  - **Message list** redesigned:
    - Bubbles grouped by sender.
    - Date separators (Today, Yesterday, etc.).
    - Right-aligned vs left-aligned messages with distinct bubble styles.
  - **Fixed input bar**:
    - Text input anchored at bottom above keyboard.
    - Character counter and daily limit feedback areas.
  - Empty state when no messages yet with gentle prompt and possible ice-breaker copy.
  - **Header menu wired** with options:
    - View profile.
    - Unmatch.
    - Block & report.
- **Logic**
  - Still uses the existing Supabase chat logic (`fetchMessages`, `sendChatMessage`, realtime subscription).
  - Daily message limit uses existing `DAILY_MESSAGE_LIMIT` constant.
  - Menu options call existing navigation and `handleBlockAndExit` logic.


## 2. What has improved vs the old app

- **Visual consistency**
  - Unified colors, typography, spacing, and border radii across all key screens.
  - Cards, buttons, and inputs feel like same design family.
- **Clarity and hierarchy**
  - Important actions (Like, Message, Save, Login) are more prominent.
  - Supporting info (subtitles, helper text) is more readable.
- **Onboarding and profile quality**
  - Profile wizard is shorter (3 steps) but clearer.
  - Main profile picture is emphasized.
  - 1–3 photos reduces friction while still enforcing decent profile quality.
- **Discoverability**
  - Explore screen now feels like a proper discovery hub with filters and grid cards.
  - Home acts as a true **hub**: daily suggestions, quick actions, and search.
- **Messaging experience**
  - Matches list looks like a modern message inbox.
  - Chat screen feels like a proper messenger (grouped bubbles, date separators, sticky header).
- **Profile viewing**
  - ViewUserProfile is now immersive and scannable.
  - Shared interests and stats help users quickly decide whether to like/message.


## 3. What is UI-only vs what changed logic

### 3.1 Pure UI/UX changes (no logic modifications)
- Login visuals and layout only.
- Sign Up visuals and layout only.
- Home layout, card design, quick actions, and search UI only.
- Explore layout, filter panel visuals, and grid cards (filter/query logic unchanged).
- ViewUserProfile layout and components (the only “dynamic” part is how data already fetched is displayed, including shared interests which use existing arrays).
- Matches layout, card visuals, header, and empty state copy.
- Chat layout, header, grouped bubbles, date separators, input bar visuals.

### 3.2 Intentional small logic adjustments
- **Photo requirements**
  - Profile Wizard & MyProfile now both enforce **1–3 photos** instead of 3–5.
- **“Set as main photo”** in MyProfile
  - Only reorders the photo array client-side so the chosen photo appears first.
  - No change to storage format; Cloudinary upload and Supabase save remain the same.
- Everything else (matching, Supabase queries, chat flows, blocking/unmatching, auth) is **unchanged**.


## 4. How to test the app now (manual QA guide)

### 4.1 Setup and running
- **Prerequisites**
  - Node/Yarn or npm installed.
  - Expo CLI installed globally (or use `npx expo`).
  - Supabase project and environment variables already configured (as before).
- **Run the app**
  - From the project root:
    - `npm install` or `yarn` (if not already done).
    - `npx expo start` (or `expo start`).
  - Open the app in **Expo Go** on your device or an emulator.

### 4.2 Auth flows
- **Login**
  - Try logging in with a valid account.
  - Verify:
    - Loading state appears briefly when submitting.
    - Errors show inline if you use wrong credentials.
    - Successful login navigates to the main app as before.
- **Sign Up**
  - Create a new user (if allowed in your backend).
  - Check:
    - Validation messages for weak/short passwords.
    - Error presentation for invalid email or taken username.
    - After signup, flow continues exactly as before (to wizard or home depending on logic).

### 4.3 Profile Wizard
- Create or complete a profile:
  - Confirm wizard now has 3 main steps.
  - Try saving with **0 photos** → should show validation error.
  - Try saving with **1–3 photos** → should allow save.
  - Confirm photos upload and profile is visible in My Profile / Explore / ViewUserProfile.

### 4.4 My Profile
- Open **My Profile**:
  - Edit text fields and save to ensure updates persist.
  - Add a new photo and ensure it uploads successfully.
  - Use **“Set as main photo”** and confirm:
    - Photo jumps to first position in UI.
    - After save and reload, that photo is still primary.

### 4.5 Home
- On Home screen:
  - Verify that daily suggestions load (if there are available profiles).
  - Scroll through suggestion cards and try **Like** and **Pass**.
  - Confirm:
    - Like triggers existing matching logic (you may see a match modal later via ViewUserProfile or Matches).
    - Navigation buttons correctly take you to Explore, Matches, and My Profile.

### 4.6 Explore
- Open **Explore**:
  - Expand the filter panel; adjust gender, location, age.
  - Tap the existing **Search** / filter trigger button.
  - Confirm results update correctly according to filters.
  - Tap a result to open **ViewUserProfile**.

### 4.7 View User Profile
- From Home/Explore/Matches, open a user profile:
  - Swipe horizontally through photos.
  - Scroll down and check:
    - Stats section.
    - Bio with **Read more/Show less** for long bios.
    - Interests and potential **Shared interests** banner if you share tags.
  - If not matched:
    - Tap **Like**.
    - If a mutual like exists, confirm **match modal** appears and you can navigate to Chat.
  - If already matched:
    - The bottom bar should show **Message** instead of Like/Pass, and navigating should go to Chat.

### 4.8 Matches
- Open **Matches**:
  - Confirm header and stats appear.
  - Check each card shows:
    - Photo, name, last message preview.
    - Time label (correct ordering by recency).
    - Unread dots for conversations with new messages since last open.
  - Tap a match to open Chat and then return; unread indicator should update based on `last_read` timestamp.
  - If you have no matches, verify the **empty state** text and CTA.

### 4.9 Chat
- Open a chat:
  - Confirm header shows the other user and the three-dot menu.
  - Send messages back and forth (using two accounts or test users):
    - Messages should appear in grouped bubbles with correct alignment.
    - Date separators appear correctly as days change.
  - Open menu:
    - **View profile** navigates to ViewUserProfile.
    - **Unmatch** or **Block & report** follow existing flow (same behavior as before UI redesign).
  - If `DAILY_MESSAGE_LIMIT` is reached:
    - Confirm warning/limit state appears visually, but logic is same as previous implementation.


## 5. How to think about future work

- **Micro-interactions & animations**
  - We can layer in small animations: button press scale, card entrance transitions, pull-to-refresh, typing indicators, etc., without touching core logic.
  - These should sit on top of existing handlers (`onPress`, `onRefresh`) and not alter Supabase or matching/chat services.
- **Accessibility**
  - Next improvements will focus on WCAG 2.1 AA:
    - Color contrast checks.
    - Minimum touch target sizes.
    - Screen reader labels for important controls.
    - Reduced motion support.

This document summarizes what the shuu app does **right now**, which parts were redesigned visually, what small logic adjustments were made (photos and main photo ordering), and how to thoroughly test the experience in Expo Go without needing to read through the entire codebase.
