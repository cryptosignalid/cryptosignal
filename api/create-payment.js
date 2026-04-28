// api/create-payment.js
// Vercel Serverless Function — DOKU Checkout v1
// Fixed to match exact DOKU API spec from developers.doku.com

import crypto from 'crypto';

const DOKU_CLIENT_ID  = process.env.DOKU_CLIENT_ID;
const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY;
const DOKU_BASE_URL   = process.env.DOKU_ENV === 'production'
  ? 'https://api.doku.com'
  : 'https://api-sandbox.doku.com';
const SITE_URL = process.env.SITE_URL || 'https://cryptosignal.id';

// DOKU HMAC-SHA256 Signature — exact format per developers.doku.com
function generateDokuSignature(secretKey, clientId, requestId, timestamp, requestTarget, bodyString) {
  const bodyHash  = crypto.createHash('sha256').update(bodyString, 'utf8').digest('base64');
  const digest    = 'SHA-256=' + bodyHash;
  const component = [
    'Client-Id:'         + clientId,
    'Request-Id:'        + requestId,
    'Request-Timestamp:' + timestamp,
    'Request-Target:'    + requestTarget,
    'Digest:'            + digest,
  ].join('\n');
  const hmac      = crypto.createHmac('sha256', secretKey).update(component, 'utf8').digest('base64');
  return { signature: 'HMACSHA256=' + hmac, digest };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ message: 'Method not allowed' });

  if (!DOKU_CLIENT_ID || !DOKU_SECRET_KEY) {
    console.error('Missing DOKU env vars');
    return res.status(500).json({ message: 'Payment gateway not configured — missing env vars' });
  }

  try {
    const { invoiceNumber, amount, planName, customer, tgChatId } = req.body;

    if (!invoiceNumber || !amount || !customer?.name || !customer?.email) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString().split('.')[0] + 'Z'; // no ms
    const target    = '/checkout/v1/payment';

    const body = {
      order: {
        amount:              amount,
        invoice_number:      invoiceNumber,
        currency:            'IDR',
        callback_url:        `${SITE_URL}/pro.html?status=success`,
        callback_url_cancel: `${SITE_URL}/pro.html?status=failed`,
        line_items: [{
          id: '001', name: planName || 'CryptoSignal Pro',
          price: amount, quantity: 1,
        }],
      },
      payment: { payment_due_date: 60 },
      customer: {
        name:  customer.name,
        email: customer.email,
        phone: (customer.phone || '08000000000').replace(/[^0-9]/g, ''),
      },
      additional_info: {
        override_notification_url: `${SITE_URL}/api/payment-webhook`,
        tg_chat_id: tgChatId || '',
        plan: planName || 'pro',
      },
    };

    const bodyString = JSON.stringify(body);
    const { signature, digest } = generateDokuSignature(
      DOKU_SECRET_KEY, DOKU_CLIENT_ID, requestId, timestamp, target, bodyString
    );

    console.log('DOKU →', DOKU_BASE_URL + target, '| Invoice:', invoiceNumber, '| Amount:', amount);

    const response = await fetch(`${DOKU_BASE_URL}${target}`, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'Client-Id':         DOKU_CLIENT_ID,
        'Request-Id':        requestId,
        'Request-Timestamp': timestamp,
        'Signature':         signature,
        'Digest':            digest,
      },
      body: bodyString,
    });

    const data = await response.json();
    console.log('DOKU ←', response.status, JSON.stringify(data));

    if (!response.ok) {
      return res.status(response.status).json({
        message: data?.message || data?.error || 'DOKU API error',
        doku: data,
      });
    }

    return res.status(200).json({
      url:     data.payment?.url,
      payment: data.payment,
      order:   data.order,
    });

  } catch (err) {
    console.error('create-payment error:', err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
}
