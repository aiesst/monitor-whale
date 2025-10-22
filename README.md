Monitor Whale (API only)

- 地址: `ADDRESS` = 0xb317d2bc2d3d2df5fa441b5bae0ab9d8b07283ae
- 目标: 轮询 Hyperbot 的后端接口, 从 JSON 提取永续持仓变化, 推送到 Telegram。

Quick Start
- 填好 `.env` (已预置 ADDRESS / TELEGRAM_*)
- 依赖: `npm i`
- 发测试消息: `npm run test:telegram`
- 单次拉取(便于测试): `npm run start:once`
- 常驻: `npm start`

Notes
- 如默认 API 返回 500, 请设置 `API_CANDIDATES` 为你网络下可用的完整接口 URL, 多个用逗号分隔。
- 只使用接口数据, 不解析 HTML。
- 如需走本地代理(如 Clash/ClashX 端口 7890):
  - macOS/Linux: `export HTTPS_PROXY=http://127.0.0.1:7890` (或 HTTP_PROXY)
  - Windows PowerShell: `$env:HTTPS_PROXY='http://127.0.0.1:7890'`
  - 然后再运行 `npm run test:telegram` / `npm run start:once`
