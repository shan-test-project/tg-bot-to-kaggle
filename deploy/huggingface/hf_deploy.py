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
    print("🚀 Kaggle Notebook Dashboard — Hugging Face Deploy")
    print()

    hf_token = os.environ.get("HF_TOKEN") or input("HF token (huggingface.co/settings/tokens): ").strip()
    hf_user  = os.environ.get("HF_USERNAME") or input("HF username: ").strip()
    space    = os.environ.get("HF_SPACE") or input("Space name [tg-bot-to-kaggle]: ").strip() or "tg-bot-to-kaggle"

    repo_url = f"https://{hf_user}:{hf_token}@huggingface.co/spaces/{hf_user}/{space}"

    print(f"\n📦 Creating Space: {hf_user}/{space}")
    try:
        from huggingface_hub import HfApi
        api = HfApi(token=hf_token)
        api.create_repo(
            repo_id=f"{hf_user}/{space}",
            repo_type="space",
            space_sdk="docker",
            exist_ok=True,
        )
        print("✅ Space created (or already exists)")
    except Exception as e:
        print(f"   Note: {e}")

    print("\n📤 Pushing code to HF Space…")
    subprocess.run(["git", "remote", "remove", "hf"], capture_output=True)
    subprocess.run(["git", "remote", "add", "hf", repo_url], check=True)
    subprocess.run(["git", "push", "hf", "main", "--force"], check=True)

    space_url = f"https://{hf_user}-{space}.hf.space"

    print(f"\n✅ Done! Your app will be live at:")
    print(f"   https://huggingface.co/spaces/{hf_user}/{space}")
    print()
    print("👉 Configure credentials one of two ways:")
    print()
    print("  Option A — Use the app's Settings UI (easiest):")
    print(f"     Open {space_url} → click the ⚙️ Settings button")
    print()
    print("  Option B — Set HF Space secrets:")
    print("     Go to your Space → Settings → Variables and Secrets:")
    print("       KAGGLE_USERNAME, KAGGLE_KEY, TELEGRAM_BOT_TOKEN")
    print()
    print("After configuring, register your Telegram webhook:")
    print(f"  curl -X POST {space_url}/api/telegram/setup")


if __name__ == "__main__":
    main()
