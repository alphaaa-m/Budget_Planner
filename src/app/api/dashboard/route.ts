import { NextRequest } from "next/server";
import { apiFailure, apiSuccess, handleApiError } from "@/lib/api";
import {
  initializeMonthAccounts,
  listAccounts,
  listCategories,
  listExpenses,
  listHiddenSavings,
  listIncome,
} from "@/lib/budget-service";
import { initializeMonthSchema, monthKeySchema } from "@/lib/schemas";
import { requireSession } from "@/lib/route-auth";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);

    const monthKey = request.nextUrl.searchParams.get("monthKey");
    const carryForward = request.nextUrl.searchParams.get("carryForward") === "true";
    const duplicatePrevious = request.nextUrl.searchParams.get("duplicatePrevious") === "true";

    const parsedMonth = monthKeySchema.safeParse(monthKey);
    if (!parsedMonth.success) {
      return apiFailure("Invalid month key", 400, parsedMonth.error.flatten());
    }

    const parsedInit = initializeMonthSchema.safeParse({
      monthKey: parsedMonth.data,
      carryForward,
      duplicatePrevious,
    });

    if (!parsedInit.success) {
      return apiFailure("Invalid dashboard initialization payload", 400, parsedInit.error.flatten());
    }

    await initializeMonthAccounts(session.householdId, parsedInit.data);

    const [accounts, categories, expenses, income, savings, allExpenses, allAccounts] =
      await Promise.all([
        listAccounts(session.householdId, parsedMonth.data),
        listCategories(session.householdId),
        listExpenses(session.householdId, parsedMonth.data),
        listIncome(session.householdId, parsedMonth.data),
        listHiddenSavings(session.householdId, parsedMonth.data),
        listExpenses(session.householdId),
        listAccounts(session.householdId),
      ]);

    return apiSuccess({
      monthKey: parsedMonth.data,
      accounts,
      categories,
      expenses,
      income,
      savings,
      allExpenses,
      allAccounts,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
