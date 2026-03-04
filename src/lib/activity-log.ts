import { getSystemConfigPageId, ensureNotionSetup } from "@/lib/notion-setup";
import { notion, withNotionRetry } from "@/lib/notion";
import type { SessionPayload } from "@/lib/types";

const ACTIVITY_PREFIX = "ACTIVITY_LOG::";

type ActivityPayload = {
  timestamp: string;
  actorName: string;
  actorUsername: string;
  action: string;
  entity: string;
  description: string;
  householdId: string;
  monthKey?: string | null;
};

export type ActivityLogRecord = ActivityPayload & {
  id: string;
};

export async function logActivity(args: {
  session: Pick<SessionPayload, "name" | "username" | "householdId">;
  action: string;
  entity: string;
  description: string;
  monthKey?: string | null;
}): Promise<void> {
  await ensureNotionSetup();
  const configPageId = await getSystemConfigPageId();

  const payload: ActivityPayload = {
    timestamp: new Date().toISOString(),
    actorName: args.session.name,
    actorUsername: args.session.username,
    action: args.action,
    entity: args.entity,
    description: args.description,
    householdId: args.session.householdId,
    monthKey: args.monthKey ?? null,
  };

  const marker = `${ACTIVITY_PREFIX}${JSON.stringify(payload)}`;

  await withNotionRetry(() =>
    notion.blocks.children.append({
      block_id: configPageId,
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: marker } }],
          },
        },
      ],
    }),
  );
}

export async function logActivitySafely(args: {
  session: Pick<SessionPayload, "name" | "username" | "householdId">;
  action: string;
  entity: string;
  description: string;
  monthKey?: string | null;
}): Promise<void> {
  try {
    await logActivity(args);
  } catch (error) {
    console.error("Activity log write failed", error);
  }
}

export async function listActivityLogs(
  householdId: string,
  limit = 40,
): Promise<ActivityLogRecord[]> {
  await ensureNotionSetup();
  const configPageId = await getSystemConfigPageId();

  const blocks: Array<{ id: string; text: string }> = [];
  let cursor: string | undefined;

  while (true) {
    const response = await withNotionRetry(() =>
      notion.blocks.children.list({
        block_id: configPageId,
        start_cursor: cursor,
        page_size: 100,
      }),
    );

    response.results.forEach((block) => {
      if (!("type" in block) || block.type !== "paragraph") {
        return;
      }

      const text = block.paragraph.rich_text.map((item) => item.plain_text).join("").trim();
      if (!text.startsWith(ACTIVITY_PREFIX)) {
        return;
      }

      blocks.push({
        id: block.id,
        text,
      });
    });

    if (!response.has_more || !response.next_cursor) {
      break;
    }

    cursor = response.next_cursor;
  }

  const parsed = blocks
    .map((item) => {
      try {
        const payload = JSON.parse(item.text.slice(ACTIVITY_PREFIX.length)) as ActivityPayload;
        if (!payload?.timestamp || !payload.actorUsername || !payload.description) {
          return null;
        }

        return {
          id: item.id,
          ...payload,
        } as ActivityLogRecord;
      } catch {
        return null;
      }
    })
    .filter((item): item is ActivityLogRecord => Boolean(item))
    .filter((item) => item.householdId === householdId)
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, Math.max(1, limit));

  return parsed;
}
