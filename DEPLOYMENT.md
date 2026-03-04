# Deployment Guide: Supabase + Vercel

This guide covers:

1. How to deploy the database on Supabase
2. How to deploy the app on Vercel
3. Exactly where to get credentials for each platform

## 1) Supabase Setup (Database + API)

### A) Create Supabase project

1. Open https://supabase.com
2. Create a new project
3. Choose organization, project name, region, and database password
4. Wait for project provisioning to complete

### B) Deploy database schema

1. In Supabase dashboard, go to SQL Editor
2. Open file [supabase/schema.sql](supabase/schema.sql)
3. Copy all SQL and run it in SQL Editor
4. Confirm tables were created:
   - households
   - app_users
   - accounts
   - categories
   - expenses
   - income
   - hidden_savings
   - activity_logs

### C) Supabase credentials you need

For this app, you need these two values:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Where to find them:

1. Supabase dashboard → Project Settings → API
2. Copy:
   - Project URL → SUPABASE_URL
   - service_role key (secret) → SUPABASE_SERVICE_ROLE_KEY

Security notes:

- service_role key is secret server credential
- never expose service_role in frontend/browser code
- only keep it in server environment variables (Vercel + local .env)

Optional credentials (not required by this app):

- anon public key (used only for browser-side Supabase usage)
- database connection string/password (needed only for direct SQL tools or migrations outside SQL Editor)

## 2) Local Environment Setup

Update [.env.example](.env.example) and local .env values:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- AUTH_SECRET

AUTH_SECRET should be long and random (at least 24 characters).

## 3) Vercel Deployment

### A) Deploy with Vercel dashboard (recommended)

1. Push your repo to GitHub/GitLab/Bitbucket
2. Open https://vercel.com/new
3. Import your repository
4. In project setup, add environment variables:
   - SUPABASE_URL (from Supabase Project Settings → API)
   - SUPABASE_SERVICE_ROLE_KEY (from Supabase Project Settings → API)
   - AUTH_SECRET (your own secret)
5. Click Deploy

### B) Vercel credentials you need

If using Vercel dashboard only:

- no explicit API token is required
- just your Vercel account login and repo access permissions

If using Vercel CLI/CI automation:

- Vercel token

Where to get Vercel token:

1. Vercel dashboard → Account Settings → Tokens
2. Create token and copy it once
3. Store it securely in CI secret store

Optional CI identifiers:

- VERCEL_ORG_ID and VERCEL_PROJECT_ID
- generated after linking project with Vercel CLI (`vercel link`), then available in `.vercel/project.json`

## 4) Post-Deploy Verification

After deployment, verify:

1. Open deployed URL
2. Login page loads
3. Call setup route once:
   - GET /api/setup
4. Login with default usernames:
   - muneeb
   - ayesha
5. Add a category manually (no predefined categories are seeded)
6. Add income/expense and verify Logs tab updates

## 5) Common Issues

### Issue: Setup route fails

- Most common cause: schema was not applied
- Fix: rerun [supabase/schema.sql](supabase/schema.sql) in Supabase SQL Editor

### Issue: Unauthorized or env errors on Vercel

- Check exact variable names in Vercel project settings
- Redeploy after editing environment variables

### Issue: App works locally but not on Vercel

- Verify SUPABASE_URL and service_role key are from the same Supabase project
- Confirm service_role key has no extra whitespace/newlines
