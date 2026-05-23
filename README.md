# 🎬 CaptionWare

> AI-powered video captions — runs 100% in your browser. No server. No uploads.

## Features
- 🎙️ Whisper AI transcription (on-device, private)
- 🌐 100+ languages supported
- 📍 Customisable font, size, color, position
- 💾 History saved locally (IndexedDB)
- 📱 Works as PWA + Android APK

## Deploy (Website)
1. Push this repo to GitHub ✅ (already done by setup script)
2. Go to [vercel.com](https://vercel.com) → Import GitHub repo
3. Click Deploy — done!

## Android APK
- GitHub Actions auto-builds the APK on every push to `main`
- Download from: **Actions tab** → latest run → **Artifacts**

## Tech Stack
| Layer | Tech |
|---|---|
| Speech-to-Text | Whisper.js (xenova/transformers) |
| UI | Vanilla HTML/CSS/JS |
| Storage | IndexedDB (local) |
| Android | Capacitor 6 |
| CI/CD | GitHub Actions |
| Hosting | Vercel (free) |

## Privacy
Your videos never leave your device. All processing happens in the browser.
