# AI Email Sorter

An AI-powered email sorting assistant for Gmail and Outlook that automatically organizes incoming emails into user-defined folders based on semantic understanding — not just keywords.

Unlike traditional email rules that match exact words, this tool uses a large language model (Claude) to read each email in context and classify it according to detailed, natural-language instructions you define. If you say "put anything related to summer research programs or lab positions into Research," the AI understands that — even if the email never uses those exact words.

---

## How It Works

1. **You define your categories** — give each folder a name and a plain-English description of what belongs there (e.g., "Internships: recruiting emails, job postings, application confirmations, networking outreach from companies").
2. **An email arrives** — the extension detects it in Gmail or Outlook on the web.
3. **The AI classifies it** — the email subject, sender, and body are sent to the backend, which calls Claude to determine which folder it belongs in (or whether to leave it in the inbox).
4. **The email is moved automatically** — the extension applies the label/folder in your email client without you doing anything.

---

## Features

- **Semantic understanding** — classifies emails by meaning, not keyword matching. Catches things that rule-based filters miss.
- **Natural-language rules** — describe your categories in plain English. No regex, no complex filter logic.
- **Gmail and Outlook support** — works as a Chrome extension on both Gmail and Outlook Web.
- **User-defined folders** — create as many categories as you want (e.g., Food, Research, Internships, Events, Finance, Newsletters, Housing, etc.).
- **Configurable fallback** — emails that don't fit any category stay in the inbox.
- **Privacy-conscious** — email content is only sent to the classification backend while the extension is active. You control when it runs.

---

## Planned Architecture

```
┌──────────────────────────────────┐
│         Chrome Extension         │
│  ┌────────────┐  ┌─────────────┐ │
│  │  Content   │  │  Settings   │ │
│  │  Script    │  │  Popup UI   │ │
│  │ (Gmail /   │  │ (categories,│ │
│  │  Outlook)  │  │  rules)     │ │
│  └─────┬──────┘  └──────┬──────┘ │
│        │  Background SW │        │
└────────┼───────────────-┼────────┘
         │                │
         ▼                ▼
┌──────────────────────────────────┐
│           Backend API            │
│  - Receives email data           │
│  - Stores user category rules    │
│  - Calls Claude API              │
│  - Returns folder assignment     │
└──────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│         Claude (Anthropic API)   │
│  Reads email + user rules,       │
│  outputs folder name or "inbox"  │
└──────────────────────────────────┘
```

### Components

| Component | Description |
|---|---|
| `extension/` | Chrome extension (Manifest V3) |
| `extension/content/` | Content scripts for Gmail and Outlook Web |
| `extension/popup/` | Settings UI for managing categories and rules |
| `backend/` | API server (Python/FastAPI or Node/Express) |
| `backend/classifier.py` | Claude-based email classification logic |
| `backend/storage.py` | User preferences persistence |

---

## Example Category Setup

In the extension popup, you'd define your categories like this:

| Folder | Description |
|---|---|
| Internships | Recruiting emails, job postings, application status updates, networking outreach from companies or recruiters |
| Research | Lab opportunities, research program applications, faculty outreach, academic conferences |
| Food | Restaurant deals, delivery promotions, dining hall announcements, food event invites |
| Events | Campus events, club announcements, social invitations, ticketing confirmations |
| Finance | Bank statements, payment receipts, billing notifications, expense reports |
| Newsletters | Mailing lists, digests, product updates, company announcements you subscribed to |

---

## Tech Stack (Planned)

- **Chrome Extension**: Manifest V3, JavaScript/TypeScript
- **Backend**: Python + FastAPI
- **AI**: Claude API (Anthropic) via `anthropic` Python SDK
- **Auth**: OAuth 2.0 (Gmail API / Microsoft Graph) for reading/moving emails server-side, or direct DOM manipulation via content scripts
- **Storage**: SQLite or Postgres for user rules; Chrome `storage.sync` for extension preferences

---

## Development Roadmap

- [ ] Chrome extension scaffold (Manifest V3)
- [ ] Gmail content script — detect new emails
- [ ] Outlook Web content script — detect new emails
- [ ] Extension popup — category/rule management UI
- [ ] Backend API — `/classify` endpoint
- [ ] Claude integration — prompt design for email classification
- [ ] Gmail folder/label application via Gmail API
- [ ] Outlook folder move via Microsoft Graph API
- [ ] User authentication flow
- [ ] Feedback loop — mark a classification as wrong to refine rules
- [ ] Digest mode — batch-classify at set intervals instead of real-time

---

## Getting Started

> Setup instructions will be added as the project is built out.

For now, clone the repo and watch this space.

```bash
git clone https://github.com/Charlarthebar/Email_Sorter.git
cd Email_Sorter
```
