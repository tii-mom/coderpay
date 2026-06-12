export const runtime = "edge";
import { NextRequest } from "next/server";
import { requireAdminUser, adminJson } from "@/lib/admin-auth";
import { getAuthD1, runAuthAtomic } from "@/lib/auth-d1";

const GLOBAL_NOTICE_ID = "global";
const VALID_LEVELS = new Set(["info", "warning", "critical", "success"]);

type NoticeRow = {
  id: string;
  title: string;
  content: string;
  level: string;
  enabled: number | boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

function normalizeNotice(row: NoticeRow | null) {
  if (!row) {
    return {
      id: GLOBAL_NOTICE_ID,
      title: "",
      content: "",
      level: "info",
      enabled: false,
      startsAt: null,
      endsAt: null,
      updatedAt: null,
    };
  }
  return {
    ...row,
    enabled: row.enabled === true || Number(row.enabled) === 1,
  };
}

function parseOptionalDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

async function readNotice(db = getAuthD1()) {
  return db
    .prepare(`SELECT * FROM SystemNotice WHERE id = ? LIMIT 1`)
    .bind(GLOBAL_NOTICE_ID)
    .first<NoticeRow>();
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser(req);
    if (admin instanceof Response) return admin;

    const notice = await readNotice();
    return adminJson({ notice: normalizeNotice(notice) });
  } catch (err) {
    console.error("Admin system notice GET failed:", err);
    return adminJson({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdminUser(req);
    if (admin instanceof Response) return admin;

    const body = await req.json().catch(() => ({}));
    const title = String(body.title ?? "").trim();
    const content = String(body.content ?? "").trim();
    const level = String(body.level ?? "info").trim();
    const enabled = Boolean(body.enabled);
    const startsAt = parseOptionalDate(body.startsAt);
    const endsAt = parseOptionalDate(body.endsAt);

    if (!VALID_LEVELS.has(level)) {
      return adminJson({ error: "通知级别无效" }, { status: 400 });
    }
    if (title.length > 80) {
      return adminJson({ error: "标题最多 80 个字符" }, { status: 400 });
    }
    if (content.length > 500) {
      return adminJson({ error: "内容最多 500 个字符" }, { status: 400 });
    }
    if (enabled && (!title || !content)) {
      return adminJson({ error: "启用通知时必须填写标题和内容" }, { status: 400 });
    }
    if (startsAt === undefined || endsAt === undefined) {
      return adminJson({ error: "生效时间格式无效" }, { status: 400 });
    }
    if (startsAt && endsAt && new Date(startsAt).getTime() >= new Date(endsAt).getTime()) {
      return adminJson({ error: "结束时间必须晚于开始时间" }, { status: 400 });
    }

    const db = getAuthD1();
    const before = await readNotice(db);
    const now = new Date().toISOString();
    const next = {
      id: GLOBAL_NOTICE_ID,
      title,
      content,
      level,
      enabled,
      startsAt,
      endsAt,
      updatedAt: now,
    };

    await runAuthAtomic(db, [
      db
        .prepare(
          `INSERT INTO SystemNotice (
             id, title, content, level, enabled, startsAt, endsAt, createdBy, updatedBy, createdAt, updatedAt
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title,
             content = excluded.content,
             level = excluded.level,
             enabled = excluded.enabled,
             startsAt = excluded.startsAt,
             endsAt = excluded.endsAt,
             updatedBy = excluded.updatedBy,
             updatedAt = excluded.updatedAt`
        )
        .bind(
          GLOBAL_NOTICE_ID,
          title,
          content,
          level,
          enabled ? 1 : 0,
          startsAt,
          endsAt,
          admin.email,
          admin.email,
          now,
          now
        ),
      db
        .prepare(
          `INSERT INTO AdminAuditLog (id, adminEmail, action, targetType, targetId, beforeJson, afterJson, reason, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          admin.email,
          "system_notice_update",
          "SystemNotice",
          GLOBAL_NOTICE_ID,
          before ? JSON.stringify(normalizeNotice(before)) : null,
          JSON.stringify(next),
          enabled ? "启用或更新开发者顶部通知栏" : "关闭或更新开发者顶部通知栏",
          now
        ),
    ]);

    return adminJson({ notice: next });
  } catch (err) {
    console.error("Admin system notice PUT failed:", err);
    return adminJson({ error: "Internal server error" }, { status: 500 });
  }
}
