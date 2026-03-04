import { z } from "zod";

export const monthKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, {
  message: "Month Key must be in YYYY-MM format",
});

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "Date must be in YYYY-MM-DD format",
});

export const amountSchema = z.coerce
  .number()
  .finite()
  .positive("Amount must be greater than zero")
  .max(1_000_000_000, "Amount is too large");

export const accountTypeSchema = z.enum([
  "Cash",
  "Bank",
  "Easypaisa",
  "Savings",
  "Investment",
  "Other",
]);

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const initializeMonthSchema = z.object({
  monthKey: monthKeySchema,
  carryForward: z.boolean().optional().default(false),
  duplicatePrevious: z.boolean().optional().default(false),
});

export const createAccountSchema = z.object({
  name: z.string().trim().min(1),
  type: accountTypeSchema,
  balance: z.coerce.number().finite().min(0).default(0),
  monthKey: monthKeySchema,
});

export const updateAccountSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).optional(),
  type: accountTypeSchema.optional(),
  balance: z.coerce.number().finite().min(0).optional(),
});

export const transferSchema = z.object({
  mode: z.literal("transfer"),
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: amountSchema,
});

export const createExpenseSchema = z.object({
  title: z.string().trim().min(1),
  amount: amountSchema,
  date: dateSchema,
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  monthKey: monthKeySchema.optional(),
  note: z.string().trim().max(500).optional().default(""),
});

export const updateExpenseSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  amount: amountSchema,
  date: dateSchema,
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  monthKey: monthKeySchema.optional(),
  note: z.string().trim().max(500).optional().default(""),
});

export const deleteEntitySchema = z.object({
  id: z.string().min(1),
});

export const createIncomeSchema = z.object({
  title: z.string().trim().min(1),
  amount: amountSchema,
  date: dateSchema,
  accountId: z.string().min(1),
  monthKey: monthKeySchema.optional(),
});

export const updateIncomeSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  amount: amountSchema,
  date: dateSchema,
  accountId: z.string().min(1),
  monthKey: monthKeySchema.optional(),
});

export const createSavingsSchema = z.object({
  title: z.string().trim().min(1),
  amount: amountSchema,
  date: dateSchema,
  accountId: z.string().min(1),
  monthKey: monthKeySchema.optional(),
});

export const updateCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).optional(),
  color: z.string().trim().min(1).optional(),
  budgetLimit: z.coerce.number().finite().min(0).optional(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  color: z.string().trim().min(1).default("default"),
  budgetLimit: z.coerce.number().finite().min(0).default(0),
});
