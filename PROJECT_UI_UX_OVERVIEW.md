# Uni Dating Beta – UI & UX Overview

This document explains all the main screens in the app, how they connect, and what each one is responsible for. It focuses on **what the user sees and can do**, not on code implementation.

---

## 1. High-Level Flow

### 1.1 First-Time User (No Account Yet)

1. **Login Screen**
   - Default entry point for unauthenticated users.
   - Lets user log in with **email or username + password**.
   - Provides a link to **Sign up**.

2. **Sign Up Screen**
   - Collects **username, email, password**.
   - Enforces **unique username** and secure password rules.
   - After successful signup, the user is asked to **log in explicitly** (no auto-login).

3. **Profile Wizard (3 steps)**
   - After login, if the user’s profile is incomplete, they are forced into a **3-step profile wizard**.
   - Wizard must be completed once to unlock the full app.

4. **Home Screen**
   - Main hub after profile completion.
   - Shows **daily suggestions feed** (Tinder-like photo cards with Like/Pass buttons).
   - From here, the user can go to **Explore**, **Messages (matches/chats)**, **My profile**, and **Search by username**.

### 1.2 Returning User (Profile Complete)

1. User opens app and logs in (or session is restored).
2. Because profile is complete, they are taken **directly to Home**:
   - See today’s suggestions.
   - Can navigate to Explore, Messages, My profile, etc.

---

## 2. Authentication Screens

### 2.1 Login Screen (`Login`)

- **Purpose**: Allow user to log in using either **email or username** plus password.
- **Key UI elements**:
  - Text input for **identifier** (placeholder explains it accepts email or username).
  - Text input for **password**.
  - **Login** button.
  - **Forgot password** link (works with email only).
  - Link / button to go to **Sign Up**.
- **UX notes**:
  - Error messages are shown via alerts when login fails.
  - Keyboard types and auto-capitalization are tuned (e.g. no auto-cap for username/email).

### 2.2 Sign Up Screen (`SignUp`)

- **Purpose**: Create a new account with **unique username**.
- **Key UI elements**:
  - Input for **username**.
  - Input for **email**.
  - Input for **password**.
  - **Sign up** button.
  - Link back to **Login**.
- **UX notes**:
  - Validates password rules and username uniqueness.
  - On success, user is **signed out** and navigated back to **Login**, so they explicitly log in next.

---

## 3. Profile Completion & Management

### 3.1 Profile Wizard (`ProfileWizard`)

- **When shown**: First login after signup, if the user’s profile `is_complete` is false.
- **Goal**: Collect all necessary profile information in **3 clear steps**.

#### Step 1 – Basic Info & Bio

- Fields:
  - **Name**
  - **Age** (must be 18+)
  - **Gender** (chips: male / female / other)
  - **City**
  - **Country**
  - **Short bio** (multiline, up to 500 characters, live character counter)
- UX rules:
  - Cannot go to next step until required fields are filled and age is valid.

#### Step 2 – Preferences & Interests

- Fields:
  - **Relationship goal** (chips: serious / casual / both)
  - **Who do you want to match with?** (gender preference: male / female / other / all)
  - **Interests** (select from predefined list; user must pick **3–10**)
- UI:
  - Chips or buttons laid out in a simple grid using a list.
  - Selected interests are highlighted.
- UX rules:
  - Must choose at least 3 and at most 10 interests to proceed.

#### Step 3 – Photos (Main Profile Picture)

- Fields:
  - Photo picker using the device gallery.
  - Allows **1–3 photos** in total.
- UI & text:
  - Header text like: **“Add 1–3 profile photos”**.
  - Helper text: **“The first photo will be used as your main profile picture across the app.”**
  - Thumbnails of selected photos with tap-to-remove.
- UX rules:
  - User must upload at least **1** photo and not more than **3**.
  - Tapping a photo removes it.
- After completion:
  - Photos are uploaded to Cloudinary.
  - Profile is saved and marked **complete**, and user is routed to **Home**.

### 3.2 My Profile Screen (`MyProfile`)

- **Purpose**: Allow the user to **view and edit** everything they entered in the wizard.
- **Sections**:
  - Basic info (Name, Age, Gender).
  - Location (City, Country).
  - Relationship goal and **Who to match with**.
  - Bio.
  - Interests (chips; can re-select).
  - Photos.

#### Photo Management in My Profile

- User can:
  - Add new photos from gallery (still limited to **1–3 total**).
  - Remove photos by tapping the thumbnail.
  - Use **“Set as main”** on any non-first photo to make it the main profile picture.
- Visual cues:
  - The first photo is labeled **“Main photo”**.
  - Other photos show a **“Set as main”** text under them.
- UX rules:
  - Validation ensures there is always between **1 and 3** photos before saving.

#### Edit & Save

- After editing, user hits **“Save changes”**.
- Photos are uploaded if new, existing URLs are preserved.
- On success, the global profile is refreshed so other parts of the app see the changes.

### 3.3 View User Profile Screen (`ViewUserProfile`)

- **Purpose**: Show a read-only version of **another user’s** profile.
- **Entry points**:
  - From **Home suggestions** (planned extension).
  - From **Explore** when tapping a profile card.
  - From **username search** results.
- **UI contents**:
  - Main photo (plus optionally additional photos in some layout).
  - Username, name, age.
  - City, country.
  - Bio.
  - Basic interests.
  - Actions: **Like** and **Start chat** (only if a match exists / after a match is created).

---

## 4. Home & Discovery Experience

### 4.1 Home Screen (`Home`)

- **Role**: Primary landing screen after login and profile completion.
- **Main sections (top to bottom)**:

1. **Header**
   - App name: **“Uni Dating Beta”** with a small **BETA** label.
   - Welcome text using the user’s name or email.

2. **Today’s Suggestions (Daily Feed)**
   - **Core feature**: simple list of photo cards similar to Tinder, but controlled by buttons instead of swipes.
   - Each card shows:
     - Main profile photo.
     - Name and age.
     - City and country.
     - Buttons: **Like** and **Pass**.
   - Behavior:
     - Uses a daily suggestions list (15–20 profiles per day) coming from the matching algorithm.
     - Only shows **5 at a time** (client-side pagination) by slicing part of that list.
     - When user taps **Pass** or successfully **Likes**, the app advances to the next suggestion.
     - Once the end is reached, an **“End of feed – come back tomorrow”** message is shown.
   - Like behavior:
     - On **Like**, the app checks a **daily like limit (e.g. 50 per day)**.
     - Sends the like to the backend; if there is a mutual like, shows an **“It’s a match!”** alert.

3. **Navigation Buttons**
   - **Explore** – opens the Explore screen (see below).
   - **Messages (Beta)** – opens matches list and chat.
   - **My profile** – opens profile editor.
   - **Sign out** – logs the user out.

4. **Search by Username**
   - A dedicated section at the bottom:
     - Input field: **“Search users by username”**.
     - Search button.
     - Displays a list of users matching the prefix.
     - Tapping a result opens that user’s profile (`ViewUserProfile`).

### 4.2 (Legacy) Discovery Screen (`Discovery`)

- Still present in the navigation but conceptually replaced by the **Home suggestions**.
- Shows a similar list of daily suggestions with Like/Pass.
- Used during development; long-term, Home is intended to be the main discovery entry point.

---

## 5. Explore & Browsing

### 5.1 Explore Screen (`Explore`)

- **Purpose**: Let users **browse everyone** on the platform with flexible filters, separate from daily curated suggestions.
- **Filters**:
  - **Gender**: chips for all / male / female / other.
  - **Location**: free-text input; matches city or country (case-insensitive, partial match).
  - **Age range**: min age and max age inputs.
- **Results**:
  - List of cards showing:
    - Main photo.
    - Name and age.
    - City and country.
    - Gender.
  - Tapping a card opens `ViewUserProfile` for that user.
- **UX notes**:
  - Shows a loading spinner while searching.
  - Displays an info message if no profiles match the filters.
  - Limits number of profiles returned (e.g. 50) to keep performance and UX smooth.

---

## 6. Matches & Chat

### 6.1 Matches Screen (`Matches` / Messages (Beta))

- **Purpose**: Show all current matches and allow user to open chats.
- **UI**:
  - List of match rows.
  - Each row typically shows:
    - Other user’s **photo** (or neutral placeholder if no photo available).
    - Name or username.
    - Last message snippet (if any).
    - Time of last message.
  - Tapping a row opens the **Chat screen** for that match.

### 6.2 Chat Screen (`Chat`)

- **Purpose**: One-on-one real-time messaging between matched users.
- **UI layout**:
  - Header:
    - Other user’s name and possibly avatar.
    - An **Unmatch / Block** action in the header options (current implementation is a combined “block + unmatch”).
  - Message list:
    - Shows messages from both sides in chronological order.
    - Supports realtime updates so incoming messages appear immediately.
  - Input area:
    - Text input for composing a message.
    - Send button.
- **UX behavior**:
  - When the local user sends a message, the message appears **immediately** by refetching after sending (so you see your own messages right away).
  - Daily and per-minute message limits are enforced on the service layer to prevent spam.
  - If the user unmatches/blocks, the conversation is effectively disabled and the match disappears from `Matches`.

---

## 7. Safety & Controls

While much of this is backend and policy, the UI currently surfaces a few safety controls:

- **Block / Unmatch via Chat header**:
  - Accessible from the Chat screen.
  - Currently acts as a combined **block + unmatch**: the other user no longer appears in matches or discovery suggestions.
- Future UI can extend this into separate **“Unmatch”** and **“Block”** actions and an explicit **Report** flow.

---

## 8. Navigation Summary

- **Unauthenticated**:
  - `Login` ↔ `SignUp`.
- **First login (no profile)**:
  - `Login` → `ProfileWizard` (steps 1–3) → `Home`.
- **Regular usage**:
  - `Home` → `Explore` / `Matches` / `MyProfile` / `ViewUserProfile` / `Chat`.

This document should give you a clear mental map of every main screen, what the user can do there, and how the overall UX is arranged. If you want, we can next refine copy text on specific screens (e.g. labels, helper messages) to better match your tone and branding.
