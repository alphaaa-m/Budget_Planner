"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatPkr, getCurrentMonthKey } from "@/lib/format";
import type {
  AccountRecord,
  CategoryRecord,
  ExpenseRecord,
  HiddenSavingsRecord,
  IncomeRecord,
} from "@/lib/types";

const todayIso = new Date().toISOString().slice(0, 10);

const chartColors = [
  "#16a34a",
  "#3b82f6",
  "#f97316",
  "#9333ea",
  "#db2777",
  "#0891b2",
  "#eab308",
  "#ef4444",
  "#64748b",
];

type SessionUser = {
  id: string;
  name: string;
  username: string;
  householdId: string;
};

type ActivityLogEntry = {
  id: string;
  timestamp: string;
  actorName: string;
  actorUsername: string;
  action: string;
  entity: string;
  description: string;
  householdId: string;
  monthKey?: string | null;
};

type DashboardTab = "planner" | "logs";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  error?: string;
};

type IncomeFormState = {
  title: string;
  amount: string;
  date: string;
  accountId: string;
};

type ExpenseFormState = {
  title: string;
  amount: string;
  date: string;
  accountId: string;
  categoryId: string;
  note: string;
};

type SavingsFormState = {
  title: string;
  amount: string;
  date: string;
  accountId: string;
  note: string;
};

type TransferFormState = {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  note: string;
};

type BankAccountFormState = {
  name: string;
  balance: string;
};

type CategoryFormState = {
  name: string;
  budgetLimit: string;
  color: string;
};

type DashboardPayload = {
  monthKey: string;
  accounts: AccountRecord[];
  categories: CategoryRecord[];
  expenses: ExpenseRecord[];
  income: IncomeRecord[];
  savings: HiddenSavingsRecord[];
  allExpenses: ExpenseRecord[];
  allAccounts: AccountRecord[];
};

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "Request failed");
  }

  return payload.data;
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300/60 p-6 text-center text-sm text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
      {label}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      className="rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70"
    >
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-8 md:px-8">
      <div className="h-16 animate-pulse rounded-2xl bg-white/60 dark:bg-slate-800/70" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl bg-white/60 dark:bg-slate-800/70"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="h-72 animate-pulse rounded-2xl bg-white/60 dark:bg-slate-800/70"
          />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [initializing, setInitializing] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("planner");

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [carryForward, setCarryForward] = useState(true);
  const [showHiddenSavings, setShowHiddenSavings] = useState(false);

  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [income, setIncome] = useState<IncomeRecord[]>([]);
  const [savings, setSavings] = useState<HiddenSavingsRecord[]>([]);

  const [allExpenses, setAllExpenses] = useState<ExpenseRecord[]>([]);
  const [allAccounts, setAllAccounts] = useState<AccountRecord[]>([]);

  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});

  const [incomeForm, setIncomeForm] = useState<IncomeFormState>({
    title: "",
    amount: "",
    date: todayIso,
    accountId: "",
  });
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>({
    title: "",
    amount: "",
    date: todayIso,
    accountId: "",
    categoryId: "",
    note: "",
  });
  const [savingsForm, setSavingsForm] = useState<SavingsFormState>({
    title: "",
    amount: "",
    date: todayIso,
    accountId: "",
    note: "",
  });
  const [transferForm, setTransferForm] = useState<TransferFormState>({
    fromAccountId: "",
    toAccountId: "",
    amount: "",
    note: "",
  });
  const [bankAccountForm, setBankAccountForm] = useState<BankAccountFormState>({
    name: "",
    balance: "",
  });
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>({
    name: "",
    budgetLimit: "0",
    color: "default",
  });

  const refreshSession = useCallback(async () => {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as
      | ApiEnvelope<{ user: SessionUser }>
      | null;

    if (response.ok && payload?.ok) {
      setUser(payload.data.user);
      return payload.data.user;
    }

    setUser(null);
    return null;
  }, []);

  const loadMonthData = useCallback(
    async (
      targetMonth: string,
      options?: {
        carryForward?: boolean;
        duplicatePrevious?: boolean;
      },
    ) => {
      if (!user) {
        return;
      }

      setLoadingData(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          monthKey: targetMonth,
          carryForward: String(options?.carryForward ?? carryForward),
          duplicatePrevious: String(options?.duplicatePrevious ?? false),
        });

        const dashboard = await apiRequest<DashboardPayload>(`/api/dashboard?${params.toString()}`);

        setAccounts(dashboard.accounts);
        setCategories(dashboard.categories);
        setExpenses(dashboard.expenses);
        setIncome(dashboard.income);
        setSavings(dashboard.savings);
        setAllExpenses(dashboard.allExpenses);
        setAllAccounts(dashboard.allAccounts);
      } catch (apiError) {
        setError(apiError instanceof Error ? apiError.message : "Failed to load dashboard data");
      } finally {
        setLoadingData(false);
      }
    },
    [user, carryForward],
  );

  const loadActivityLogs = useCallback(async () => {
    if (!user) {
      return;
    }

    try {
      const activityData = await apiRequest<{ logs: ActivityLogEntry[] }>("/api/activity?limit=30");
      setActivityLogs(activityData.logs);
    } catch {
      setActivityLogs([]);
    }
  }, [user]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        await apiRequest("/api/setup", { method: "POST" });

        if (!active) {
          return;
        }

        await refreshSession();
      } catch (setupError) {
        if (!active) {
          return;
        }

        setError(setupError instanceof Error ? setupError.message : "Failed to setup workspace");
      } finally {
        if (active) {
          setInitializing(false);
        }
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!user || activeTab !== "planner") {
      return;
    }

    void loadMonthData(monthKey, { carryForward, duplicatePrevious: false });
  }, [user, monthKey, carryForward, activeTab, loadMonthData]);

  useEffect(() => {
    if (!user || activeTab !== "logs") {
      return;
    }

    void loadActivityLogs();
  }, [activeTab, user, loadActivityLogs]);

  useEffect(() => {
    setBudgetDrafts(
      Object.fromEntries(categories.map((category) => [category.id, String(category.budgetLimit)])),
    );
  }, [categories]);

  useEffect(() => {
    if (!accounts.length) {
      return;
    }

    const fallbackAccountId = accounts[0].id;

    setIncomeForm((previous) => ({
      ...previous,
      accountId: previous.accountId || fallbackAccountId,
    }));
    setExpenseForm((previous) => ({
      ...previous,
      accountId: previous.accountId || fallbackAccountId,
    }));
    setSavingsForm((previous) => ({
      ...previous,
      accountId: previous.accountId || fallbackAccountId,
    }));
    setTransferForm((previous) => ({
      ...previous,
      fromAccountId: previous.fromAccountId || fallbackAccountId,
      toAccountId:
        previous.toAccountId ||
        accounts.find((account) => account.id !== fallbackAccountId)?.id ||
        fallbackAccountId,
    }));
  }, [accounts]);

  useEffect(() => {
    if (!categories.length) {
      return;
    }

    const fallbackCategoryId = categories[0].id;
    setExpenseForm((previous) => ({
      ...previous,
      categoryId: previous.categoryId || fallbackCategoryId,
    }));
  }, [categories]);

  const spendingByCategory = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((expenseItem) => {
      map.set(
        expenseItem.categoryId,
        (map.get(expenseItem.categoryId) || 0) + expenseItem.amount,
      );
    });
    return map;
  }, [expenses]);

  const totalIncome = useMemo(
    () => income.reduce((sum, incomeItem) => sum + incomeItem.amount, 0),
    [income],
  );
  const totalExpenses = useMemo(
    () => expenses.reduce((sum, expenseItem) => sum + expenseItem.amount, 0),
    [expenses],
  );
  const totalSavings = useMemo(
    () => savings.reduce((sum, savingsItem) => sum + savingsItem.amount, 0),
    [savings],
  );
  const availableBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts],
  );

  const expensePieData = useMemo(
    () =>
      categories
        .map((category) => ({
          name: category.name,
          value: spendingByCategory.get(category.id) || 0,
        }))
        .filter((item) => item.value > 0),
    [categories, spendingByCategory],
  );

  const monthlySpendingData = useMemo(() => {
    const map = new Map<string, number>();
    allExpenses.forEach((expenseItem) => {
      map.set(expenseItem.monthKey, (map.get(expenseItem.monthKey) || 0) + expenseItem.amount);
    });

    return Array.from(map.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, amount]) => ({ month, amount }));
  }, [allExpenses]);

  const balanceOverTimeData = useMemo(() => {
    const map = new Map<string, number>();
    allAccounts.forEach((account) => {
      map.set(account.monthKey, (map.get(account.monthKey) || 0) + account.balance);
    });

    return Array.from(map.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, balance]) => ({ month, balance }));
  }, [allAccounts]);

  const accountDistributionData = useMemo(
    () => accounts.map((account) => ({ name: account.name, value: account.balance })),
    [accounts],
  );

  const sharedCashAccount = useMemo(
    () =>
      accounts.find(
        (account) => account.name.trim().toLowerCase() === "cash (muneeb, ayesha)",
      ) ?? null,
    [accounts],
  );

  const cashMuneebAccount = useMemo(
    () =>
      accounts.find(
        (account) => account.name.trim().toLowerCase() === "cash (muneeb)",
      ) ?? null,
    [accounts],
  );

  const cashAyeshaAccount = useMemo(
    () =>
      accounts.find(
        (account) => account.name.trim().toLowerCase() === "cash (ayesha)",
      ) ?? null,
    [accounts],
  );

  const showCashSections = useMemo(
    () => Boolean(sharedCashAccount || cashMuneebAccount || cashAyeshaAccount),
    [sharedCashAccount, cashMuneebAccount, cashAyeshaAccount],
  );

  const nonCashAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        const name = account.name.trim().toLowerCase();
        return (
          name !== "cash (muneeb)" &&
          name !== "cash (ayesha)" &&
          name !== "cash (muneeb, ayesha)"
        );
      }),
    [accounts],
  );

  const budgetVsActualData = useMemo(
    () =>
      categories.map((category) => ({
        name: category.name,
        budget: category.budgetLimit,
        actual: spendingByCategory.get(category.id) || 0,
      })),
    [categories, spendingByCategory],
  );

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginLoading(true);
    setError(null);

    try {
      await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      await refreshSession();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    await apiRequest("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  async function handleIncomeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload = {
      title: incomeForm.title,
      amount: Number(incomeForm.amount),
      date: incomeForm.date,
      accountId: incomeForm.accountId,
      monthKey,
    };

    try {
      if (editingIncomeId) {
        await apiRequest("/api/income", {
          method: "PATCH",
          body: JSON.stringify({ id: editingIncomeId, ...payload }),
        });
      } else {
        await apiRequest("/api/income", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setEditingIncomeId(null);
      setIncomeForm({ title: "", amount: "", date: todayIso, accountId: incomeForm.accountId });
      await loadMonthData(monthKey);
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : "Unable to save income");
    }
  }

  async function handleExpenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload = {
      title: expenseForm.title,
      amount: Number(expenseForm.amount),
      date: expenseForm.date,
      accountId: expenseForm.accountId,
      categoryId: expenseForm.categoryId,
      note: expenseForm.note,
      monthKey,
    };

    try {
      if (editingExpenseId) {
        await apiRequest("/api/expenses", {
          method: "PATCH",
          body: JSON.stringify({ id: editingExpenseId, ...payload }),
        });
      } else {
        await apiRequest("/api/expenses", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setEditingExpenseId(null);
      setExpenseForm({
        title: "",
        amount: "",
        date: todayIso,
        accountId: expenseForm.accountId,
        categoryId: expenseForm.categoryId,
        note: "",
      });
      await loadMonthData(monthKey);
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : "Unable to save expense");
    }
  }

  async function handleAddSavings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await apiRequest("/api/savings", {
        method: "POST",
        body: JSON.stringify({
          title: savingsForm.title,
          amount: Number(savingsForm.amount),
          date: savingsForm.date,
          accountId: savingsForm.accountId,
          monthKey,
          note: savingsForm.note,
        }),
      });

      setSavingsForm({
        title: "",
        amount: "",
        date: todayIso,
        accountId: savingsForm.accountId,
        note: "",
      });

      await loadMonthData(monthKey);
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : "Unable to move funds to hidden savings",
      );
    }
  }

  async function handleTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await apiRequest("/api/accounts", {
        method: "PATCH",
        body: JSON.stringify({
          mode: "transfer",
          fromAccountId: transferForm.fromAccountId,
          toAccountId: transferForm.toAccountId,
          amount: Number(transferForm.amount),
          note: transferForm.note,
        }),
      });

      setTransferForm((previous) => ({ ...previous, amount: "", note: "" }));
      await loadMonthData(monthKey);
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : "Unable to transfer funds");
    }
  }

  async function updateBudgetLimit(categoryId: string) {
    setError(null);
    const budgetLimit = Number(budgetDrafts[categoryId] || "0");

    try {
      await apiRequest("/api/categories", {
        method: "PATCH",
        body: JSON.stringify({ id: categoryId, budgetLimit }),
      });

      await loadMonthData(monthKey);
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : "Unable to update category budget",
      );
    }
  }

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await apiRequest("/api/categories", {
        method: "POST",
        body: JSON.stringify({
          name: categoryForm.name,
          color: categoryForm.color,
          budgetLimit: Number(categoryForm.budgetLimit || "0"),
        }),
      });

      setCategoryForm((previous) => ({
        ...previous,
        name: "",
        budgetLimit: "0",
      }));

      await loadMonthData(monthKey);
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : "Unable to create category",
      );
    }
  }

  async function handleCreateBankAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await apiRequest("/api/accounts", {
        method: "POST",
        body: JSON.stringify({
          name: bankAccountForm.name,
          type: "Bank",
          balance: Number(bankAccountForm.balance || "0"),
          monthKey,
        }),
      });

      setBankAccountForm({
        name: "",
        balance: "",
      });

      await loadMonthData(monthKey);
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : "Unable to create bank account",
      );
    }
  }

  async function handleDeleteAccount(id: string) {
    setError(null);

    try {
      await apiRequest("/api/accounts", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });

      await loadMonthData(monthKey);
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : "Unable to remove account",
      );
    }
  }

  async function handleDeleteIncome(id: string) {
    setError(null);
    try {
      await apiRequest("/api/income", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      await loadMonthData(monthKey);
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : "Unable to delete income");
    }
  }

  async function handleDeleteExpense(id: string) {
    setError(null);
    try {
      await apiRequest("/api/expenses", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      await loadMonthData(monthKey);
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : "Unable to delete expense");
    }
  }

  if (initializing) {
    return <LoadingSkeleton />;
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-3 py-6 sm:px-4 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border border-white/50 bg-white/75 p-6 shadow-lg backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/75"
        >
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Couple Budget Planner
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Secure login for shared monthly planning
              </p>
            </div>
            <ThemeToggle />
          </div>

          <form className="space-y-3" onSubmit={handleLogin}>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
              Username
              <input
                required
                className="mt-1 w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-slate-800 outline-none ring-sky-400 transition focus:ring dark:border-slate-700/60 dark:bg-slate-950 dark:text-slate-100"
                value={loginUsername}
                onChange={(event) => setLoginUsername(event.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
              Password
              <input
                required
                type="password"
                className="mt-1 w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-slate-800 outline-none ring-sky-400 transition focus:ring dark:border-slate-700/60 dark:bg-slate-950 dark:text-slate-100"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
            </label>
            <button
              disabled={loginLoading}
              type="submit"
              className="w-full rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loginLoading ? "Signing in..." : "Login"}
            </button>
          </form>

          {error ? (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          ) : null}
        </motion.div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-3 py-4 sm:px-4 sm:py-6 md:px-8 md:py-8">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Couple Monthly Budget Planner
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Welcome {user.name}. Shared household data with {user.username} access.
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <ThemeToggle />
            <button
              type="button"
              onClick={() =>
                activeTab === "logs"
                  ? void loadActivityLogs()
                  : void loadMonthData(monthKey)
              }
              className="w-full rounded-xl border border-slate-300/70 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 sm:w-auto dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Month
            <input
              type="month"
              value={monthKey}
              onChange={(event) => setMonthKey(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-sky-400 transition focus:ring sm:ml-2 sm:mt-0 sm:w-auto dark:border-slate-700/60 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>

          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700/60 dark:bg-slate-950 dark:text-slate-200">
            <input
              type="checkbox"
              checked={carryForward}
              onChange={(event) => setCarryForward(event.target.checked)}
            />
            Carry forward balances
          </label>

          <button
            type="button"
            onClick={() =>
              void loadMonthData(monthKey, {
                carryForward: true,
                duplicatePrevious: true,
              })
            }
            className="w-full rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 sm:w-auto"
          >
            Duplicate Previous Month
          </button>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <div className="mt-4 inline-flex w-full rounded-xl border border-slate-300/60 bg-white p-1 sm:w-auto dark:border-slate-700/60 dark:bg-slate-950">
          <button
            type="button"
            onClick={() => setActiveTab("planner")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold sm:flex-none ${
              activeTab === "planner"
                ? "bg-sky-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Planner
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold sm:flex-none ${
              activeTab === "logs"
                ? "bg-sky-600 text-white"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Logs
          </button>
        </div>
      </motion.section>

      {loadingData ? <LoadingSkeleton /> : null}

      {activeTab === "planner" ? (
        <>
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <SummaryCard label="Total Income" value={formatPkr(totalIncome)} />
        <SummaryCard label="Total Expenses" value={formatPkr(totalExpenses)} />
        <SummaryCard
          label="Hidden Savings"
          value={showHiddenSavings ? formatPkr(totalSavings) : "₨ ••••••"}
        />
        <SummaryCard label="Available Balance" value={formatPkr(availableBalance)} />
      </section>

      <section className="rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Accounts</h2>
          <button
            type="button"
            onClick={() => setShowHiddenSavings((value) => !value)}
            className="w-full rounded-xl border border-slate-300/60 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 sm:w-auto dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {showHiddenSavings ? "Hide savings" : "Show savings"}
          </button>
        </div>

        <form
          onSubmit={handleCreateBankAccount}
          className="mb-4 grid gap-2 rounded-xl border border-slate-200/70 bg-white p-3 dark:border-slate-700/70 dark:bg-slate-950 sm:grid-cols-[1fr_160px_auto]"
        >
          <input
            placeholder="Bank account name"
            required
            value={bankAccountForm.name}
            onChange={(event) =>
              setBankAccountForm((previous) => ({ ...previous, name: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <input
            placeholder="Opening balance"
            type="number"
            min={0}
            value={bankAccountForm.balance}
            onChange={(event) =>
              setBankAccountForm((previous) => ({ ...previous, balance: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <button className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">
            Add Bank Account
          </button>
        </form>

        {accounts.length === 0 ? (
          <EmptyState label="No accounts yet for this month." />
        ) : (
          <div className="space-y-4">
            {showCashSections ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Cash Section</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Cash (Muneeb)</p>
                  <p className="mt-2 text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    {formatPkr(cashMuneebAccount?.balance ?? sharedCashAccount?.balance ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-cyan-200/70 bg-cyan-50/70 p-3 dark:border-cyan-900/60 dark:bg-cyan-950/20">
                  <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Cash Section</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Cash (Ayesha)</p>
                  <p className="mt-2 text-lg font-bold text-cyan-700 dark:text-cyan-300">
                    {formatPkr(cashAyeshaAccount?.balance ?? 0)}
                  </p>
                </div>
              </div>
            ) : null}

            {nonCashAccounts.length === 0 ? (
              <EmptyState label="No non-cash accounts yet for this month." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {nonCashAccounts.map((account) => (
                  <motion.div
                    key={account.id}
                    whileHover={{ y: -2, scale: 1.01 }}
                    className="rounded-xl border border-slate-200/70 bg-white p-3 dark:border-slate-700/70 dark:bg-slate-950"
                  >
                    <p className="text-xs uppercase tracking-wide text-slate-500">{account.type}</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{account.name}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-lg font-bold text-sky-700 dark:text-sky-300">
                        {formatPkr(account.balance)}
                      </p>
                      {account.type === "Bank" || account.type === "Easypaisa" ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Remove this bank account?")) {
                              void handleDeleteAccount(account.id);
                            }
                          }}
                          className="rounded-lg border border-rose-300/70 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/30"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <motion.form
          whileHover={{ y: -2 }}
          onSubmit={handleIncomeSubmit}
          className="space-y-2 rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70"
        >
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            {editingIncomeId ? "Edit Income" : "Add Income"}
          </h3>
          <input
            placeholder="Title"
            required
            value={incomeForm.title}
            onChange={(event) => setIncomeForm((previous) => ({ ...previous, title: event.target.value }))}
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <input
            placeholder="Amount"
            type="number"
            min={1}
            required
            value={incomeForm.amount}
            onChange={(event) => setIncomeForm((previous) => ({ ...previous, amount: event.target.value }))}
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <input
            type="date"
            required
            value={incomeForm.date}
            onChange={(event) => setIncomeForm((previous) => ({ ...previous, date: event.target.value }))}
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <select
            required
            value={incomeForm.accountId}
            onChange={(event) => setIncomeForm((previous) => ({ ...previous, accountId: event.target.value }))}
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500">
              {editingIncomeId ? "Update" : "Add"}
            </button>
            {editingIncomeId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingIncomeId(null);
                  setIncomeForm((previous) => ({ ...previous, title: "", amount: "", date: todayIso }));
                }}
                className="rounded-xl border border-slate-300/70 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </motion.form>

        <motion.form
          whileHover={{ y: -2 }}
          onSubmit={handleExpenseSubmit}
          className="space-y-2 rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70"
        >
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            {editingExpenseId ? "Edit Expense" : "Add Expense"}
          </h3>
          <input
            placeholder="Title"
            required
            value={expenseForm.title}
            onChange={(event) =>
              setExpenseForm((previous) => ({ ...previous, title: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <input
            placeholder="Amount"
            type="number"
            min={1}
            required
            value={expenseForm.amount}
            onChange={(event) =>
              setExpenseForm((previous) => ({ ...previous, amount: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <input
            type="date"
            required
            value={expenseForm.date}
            onChange={(event) =>
              setExpenseForm((previous) => ({ ...previous, date: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <select
            required
            value={expenseForm.categoryId}
            onChange={(event) =>
              setExpenseForm((previous) => ({ ...previous, categoryId: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Optional note"
            value={expenseForm.note}
            onChange={(event) =>
              setExpenseForm((previous) => ({ ...previous, note: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <div className="flex gap-2">
            <button className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500">
              {editingExpenseId ? "Update" : "Add"}
            </button>
            {editingExpenseId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingExpenseId(null);
                  setExpenseForm((previous) => ({
                    ...previous,
                    title: "",
                    amount: "",
                    date: todayIso,
                    note: "",
                  }));
                }}
                className="rounded-xl border border-slate-300/70 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </motion.form>

        <motion.form
          whileHover={{ y: -2 }}
          onSubmit={handleTransfer}
          className="space-y-2 rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70"
        >
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Transfer Funds</h3>
          <select
            required
            value={transferForm.fromAccountId}
            onChange={(event) =>
              setTransferForm((previous) => ({ ...previous, fromAccountId: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                From: {account.name}
              </option>
            ))}
          </select>
          <select
            required
            value={transferForm.toAccountId}
            onChange={(event) =>
              setTransferForm((previous) => ({ ...previous, toAccountId: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                To: {account.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Amount"
            type="number"
            min={1}
            required
            value={transferForm.amount}
            onChange={(event) =>
              setTransferForm((previous) => ({ ...previous, amount: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <input
            placeholder="Optional note"
            value={transferForm.note}
            onChange={(event) =>
              setTransferForm((previous) => ({ ...previous, note: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <button className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500">
            Transfer
          </button>
        </motion.form>

        <motion.form
          whileHover={{ y: -2 }}
          onSubmit={handleAddSavings}
          className="space-y-2 rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70"
        >
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Hidden Savings</h3>
          <input
            placeholder="Title"
            required
            value={savingsForm.title}
            onChange={(event) =>
              setSavingsForm((previous) => ({ ...previous, title: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <input
            placeholder="Amount"
            type="number"
            min={1}
            required
            value={savingsForm.amount}
            onChange={(event) =>
              setSavingsForm((previous) => ({ ...previous, amount: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <input
            type="date"
            required
            value={savingsForm.date}
            onChange={(event) =>
              setSavingsForm((previous) => ({ ...previous, date: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <select
            required
            value={savingsForm.accountId}
            onChange={(event) =>
              setSavingsForm((previous) => ({ ...previous, accountId: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Optional note"
            value={savingsForm.note}
            onChange={(event) =>
              setSavingsForm((previous) => ({ ...previous, note: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <button className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500">
            Move to Hidden Savings
          </button>
        </motion.form>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">Income Entries</h3>
          {income.length === 0 ? (
            <EmptyState label="No income entries this month." />
          ) : (
            <div className="space-y-2">
              {income.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-700/70 dark:bg-slate-950"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {item.date} · {formatPkr(item.amount)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingIncomeId(item.id);
                        setIncomeForm({
                          title: item.title,
                          amount: String(item.amount),
                          date: item.date,
                          accountId: item.accountId,
                        });
                      }}
                      className="rounded-lg border border-slate-300/70 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteIncome(item.id)}
                      className="rounded-lg border border-rose-300/70 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/30"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">Expense Entries</h3>
          {expenses.length === 0 ? (
            <EmptyState label="No expenses entries this month." />
          ) : (
            <div className="space-y-2">
              {expenses.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-700/70 dark:bg-slate-950"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {item.date} · {formatPkr(item.amount)} {item.note ? `· ${item.note}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingExpenseId(item.id);
                        setExpenseForm({
                          title: item.title,
                          amount: String(item.amount),
                          date: item.date,
                          accountId: item.accountId,
                          categoryId: item.categoryId,
                          note: item.note,
                        });
                      }}
                      className="rounded-lg border border-slate-300/70 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteExpense(item.id)}
                      className="rounded-lg border border-rose-300/70 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/30"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70">
        <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">Budget Controls</h3>
        <form
          onSubmit={handleCreateCategory}
          className="mb-4 grid gap-2 rounded-xl border border-slate-200/70 bg-white p-3 dark:border-slate-700/70 dark:bg-slate-950 sm:grid-cols-[1fr_160px_auto]"
        >
          <input
            placeholder="Category name"
            required
            value={categoryForm.name}
            onChange={(event) =>
              setCategoryForm((previous) => ({ ...previous, name: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <input
            placeholder="Budget limit"
            type="number"
            min={0}
            value={categoryForm.budgetLimit}
            onChange={(event) =>
              setCategoryForm((previous) => ({ ...previous, budgetLimit: event.target.value }))
            }
            className="w-full rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-950"
          />
          <button className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500">
            Add Category
          </button>
        </form>
        {categories.length === 0 ? (
          <EmptyState label="No categories yet. Add one to start planning." />
        ) : (
          <div className="space-y-3">
            {categories.map((category) => {
              const spent = spendingByCategory.get(category.id) || 0;
              const budget = category.budgetLimit;
              const progress = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
              const isExceeded = budget > 0 && spent > budget;

              return (
                <div
                  key={category.id}
                  className="rounded-xl border border-slate-200/70 bg-white p-3 dark:border-slate-700/70 dark:bg-slate-950"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{category.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Spent: {formatPkr(spent)} · Remaining: {formatPkr(Math.max(budget - spent, 0))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={budgetDrafts[category.id] ?? "0"}
                        onChange={(event) =>
                          setBudgetDrafts((previous) => ({
                            ...previous,
                            [category.id]: event.target.value,
                          }))
                        }
                        className="w-32 rounded-xl border border-slate-300/60 bg-white px-3 py-2 text-sm dark:border-slate-700/60 dark:bg-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => void updateBudgetLimit(category.id)}
                        className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${
                        isExceeded ? "bg-rose-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {isExceeded ? (
                    <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      Budget exceeded for this category.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70">
          <h3 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">Expenses by Category</h3>
          <div className="h-64 sm:h-72">
            {expensePieData.length === 0 ? (
              <EmptyState label="Add expenses to see category analytics." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensePieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={96}
                    isAnimationActive
                    animationDuration={700}
                  >
                    {expensePieData.map((entry, index) => (
                      <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatPkr(Number(value ?? 0))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70">
          <h3 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">Monthly Spending Trend</h3>
          <div className="h-64 sm:h-72">
            {monthlySpendingData.length === 0 ? (
              <EmptyState label="No trend data yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySpendingData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatPkr(Number(value ?? 0))} />
                  <Legend />
                  <Bar dataKey="amount" name="Spending" fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70">
          <h3 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">Balance Over Time</h3>
          <div className="h-64 sm:h-72">
            {balanceOverTimeData.length === 0 ? (
              <EmptyState label="No balance history yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={balanceOverTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatPkr(Number(value ?? 0))} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    name="Balance"
                    stroke="#0ea5e9"
                    strokeWidth={3}
                    isAnimationActive
                    animationDuration={800}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70">
          <h3 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">
            Account Distribution
          </h3>
          <div className="h-64 sm:h-72">
            {accountDistributionData.length === 0 ? (
              <EmptyState label="No account distribution yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={accountDistributionData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={96}
                    isAnimationActive
                    animationDuration={700}
                  >
                    {accountDistributionData.map((entry, index) => (
                      <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatPkr(Number(value ?? 0))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70">
        <h3 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">
          Budget vs Actual Comparison
        </h3>
        <div className="h-64 sm:h-72">
          {budgetVsActualData.length === 0 ? (
            <EmptyState label="No category data for budget comparison." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetVsActualData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatPkr(Number(value ?? 0))} />
                <Legend />
                <Bar dataKey="budget" fill="#16a34a" radius={[8, 8, 0, 0]} />
                <Bar dataKey="actual" fill="#f97316" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

        </>
      ) : (
      <section className="rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70">
        <h3 className="mb-3 font-semibold text-slate-900 dark:text-slate-100">Recent Activity</h3>
        {activityLogs.length === 0 ? (
          <EmptyState label="No changes logged yet." />
        ) : (
          <div className="space-y-2">
            {activityLogs.map((log) => {
              const actor = log.actorUsername.trim().toLowerCase();
              const isMuneeb = actor === "muneeb";
              const isAyesha = actor === "ayesha";

              const cardTone = isMuneeb
                ? "border-sky-200/70 bg-sky-50/70 dark:border-sky-900/60 dark:bg-sky-950/20"
                : isAyesha
                  ? "border-fuchsia-200/70 bg-fuchsia-50/70 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/20"
                  : "border-slate-200/70 bg-white dark:border-slate-700/70 dark:bg-slate-950";

              const badgeTone = isMuneeb
                ? "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200"
                : isAyesha
                  ? "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/50 dark:text-fuchsia-200"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";

              return (
                <div
                  key={log.id}
                  className={`rounded-xl border p-3 ${cardTone}`}
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    <span className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badgeTone}`}>
                      {log.actorName}
                    </span>
                    {log.description}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {new Date(log.timestamp).toLocaleString()}
                    {log.monthKey ? ` · ${log.monthKey}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}
    </main>
  );
}
