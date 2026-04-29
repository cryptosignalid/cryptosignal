// create-payment.js — DOKU Checkout (CommonJS for Vercel compatibility)
const crypto = require('crypto');

const DOKU_CLIENT_ID  = process.env.DOKU_CLIENT_ID;
const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY;
const DOKU_BASE_URL   = process.env.DOKU_ENV === 'production'
  ? 'https://api.doku.com'
  : 'https://api-sandbox.doku.com';
const SITE_URL = process.env.SITE_URL || 'https://cryptosignal.id';

// Upstash Redis helper (inline — no import needed)
const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function redisSet(key, value, exSeconds) {
  if (!KV_URL || !KV_TOKEN) throw new Error('Missing KV env vars');
  const args = exSeconds ? [key, JSON.stringify(value), 'EX', exSeconds] : [key, JSON.stringify(value)];
  const res = await fetch(`${KV_URL}/set/${args.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Redis SET failed: ${res.status}`);
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
  if (req.method !== 'POST')   return res.status(405).json({ message: 'Method not allowed' });

  if (!DOKU_CLIENT_ID || !DOKU_SECRET_KEY) {
    console.error('Missing DOKU credentials');
    return res.status(500).json({ message: 'Payment gateway not configured' });
  }

  try {
    const { invoiceNumber, amount, planName, customer, tgChatId } = req.body || {};

    if (!invoiceNumber || !amount || !customer?.name || !customer?.email) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const requestId     = crypto.randomUUID();
    const timestamp     = new Date().toISOString().split('.')[0] + 'Z';
    const requestTarget = '/checkout/v1/payment';

    const body = {
      order: {
        amount:              Number(amount),
        invoice_number:      String(invoiceNumber).substring(0, 64),
        currency:            'IDR',
        callback_url:        `${SITE_URL}/pro.html?status=success`,
        callback_url_cancel: `${SITE_URL}/pro.html?status=failed`,
        line_items: [{
          id:       '001',
          name:     String(planName || 'CryptoSignal Pro').substring(0, 50),
          price:    Number(amount),
          quantity: 1,
        }],
      },
      payment: { payment_due_date: 60 },
      customer: {
        name:  String(customer.name),
        email: String(customer.email),
        phone: String(customer.phone || '08000000000').replace(/[^0-9]/g, ''),
      },
      additional_info: {
        override_notification_url: `${SITE_URL}/api/payment-webhook`,
        tg_chat_id: String(tgChatId || ''),
        plan:       String(planName || 'pro'),
      },
    };

    const bodyString = JSON.stringify(body);
    const { signature, digestValue } = generateDokuSignature({
      secretKey: DOKU_SECRET_KEY, clientId: DOKU_CLIENT_ID,
      requestId, timestamp, requestTarget, bodyString,
    });

    // Save pending invoice to Redis
    try {
      await redisSet(`invoice:${invoiceNumber}`, { email: customer.email, tgChatId: tgChatId || '', plan: planName || 'pro' }, 7200);
      console.log('Invoice saved:', invoiceNumber);
    } catch (e) {
      console.error('Redis save failed (non-fatal):', e.message);
    }

    console.log('DOKU URL:', DOKU_BASE_URL + requestTarget);
    console.log('Client-Id:', DOKU_CLIENT_ID ? 'SET' : 'MISSING');

    const response = await fetch(`${DOKU_BASE_URL}${requestTarget}`, {
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

    const responseText = await response.text();
    console.log('DOKU Response:', response.status, responseText.substring(0, 500));

    let data;
    try { data = JSON.parse(responseText); } catch { data = { raw: responseText }; }

    if (!response.ok) {
      const errMsg = Array.isArray(data?.message) ? data.message.join(', ') : (data?.message || 'DOKU error ' + response.status);
      return res.status(response.status).json({ message: errMsg, doku: data });
    }

    const resp = data.response || data;
    const paymentUrl = resp.payment?.url || (resp.payment?.token ? `https://jokul.doku.com/checkout/link/${resp.payment.token}` : null);

    return res.status(200).json({
      url:     paymentUrl,
      payment: resp.payment,
      order:   resp.order,
    });

  } catch (err) {
    console.error('create-payment error:', err.message);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};
