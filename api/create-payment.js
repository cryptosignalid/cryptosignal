// api/create-payment.js — DOKU Checkout (CommonJS)
const crypto = require('crypto');

const DOKU_CLIENT_ID  = process.env.DOKU_CLIENT_ID;
const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY;
const DOKU_BASE_URL   = process.env.DOKU_ENV === 'production'
  ? 'https://api.doku.com'
  : 'https://api-sandbox.doku.com';
const SITE_URL = process.env.SITE_URL || 'https://cryptosignal.id';
const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function redisSet(key, value, exSeconds) {
  if (!KV_URL || !KV_TOKEN) { console.warn('No KV configured'); return; }
  try {
    const path = `set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}${exSeconds ? `/ex/${exSeconds}` : ''}`;
    const res = await fetch(`${KV_URL}/${path}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    if (!res.ok) console.error('Redis SET error:', res.status);
  } catch(e) { console.error('Redis error:', e.message); }
}

function generateDokuSignature({ secretKey, clientId, requestId, timestamp, requestTarget, bodyString }) {
  const digestValue = crypto.createHash('sha256').update(bodyString, 'utf8').digest('base64');
  const componentSignature = [
    'Client-Id:'         + clientId,
    'Request-Id:'        + requestId,
    'Request-Timestamp:' + timestamp,
    'Request-Target:'    + requestTarget,
    'Digest:'            + digestValue,
  ].join('\n');
  const hmacSignature = crypto.createHmac('sha256', secretKey).update(componentSignature, 'utf8').digest('base64');
  return { signature: 'HMACSHA256=' + hmacSignature, digestValue };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  if (!DOKU_CLIENT_ID || !DOKU_SECRET_KEY) {
    return res.status(500).json({ message: 'Payment gateway not configured' });
  }

  try {
    const body = req.body || {};
    const email    = body.email    || body.customer?.email;
    const name     = body.name     || body.customer?.name;
    const phone    = body.phone    || body.customer?.phone || '08000000000';
    const amount   = body.amount   || body.customer?.amount;
    const planName = body.planName || 'CryptoSignal Pro';
    const tgChatId = body.tgChatId || '';
    const invoiceNumber = body.invoiceNumber || `CS-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    if (!amount || !email || !name) {
      return res.status(400).json({
        message: `Missing: ${!amount?'amount ':''} ${!email?'email ':''} ${!name?'name':''}`.trim()
      });
    }

    const requestId     = crypto.randomUUID();
    const timestamp     = new Date().toISOString().split('.')[0] + 'Z';
    const requestTarget = '/checkout/v1/payment';

    const dokuBody = {
      order: {
        amount:              Number(amount),
        invoice_number:      String(invoiceNumber).substring(0, 64),
        currency:            'IDR',
        callback_url:        `${SITE_URL}/pro.html?status=success`,
        callback_url_cancel: `${SITE_URL}/pro.html?status=failed`,
        line_items: [{
          id:       '001',
          name:     String(planName).substring(0, 50),
          price:    Number(amount),
          quantity: 1,
        }],
      },
      payment: { payment_due_date: 60 },
      customer: {
        name:  String(name),
        email: String(email),
        phone: String(phone).replace(/[^0-9]/g, '') || '08000000000',
      },
      additional_info: {
        override_notification_url: 'https://www.gominers.id/api/payment-webhook',
        tg_chat_id: String(tgChatId),
        plan: String(planName),
      },
    };

    const bodyString = JSON.stringify(dokuBody);
    const { signature, digestValue } = generateDokuSignature({
      secretKey: DOKU_SECRET_KEY, clientId: DOKU_CLIENT_ID,
      requestId, timestamp, requestTarget, bodyString,
    });

    await redisSet(`invoice:${invoiceNumber}`, { email, tgChatId, plan: planName }, 7200);

    console.log('Calling DOKU:', DOKU_BASE_URL + requestTarget);

    const dokuRes = await fetch(`${DOKU_BASE_URL}${requestTarget}`, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'Client-Id':         DOKU_CLIENT_ID,
        'Request-Id':        requestId,
        'Request-Timestamp': timestamp,
        'Signature':         signature,
        'Digest':            digestValue,
      },
      body: bodyString,
    });

    const responseText = await dokuRes.text();
    console.log('DOKU status:', dokuRes.status);
    console.log('DOKU response:', responseText.substring(0, 500));

    let data;
    try { data = JSON.parse(responseText); } catch { data = { raw: responseText }; }

    if (!dokuRes.ok) {
      return res.status(dokuRes.status).json({
        message: data?.message || 'DOKU error ' + dokuRes.status,
        doku_response: data,
      });
    }

    const resp = data.response || data;
    const paymentUrl = resp.payment?.url ||
      (resp.payment?.token ? `https://jokul.doku.com/checkout/link/${resp.payment.token}` : null);

    return res.status(200).json({
      url:          paymentUrl,
      payment:      resp.payment,
      order:        resp.order,
      invoiceNumber,
    });

  } catch (err) {
    console.error('create-payment error:', err.message, err.stack);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};
