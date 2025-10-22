# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js monitoring service that polls the Hyperbot trader API to detect changes in perpetual futures positions for a specific wallet address and pushes notifications to Telegram. The project is API-only (no DOM/HTML parsing) and designed to run as a continuous monitoring service.

**Key characteristics:**
- Single-purpose CLI tool with no web framework
- Uses Node.js built-in `fetch` (Node 18+) with fallback to `node-fetch`
- Stores state in JSON files to track position changes between polls
- Supports HTTP/HTTPS proxy via `undici` ProxyAgent
- All output in Chinese (monitoring messages, comments)

## Commands

### Development & Testing
```bash
# Install dependencies
npm i

# Test Telegram connectivity (sends test message)
npm run test:telegram

# Single fetch cycle (useful for debugging, exits after one poll)
npm run start:once

# Debug API endpoints (tests connectivity and shows JSON structure)
npm run debug:api

# Start continuous monitoring (polls every POLL_SECONDS)
npm start
```

### Proxy Setup (if needed)
For networks requiring proxy (e.g., Clash on port 7890):
```bash
# macOS/Linux
export HTTPS_PROXY=http://127.0.0.1:7890
npm run test:telegram

# Windows PowerShell
$env:HTTPS_PROXY='http://127.0.0.1:7890'
npm run test:telegram
```

## Architecture

### Core Files
- **monitor-whale-api.js** (main): Continuous polling loop, position diffing, Telegram notifications
- **test-telegram.js**: Standalone Telegram connectivity test
- **debug-api.js**: API endpoint diagnostic tool
- **package.json**: Defines npm scripts and minimal dependencies (`dotenv`, `undici`)

### Configuration
All configuration via `.env`:
- `ADDRESS`: Wallet address to monitor (default: 0xb317d2bc2d3d2df5fa441b5bae0ab9d8b07283ae)
- `TELEGRAM_BOT_TOKEN`: Telegram bot API token
- `TELEGRAM_CHAT_ID`: Target chat/channel ID
- `POLL_SECONDS`: Polling interval (default: 30)
- `API_CANDIDATES`: (optional) Comma-separated full API URLs if defaults fail
- `HTTPS_PROXY` / `HTTP_PROXY`: (optional) Proxy URL for fetch requests

### State Management
- State stored in `.hyperbot_api_state_{ADDRESS_PREFIX}.json`
- Contains `positions` array with previous poll results
- Used for diffing to detect added/removed/changed positions

### Position Detection Algorithm

The main logic flow in `monitor-whale-api.js`:

1. **API Polling** (`fetchFromCandidates`): Tries multiple API endpoints in sequence until one succeeds
   - Default candidates: `/api/trader/detail` and `/api/trader/positions`
   - Custom candidates via `API_CANDIDATES` env var

2. **Position Extraction** (`flattenPositions`): Recursively searches JSON for position-like objects
   - Looks for objects with `symbol/coin/asset` + `side/direction` + price fields
   - Normalizes field names across different API response structures
   - Extracts: symbol, side, positionValue, amount, openingPrice, markPrice, liqPrice, leverage, uPnL

3. **Change Detection** (`diffPositions`): Compares current vs previous positions
   - Keys positions by `${symbol}|${side}|${leverage}`
   - Detects: added positions, removed positions, field changes in existing positions

4. **Notification**: Sends formatted Telegram message with changes
   - Initial run: confirmation message with position count
   - Subsequent runs: detailed change breakdown with ➕/➖/♻️ indicators

### Helper Utilities
- `normalizeNumber()`: Cleans currency strings ($1,234.56 → 1234.56)
- `keyOfPosition()`: Generates unique key for position comparison
- `sendTelegram()`: Posts HTML-formatted messages to Telegram

## Development Notes

### Adding New API Endpoints
When Hyperbot changes their API structure:
1. Add new URL to `defaultCandidates` array in `monitor-whale-api.js:43-46`
2. Test with `npm run debug:api` to verify JSON structure
3. If field names differ, extend `flattenPositions` pattern matching (lines 89-101)

### Modifying Position Fields
To track additional position fields:
1. Add extraction in `flattenPositions` (monitor-whale-api.js:95-101)
2. Include in `row` object construction (line 103)
3. Add field name to comparison in `diffPositions` (line 122)
4. Update `fmt` function for display (line 165)

### Proxy Configuration
Proxy is set via `undici` ProxyAgent at startup (monitor-whale-api.js:23-31). The same pattern is replicated in `test-telegram.js` and `debug-api.js` for consistency.

### Node.js Version Compatibility
- Primary target: Node 18+ (native `fetch`)
- Fallback: Dynamic import of `node-fetch` for older versions (lines 178-180)
- External dependencies: `dotenv` (config), `undici` (proxy support)
