# Couple Monthly Budget Planner

Shared monthly budget planner for couples using **Supabase** as the data backend.

For full deployment instructions and credential locations, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Framer Motion
- Recharts
- Supabase (Postgres + API)

## 1) Create Supabase Project

1. Go to https://supabase.com and create a new project.
2. Wait for the database to finish provisioning.
3. Open your project dashboard.

## 2) Get Supabase API Credentials

In Supabase dashboard:

1. Go to **Project Settings → API**.
2. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

Important:

- `SUPABASE_SERVICE_ROLE_KEY` is highly sensitive.
- Never expose it in frontend/browser code.
- This app uses it on the server only.

## 3) Deploy Database Schema

1. Open **SQL Editor** in Supabase.
2. Copy/paste and run SQL from [supabase/schema.sql](supabase/schema.sql).
3. Confirm these tables exist:
   - `households`
   - `app_users`
   - `accounts`
   - `categories`
   - `expenses`
   - `income`
   - `hidden_savings`
   - `activity_logs`

## 4) Environment Setup (Local)

Copy `.env.example` to `.env` and set values:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_SECRET=
```

`AUTH_SECRET` should be at least 24 characters.

## 5) Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## 6) App Behavior

- Default users are auto-created/updated on setup:
  - `muneeb`
  - `ayesha`
- Passwords are never displayed by UI or setup API response.
- **No predefined categories** are created.
- Categories you add are stored for future use.
- Activity logs are shown in a dedicated **Logs** tab.

## 7) API Routes

- `/api/setup` (primary setup route)
- `/api/setup-notion` (backward-compatible alias)
- `/api/auth/login`
- `/api/auth/me`
- `/api/auth/logout`
- `/api/accounts`
- `/api/expenses`
- `/api/income`
- `/api/categories`
- `/api/savings`
- `/api/month`
- `/api/activity`

## 8) Deploy to Vercel

1. Push this repository to GitHub.
2. Import project in Vercel.
3. In Vercel project settings, add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AUTH_SECRET`
4. Deploy.

## 9) Troubleshooting

- Setup fails with table errors:
  - Run [supabase/schema.sql](supabase/schema.sql) in Supabase SQL Editor.
- Login fails:
  - Call `/api/setup` once and retry.
- Empty dashboard:
  - Add at least one category, then add income/expenses.
- Duplicate category/account errors:
  - Category names are unique per household.
  - Account names are unique per month.
