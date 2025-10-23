#!/usr/bin/env node
/*
  Hyperliquid Whale Monitor -> Telegram

  思路:
  - 直接调用 Hyperliquid 官方 API (api-ui.hyperliquid.xyz)，获取持仓信息，检测变化后推送到 Telegram。
  - 支持监控多个钱包地址，每个地址独立追踪状态。

  环境变量:
  - ADDRESSES=0xb317d2bc2d3d2df5fa441b5bae0ab9d8b07283ae,0x... (逗号分隔多个地址)
  - ADDRESS=0xb317d2bc2d3d2df5fa441b5bae0ab9d8b07283ae (单地址，兼容旧配置)
  - TELEGRAM_BOT_TOKEN=xxx
  - TELEGRAM_CHAT_ID=-100xxxxx
  - POLL_SECONDS=30
  - API_URL (可选，默认: https://api-ui.hyperliquid.xyz/info)
*/

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Proxy support (HTTP/HTTPS)
try {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxyUrl) {
    const { setGlobalDispatcher, ProxyAgent } = require('undici');
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    console.log(`[proxy] Using proxy: ${proxyUrl}`);
  }
} catch (_) {}

// 支持多地址配置，支持别名格式：地址:别名
const ADDRESSES_STR = process.env.ADDRESSES || process.env.ADDRESS || '0xb317d2bc2d3d2df5fa441b5bae0ab9d8b07283ae';
const ADDRESSES_WITH_ALIAS = ADDRESSES_STR.split(',').map(s => {
  const parts = s.trim().split(':');
  const address = parts[0].trim().toLowerCase();
  const alias = parts[1] ? parts[1].trim() : null;
  return { address, alias };
}).filter(item => item.address);

const POLL_SECONDS = parseInt(process.env.POLL_SECONDS || '30', 10);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const API_URL = process.env.API_URL || 'https://api-ui.hyperliquid.xyz/info';

// 定时推送配置（分钟）
const REPORT_INTERVAL_MINUTES = parseInt(process.env.REPORT_INTERVAL_MINUTES || '30', 10);

// 追踪上次定时推送时间 Map<address, timestamp>
const lastReportTime = new Map();

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
  process.exit(1);
}

if (!ADDRESSES_WITH_ALIAS.length) {
  console.error('No addresses to monitor. Set ADDRESS or ADDRESSES in .env');
  process.exit(1);
}

console.log(`[config] 监控地址: ${ADDRESSES_WITH_ALIAS.map(a => a.alias ? `${a.alias}(${a.address.slice(0,6)}...)` : a.address).join(', ')}`);
console.log(`[config] API: ${API_URL}`);
console.log(`[config] 轮询间隔: ${POLL_SECONDS}秒`);
console.log(`[config] 定时推送间隔: ${REPORT_INTERVAL_MINUTES}分钟`);

async function sendTelegram(text) {
  const endpoint = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = { chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true };
  const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) { console.error('[telegram] 发送失败', res.status, await res.text()); }
}

// 每个地址独立的状态文件
function getStateFile(address) {
  return path.resolve(__dirname, `.hyperliquid_state_${address.slice(0, 10)}.json`);
}

function loadState(address) {
  try {
    const file = getStateFile(address);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { positions: [] };
  }
}

function saveState(address, s) {
  try {
    const file = getStateFile(address);
    fs.writeFileSync(file, JSON.stringify(s, null, 2));
  } catch (e) {
    console.error(`[state] 保存状态失败 ${address}:`, e.message);
  }
}

function normalizeNumber(v) {
  if (v == null) return null;
  const t = String(v).replace(/[,\s]/g, '').replace(/^\$/, '');
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

function formatNumber(num, decimals = 2) {
  if (num == null) return '-';
  const absNum = Math.abs(num);
  if (absNum >= 1e6) return (num / 1e6).toFixed(decimals) + 'M';
  if (absNum >= 1e3) return (num / 1e3).toFixed(decimals) + 'K';
  return num.toFixed(decimals);
}

function keyOfPosition(p) {
  return `${p.coin}|${p.side}`;
}

// 解析 Hyperliquid clearinghouseState 返回的持仓数据
function parseHyperliquidPositions(data) {
  if (!data || !data.assetPositions) return [];

  return data.assetPositions.map(ap => {
    const pos = ap.position;
    const szi = parseFloat(pos.szi);
    const side = szi < 0 ? 'Short' : 'Long';
    const amount = Math.abs(szi);

    // 解析杠杆
    let leverage = '-';
    if (pos.leverage) {
      if (pos.leverage.type === 'cross') {
        leverage = `${pos.leverage.value}X Cross`;
      } else if (pos.leverage.type === 'isolated') {
        leverage = `${pos.leverage.value}X Isolated`;
      }
    }

    return {
      coin: pos.coin,
      side: side,
      amount: amount,
      entryPrice: parseFloat(pos.entryPx),
      positionValue: parseFloat(pos.positionValue),
      unrealizedPnl: parseFloat(pos.unrealizedPnl),
      roe: parseFloat(pos.returnOnEquity) * 100, // 转换为百分比
      liquidationPrice: parseFloat(pos.liquidationPx),
      leverage: leverage,
      fundingFee: pos.cumFunding?.sinceOpen ? parseFloat(pos.cumFunding.sinceOpen) : null
    };
  });
}

function diffPositions(prev, curr) {
  const prevMap = new Map(prev.map(p => [keyOfPosition(p), p]));
  const currMap = new Map(curr.map(p => [keyOfPosition(p), p]));
  const added = [], removed = [], changed = [];

  for (const [k, p] of currMap) {
    if (!prevMap.has(k)) {
      added.push(p);
    } else {
      const q = prevMap.get(k);
      // 仅比较仓位规模（amount），忽略价格/盈亏等波动
      const fields = ['amount'];
      let mutate = false;
      const changes = {};

      for (const f of fields) {
        const oldVal = q[f] ?? null;
        const newVal = p[f] ?? null;
        if (oldVal !== newVal && Math.abs(oldVal - newVal) > 0.0001) { // 容忍微小差异
          mutate = true;
          changes[f] = { old: oldVal, new: newVal };
        }
      }

      if (mutate) {
        changed.push({ before: q, after: p, changes });
      }
    }
  }

  for (const [k, p] of prevMap) {
    if (!currMap.has(k)) removed.push(p);
  }

  return { added, removed, changed };
}

// 获取指定地址的持仓数据
async function fetchPositions(address) {
  const payload = {
    type: 'clearinghouseState',
    user: address
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`API returned ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return {
    positions: parseHyperliquidPositions(data),
    accountValue: data.marginSummary?.accountValue ? parseFloat(data.marginSummary.accountValue) : null,
    totalPositionValue: data.marginSummary?.totalNtlPos ? parseFloat(data.marginSummary.totalNtlPos) : null
  };
}

// 格式化持仓信息为 Telegram 消息
function formatPosition(p) {
  const pnlSign = p.unrealizedPnl >= 0 ? '+' : '';
  const pnlEmoji = p.unrealizedPnl >= 0 ? '📈' : '📉';

  // 做多/做空高亮显示
  const sideEmoji = p.side === 'Long' ? '🟢' : '🔴';
  const sideText = p.side === 'Long' ? '<b>【做多】</b>' : '<b>【做空】</b>';

  return `${sideEmoji} ${sideText} <b>${p.coin}</b> | ${p.leverage}
━━━━━━━━━━━━━━━━
📊 仓位规模: ${formatNumber(p.amount, 4)} ${p.coin}
💵 仓位价值: $${formatNumber(p.positionValue)}
📍 开仓价格: $${formatNumber(p.entryPrice, 2)}
⚠️  强平价格: $${formatNumber(p.liquidationPrice, 2)}
${pnlEmoji} 当前盈亏: ${pnlSign}$${formatNumber(p.unrealizedPnl)} (${pnlSign}${p.roe.toFixed(2)}%)${p.fundingFee != null ? `\n💸 资金费率: $${formatNumber(p.fundingFee)}` : ''}`;
}

// 生成定时汇报消息（每半小时）
function generateScheduledReport(address, alias, positions, accountValue, totalPositionValue) {
  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const displayName = alias || shortAddr;

  const lines = [`📊 <b>定时监控报告</b> 📊\n`];

  if (alias) {
    lines.push(`🏷️ 名称: <b>${alias}</b>`);
  }
  lines.push(`👤 地址: <code>${shortAddr}</code>`);
  if (accountValue) {
    lines.push(`💰 账户总值: $${formatNumber(accountValue)}`);
    lines.push(`📊 持仓总值: $${formatNumber(totalPositionValue)}`);
  }

  lines.push(`📍 当前持仓: ${positions.length} 个`);
  lines.push('━━━━━━━━━━━━━━━━\n');

  if (positions.length === 0) {
    lines.push('🎯 <b>当前空仓</b>');
  } else {
    lines.push('<b>持仓详情:</b>\n');
    positions.forEach(p => {
      lines.push(formatPosition(p));
      lines.push('');
    });
  }

  lines.push(`⏰ 报告时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`\n<a href="https://www.coinglass.com/hyperliquid/${address}">📈 查看完整持仓详情</a>`);

  return lines.join('\n');
}

// 生成即时变化通知消息
function generateChangeAlert(address, alias, positions, accountValue, totalPositionValue, added, removed, changed) {
  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const isFullyClosed = (positions.length === 0) && removed.length > 0;

  const lines = [`🚨 <b>【即时变化】巨鲸动向监控</b> 🚨\n`];

  if (alias) {
    lines.push(`🏷️ 名称: <b>${alias}</b>`);
  }
  lines.push(`👤 地址: <code>${shortAddr}</code>`);
  if (accountValue) {
    lines.push(`💰 账户总值: $${formatNumber(accountValue)}`);
    lines.push(`📊 持仓总值: $${formatNumber(totalPositionValue)}`);
  }

  lines.push('━━━━━━━━━━━━━━━━');

  // 清仓特殊提示
  if (isFullyClosed) {
    lines.push('');
    lines.push('🎯 <b>【已清仓】所有持仓已平仓</b>');
  }

  lines.push('');

  if (added.length) {
    lines.push(`➕ <b>新开仓位 (${added.length})</b>`);
    added.forEach(p => lines.push(formatPosition(p)));
    lines.push('');
  }

  if (removed.length) {
    lines.push(`✂️ <b>平仓操作 (${removed.length})</b>`);
    removed.forEach(p => {
      const pnlSign = p.unrealizedPnl >= 0 ? '+' : '';
      const pnlEmoji = p.unrealizedPnl >= 0 ? '✅' : '❌';
      const sideEmoji = p.side === 'Long' ? '🟢' : '🔴';
      const sideText = p.side === 'Long' ? '【做多】' : '【做空】';

      lines.push(`${sideEmoji} ${sideText} <b>${p.coin}</b> - 已平仓`);
      lines.push(`${pnlEmoji} 平仓盈亏: ${pnlSign}$${formatNumber(p.unrealizedPnl)} (${pnlSign}${p.roe.toFixed(2)}%)`);
    });
    lines.push('');
  }

  if (changed.length) {
    lines.push(`♻️ <b>仓位变更 (${changed.length})</b>`);
    changed.forEach(c => {
      lines.push(formatPosition(c.after));
      const changeDesc = [];
      if (c.changes.amount) changeDesc.push(`量: ${formatNumber(c.changes.amount.old, 4)}→${formatNumber(c.changes.amount.new, 4)}`);
      if (c.changes.unrealizedPnl) {
        const diff = c.changes.unrealizedPnl.new - c.changes.unrealizedPnl.old;
        changeDesc.push(`盈亏变化: ${diff >= 0 ? '+' : ''}$${formatNumber(diff)}`);
      }
      if (changeDesc.length) lines.push(`  └ ${changeDesc.join(' | ')}`);
    });
    lines.push('');
  }

  // 添加跟单指引
  lines.push('━━━━━━━━━━━━━━━━');
  lines.push('💡 <b>跟单提示:</b>');
  if (isFullyClosed) {
    lines.push('  🎯 巨鲸已全部清仓，观望为主');
  } else {
    if (added.length) {
      const hasLong = added.some(p => p.side === 'Long');
      const hasShort = added.some(p => p.side === 'Short');
      if (hasLong) lines.push('  🟢 检测到新做多仓位，关注入场时机');
      if (hasShort) lines.push('  🔴 检测到新做空仓位，关注入场时机');
    }
    if (removed.length && !isFullyClosed) {
      lines.push('  ✂️ 检测到平仓操作，注意止盈/止损');
    }
  }

  lines.push(`\n<a href="https://www.coinglass.com/hyperliquid/${address}">📈 查看完整持仓详情</a>`);

  return lines.join('\n');
}

// 监控单个地址
async function monitorAddress(address, alias = null) {
  const stateFilePath = getStateFile(address);
  const isFirstRun = !fs.existsSync(stateFilePath);
  const prev = loadState(address);

  try {
    const { positions, accountValue, totalPositionValue } = await fetchPositions(address);
    const { added, removed, changed } = diffPositions(prev.positions || [], positions);

    // 显示名称：优先使用别名，否则使用缩写地址
    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const displayName = alias || shortAddr;

    // 首次运行：以“状态文件是否存在”为准，避免空仓时重复初始化
    if (isFirstRun) {
      saveState(address, { positions, accountValue, totalPositionValue });
      lastReportTime.set(address, Date.now()); // 记录初始化时间

      await sendTelegram(
        `✅ <b>开始监控钱包</b>

${alias ? `🏷️ 名称: <b>${alias}</b>\n` : ''}🏦 地址: <code>${shortAddr}</code>
💵 账户价值: $${formatNumber(accountValue)}
📊 持仓总值: $${formatNumber(totalPositionValue)}
📍 当前持仓: ${positions.length} 个

<a href="https://www.coinglass.com/hyperliquid/${address}">📈 查看详情</a>`
      );
      console.log(`[${displayName}] 初始化完成, ${positions.length} 个持仓`);
      return;
    }

    // 检测是否有变化
    const hasChanges = added.length > 0 || removed.length > 0 || changed.length > 0;

    // 确保有定时报告基准时间（避免程序启动后立刻发送定时报告）
    if (!lastReportTime.has(address)) {
      lastReportTime.set(address, Date.now());
    }

    // 始终保存最新状态（无论是否有变化）
    saveState(address, { positions, accountValue, totalPositionValue });

    // 1. 如果有变化 -> 立即发送即时变化通知
    if (hasChanges) {
      const message = generateChangeAlert(
        address,
        alias,
        positions,
        accountValue,
        totalPositionValue,
        added,
        removed,
        changed
      );
      await sendTelegram(message);
      console.log(`[${displayName}] 🚨 即时变化: +${added.length} -${removed.length} ~${changed.length}`);
    }

    // 2. 检查是否需要发送定时报告
    const now = Date.now();
    const lastReport = lastReportTime.get(address) || 0;
    const minutesSinceLastReport = (now - lastReport) / (1000 * 60);

    if (minutesSinceLastReport >= REPORT_INTERVAL_MINUTES) {
      const reportMessage = generateScheduledReport(
        address,
        alias,
        positions,
        accountValue,
        totalPositionValue
      );
      await sendTelegram(reportMessage);
      lastReportTime.set(address, now);
      console.log(`[${displayName}] 📊 定时报告已发送 (${positions.length}个持仓)`);
    } else if (!hasChanges) {
      // 无变化且不需要定时报告
      const nextReportMinutes = Math.ceil(REPORT_INTERVAL_MINUTES - minutesSinceLastReport);
      console.log(`[${displayName}] 无变化, ${positions.length} 个持仓 (下次报告: ${nextReportMinutes}分钟后)`);
    }

  } catch (e) {
    const displayName = alias || `${address.slice(0, 6)}...${address.slice(-4)}`;
    console.error(`[${displayName}] 监控错误:`, e.message);
  }
}


// 主循环: 监控所有地址
async function loop() {
  console.log(`[${new Date().toLocaleString('zh-CN')}] 开始轮询...`);

  for (const item of ADDRESSES_WITH_ALIAS) {
    await monitorAddress(item.address, item.alias);
    // 地址间稍微延迟，避免API限流
    if (ADDRESSES_WITH_ALIAS.length > 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// Node 18+
if (typeof fetch === 'undefined') {
  global.fetch = (...args) => import('node-fetch').then(({default:f}) => f(...args));
}

(async () => {
  await loop();
  if (process.env.RUN_ONCE === '1') {
    process.exit(0);
  }
  setInterval(loop, POLL_SECONDS * 1000);
})();
