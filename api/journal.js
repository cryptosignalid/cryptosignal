// api/journal.js — Trade journal CRUD
import { saveJournalEntry, getJournal, isProActive } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { email } = req.method === 'GET' ? req.query : (req.body || {});
  if (!email) return res.status(400).json({ error: 'email required' });

  const active = await isProActive(email).catch(() => false);
  if (!active) return res.status(403).json({ error: 'Pro required' });

  if (req.method === 'GET') {
    const entries = await getJournal(email);
    return res.json({ entries });
  }

  if (req.method === 'POST') {
    const { entry } = req.body;
    if (!entry) return res.status(400).json({ error: 'entry required' });
    if (!entry.id) entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    if (!entry.date) entry.date = new Date().toISOString();
    const entries = await saveJournalEntry(email, entry);
    return res.json({ ok: true, entries });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
