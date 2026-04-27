// Background service worker — polls Gmail and classifies new emails.

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const POLL_ALARM = 'poll-emails';
const POLL_INTERVAL_MINUTES = 5;
const LABEL_PREFIX = 'AI Sorter';
const MAX_TRACKED_IDS = 500;

// ── Setup ────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(POLL_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: POLL_INTERVAL_MINUTES,
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) pollGmail();
});

// Allow the popup to trigger an immediate poll.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'POLL_NOW') {
    pollGmail()
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true; // keep channel open for async response
  }
});

// ── Main polling function ────────────────────────────────────────────────────

async function pollGmail() {
  const { gmailEnabled, backendUrl, categories } = await chrome.storage.sync.get({
    gmailEnabled: false,
    backendUrl: 'http://localhost:8000',
    categories: [],
  });

  if (!gmailEnabled || categories.length === 0) return;

  let token;
  try {
    token = await getAuthToken(false);
  } catch (e) {
    console.warn('[AI Sorter] Auth token unavailable, skipping poll:', e.message);
    return;
  }

  // Load already-processed message IDs to avoid re-classifying.
  const { processedIds = [] } = await chrome.storage.local.get({ processedIds: [] });

  // Fetch recent unread messages (up to 25).
  let messages;
  try {
    const res = await gmailGet(token, '/users/me/messages?q=is:unread&maxResults=25');
    messages = res.messages || [];
  } catch (e) {
    console.warn('[AI Sorter] Failed to list messages:', e.message);
    return;
  }

  const newMessages = messages.filter((m) => !processedIds.includes(m.id));
  if (newMessages.length === 0) return;

  // Ensure Gmail labels exist for all categories.
  let labelMap;
  try {
    labelMap = await ensureLabels(token, categories);
  } catch (e) {
    console.warn('[AI Sorter] Label setup failed:', e.message);
    return;
  }

  const newProcessed = [...processedIds];

  for (const { id } of newMessages) {
    try {
      const msg = await gmailGet(token, `/users/me/messages/${id}?format=full`);
      const email = parseEmail(msg);

      const result = await backendClassify(backendUrl, email, categories);

      if (result.category && result.category !== 'inbox') {
        const labelId = labelMap[result.category.toLowerCase()];
        if (labelId) {
          await gmailPost(token, `/users/me/messages/${id}/modify`, {
            addLabelIds: [labelId],
          });
          console.log(`[AI Sorter] "${email.subject}" → ${result.category}`);
        }
      }
    } catch (e) {
      console.warn(`[AI Sorter] Failed to process message ${id}:`, e.message);
    }

    newProcessed.push(id);
  }

  // Keep the processed list bounded so storage doesn't grow forever.
  const trimmed = newProcessed.length > MAX_TRACKED_IDS
    ? newProcessed.slice(newProcessed.length - MAX_TRACKED_IDS)
    : newProcessed;

  await chrome.storage.local.set({ processedIds: trimmed, lastRun: Date.now() });
}

// ── Gmail helpers ────────────────────────────────────────────────────────────

function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}

async function gmailGet(token, path) {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail GET ${path} → ${res.status}`);
  return res.json();
}

async function gmailPost(token, path, body) {
  const res = await fetch(`${GMAIL_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gmail POST ${path} → ${res.status}`);
  return res.json();
}

async function ensureLabels(token, categories) {
  const { labels = [] } = await gmailGet(token, '/users/me/labels');
  const labelMap = {};

  for (const cat of categories) {
    const labelName = `${LABEL_PREFIX}/${cat.name}`;
    let label = labels.find((l) => l.name === labelName);
    if (!label) {
      label = await gmailPost(token, '/users/me/labels', { name: labelName });
    }
    labelMap[cat.name.toLowerCase()] = label.id;
  }

  return labelMap;
}

function parseEmail(msg) {
  const headers = msg.payload?.headers ?? [];
  const header = (name) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

  return {
    sender: header('From'),
    subject: header('Subject'),
    body: extractBody(msg.payload),
  };
}

function extractBody(payload) {
  // Recursively search parts for the first text/plain segment.
  if (!payload) return '';

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data).slice(0, 3000);
  }

  for (const part of payload.parts ?? []) {
    const text = extractBody(part);
    if (text) return text;
  }

  return '';
}

function decodeBase64Url(data) {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
  } catch {
    return atob(base64);
  }
}

// ── Backend helper ───────────────────────────────────────────────────────────

async function backendClassify(baseUrl, email, categories) {
  const res = await fetch(`${baseUrl}/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, categories }),
  });
  if (!res.ok) throw new Error(`Backend /classify → ${res.status}`);
  return res.json();
}
