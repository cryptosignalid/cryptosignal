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

  // Log env state (no secrets)
  console.log('ENV CHECK - DOKU_CLIENT_ID:', DOKU_CLIENT_ID ? `SET (${DOKU_CLIENT_ID.length} chars)` : 'MISSING');
  console.log('ENV CHECK - DOKU_SECRET_KEY:', DOKU_SECRET_KEY ? `SET (${DOKU_SECRET_KEY.length} chars)` : 'MISSING');
  console.log('ENV CHECK - DOKU_ENV:', process.env.DOKU_ENV);
  console.log('ENV CHECK - DOKU_BASE_URL:', DOKU_BASE_URL);
  console.log('BODY received:', JSON.stringify(req.body));

  if (!DOKU_CLIENT_ID || !DOKU_SECRET_KEY) {
    return res.status(500).json({ message: 'Payment gateway not configured — missing DOKU credentials' });
  }

  try {
    const body = req.body || {};
    const { invoiceNumber, amount, planName, customer, tgChatId } = body;

    console.log('Fields - invoiceNumber:', invoiceNumber, 'amount:', amount, 'customer:', JSON.stringify(customer));

    if (!invoiceNumber || !amount || !customer?.name || !customer?.email) {
      return res.status(400).json({
        message: `Missing fields: ${!invoiceNumber?'invoiceNumber ':''} ${!amount?'amount ':''} ${!customer?.name?'customer.name ':''} ${!customer?.email?'customer.email':''}`.trim(),
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
          id: '001',
          name: String(planName || 'CryptoSignal Pro').substring(0, 50),
          price: Number(amount),
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
        plan: String(planName || 'pro'),
      },
    };

    const bodyString = JSON.stringify(dokuBody);
    const { signature, digestValue } = generateDokuSignature({
      secretKey: DOKU_SECRET_KEY,
      clientId: DOKU_CLIENT_ID,
      requestId, timestamp, requestTarget, bodyString,
    });

    // Save to Redis (non-fatal)
    await redisSet(`invoice:${invoiceNumber}`, {
      email: customer.email, tgChatId: tgChatId || '', plan: planName || 'pro'
    }, 7200);

    console.log('Calling DOKU:', DOKU_BASE_URL + requestTarget);
    console.log('Client-Id:', DOKU_CLIENT_ID);
    console.log('Timestamp:', timestamp);
    console.log('Signature:', signature.substring(0, 30) + '...');

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
    console.log('DOKU response:', responseText);

    let data;
    try { data = JSON.parse(responseText); } catch { data = { raw: responseText }; }

    if (!dokuRes.ok) {
      // Return FULL DOKU error so we can debug
      return res.status(dokuRes.status).json({
        message: data?.message || 'DOKU error ' + dokuRes.status,
        doku_status: dokuRes.status,
        doku_response: data,
      });
    }

    const resp = data.response || data;
    const paymentUrl = resp.payment?.url ||
      (resp.payment?.token ? `https://jokul.doku.com/checkout/link/${resp.payment.token}` : null);

    console.log('Payment URL:', paymentUrl);

    return res.status(200).json({
      url: paymentUrl,
      payment: resp.payment,
      order: resp.order,
    });

  } catch (err) {
    console.error('create-payment exception:', err.message, err.stack);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};
