# Faceless Studio — Vibes AI Generator (`vibe-gen`)

A **standalone, zero-build Chrome Extension** (Manifest V3) that automates batch image and video generation on [Vibes.ai](https://vibes.ai) (Meta AI).

---

## Highlights

* **Zero Build Step**: Pure Vanilla JavaScript, HTML, and CSS. No `npm install`, no `npm run build`, and no bundlers required.
* **Persistent Side Panel**: Uses Chrome's native Side Panel API so it stays open docked to your browser window while you work.
* **100% English UI**: Clean, modern dark-slate interface matching Faceless Studio.
* **Dual Generation Modes**:
  * **Image Batch**: Generates scene images from prompt descriptions.
  * **Video Batch**: Automatically attaches generated scene images as the **Start Frame** to generate high-definition video clips.
* **Automated Watermark Removal**: Blurs the bottom-right Meta AI logo automatically before saving to your local disk.
* **Two Input Methods**:
  1. **Local `script.json`**: Choose any project folder on your machine via File System Access API.
  2. **Faceless Studio API**: Connect directly to your local Faceless Studio (`http://localhost:3000`) and pick Channel → Pillar → Topic.

---

## How to Install in Chrome

1. Open Google Chrome and go to:
   ```
   chrome://extensions/
   ```
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **"Load unpacked"** (top-left).
4. Select this directory:
   ```
   chrome-extension/vibe-gen
   ```
5. Click the extension icon in your Chrome toolbar or open the **Side Panel** to launch the studio.

---

## How to Use

1. **Open Vibes.ai**: Open [https://vibes.ai](https://vibes.ai) in a browser tab and log into your Meta account.
2. **Open the Side Panel**: The status pill at the top will indicate **"Vibes.ai Connected"**.
3. **Choose Input Source**:
   * **Local script.json**: Click **"Select Project Folder"** and pick your folder containing `script.json`.
   * **Faceless Studio API**: Click **"Faceless Studio API"**, enter your server URL (`http://localhost:3000`), connect, and select your topic.
4. **Select Mode**:
   * Choose **Image Batch** to generate all still frames first.
   * Choose **Video Batch** to convert existing frames into image-to-video scenes.
5. **Start Generation**: Click **"▶ Start Batch Generation"** and watch the live progress and console logs. Assets are saved directly into `/images` and `/videos` subfolders on your local drive!
