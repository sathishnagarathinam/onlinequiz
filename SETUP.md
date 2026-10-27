# Online MCQ Quiz Portal — SETUP Guide

This guide walks through end-to-end setup of the React + Firebase MCQ Quiz Portal.

## Prerequisites

- Node.js **18.x** or higher (`node --version`)
- npm 9+ (`npm --version`)
- Firebase CLI **13.x**+ (`npm i -g firebase-tools`)
- A Google account with access to Firebase Console
- **Firebase Blaze plan** (required for Cloud Functions)

---

## 1. Create a Firebase Project

1. Go to <https://console.firebase.google.com> → **Add project**
2. Name it (e.g. `mcq-quiz-portal`), accept terms, enable Google Analytics (optional).
3. Once created, from the **Project Overview** page click **</>** (Add Web App).
4. Register app nickname: `mcq-portal-web`, enable **Also set up Firebase Hosting**. Click **Register app**.
5. Copy the generated `firebaseConfig` values — you'll paste them into `frontend/.env` in step 3.

---

## 2. Enable Authentication Providers

1. Firebase Console → **Authentication** → **Sign-in method**
2. Enable **Email/Password** provider (for Admin login).
3. Enable **Anonymous** provider (for first-time Employee no-password login; uid links to Firestore user record).
4. **Authorized domains**: Keep `localhost` for dev; add your production Hosting domain after deploy.

### 2a. (Optional) Set Custom Admin Claim

Run from a privileged environment (Cloud Shell or local with service account):

```bash
# After creating admin user in Firebase Console Auth tab, set their custom claim:
firebase login
firebase auth:set-custom-user-claims <admin-uid> '{"role":"admin"}'

# Verify with:
firebase auth:export /tmp/users.json --format=json && grep -A20 admin /tmp/users.json
```

You must also create a Firestore document at `users/<admin-uid>` with `{ role: "admin", email: "...", displayName: "..." }` so the admin UI recognises the user.

---

## 3. Configure Frontend Env

```bash
cd frontend
cp .env.example .env
```

Edit `.env` and paste the values from the Web App registration in Step 1:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

To use emulators during development (recommended for testing rules & functions without cost):

```
VITE_USE_EMULATORS=true
```

Install frontend deps and verify build:

```bash
npm install
npm run build   # must exit 0
```

---

## 4. Configure Project ID

Edit repo root `.firebaserc`:

```json
{
  "projects": {
    "default": "your-project-id-from-step-1"
  }
}
```

Then log in locally:

```bash
cd /Volumes/work/online   # repo root
firebase login
firebase use default
```

---

## 5. Create Firestore Database & Deploy Rules/Indexes

```bash
# 1. Create Firestore (Production mode or test mode — we deploy our own rules immediately)
firebase firestore:databases:create (default) --location=asia-south1  # choose a region near you

# 2. Deploy Security Rules and Indexes
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

Security rules enforce:
- **Admin** users can read/write `quizzes`, `questions`, `results`, `auditLogs`, `users`
- **Employees** can only read their own `users/{uid}` and their own `results/*` where `published == true`
- **Questions** (answer key) are **never** readable by employees — only Cloud Functions service account and admin
- **Duplicate attempt** guard: only one `completed` `attempts` doc per employee/quiz

---

## 6. Deploy Storage Rules

```bash
firebase deploy --only storage
```

---

## 7. Configure Cloud Functions

```bash
cd functions
npm install
```

You **must** specify the Cloud Functions region in `functions/src/index.ts` near the top (we default to `asia-south1` in code comments — change if needed).

Deploy functions:

```bash
cd /Volumes/work/online
firebase deploy --only functions
```

This deploys:
- `helloWorld` — smoke test callable
- `evaluateSubmission` — triggered on `attempts/{attemptId}` writes; validates time window, score compute, negative marking, write results

---

## 8. Seed Master Data (officeMaster + Admin User)

Run the seed script or manually create these documents via **Firestore Data** tab:

### 8a. officeMaster collection
Valid dropdowns for employee login. Example document `officeMaster/divisions`:

```json
{
  "divisions": ["Chennai Dn", "Coimbatore Dn", "Madurai Dn"],
  "offices": ["Chennai GPO", "Anna Nagar SO", "T Nagar SO"],
  "designations": ["Postman", "MTS", "Postal Assistant", "Inspector Posts"]
}
```

### 8b. Admin user
Create document `users/<ADMIN_UID_FROM_AUTH>`:

```json
{
  "uid": "<ADMIN_UID>",
  "email": "admin@example.com",
  "role": "admin",
  "displayName": "Portal Admin",
  "createdAt": "<ServerTimestamp>"
}
```

---

## 9. Run Locally (Emulators)

```bash
# From repo root:
firebase emulators:start
```

Then open:
- Emulator UI: <http://localhost:4000>
- Auth emulator: <http://localhost:9099>
- Firestore emulator: <http://localhost:8080>
- Functions emulator: <http://localhost:5001>
- Storage emulator: <http://localhost:9199>

In another terminal:

```bash
cd frontend
VITE_USE_EMULATORS=true npm run dev
```

Visit <http://localhost:5173>.

---

## 10. Deploy Production

```bash
cd frontend && npm run build && cd ..
firebase deploy
```

Deploys: Firestore Rules/Indexes, Storage Rules, Cloud Functions, Hosting (frontend build)

---

## 11. Verify Checklist

- [ ] Admin login at `/admin/login` lands on Dashboard → `/admin/dashboard`
- [ ] Employee login at `/employee/login` creates Firestore `users` doc on first login
- [ ] Admin can create a Quiz, upload Questions via Excel
- [ ] Employee sees the quiz only **within** its open/close window
- [ ] Employee submits → Cloud Function evaluates → `results` doc with `published: false`
- [ ] Admin publishes results → employee can view score at `/employee/results/:id`
- [ ] Leaderboard rank export produces valid Excel + PDF

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `PERMISSION_DENIED` reading questions | Rules deny employee access to `correctAnswer` by design — admin UI only |
| Cloud Function returns `deadline-exceeded` | Check function memory allocation in GCP Console; bump to 512MB if needed |
| Excel import shows 0 valid rows | Verify column headers match exactly: `Question, Option A, Option B, Option C, Option D, Correct Answer, Marks, Explanation` (case-sensitive) |
| Employee sees no quizzes | 1. Check open/close window vs Firestore timestamp 2. Check Target Office/Division vs employee fields 3. Ensure `forceClosed` is not `true` |
