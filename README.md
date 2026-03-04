# Couple Monthly Budget Planner

Shared monthly budget planner for couples using Notion as the only data store.

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Framer Motion
- Recharts
- Notion API (server-side only)

## 1) Prerequisites

Before running:

1. Create a Notion integration and copy its API key.
2. Share your Notion parent page with that integration.
3. Copy the parent page ID.
4. Use Node.js 18+.

## 2) Environment Setup

Create a `.env` file from `.env.example`:

```bash
NOTION_API_KEY=
NOTION_PARENT_PAGE_ID=
AUTH_SECRET=
```

Notes:

- `NOTION_PARENT_PAGE_ID` must be a **page ID**, not a database ID.
- `AUTH_SECRET` should be a strong secret (at least 24 characters).

## 3) Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## 4) First-Run Automatic Notion Setup

On first load, the app automatically creates and configures all required Notion databases under your parent page:

- Households
- Users
- Accounts
- Categories
- Expenses
- Income
- Hidden Savings

It also creates:

- System Config page marker
- Default categories
- Shared household
- Two login users

Default login credentials:

- `muneeb`
- `ayesha`

For security, passwords are not displayed by the UI or setup API response.

## 5) How to Use the App

### Login

- Open the app and sign in with either default user.
- Both users see the same household financial data.

### Month Planning

- Select a month using `YYYY-MM`.
- New month initializes accounts automatically.
- Use **Duplicate Previous Month** to copy previous balances.

### Add / Remove Bank Accounts

- Use the **Accounts** section form to add a new bank account.
- Click **Remove** on a bank account card to delete it.

### Financial Actions

- Add/edit/delete income
- Add/edit/delete expenses
- Transfer between accounts (overdraft is blocked)
- Move money to hidden savings
- Set per-category budget limits and monitor progress

### Analytics

- Expense-by-category pie chart
- Monthly spending trend bar chart
- Balance over time line chart
- Account distribution chart
- Budget vs actual chart

## 6) Mobile Experience

The dashboard is optimized for small screens:

- Stacked controls and forms
- Compact summary cards
- Mobile-friendly list rows and action buttons
- Responsive chart heights

## 7) API Routes

- `/api/setup-notion`
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

All sensitive Notion operations run server-side. `NOTION_API_KEY` is never exposed to the frontend.

## 8) Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repo into Vercel.
3. Set environment variables in Vercel:
	 - `NOTION_API_KEY`
	 - `NOTION_PARENT_PAGE_ID`
	 - `AUTH_SECRET`
4. Deploy.

No external database and no runtime filesystem writes are required.

## 9) Troubleshooting

- Setup fails with validation errors:
	- Ensure `NOTION_PARENT_PAGE_ID` is a page ID.
	- Ensure integration has access to the parent page.
- Login fails:
	- Call `/api/setup-notion` once to ensure initial users are created.
- Empty dashboard:
	- Select the current month and add income/accounts first.
