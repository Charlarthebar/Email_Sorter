# AI Email Sorter

An AI-powered email sorting assistant for Gmail that automatically organizes incoming emails into user-defined folders based on semantic understanding — not just keywords.

Unlike traditional email rules that match exact words, this tool uses Claude (Anthropic) to read each email in context and classify it according to detailed, natural-language instructions you define. If you say "put anything related to summer research programs or lab positions into Research," the AI understands that — even if the email never uses those exact words.

---

## How It Works

1. **You define your categories** — give each folder a name and a plain-English description of what belongs there.
2. **An email arrives** — the Chrome extension detects it via the Gmail API.
3. **The AI classifies it** — the email subject, sender, and body are sent to the local backend, which calls Claude to determine which folder it belongs in.
4. **The email is labeled automatically** — the extension applies a Gmail label (e.g. `AI Sorter/Internships`) without you doing anything.

The extension polls for new unread emails every 5 minutes, or you can click **Sort Now** to run it immediately.

---

## Features

- **Semantic understanding** — classifies emails by meaning, not keyword matching
- **Natural-language rules** — describe categories in plain English, no regex needed
- **User-defined folders** — create as many categories as you want (Internships, Research, Food, Events, Finance, Newsletters, …)
- **Gmail label management** — labels are auto-created under an `AI Sorter/` prefix so they stay organized
- **On-demand or automatic** — sort on a schedule or trigger manually from the popup

---

## Project Structure

```
Email_Sorter/
├── backend/
│   ├── main.py           # FastAPI server with /classify endpoint
│   ├── classifier.py     # Claude-based classification logic
│   ├── requirements.txt
│   └── .env.example
└── extension/
    ├── manifest.json     # Chrome Manifest V3
    ├── background.js     # Service worker: polls Gmail, applies labels
    └── popup/
        ├── popup.html    # Settings UI
        ├── popup.css
        └── popup.js
```

---

## Setup

### 1. Google Cloud — Gmail API + OAuth

You need a Google Cloud project to get an OAuth client ID for the extension.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Enable the **Gmail API**: APIs & Services → Library → search "Gmail API" → Enable
4. Go to APIs & Services → **OAuth consent screen** — configure it (External, add your email as a test user)
5. Go to APIs & Services → **Credentials** → Create Credentials → **OAuth client ID**
   - Application type: **Chrome Extension**
   - To get your extension ID before loading it: open `chrome://extensions`, enable Developer mode, note the ID after loading the extension unpacked (see step 3 below)
6. Copy the client ID and paste it into `extension/manifest.json`:
   ```json
   "oauth2": {
     "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
     ...
   }
   ```

### 2. Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set your Anthropic API key
cp .env.example .env
# Edit .env and add your key: ANTHROPIC_API_KEY=sk-ant-...

# Start the server
uvicorn main:app --reload
```

The backend runs at `http://localhost:8000`. You can verify it at `http://localhost:8000/health`.

Get an Anthropic API key at [console.anthropic.com](https://console.anthropic.com).

### 3. Chrome Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `extension/` folder
4. The AI Email Sorter icon will appear in your toolbar

### 4. Configure the Extension

Click the extension icon to open the popup:

1. **Backend URL** — leave as `http://localhost:8000` if running locally
2. **Enable Gmail sorting** — toggle on; Chrome will ask you to log in with your Google account
3. **Add categories** — click `+ Add` and define your folders, for example:

   | Name | Description |
   |---|---|
   | Internships | Recruiting emails, job postings, application status updates, networking outreach from companies |
   | Research | Lab opportunities, research program applications, faculty outreach, academic conferences |
   | Food | Restaurant deals, delivery promotions, dining hall announcements, food event invites |
   | Events | Campus events, club announcements, social invitations, ticketing confirmations |
   | Newsletters | Mailing lists, digests, product updates, company announcements |

4. Click **Sort Now** to run immediately, or wait for the automatic 5-minute poll.

Labels will appear in Gmail under `AI Sorter/` (e.g. `AI Sorter/Internships`).

---

## Architecture

```
┌─────────────────────────────────────────┐
│            Chrome Extension             │
│                                         │
│  background.js (service worker)         │
│  ├── polls Gmail API every 5 min        │
│  ├── sends emails to backend /classify  │
│  └── applies Gmail labels               │
│                                         │
│  popup/ (settings UI)                   │
│  └── manages categories, auth, toggle   │
└───────────────────┬─────────────────────┘
                    │ HTTP (localhost)
                    ▼
┌─────────────────────────────────────────┐
│       Backend — FastAPI (Python)        │
│                                         │
│  POST /classify                         │
│  ├── receives email + category list     │
│  └── calls Claude, returns folder name  │
└───────────────────┬─────────────────────┘
                    │ Anthropic API
                    ▼
┌─────────────────────────────────────────┐
│         Claude (claude-sonnet-4-6)      │
│  Reads email + descriptions, outputs   │
│  the best-matching folder name          │
└─────────────────────────────────────────┘
```

---

## Roadmap

- [x] Backend `/classify` endpoint with Claude
- [x] Chrome extension (Manifest V3)
- [x] Gmail polling + automatic label application
- [x] Popup for category management
- [ ] Outlook / Microsoft Graph support
- [ ] Feedback loop — mark a classification as wrong to refine future results
- [ ] Batch digest mode — summarize sorted emails instead of just labeling
- [ ] Cloud deployment option (so the backend doesn't need to run locally)
