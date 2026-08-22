# 🛡️ TokenGuard - Local AI Token Optimizer & Desktop App

> **The "Creator of Creators" Tool for Global AI Developers.**  
> Cut your LLM API bills (OpenAI, Anthropic, Gemini, DeepSeek) by **50%–90%** and achieve **0ms instant caching** with zero code changes.

---

## 🌟 Key Features

1. **Terminal Log & Stack Trace Cleaner:**
   - Automatically removes ANSI color escape sequences.
   - Collapses repetitive internal `node_modules` and framework stack frames.
   - Filters out progress bars and noisy compiler loops.
2. **Context & Whitespace Minifier:**
   - Normalizes excess blank lines and trailing whitespace in code files.
   - Preserves syntax structure while reducing token count by 20%–40%.
3. **Local Smart Cache (0ms Latency / $0 Cost):**
   - High-speed in-memory & vector cache for repeat queries.
   - Instant replay with zero token expenditure.
4. **Dual Protocol Gateway:**
   - **OpenAI Compatible:** `/v1/chat/completions` (Cursor, VS Code, OpenAI SDK, DeepSeek, Groq, Gemini)
   - **Anthropic Compatible:** `/v1/messages` (Claude Code CLI)
5. **Native Desktop Application & Live Dashboard:**
   - Standalone Desktop App with system tray integration.
   - Real-time savings ticker ($ USD), token reduction counters, and live activity stream.
6. **Zero-Config Auto Environment Setup:**
   - Automatically configures `OPENAI_BASE_URL` and `ANTHROPIC_BASE_URL` system-wide.

---

## 🚀 Quick Start Guide

### 1. Installation
```bash
# Clone repository
git clone https://github.com/jingjooo9999-gif/TESTTOKENOPTIMIZER.git
cd TESTTOKENOPTIMIZER

# Install dependencies
npm install
```

### 2. Run Desktop App / Local Proxy
```bash
# Run local proxy server
npm start

# Run Desktop App Window
npm run desktop
```

### 3. Connect Your AI Tools

#### Claude Code CLI:
```bash
# Windows (PowerShell)
$env:ANTHROPIC_BASE_URL="http://localhost:8080"
claude

# macOS / Linux
export ANTHROPIC_BASE_URL="http://localhost:8080"
claude
```

#### Cursor / Antigravity / Cline IDE:
* **Base URL:** `http://localhost:8080/v1`
* **API Key:** `(Your standard API key or any string in demo mode)`

#### Python / Node.js OpenAI SDK:
```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8080/v1")
```

---

## 📊 Live Dashboard

Access the interactive dashboard at:
👉 **`http://localhost:8080/dashboard`**

* Real-time money saved tracker
* Live request inspector
* Interactive optimization toggles
* Built-in simulation trigger (`⚡ Simulate Request`)

---

## 🛠️ Project Structure

```
.
├── src/
│   ├── index.ts                # Server entrypoint & banner
│   ├── server.ts               # Express API proxy & SSE stream
│   ├── optimizer/
│   │   ├── logCleaner.ts       # Log & stack trace cleaner
│   │   ├── promptMinifier.ts   # Whitespace & context minifier
│   │   ├── cacheManager.ts     # Local high-speed cache
│   │   └── tokenCalculator.ts  # Token & USD cost estimation
│   ├── proxy/
│   │   ├── openaiHandler.ts    # OpenAI protocol handler
│   │   └── anthropicHandler.ts # Anthropic protocol handler
│   ├── state/
│   │   └── statsStore.ts       # In-memory stats & live events
│   └── public/                 # Modern Tailwind CSS Web Dashboard
├── electron/                   # Desktop App & System Tray integration
├── scripts/
│   ├── simulate-traffic.js     # 5-stage benchmark simulator
│   └── test-ide-agent.js       # Antigravity IDE agent simulator
└── package.json
```

---

## 📄 License
MIT License. Built for developers worldwide.
