import { Client, isNotionClientError } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDataSourceParameters,
} from "@notionhq/client/build/src/api-endpoints";
import { env } from "@/lib/env";
import { HttpError } from "@/lib/api";

export const notion = new Client({ auth: env.NOTION_API_KEY });
const dataSourceIdCache = new Map<string, string>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withNotionRetry<T>(
  task: () => Promise<T>,
  retries = 3,
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    const isRateLimited =
      (isNotionClientError(error) && error.code === "rate_limited") ||
      (typeof error === "object" &&
        error !== null &&
        "status" in error &&
        Number((error as { status?: number }).status) === 429);

    if (isRateLimited && retries > 0) {
      const backoffMs = (4 - retries) * 600;
      await sleep(backoffMs);
      return withNotionRetry(task, retries - 1);
    }

    if (isNotionClientError(error)) {
      throw new HttpError(
        Number((error as { status?: number }).status ?? 500),
        error.message,
      );
    }

    throw error;
  }
}

export async function queryAllPages(
  params: Omit<
    QueryDataSourceParameters,
    "data_source_id" | "start_cursor" | "page_size"
  > & {
    database_id: string;
  },
): Promise<PageObjectResponse[]> {
  const { database_id, ...queryParams } = params;
  const pages: PageObjectResponse[] = [];
  let startCursor: string | undefined;

  const dataSourceId = await getDataSourceIdByDatabaseId(database_id);

  while (true) {
    const response = await withNotionRetry(() =>
      notion.dataSources.query({
        ...queryParams,
        data_source_id: dataSourceId,
        start_cursor: startCursor,
        page_size: 100,
      }),
    );

    for (const result of response.results) {
      if (result.object === "page" && "properties" in result) {
        pages.push(result as PageObjectResponse);
      }
    }

    if (!response.has_more || !response.next_cursor) {
      break;
    }

    startCursor = response.next_cursor;
  }

  return pages;
}

export async function getDataSourceIdByDatabaseId(
  databaseId: string,
): Promise<string> {
  const cached = dataSourceIdCache.get(databaseId);
  if (cached) {
    return cached;
  }

  const database = await withNotionRetry(() =>
    notion.databases.retrieve({
      database_id: databaseId,
    }),
  );

  const source = "data_sources" in database ? database.data_sources?.[0] : null;
  if (!source?.id) {
    throw new HttpError(500, `No data source found for database ${databaseId}`);
  }

  dataSourceIdCache.set(databaseId, source.id);
  return source.id;
}
