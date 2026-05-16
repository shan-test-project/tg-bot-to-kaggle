#!/usr/bin/env python3
"""
One-command Hugging Face Spaces deploy.

Usage:
    pip install huggingface_hub
    python deploy/huggingface/hf_deploy.py
"""
import os
import subprocess
import sys

def main():
    print("🚀 TG Bot to Kaggle — Hugging Face Deploy")

    hf_token = os.environ.get("HF_TOKEN") or input("Enter your HF token (from huggingface.co/settings/tokens): ").strip()
    hf_user  = os.environ.get("HF_USERNAME") or input("Enter your HF username: ").strip()
    space    = os.environ.get("HF_SPACE") or input("Space name [tg-bot-to-kaggle]: ").strip() or "tg-bot-to-kaggle"

    repo_url = f"https://{hf_user}:{hf_token}@huggingface.co/spaces/{hf_user}/{space}"

    print(f"\n📦 Creating Space: {hf_user}/{space}")
    try:
        from huggingface_hub import HfApi
        api = HfApi(token=hf_token)
        api.create_repo(repo_id=f"{hf_user}/{space}", repo_type="space", space_sdk="docker", exist_ok=True)
        print("✅ Space created (or already exists)")
    except Exception as e:
        print(f"Space creation: {e}")

    print("\n📤 Pushing code to HF Space...")
    subprocess.run(["git", "remote", "remove", "hf"], capture_output=True)
    subprocess.run(["git", "remote", "add", "hf", repo_url], check=True)
    subprocess.run(["git", "push", "hf", "main", "--force"], check=True)

    print(f"\n✅ Done! Your app will be live at:")
    print(f"   https://huggingface.co/spaces/{hf_user}/{space}")
    print("\nRemember to set these Secrets in your Space settings:")
    print("  KAGGLE_USERNAME, KAGGLE_KEY, TELEGRAM_BOT_TOKEN, SESSION_SECRET")
    print("\nThen register your Telegram webhook:")
    print(f"  curl -X POST https://{hf_user}-{space}.hf.space/api/telegram/setup")

if __name__ == "__main__":
    main()
