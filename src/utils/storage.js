/**
 * storage.js — Bulletproof localStorage CRUD
 * 
 * Every read is wrapped in try/catch with fallback defaults.
 * Corrupt data is silently replaced with defaults — never crashes.
 */

const KEYS = {
  INVOICES: 'invoiceflow_invoices',
  DRAFT: 'invoiceflow_draft',
  SETTINGS: 'invoiceflow_settings',
  COUNTER: 'invoiceflow_counter',
};

/**
 * Safely parse JSON from localStorage.
 * Returns fallback on ANY error (missing, corrupt, quota exceeded).
 */
function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    const parsed = JSON.parse(raw);
    // Guard: if we expected an array but got something else, return fallback
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    // Guard: if we expected an object but got a primitive, return fallback
    if (typeof fallback === 'object' && fallback !== null && typeof parsed !== 'object') return fallback;
    return parsed;
  } catch {
    // Corrupt JSON — reset to fallback
    try { localStorage.setItem(key, JSON.stringify(fallback)); } catch { /* quota full, ignore */ }
    return fallback;
  }
}

/**
 * Safely write JSON to localStorage.
 * Returns true on success, false on failure (quota exceeded, etc.)
 */
function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    console.warn(`[storage] Failed to write key: ${key}`);
    return false;
  }
}

// ========== INVOICES ==========

export function getInvoices() {
  const invoices = safeGet(KEYS.INVOICES, []);
  // Sanitize: ensure every invoice has required fields
  return invoices.filter(inv => inv && typeof inv === 'object' && inv.id);
}

export function getInvoiceById(id) {
  if (!id) return null;
  const invoices = getInvoices();
  return invoices.find(inv => inv.id === id) || null;
}

export function saveInvoice(invoice) {
  if (!invoice || typeof invoice !== 'object') return false;
  
  // Ensure invoice has an id
  if (!invoice.id) {
    invoice.id = generateId();
  }
  
  // Ensure required fields have safe defaults
  invoice.createdAt = invoice.createdAt || new Date().toISOString();
  invoice.updatedAt = new Date().toISOString();
  invoice.status = invoice.status || 'draft';
  invoice.items = Array.isArray(invoice.items) ? invoice.items : [];
  
  const invoices = getInvoices();
  const existingIdx = invoices.findIndex(inv => inv.id === invoice.id);
  
  if (existingIdx >= 0) {
    invoices[existingIdx] = invoice;
  } else {
    invoices.unshift(invoice); // newest first
  }
  
  return safeSet(KEYS.INVOICES, invoices);
}

export function deleteInvoice(id) {
  if (!id) return false;
  const invoices = getInvoices();
  const filtered = invoices.filter(inv => inv.id !== id);
  return safeSet(KEYS.INVOICES, filtered);
}

export function updateInvoiceStatus(id, status) {
  if (!id || !status) return false;
  const invoices = getInvoices();
  const invoice = invoices.find(inv => inv.id === id);
  if (!invoice) return false;
  invoice.status = status;
  invoice.updatedAt = new Date().toISOString();
  return safeSet(KEYS.INVOICES, invoices);
}

// ========== DRAFT ==========

export function getDraft() {
  return safeGet(KEYS.DRAFT, null);
}

export function saveDraft(data) {
  if (!data || typeof data !== 'object') return false;
  data._draftTimestamp = Date.now();
  return safeSet(KEYS.DRAFT, data);
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEYS.DRAFT);
    return true;
  } catch {
    return false;
  }
}

// ========== SETTINGS ==========

const DEFAULT_SETTINGS = {
  businessName: '',
  gstin: '',
  phone: '',
  email: '',
  address: '',
  state: '',
  logo: '', // base64
  signature: '', // base64
  invoicePrefix: 'INV-',
  startingNumber: 1,
  defaultGstPercent: 18,
  termsAndConditions: 'Thank you for your business.',
};

export function getSettings() {
  const settings = safeGet(KEYS.SETTINGS, { ...DEFAULT_SETTINGS });
  // Merge with defaults to ensure no missing keys
  return { ...DEFAULT_SETTINGS, ...settings };
}

export function saveSettings(data) {
  if (!data || typeof data !== 'object') return false;
  const current = getSettings();
  const merged = { ...current, ...data };
  return safeSet(KEYS.SETTINGS, merged);
}

// ========== COUNTER ==========

export function getNextInvoiceNumber() {
  const settings = getSettings();
  let counter = safeGet(KEYS.COUNTER, null);
  
  if (counter === null || typeof counter !== 'number' || isNaN(counter) || counter < 0) {
    counter = Math.max(1, Number(settings.startingNumber) || 1);
  } else {
    counter++;
  }
  
  safeSet(KEYS.COUNTER, counter);
  
  const prefix = settings.invoicePrefix || 'INV-';
  return `${prefix}${String(counter).padStart(4, '0')}`;
}

export function peekNextInvoiceNumber() {
  const settings = getSettings();
  let counter = safeGet(KEYS.COUNTER, null);
  
  if (counter === null || typeof counter !== 'number' || isNaN(counter) || counter < 0) {
    counter = Math.max(1, Number(settings.startingNumber) || 1);
  } else {
    counter++;
  }
  
  const prefix = settings.invoicePrefix || 'INV-';
  return `${prefix}${String(counter).padStart(4, '0')}`;
}

// ========== HELPERS ==========

function generateId() {
  return `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export { generateId, KEYS };
