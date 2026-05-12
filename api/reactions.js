// api/reactions.js — Signal community reactions (bull/bear/noise votes)
import { addReaction, getReactions } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { signalId } = req.query;
    if (!signalId) return res.status(400).json({ error: 'signalId required' });
    const reactions = await getReactions(signalId);
    return res.json(reactions);
  }

  if (req.method === 'POST') {
    const { signalId, reaction } = req.body || {};
    if (!signalId || !reaction) return res.status(400).json({ error: 'signalId + reaction required' });
    if (!['bull','bear','noise'].includes(reaction)) return res.status(400).json({ error: 'Invalid reaction' });
    const reactions = await addReaction(signalId, reaction);
    return res.json({ ok: true, reactions });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
