#!/usr/bin/env node
const fs = require('fs');
require('dotenv').config();

// Proxy support
try {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxyUrl) {
    const { setGlobalDispatcher, ProxyAgent } = require('undici');
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    console.log(`[proxy] Using proxy: ${proxyUrl}`);
  }
} catch (_) {}

const ADDRESS = (process.env.ADDRESS || '').trim();
const defaults = ADDRESS ? [
  `https://hyperbot.network/api/trader/detail?address=${ADDRESS}`,
  `https://hyperbot.network/api/trader/positions?address=${ADDRESS}`,
] : [];

const argCandidates = process.argv.slice(2);
const envCandidates = (process.env.API_CANDIDATES || '').split(',').map(s=>s.trim()).filter(Boolean);
const candidates = [...argCandidates, ...envCandidates, ...defaults].filter(Boolean);

if (!candidates.length) {
  console.error('Usage: node debug-api.js <full_api_url> [more_urls...]\nOr set ADDRESS/.env API_CANDIDATES');
  process.exit(1);
}

function summarizeJson(json) {
  try {
    const str = JSON.stringify(json);
    return str.length > 400 ? str.slice(0, 400) + ' …' : str;
  } catch { return '[unserializable json]'; }
}

async function main() {
  for (const url of candidates) {
    try {
      console.log(`\n== Try: ${url}`);
      const res = await fetch(url, { headers: { 'accept': 'application/json,*/*;q=0.8' } });
      const ct = res.headers.get('content-type') || '';
      console.log('Status:', res.status, ct);
      const body = ct.includes('json') ? await res.json() : await res.text();
      if (ct.includes('json')) {
        console.log('JSON preview:', summarizeJson(body));
      } else {
        console.log('Text preview:', String(body).slice(0, 400));
      }
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
}

// Node 18+ fetch fallback
if (typeof fetch === 'undefined') {
  global.fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });

