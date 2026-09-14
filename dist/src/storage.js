const STATE_KEY = 'aoi-ledger-state-v1';
const DB_NAME = 'aoi-ledger-receipts';
const STORE_NAME = 'receipts';

export const defaultState = {
  sales: [],
  expenses: [],
  importedTransactions: [],
  settings: {
    businessStartDate: '2026-09-11',
    reserveRate: 25,
    businessName: '',
    vehicleDefaultRatio: 100,
  },
};

export function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      settings: { ...defaultState.settings, ...(parsed.settings || {}) },
      sales: Array.isArray(parsed.sales) ? parsed.sales : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      importedTransactions: Array.isArray(parsed.importedTransactions) ? parsed.importedTransactions : [],
    };
  } catch {
    return structuredClone(defaultState);
  }
}

export function saveState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runStore(mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function putReceipt(file) {
  const id = crypto.randomUUID();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  await runStore('readwrite', (store) => store.put({ id, name: file.name, mimeType: file.type, dataUrl }));
  return id;
}

export async function getReceipt(id) {
  if (!id) return null;
  return runStore('readonly', (store) => store.get(id));
}

export async function deleteReceipt(id) {
  if (!id) return;
  await runStore('readwrite', (store) => store.delete(id));
}

export async function listReceipts() {
  return runStore('readonly', (store) => store.getAll());
}

export async function exportBackup(state) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
    receipts: await listReceipts(),
  };
}

export async function importBackup(payload) {
  if (!payload || payload.version !== 1 || !payload.state) throw new Error('対応していないバックアップ形式です。');
  saveState(payload.state);
  if (Array.isArray(payload.receipts)) {
    for (const receipt of payload.receipts) {
      await runStore('readwrite', (store) => store.put(receipt));
    }
  }
  return loadState();
}
