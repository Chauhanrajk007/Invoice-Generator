/**
 * storage.js — Supabase-backed Data Layer with Multi-Tenant Isolation
 * 
 * All invoice + settings operations go through Supabase.
 * Draft operations stay in localStorage (per-device, fast).
 * Every function is async (except drafts).
 */

import { supabase, isSupabaseConfigured } from './supabase.js';
import { getCurrentOrgId } from './tenant.js';
import { getCurrentUser } from './auth.js';

const DRAFT_KEY = 'invoiceflow_draft';

// ========== INVOICES ==========

export async function getInvoices() {
  const orgId = getCurrentOrgId();
  if (!orgId || !isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[storage] getInvoices error:', error);
    return [];
  }

  // Map snake_case DB columns to camelCase for existing UI code
  return (data || []).map(mapInvoiceFromDB);
}

export async function getInvoiceById(id) {
  if (!id || !isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return mapInvoiceFromDB(data);
}

export async function saveInvoice(invoice) {
  if (!invoice || !isSupabaseConfigured()) return false;

  const orgId = getCurrentOrgId();
  const user = await getCurrentUser();
  if (!orgId || !user) return false;

  const dbInvoice = mapInvoiceToDB(invoice, orgId, user.id);

  if (invoice.id && !invoice.id.startsWith('inv_')) {
    // Existing invoice — update
    const { error } = await supabase
      .from('invoices')
      .update(dbInvoice)
      .eq('id', invoice.id);

    if (error) {
      console.error('[storage] saveInvoice update error:', error);
      return false;
    }
    return true;
  } else {
    // New invoice — insert (remove temp ID)
    delete dbInvoice.id;
    const { data, error } = await supabase
      .from('invoices')
      .insert(dbInvoice)
      .select('id')
      .single();

    if (error) {
      console.error('[storage] saveInvoice insert error:', error);
      return false;
    }

    // Update the in-memory invoice with the real DB id
    if (data) invoice.id = data.id;
    return true;
  }
}

export async function deleteInvoice(id) {
  if (!id || !isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[storage] deleteInvoice error:', error);
    return false;
  }
  return true;
}

export async function updateInvoiceStatus(id, status) {
  if (!id || !status || !isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('invoices')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[storage] updateInvoiceStatus error:', error);
    return false;
  }
  return true;
}

// ========== DRAFT (localStorage only — per device) ==========

export function getDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveDraft(data) {
  if (!data) return false;
  try {
    data._draftTimestamp = Date.now();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
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
  logo: '',
  signature: '',
  invoicePrefix: 'INV-',
  startingNumber: 1,
  defaultGstPercent: 18,
  termsAndConditions: 'Thank you for your business.',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  upiId: '',
  defaultEmailCc: '',
  defaultEmailBcc: '',
};

export async function getSettings() {
  const orgId = getCurrentOrgId();
  if (!orgId || !isSupabaseConfigured()) return { ...DEFAULT_SETTINGS };

  const { data, error } = await supabase
    .from('org_settings')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (error || !data) return { ...DEFAULT_SETTINGS };

  return mapSettingsFromDB(data);
}

export async function saveSettings(settingsData) {
  const orgId = getCurrentOrgId();
  if (!orgId || !isSupabaseConfigured() || !settingsData) return false;

  const dbSettings = mapSettingsToDB(settingsData);
  dbSettings.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('org_settings')
    .update(dbSettings)
    .eq('org_id', orgId);

  if (error) {
    console.error('[storage] saveSettings error:', error);
    return false;
  }
  return true;
}

// ========== INVOICE COUNTER ==========

export async function getNextInvoiceNumber() {
  const orgId = getCurrentOrgId();
  if (!orgId || !isSupabaseConfigured()) return 'INV-0001';

  // Get current settings
  const { data } = await supabase
    .from('org_settings')
    .select('invoice_prefix, invoice_counter, starting_number')
    .eq('org_id', orgId)
    .single();

  if (!data) return 'INV-0001';

  let counter = data.invoice_counter || 0;
  if (counter < (data.starting_number || 1)) {
    counter = (data.starting_number || 1) - 1;
  }
  counter++;

  // Update counter
  await supabase
    .from('org_settings')
    .update({ invoice_counter: counter })
    .eq('org_id', orgId);

  const prefix = data.invoice_prefix || 'INV-';
  return `${prefix}${String(counter).padStart(4, '0')}`;
}

export async function peekNextInvoiceNumber() {
  const orgId = getCurrentOrgId();
  if (!orgId || !isSupabaseConfigured()) return 'INV-0001';

  const { data } = await supabase
    .from('org_settings')
    .select('invoice_prefix, invoice_counter, starting_number')
    .eq('org_id', orgId)
    .single();

  if (!data) return 'INV-0001';

  let counter = (data.invoice_counter || 0) + 1;
  if (counter < (data.starting_number || 1)) {
    counter = data.starting_number || 1;
  }

  const prefix = data.invoice_prefix || 'INV-';
  return `${prefix}${String(counter).padStart(4, '0')}`;
}

// ========== MAPPERS (DB ↔ UI) ==========

function mapInvoiceFromDB(row) {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number || '',
    date: row.date || '',
    status: row.status || 'draft',
    businessName: row.business_name || '',
    businessGstin: row.business_gstin || '',
    businessPhone: row.business_phone || '',
    businessEmail: row.business_email || '',
    businessAddress: row.business_address || '',
    businessLogo: row.business_logo || '',
    customerName: row.customer_name || '',
    customerPhone: row.customer_phone || '',
    customerEmail: row.customer_email || '',
    customerAddress: row.customer_address || '',
    customerGstin: row.customer_gstin || '',
    discountValue: Number(row.discount_value) || 0,
    discountType: row.discount_type || 'amount',
    isGstInvoice: row.is_gst_invoice || false,
    signature: row.signature || '',
    termsAndConditions: row.terms_and_conditions || '',
    grandTotal: Number(row.grand_total) || 0,
    items: Array.isArray(row.items) ? row.items : [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvoiceToDB(inv, orgId, userId) {
  return {
    id: inv.id && !inv.id.startsWith('inv_') ? inv.id : undefined,
    org_id: orgId,
    invoice_number: inv.invoiceNumber || '',
    date: inv.date || null,
    status: inv.status || 'draft',
    business_name: inv.businessName || '',
    business_gstin: inv.businessGstin || '',
    business_phone: inv.businessPhone || '',
    business_email: inv.businessEmail || '',
    business_address: inv.businessAddress || '',
    business_logo: inv.businessLogo || '',
    customer_name: inv.customerName || '',
    customer_phone: inv.customerPhone || '',
    customer_email: inv.customerEmail || '',
    customer_address: inv.customerAddress || '',
    customer_gstin: inv.customerGstin || '',
    discount_value: inv.discountValue || 0,
    discount_type: inv.discountType || 'amount',
    is_gst_invoice: inv.isGstInvoice || false,
    signature: inv.signature || '',
    terms_and_conditions: inv.termsAndConditions || '',
    grand_total: inv.grandTotal || 0,
    items: Array.isArray(inv.items) ? inv.items : [],
    created_by: userId,
    updated_at: new Date().toISOString(),
  };
}

function mapSettingsFromDB(row) {
  return {
    businessName: row.business_name || '',
    gstin: row.gstin || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    state: row.state || '',
    logo: row.logo || '',
    signature: row.signature || '',
    invoicePrefix: row.invoice_prefix || 'INV-',
    startingNumber: row.starting_number || 1,
    defaultGstPercent: Number(row.default_gst_percent) || 18,
    termsAndConditions: row.terms_and_conditions || 'Thank you for your business.',
    bankName: row.bank_name || '',
    accountNumber: row.account_number || '',
    ifscCode: row.ifsc_code || '',
    upiId: row.upi_id || '',
    defaultEmailCc: row.default_email_cc || '',
    defaultEmailBcc: row.default_email_bcc || '',
  };
}

function mapSettingsToDB(s) {
  return {
    business_name: s.businessName || '',
    gstin: s.gstin || '',
    phone: s.phone || '',
    email: s.email || '',
    address: s.address || '',
    state: s.state || '',
    logo: s.logo || '',
    signature: s.signature || '',
    invoice_prefix: s.invoicePrefix || 'INV-',
    starting_number: Math.max(1, parseInt(s.startingNumber) || 1),
    default_gst_percent: Math.max(0, Math.min(28, parseFloat(s.defaultGstPercent) || 18)),
    terms_and_conditions: s.termsAndConditions || '',
    bank_name: s.bankName || '',
    account_number: s.accountNumber || '',
    ifsc_code: s.ifscCode || '',
    upi_id: s.upiId || '',
    default_email_cc: s.defaultEmailCc || '',
    default_email_bcc: s.defaultEmailBcc || '',
  };
}

// ========== LEGACY EXPORTS (for backward compatibility) ==========
export { DEFAULT_SETTINGS };
