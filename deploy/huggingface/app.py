"""
Hugging Face Spaces — 1-tap deploy launcher.

This Space acts as a thin wrapper: it builds and runs the Node.js app
inside the HF Docker container, then exposes it on port 7860 (the HF default).

Deploy steps:
  1. Create a new HF Space (Docker SDK)
  2. Push this repo to it:  git push https://huggingface.co/spaces/<user>/<space>
  3. Set these Space Secrets in the HF UI:
       KAGGLE_USERNAME, KAGGLE_KEY, TELEGRAM_BOT_TOKEN, SESSION_SECRET
  4. The Space boots, builds the app, serves on 7860 automatically.
"""
# This file is intentionally minimal — the real entry point is the Dockerfile.
# HF Spaces with Docker SDK use Dockerfile directly.
print("Use the Dockerfile in the repo root. See README.md for instructions.")
