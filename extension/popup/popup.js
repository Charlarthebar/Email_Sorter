// popup.js — manages settings and category list in the extension popup.

let categories = [];

// ── Load ─────────────────────────────────────────────────────────────────────

async function load() {
  const sync = await chrome.storage.sync.get({
    backendUrl: 'http://localhost:8000',
    gmailEnabled: false,
    categories: [],
  });

  document.getElementById('backend-url').value = sync.backendUrl;
  document.getElementById('gmail-toggle').checked = sync.gmailEnabled;
  categories = sync.categories;

  renderCategories();
  updateBadge(sync.gmailEnabled);

  const local = await chrome.storage.local.get({ lastRun: null });
  if (local.lastRun) {
    document.getElementById('last-run').textContent =
      `Last sorted: ${new Date(local.lastRun).toLocaleString()}`;
  }
}

// ── Render categories ─────────────────────────────────────────────────────────

function renderCategories() {
  const list = document.getElementById('cat-list');

  if (categories.length === 0) {
    list.innerHTML = '<p class="empty">No categories yet.</p>';
    return;
  }

  list.innerHTML = categories
    .map(
      (cat, i) => `
      <div class="cat-item">
        <div class="cat-info">
          <strong>${esc(cat.name)}</strong>
          <span>${esc(cat.description)}</span>
        </div>
        <button class="delete-btn" data-index="${i}" title="Remove">✕</button>
      </div>`
    )
    .join('');

  list.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteCategory(parseInt(btn.dataset.index)));
  });
}

// ── Persist ───────────────────────────────────────────────────────────────────

async function saveSettings() {
  await chrome.storage.sync.set({
    backendUrl: document.getElementById('backend-url').value.trim(),
    gmailEnabled: document.getElementById('gmail-toggle').checked,
    categories,
  });
}

// ── Category actions ──────────────────────────────────────────────────────────

async function deleteCategory(i) {
  categories.splice(i, 1);
  renderCategories();
  await saveSettings();
}

function showAddForm() {
  document.getElementById('add-form').classList.remove('hidden');
  document.getElementById('new-name').focus();
}

function hideAddForm() {
  document.getElementById('add-form').classList.add('hidden');
  document.getElementById('new-name').value = '';
  document.getElementById('new-desc').value = '';
}

async function saveCategory() {
  const name = document.getElementById('new-name').value.trim();
  const description = document.getElementById('new-desc').value.trim();
  if (!name || !description) return;

  categories.push({ name, description });
  hideAddForm();
  renderCategories();
  await saveSettings();
}

// ── Gmail toggle ──────────────────────────────────────────────────────────────

async function handleGmailToggle() {
  const enabled = document.getElementById('gmail-toggle').checked;
  updateBadge(enabled);

  if (enabled) {
    // Trigger interactive auth now so the background worker can use a cached token later.
    try {
      await getAuthToken(true);
    } catch (e) {
      console.warn('Auth failed:', e.message);
      document.getElementById('gmail-toggle').checked = false;
      updateBadge(false);
      return;
    }
  }

  await saveSettings();
}

// ── Sort now ──────────────────────────────────────────────────────────────────

async function sortNow() {
  const btn = document.getElementById('sort-now-btn');
  const badge = document.getElementById('status-badge');

  btn.disabled = true;
  btn.textContent = 'Sorting…';
  badge.textContent = 'Running';
  badge.className = 'badge running';

  const result = await chrome.runtime.sendMessage({ type: 'POLL_NOW' });

  btn.disabled = false;
  btn.textContent = 'Sort Now';

  const enabled = document.getElementById('gmail-toggle').checked;
  updateBadge(enabled);

  if (result?.ok) {
    const now = Date.now();
    await chrome.storage.local.set({ lastRun: now });
    document.getElementById('last-run').textContent =
      `Last sorted: ${new Date(now).toLocaleString()}`;
  } else {
    document.getElementById('last-run').textContent = `Error: ${result?.error ?? 'unknown'}`;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function updateBadge(enabled) {
  const badge = document.getElementById('status-badge');
  badge.textContent = enabled ? 'Active' : 'Idle';
  badge.className = 'badge' + (enabled ? ' active' : '');
}

function getAuthToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(token);
    });
  });
}

function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.getElementById('backend-url').addEventListener('change', saveSettings);
document.getElementById('gmail-toggle').addEventListener('change', handleGmailToggle);
document.getElementById('add-btn').addEventListener('click', showAddForm);
document.getElementById('cancel-btn').addEventListener('click', hideAddForm);
document.getElementById('save-btn').addEventListener('click', saveCategory);
document.getElementById('sort-now-btn').addEventListener('click', sortNow);

document.getElementById('new-desc').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.metaKey) saveCategory();
});

load();
