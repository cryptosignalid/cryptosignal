// api/create-payment.js — DOKU Checkout v1
// Signature fixed per official DOKU sample code (PHP/Python reference)

import crypto from 'crypto';
import { savePendingInvoice } from './db.js';

const DOKU_CLIENT_ID  = process.env.DOKU_CLIENT_ID;
const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY;
const DOKU_BASE_URL   = process.env.DOKU_ENV === 'production'
  ? 'https://api.doku.com'
  : 'https://api-sandbox.doku.com';
const SITE_URL = process.env.SITE_URL || 'https://cryptosignal.id';

// DOKU Signature — verified against official PHP + Python sample code
// Digest in component string = raw base64 (NO "SHA-256=" prefix)
// Digest header = raw base64 (NO "SHA-256=" prefix either)
// Component order: Client-Id, Request-Id, Request-Timestamp, Request-Target, Digest
function generateDokuSignature({ secretKey, clientId, requestId, timestamp, requestTarget, bodyString }) {
  // Step 1: SHA-256 hash of body → base64 (this IS the digestValue)
  const digestValue = crypto
    .createHash('sha256')
    .update(bodyString, 'utf8')
    .digest('base64');

  // Step 2: Component string — per DOKU PHP sample:
  // "Client-Id:" + clientId + "\n" + "Request-Id:" + requestId + "\n" +
  // "Request-Timestamp:" + timestamp + "\n" + "Request-Target:" + target + "\n" +
  // "Digest:" + digestValue
  const componentSignature = [
    'Client-Id:'         + clientId,
    'Request-Id:'        + requestId,
    'Request-Timestamp:' + timestamp,
    'Request-Target:'    + requestTarget,
    'Digest:'            + digestValue,
  ].join('\n');

  // Step 3: HMAC-SHA256 of component string using secret key → base64
  const hmacSignature = crypto
    .createHmac('sha256', secretKey)
    .update(componentSignature, 'utf8')
    .digest('base64');

  return {
    signature:   'HMACSHA256=' + hmacSignature,
    digestValue,                              // raw base64, used in Digest header
    componentSignature,                       // for debug logging
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ message: 'Method not allowed' });

  if (!DOKU_CLIENT_ID || !DOKU_SECRET_KEY) {
    console.error('❌ Missing DOKU_CLIENT_ID or DOKU_SECRET_KEY');
    return res.status(500).json({ message: 'Payment gateway not configured — missing env vars' });
  }

  try {
    const { invoiceNumber, amount, planName, customer, tgChatId } = req.body || {};

    if (!invoiceNumber || !amount || !customer?.name || !customer?.email) {
      return res.status(400).json({ message: 'Missing: invoiceNumber, amount, customer.name, customer.email' });
    }

    const requestId     = crypto.randomUUID();
    // DOKU timestamp: UTC, no milliseconds e.g. 2020-08-11T08:45:42Z
    const timestamp     = new Date().toISOString().split('.')[0] + 'Z';
    const requestTarget = '/checkout/v1/payment';

    // Minimal valid DOKU body
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
      payment: {
        payment_due_date: 60,
      },
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

    // Stringify ONCE — same string used for digest + request body
    const bodyString = JSON.stringify(body);

    const { signature, digestValue, componentSignature } = generateDokuSignature({
      secretKey:     DOKU_SECRET_KEY,
      clientId:      DOKU_CLIENT_ID,
      requestId,
      timestamp,
      requestTarget,
      bodyString,
    });

    // Debug log — visible in Vercel Functions tab
    // Save pending invoice to Redis BEFORE calling DOKU
    try {
      await savePendingInvoice(invoiceNumber, customer.email, tgChatId || '', planName || 'pro');
      console.log('Invoice saved to Redis:', invoiceNumber);
    } catch (e) {
      console.error('Redis save failed (non-fatal):', e.message);
    }

    console.log('── DOKU Request ──');
    console.log('URL:', DOKU_BASE_URL + requestTarget);
    console.log('Client-Id:', DOKU_CLIENT_ID);
    console.log('Request-Id:', requestId);
    console.log('Timestamp:', timestamp);
    console.log('Digest:', digestValue);
    console.log('Signature:', signature);
    console.log('Component:\n', componentSignature);
    console.log('Body:', bodyString);

    const response = await fetch(`${DOKU_BASE_URL}${requestTarget}`, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'Client-Id':         DOKU_CLIENT_ID,
        'Request-Id':        requestId,
        'Request-Timestamp': timestamp,
        'Signature':         signature,
        'Digest':            digestValue,   // raw base64, no prefix in header
      },
      body: bodyString,
    });

    const responseText = await response.text();
    console.log('── DOKU Response ──', response.status, responseText);

    let data;
    try { data = JSON.parse(responseText); }
    catch { data = { raw: responseText }; }

    if (!response.ok) {
      const errMsg = Array.isArray(data?.message)
        ? data.message.join(', ')
        : (data?.message || data?.error?.message || 'DOKU error ' + response.status);
      return res.status(response.status).json({
        message: errMsg,
        code:    data?.error?.code || data?.code,
        doku:    data,
      });
    }

    // Also check for DOKU soft errors (200 but message != SUCCESS)
    if (Array.isArray(data?.message) && !data.message.includes('SUCCESS')) {
      return res.status(400).json({
        message: data.message.join(', '),
        doku: data,
      });
    }

    // DOKU wraps response in data.response{}
    const resp = data.response || data;
    const paymentUrl = resp.payment?.url || resp.payment?.token
      ? `https://jokul.doku.com/checkout/link/${resp.payment?.token}`
      : null;

    console.log('Payment URL:', paymentUrl);
    console.log('Full response keys:', Object.keys(data));

    if (!paymentUrl && !resp.payment?.url) {
      // Return full data so frontend can debug
      return res.status(200).json({
        url:     paymentUrl,
        payment: resp.payment,
        order:   resp.order,
        raw:     data,
      });
    }

    return res.status(200).json({
      url:     resp.payment?.url || paymentUrl,
      payment: resp.payment,
      order:   resp.order,
    });

  } catch (err) {
    console.error('create-payment exception:', err.message, err.stack);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
}
