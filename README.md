# TG Bot to Kaggle

A Telegram Mini App dashboard to view and trigger your Kaggle notebooks with one tap — deployable anywhere via Docker.

## Features
- 📓 Lists all your Kaggle notebooks
- ▶️ Trigger notebook runs with one tap
- 📊 Live run status (running / complete / error)
- 🤖 Telegram bot with inline button to open the Mini App
- 🐳 Single Docker image — runs on any server, Colab, or Hugging Face

---

## 1-tap Deploy Options

### 🐳 Docker (any server, VPS, Railway, Render, Fly.io)

```bash
# 1. Clone
git clone https://github.com/shan-test-project/tg-bot-to-kaggle.git
cd tg-bot-to-kaggle

# 2. Configure
cp .env.example .env
# Edit .env with your values

# 3. Run (one command!)
docker compose up -d
```

App runs at `http://localhost:8080`

### 🔬 Google Colab (free GPU, no server needed)

1. Open [`deploy/colab_deploy.ipynb`](deploy/colab_deploy.ipynb) in Colab
2. Fill in your secrets in Cell 1
3. Click **Runtime → Run all** — done in ~2 minutes!

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/shan-test-project/tg-bot-to-kaggle/blob/main/deploy/colab_deploy.ipynb)

### 🤗 Hugging Face Spaces (free hosting)

```bash
pip install huggingface_hub
python deploy/huggingface/hf_deploy.py
```

Then set these Secrets in your Space settings:
`KAGGLE_USERNAME`, `KAGGLE_KEY`, `TELEGRAM_BOT_TOKEN`, `SESSION_SECRET`

See [`deploy/huggingface/README.md`](deploy/huggingface/README.md) for full instructions.

---

## Environment Variables

| Variable | Description |
|---|---|
| `KAGGLE_USERNAME` | Your Kaggle username |
| `KAGGLE_KEY` | Your Kaggle API key (from kaggle.com → Settings → API) |
| `TELEGRAM_BOT_TOKEN` | From [@BotFather](https://t.me/BotFather) |
| `SESSION_SECRET` | Any random 32+ character string |
| `PORT` | Server port (default: `8080`) |

---

## Register Telegram Webhook

After deploy, run once:
```bash
curl -X POST https://YOUR_DOMAIN/api/telegram/setup
```

---

## Local Development

```bash
# Install
npm install -g pnpm
pnpm install

# Run API server
pnpm --filter @workspace/api-server run dev

# Run dashboard (in another terminal)
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/kaggle-dashboard run dev
```

---

## Stack
- **Frontend**: React 19 + Vite + Tailwind CSS v4
- **Backend**: Express 5 + TypeScript
- **API**: Kaggle REST API v1
- **Bot**: Telegram Bot API + Mini App
- **Container**: Node 24 Alpine Docker image
