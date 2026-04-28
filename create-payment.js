// api/create-payment.js
// Vercel Serverless Function — creates a DOKU Checkout payment session
// DOKU requires HMAC-SHA256 signature generated server-side (never expose secret in browser)

import crypto from 'crypto';

const DOKU_CLIENT_ID  = process.env.DOKU_CLIENT_ID;   // Set in Vercel env vars
const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY;  // Set in Vercel env vars
const DOKU_BASE_URL   = process.env.DOKU_ENV === 'production'
  ? 'https://api.doku.com'
  : 'https://api-sandbox.doku.com';

const SITE_URL = process.env.SITE_URL || 'https://cryptosignal.id';

// Generate DOKU HMAC-SHA256 signature
function generateSignature(clientId, requestId, requestTimestamp, requestTarget, secretKey, body='') {
  const digestBody = body
    ? 'SHA-256=' + crypto.createHash('sha256').update(body).digest('base64')
    : '';

  const componentToSign = [
    'Client-Id:' + clientId,
    'Request-Id:' + requestId,
    'Request-Timestamp:' + requestTimestamp,
    'Request-Target:' + requestTarget,
    digestBody ? 'Digest:' + digestBody : '',
  ].filter(Boolean).join('\n');

  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(componentToSign)
    .digest('base64');

  return { signature: 'HMACSHA256=' + signature, digestBody };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', SITE_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const { invoiceNumber, amount, planName, customer, tgChatId } = req.body;

    if (!invoiceNumber || !amount || !customer?.email) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const requestId        = crypto.randomUUID();
    const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'); // UTC, no ms
    const requestTarget    = '/checkout/v1/payment';

    const payload = {
      order: {
        invoice_number: invoiceNumber,
        line_items: [{
          name: planName,
          price: amount,
          quantity: 1,
        }],
        amount: amount,
        currency: 'IDR',
        callback_url: `${SITE_URL}/pro.html?status=success`,
        callback_url_cancel: `${SITE_URL}/pro.html?status=failed`,
      },
      payment: {
        payment_due_date: 60, // 60 minutes to complete payment
      },
      customer: {
        name:  customer.name,
        email: customer.email,
        phone: customer.phone || '08000000000',
      },
      additional_info: {
        override_notification_url: `${SITE_URL}/api/payment-webhook`,
        tg_chat_id: tgChatId || '',
        plan: planName,
      }
    };

    const bodyString = JSON.stringify(payload);
    const { signature, digestBody } = generateSignature(
      DOKU_CLIENT_ID, requestId, requestTimestamp, requestTarget, DOKU_SECRET_KEY, bodyString
    );

    const response = await fetch(`${DOKU_BASE_URL}${requestTarget}`, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'Client-Id':         DOKU_CLIENT_ID,
        'Request-Id':        requestId,
        'Request-Timestamp': requestTimestamp,
        'Signature':         signature,
        'Digest':            digestBody,
      },
      body: bodyString,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('DOKU error:', data);
      return res.status(response.status).json({
        message: data?.message || 'DOKU API error',
        doku: data,
      });
    }

    // Store invoice → tgChatId mapping for webhook activation
    // In production use a DB (Supabase, PlanetScale, Upstash Redis)
    // For now: Vercel KV (add DOKU_KV_URL env var) or just return it
    console.log(`Order created: ${invoiceNumber} | Plan: ${planName} | TG: ${tgChatId}`);

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
