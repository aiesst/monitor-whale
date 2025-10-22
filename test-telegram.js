#!/usr/bin/env node
const fetchImpl = (typeof fetch === 'undefined')
  ? (...args) => import('node-fetch').then(({default:f}) => f(...args))
  : fetch;
require('dotenv').config();

// Proxy support via undici
try {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxyUrl) {
    const { setGlobalDispatcher, ProxyAgent } = require('undici');
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    console.log(`[proxy] Using proxy: ${proxyUrl}`);
  }
} catch (_) {}

const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env');
  process.exit(1);
}

async function main() {
  const endpoint = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const text = `🔔 Telegram 测试消息\n时间: ${new Date().toISOString()}`;
  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, disable_web_page_preview: true })
  });
  const t = await res.text();
  if (!res.ok) {
    console.error('Telegram API error:', res.status, t);
    process.exit(2);
  }
  console.log('OK:', t.slice(0, 200));
}

main().catch(e => { console.error(e); process.exit(1); });
