import { z } from "zod";

const envSchema = z.object({
  NOTION_API_KEY: z.string().min(1, "NOTION_API_KEY is required"),
  NOTION_PARENT_PAGE_ID: z.string().min(1, "NOTION_PARENT_PAGE_ID is required"),
  AUTH_SECRET: z.string().min(24, "AUTH_SECRET must be at least 24 characters"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse({
  NOTION_API_KEY: process.env.NOTION_API_KEY,
  NOTION_PARENT_PAGE_ID: process.env.NOTION_PARENT_PAGE_ID,
  AUTH_SECRET: process.env.AUTH_SECRET,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsed.data;

export function normalizeNotionId(value: string): string {
  return value.replace(/-/g, "").trim();
}
