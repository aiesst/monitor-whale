# 🐋 Hyperliquid 巨鲸监控

实时监控 Hyperliquid 链上巨鲸地址的持仓变化，自动推送 Telegram 通知。基于官方 API，无需解析网页。

## ✨ 主要功能

- 🔍 **实时监控**：轮询 Hyperliquid API，检测持仓变化
- 📊 **多维度追踪**：监控开仓、平仓、加仓、减仓等操作
- 🏷️ **地址别名**：为监控地址设置易记的别名（如"特朗普的小儿子"）
- 📱 **Telegram 推送**：变化时立即推送格式化消息
- 🟢🔴 **做多/做空标识**：清晰展示交易方向，方便跟单
- 🎯 **清仓提醒**：巨鲸清仓时特别提示
- 🔄 **多地址支持**：同时监控多个钱包地址

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# Telegram Bot 配置
TELEGRAM_BOT_TOKEN=你的_bot_token
TELEGRAM_CHAT_ID=你的_chat_id

# 监控地址（支持别名，格式：地址:别名）
ADDRESS=0xb317d2bc2d3d2df5fa441b5bae0ab9d8b07283ae:特朗普的小儿子

# 或监控多个地址（用逗号分隔）
# ADDRESSES=地址1:别名1,地址2:别名2,地址3:别名3

# 轮询间隔（秒）
POLL_SECONDS=30
```

### 3. 测试连接

```bash
# 测试 Telegram 连接
npm run test:telegram

# 测试 API 连接
npm run debug:api

# 单次监控测试（执行一次后退出）
npm run start:once
```

### 4. 启动监控

```bash
# 持续监控
npm start
```

## 📋 配置说明

### 地址别名功能

支持三种配置格式：

**格式1：单地址无别名**
```env
ADDRESS=0xb317d2bc2d3d2df5fa441b5bae0ab9d8b07283ae
```

**格式2：单地址带别名（推荐）**
```env
ADDRESS=0xb317d2bc2d3d2df5fa441b5bae0ab9d8b07283ae:特朗普的小儿子
```

**格式3：多地址带别名**
```env
ADDRESSES=0xb317d2bc2d3d2df5fa441b5bae0ab9d8b07283ae:特朗普的小儿子,0x5d2f4460ac3514ada79f5d9838916e508ab39bb7:巨鲸玩家
```

### 代理配置（如需翻墙）

如果你的网络需要代理访问 Hyperliquid API（如使用 Clash）：

**macOS/Linux:**
```bash
export HTTPS_PROXY=http://127.0.0.1:7890
npm start
```

**Windows PowerShell:**
```powershell
$env:HTTPS_PROXY='http://127.0.0.1:7890'
npm start
```

或在 `.env` 中配置：
```env
HTTPS_PROXY=http://127.0.0.1:7890
```

## 📱 通知消息格式

### 新开仓通知
```
🚨 巨鲸动向监控 🚨

🏷️ 名称: 特朗普的小儿子
👤 地址: 0xb317...83ae
💰 账户总值: $500K
📊 持仓总值: $300K
━━━━━━━━━━━━━━━━

➕ 新开仓位 (1)

🟢 【做多】 BTC | 10X Isolated
━━━━━━━━━━━━━━━━
📊 仓位规模: 5.0 BTC
💵 仓位价值: $200K
📍 开仓价格: $40,000
⚠️  强平价格: $36,000
📈 当前盈亏: +$5.2K (+2.6%)

━━━━━━━━━━━━━━━━
💡 跟单提示:
  🟢 检测到新做多仓位，关注入场时机

📈 查看完整持仓详情
```

### 平仓通知
```
✂️ 平仓操作 (1)

🔴 【做空】 ETH - 已平仓
✅ 平仓盈亏: +$3.2K (+15.3%)
```

### 清仓通知
```
🎯 【已清仓】所有持仓已平仓

━━━━━━━━━━━━━━━━
💡 跟单提示:
  🎯 巨鲸已全部清仓，观望为主
```

## 🛠️ 命令说明

| 命令 | 说明 |
|------|------|
| `npm start` | 启动持续监控 |
| `npm run start:once` | 单次监控（测试用） |
| `npm run test:telegram` | 测试 Telegram 连接 |
| `npm run debug:api` | 测试 API 连接并显示返回数据 |

## 📂 项目结构

```
monitor-whale-api/
├── monitor-whale-api.js    # 主程序
├── test-telegram.js         # Telegram 测试工具
├── debug-api.js             # API 调试工具
├── package.json
├── .env                     # 配置文件（需自行创建）
├── .env.example             # 配置示例
├── .gitignore
├── CLAUDE.md                # Claude Code 项目说明
└── README.md
```

## 🔧 技术栈

- **Node.js 18+**：原生 `fetch` 支持
- **Hyperliquid API**：官方链上数据接口
- **Telegram Bot API**：消息推送
- **undici**：代理支持

## 📊 监控状态文件

程序会自动生成状态文件来追踪持仓变化：
```
.hyperliquid_state_0xb317d2bc2.json
```

这些文件会自动管理，无需手动编辑。已添加到 `.gitignore` 中。

## 🎯 适用场景

- 📈 **跟单参考**：实时了解巨鲸操作方向
- 🔍 **市场观察**：研究大户交易策略
- ⚠️ **风险提示**：巨鲸清仓时及时预警
- 📚 **交易学习**：分析成功交易者的操作

## ⚙️ 高级配置

### 自定义轮询间隔
```env
POLL_SECONDS=60  # 60秒轮询一次
```

### 自定义 API 端点（一般无需修改）
```env
API_URL=https://api-ui.hyperliquid.xyz/info
```

## 🐛 故障排查

### API 连接失败
- 检查网络连接
- 尝试配置代理
- 运行 `npm run debug:api` 查看详细错误

### Telegram 推送失败
- 检查 `TELEGRAM_BOT_TOKEN` 是否正确
- 检查 `TELEGRAM_CHAT_ID` 是否正确
- 运行 `npm run test:telegram` 测试连接

### 监控无变化
- 正常情况，说明巨鲸持仓未变化
- 控制台会显示 `[地址/别名] 无变化, X 个持仓`

## 📝 注意事项

- ⚡ 建议轮询间隔不小于 30 秒，避免 API 限流
- 🔒 `.env` 文件包含敏感信息，不要提交到 Git
- 💾 状态文件用于对比变化，不要删除
- 🌐 监控多个地址时会自动延迟，避免频繁请求

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

⚠️ **免责声明**：本工具仅供学习和研究使用，不构成任何投资建议。加密货币交易有风险，请谨慎决策。
