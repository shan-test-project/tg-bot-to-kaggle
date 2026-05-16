---
title: TG Bot to Kaggle
emoji: 🤖
colorFrom: purple
colorTo: indigo
sdk: docker
pinned: false
app_port: 7860
---

# TG Bot to Kaggle — Hugging Face Spaces Deploy

## 1-tap deploy to Hugging Face

### Option A: Deploy via HF web UI
1. Go to [huggingface.co/new-space](https://huggingface.co/new-space)
2. Choose **Docker** as the SDK
3. Clone your GitHub repo into the Space:
   ```
   huggingface-cli repo create tg-bot-to-kaggle --type space --space_sdk docker
   git remote add hf https://huggingface.co/spaces/YOUR_HF_USERNAME/tg-bot-to-kaggle
   git push hf main
   ```
4. In your Space → **Settings → Variables and Secrets**, add:
   - `KAGGLE_USERNAME`
   - `KAGGLE_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `SESSION_SECRET`
5. The Space will rebuild and go live automatically!

### Option B: Deploy via CLI (one command)
```bash
pip install huggingface_hub
python deploy/huggingface/hf_deploy.py
```

### After deploy
Run this once to register the Telegram webhook:
```bash
curl -X POST https://YOUR_SPACE_URL/api/telegram/setup
```
