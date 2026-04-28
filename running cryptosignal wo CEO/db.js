// api/db.js — Upstash Redis helper (shared by all API functions)
// Uses REST API so works in Vercel serverless without TCP connections

const UPSTASH_URL   = process.env.KV_REST_API_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;

async function redis(command, ...args) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    throw new Error('Missing KV_REST_API_URL or KV_REST_API_TOKEN env vars');
  }
  const res = await fetch(`${UPSTASH_URL}/${[command, ...args.map(a =>
    typeof a === 'object' ? JSON.stringify(a) : String(a)
  )].join('/')}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Redis ${command} failed: ${res.status}`);
  const { result } = await res.json();
  return result;
}

// ── Subscriber schema ──
// Key: sub:{email}  →  JSON string of subscriber object
// Key: chatids      →  Redis SET of all active chatIds (for broadcast)
// Key: invoice:{invoiceNumber} → email (for webhook lookup)

export async function savePendingInvoice(invoiceNumber, email, tgChatId, plan) {
  // Store invoice → email mapping (expires in 2 hours)
  await redis('SET', `invoice:${invoiceNumber}`, JSON.stringify({ email, tgChatId, plan }), 'EX', 7200);
}

export async function activateSubscriber({ email, tgChatId, plan, invoiceNumber }) {
  const sub = {
    email,
    tgChatId: tgChatId || '',
    plan,
    invoiceNumber,
    activatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    status: 'active',
  };
  // Save subscriber
  await redis('SET', `sub:${email.toLowerCase()}`, JSON.stringify(sub));
  // Add chatId to broadcast set if provided
  if (tgChatId) await redis('SADD', 'chatids', tgChatId);
  return sub;
}

export async function getSubscriber(email) {
  const raw = await redis('GET', `sub:${email.toLowerCase()}`);
  return raw ? JSON.parse(raw) : null;
}

export async function getInvoice(invoiceNumber) {
  const raw = await redis('GET', `invoice:${invoiceNumber}`);
  return raw ? JSON.parse(raw) : null;
}

export async function getAllChatIds() {
  // Returns array of all active Pro subscriber chat IDs
  return await redis('SMEMBERS', 'chatids') || [];
}

export async function updateSubscriberChatId(email, tgChatId) {
  const sub = await getSubscriber(email);
  if (!sub) return null;
  const updated = { ...sub, tgChatId };
  await redis('SET', `sub:${email.toLowerCase()}`, JSON.stringify(updated));
  if (tgChatId) await redis('SADD', 'chatids', tgChatId);
  return updated;
}

export async function isProActive(email) {
  const sub = await getSubscriber(email);
  if (!sub || sub.status !== 'active') return false;
  // Check not expired
  if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) return false;
  return true;
}
