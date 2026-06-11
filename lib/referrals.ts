import { resolveEnvVar } from "@/lib/d1-binding";

type D1RunResult = { success?: boolean; meta?: { changes?: number } };
type D1BoundStatement = {
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
  run: () => Promise<D1RunResult>;
};
type D1DatabaseLike = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => D1BoundStatement;
    first: <T = Record<string, unknown>>() => Promise<T | null>;
    all: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
    run: () => Promise<D1RunResult>;
  };
};

type ReferralUser = {
  id: string;
  email: string;
  referredByUserId?: string | null;
};

export const REFERRAL_ACTIVE_RECHARGE_CENTS = 5000;

const REFERRAL_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const REFERRAL_CODE_LENGTH = 8;

export function normalizeInviteCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export function generateInviteCode() {
  const bytes = new Uint8Array(REFERRAL_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => REFERRAL_CODE_ALPHABET[byte % REFERRAL_CODE_ALPHABET.length]).join("");
}

export async function createUniqueInviteCode(db: D1DatabaseLike) {
  for (let i = 0; i < 8; i += 1) {
    const code = generateInviteCode();
    const existing = await db.prepare(`SELECT id FROM User WHERE inviteCode = ? LIMIT 1`).bind(code).first();
    if (!existing) return code;
  }
  throw new Error("Unable to generate unique invite code");
}

export function getReferralTier(activeDirectCount: number) {
  if (activeDirectCount >= 100) return { tier: "level1", directRateBps: 2500, indirectRateBps: 1000 };
  if (activeDirectCount >= 50) return { tier: "level2", directRateBps: 1500, indirectRateBps: 500 };
  if (activeDirectCount >= 10) return { tier: "level3", directRateBps: 1000, indirectRateBps: 300 };
  return { tier: "level4", directRateBps: 500, indirectRateBps: 100 };
}

export function getReferralRateBps(activeDirectCount: number, depth: 1 | 2) {
  const tier = getReferralTier(activeDirectCount);
  return {
    tier: tier.tier,
    rateBps: depth === 1 ? tier.directRateBps : tier.indirectRateBps,
  };
}

export function formatReferralRate(rateBps: number) {
  return `${Number((rateBps / 100).toFixed(2))}%`;
}

function amountFromCents(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function platformRechargeEmail() {
  return (resolveEnvVar("PLATFORM_RECHARGE_USER_EMAIL") || "").trim().toLowerCase();
}

async function getUser(db: D1DatabaseLike, id: string) {
  return db.prepare(`SELECT id, email, referredByUserId FROM User WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<ReferralUser>();
}

async function getActiveDirectCount(db: D1DatabaseLike, userId: string) {
  const row = await db.prepare(`
    SELECT COUNT(*) AS c
    FROM User u
    WHERE u.referredByUserId = ?
      AND EXISTS (
        SELECT 1
        FROM RechargeOrder r
        WHERE r.userId = u.id
          AND r.status = 'success'
          AND r.amountCents >= ?
      )
  `).bind(userId, REFERRAL_ACTIVE_RECHARGE_CENTS).first<{ c: number }>();
  return Number(row?.c || 0);
}

async function hasActiveRecharge(db: D1DatabaseLike, userId: string) {
  const row = await db.prepare(`
    SELECT id
    FROM RechargeOrder
    WHERE userId = ?
      AND status = 'success'
      AND amountCents >= ?
    LIMIT 1
  `).bind(userId, REFERRAL_ACTIVE_RECHARGE_CENTS).first<{ id: string }>();
  return Boolean(row);
}

function rewardDescription(depth: 1 | 2, invitedUserId: string, rechargeOrderId: string, rateBps: number) {
  return `邀请奖励入账: ${depth === 1 ? "直推" : "次推"}用户 ${invitedUserId} 充值单 ${rechargeOrderId}, 返佣 ${formatReferralRate(rateBps)}`;
}

export async function buildReferralRewardStatements(
  db: D1DatabaseLike,
  recharge: { id: string; userId: string; amountCents: number },
  nowIso: string,
  options: { requireRechargeNotSuccess?: boolean } = {}
) {
  const invited = await getUser(db, recharge.userId);
  if (!invited?.referredByUserId) return [];

  const platformEmail = platformRechargeEmail();
  if (invited.email.trim().toLowerCase() === platformEmail) return [];

  const beneficiaries: Array<{ user: ReferralUser; depth: 1 | 2 }> = [];
  const direct = await getUser(db, invited.referredByUserId);
  if (direct && direct.id !== invited.id && direct.email.trim().toLowerCase() !== platformEmail) {
    beneficiaries.push({ user: direct, depth: 1 });
    if (direct.referredByUserId && direct.referredByUserId !== direct.id && direct.referredByUserId !== invited.id) {
      const indirect = await getUser(db, direct.referredByUserId);
      if (indirect && indirect.id !== direct.id && indirect.email.trim().toLowerCase() !== platformEmail) {
        beneficiaries.push({ user: indirect, depth: 2 });
      }
    }
  }

  const statements: D1BoundStatement[] = [];
  const rechargeGuardSql = options.requireRechargeNotSuccess
    ? `AND EXISTS (SELECT 1 FROM RechargeOrder WHERE id = ? AND status != 'success')`
    : "";

  for (const beneficiary of beneficiaries) {
    let activeDirectCount = await getActiveDirectCount(db, beneficiary.user.id);
    if (
      options.requireRechargeNotSuccess &&
      beneficiary.depth === 1 &&
      Number(recharge.amountCents) >= REFERRAL_ACTIVE_RECHARGE_CENTS &&
      !(await hasActiveRecharge(db, invited.id))
    ) {
      activeDirectCount += 1;
    }
    const { tier, rateBps } = getReferralRateBps(activeDirectCount, beneficiary.depth);
    const rewardCents = Math.floor((Number(recharge.amountCents) * rateBps) / 10000);
    if (rewardCents <= 0) continue;

    const rewardId = crypto.randomUUID();
    const rewardAmount = amountFromCents(rewardCents);
    const description = rewardDescription(beneficiary.depth, invited.id, recharge.id, rateBps);

    statements.push(
      db.prepare(`
        INSERT INTO ReferralReward (
          id, rechargeOrderId, invitedUserId, beneficiaryUserId, depth, tier,
          rateBps, baseAmountCents, rewardCents, status, createdAt
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?
        WHERE NOT EXISTS (
          SELECT 1 FROM ReferralReward
          WHERE rechargeOrderId = ? AND beneficiaryUserId = ? AND depth = ?
        )
        ${rechargeGuardSql}
      `).bind(
        rewardId,
        recharge.id,
        invited.id,
        beneficiary.user.id,
        beneficiary.depth,
        tier,
        rateBps,
        Number(recharge.amountCents),
        rewardCents,
        nowIso,
        recharge.id,
        beneficiary.user.id,
        beneficiary.depth,
        ...(options.requireRechargeNotSuccess ? [recharge.id] : [])
      ),
      db.prepare(`
        UPDATE User
        SET feeBalance = ROUND(feeBalance + ?, 2), updatedAt = ?
        WHERE id = ?
          AND EXISTS (SELECT 1 FROM ReferralReward WHERE id = ? AND status = 'pending')
      `).bind(rewardAmount, nowIso, beneficiary.user.id, rewardId),
      db.prepare(`
        INSERT INTO BillingRecord (id, type, amount, balance, description, createdAt, userId)
        SELECT ?, 'referral_reward', ?, feeBalance, ?, ?, id
        FROM User
        WHERE id = ?
          AND EXISTS (SELECT 1 FROM ReferralReward WHERE id = ? AND status = 'pending')
      `).bind(crypto.randomUUID(), rewardAmount, description, nowIso, beneficiary.user.id, rewardId),
      db.prepare(`
        UPDATE ReferralReward
        SET status = 'credited', creditedAt = ?
        WHERE id = ? AND status = 'pending'
      `).bind(nowIso, rewardId)
    );
  }

  return statements;
}
