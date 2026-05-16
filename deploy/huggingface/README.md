---
title: TG Bot to Kaggle
emoji: 🤖
colorFrom: purple
colorTo: indigo
sdk: docker
pinned: false
app_port: 8080
---

# Kaggle Notebook Dashboard — HuggingFace Spaces Deploy

## Deploy in 3 steps

### Step 1 — Create a Space
1. Go to [huggingface.co/new-space](https://huggingface.co/new-space)
2. Name it `tg-bot-to-kaggle`, choose **Docker** SDK

### Step 2 — Push the code
```bash
pip install huggingface_hub
python deploy/huggingface/hf_deploy.py
```
The script will ask for your HF username and token, then push automatically.

### Step 3 — Set secrets in HF Space settings
Go to your Space → **Settings → Variables and Secrets**, add:

| Secret | Value |
|--------|-------|
| `KAGGLE_USERNAME` | your kaggle username |
| `KAGGLE_KEY` | your kaggle API key |
| `TELEGRAM_BOT_TOKEN` | your bot token from @BotFather |

> **Or skip the secrets** — just open the app after deploy and use the ⚙️ Settings button inside to configure everything without touching any files.

### After deploy
Once the Space shows **Running** (green dot), register your bot webhook once:
```bash
curl -X POST https://YOUR_HF_USERNAME-tg-bot-to-kaggle.hf.space/api/telegram/setup
```

Then open Telegram, type `/start` to your bot, and tap **Open Dashboard**.
