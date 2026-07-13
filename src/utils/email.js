/**
 * email.js — Email Integration (GMass Method)
 * 
 * Sends invoices via:
 * 1. mailto: links (opens default email client)
 * 2. GMass compose URL (for Gmail/GMass users)
 * 3. Logs all sent emails to Supabase
 */

import { supabase, isSupabaseConfigured } from './supabase.js';
import { getCurrentOrgId } from './tenant.js';
import { getCurrentUser } from './auth.js';

/**
 * Generate email subject line for an invoice.
 */
export function getEmailSubject(invoiceData, businessSettings) {
  const bizName = businessSettings?.business_name || businessSettings?.businessName || 'Our Company';
  const invNum = invoiceData.invoiceNumber || invoiceData.invoice_number || 'Invoice';
  return `${invNum} from ${bizName}`;
}

/**
 * Generate plain text email body for an invoice.
 */
export function getEmailBodyText(invoiceData, businessSettings) {
  const bizName = businessSettings?.business_name || businessSettings?.businessName || 'Our Company';
  const custName = invoiceData.customerName || invoiceData.customer_name || 'Customer';
  const invNum = invoiceData.invoiceNumber || invoiceData.invoice_number || '';
  const date = invoiceData.date || '';
  const total = invoiceData.grandTotal || invoiceData.grand_total || 0;
  const formattedTotal = '₹' + Number(total).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  let body = `Dear ${custName},\n\n`;
  body += `Please find below the details for ${invNum}.\n\n`;
  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  body += `Invoice Number: ${invNum}\n`;
  body += `Date: ${date}\n`;
  body += `Amount Due: ${formattedTotal}\n`;
  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Items
  const items = invoiceData.items || [];
  if (items.length > 0) {
    body += `Items:\n`;
    items.forEach((item, i) => {
      const name = item.name || item.item_name || '';
      if (name) {
        const qty = item.qty || item.quantity || 1;
        const price = item.price || item.unit_price || 0;
        body += `  ${i + 1}. ${name} — Qty: ${qty} × ₹${Number(price).toLocaleString('en-IN')}\n`;
      }
    });
    body += `\n`;
  }

  body += `Grand Total: ${formattedTotal}\n\n`;

  // Payment details
  const bankName = businessSettings?.bank_name || businessSettings?.bankName || '';
  const accountNo = businessSettings?.account_number || businessSettings?.accountNumber || '';
  const ifsc = businessSettings?.ifsc_code || businessSettings?.ifscCode || '';
  const upi = businessSettings?.upi_id || businessSettings?.upiId || '';

  if (bankName || accountNo || upi) {
    body += `Payment Details:\n`;
    if (bankName) body += `  Bank: ${bankName}\n`;
    if (accountNo) body += `  Account: ${accountNo}\n`;
    if (ifsc) body += `  IFSC: ${ifsc}\n`;
    if (upi) body += `  UPI: ${upi}\n`;
    body += `\n`;
  }

  body += `Thank you for your business!\n\n`;
  body += `Best regards,\n${bizName}\n`;

  if (businessSettings?.phone) body += `Phone: ${businessSettings.phone}\n`;
  if (businessSettings?.email) body += `Email: ${businessSettings.email}\n`;

  return body;
}

/**
 * Send invoice via mailto: link.
 * Opens the user's default email client.
 */
export function sendInvoiceEmail(invoiceData, recipientEmail, businessSettings) {
  const subject = getEmailSubject(invoiceData, businessSettings);
  const body = getEmailBodyText(invoiceData, businessSettings);

  const cc = businessSettings?.default_email_cc || businessSettings?.defaultEmailCc || '';
  const bcc = businessSettings?.default_email_bcc || businessSettings?.defaultEmailBcc || '';

  let mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}`;
  mailtoUrl += `?subject=${encodeURIComponent(subject)}`;
  mailtoUrl += `&body=${encodeURIComponent(body)}`;
  if (cc) mailtoUrl += `&cc=${encodeURIComponent(cc)}`;
  if (bcc) mailtoUrl += `&bcc=${encodeURIComponent(bcc)}`;

  window.open(mailtoUrl, '_blank');

  // Log the email
  logEmailSent(
    invoiceData.id,
    recipientEmail,
    subject,
    'mailto'
  );
}

/**
 * Open GMass compose in Gmail.
 * GMass works as a Chrome extension — this opens Gmail compose with pre-filled data.
 */
export function composeGMassEmail(invoiceData, recipientEmail, businessSettings) {
  const subject = getEmailSubject(invoiceData, businessSettings);
  const body = getEmailBodyText(invoiceData, businessSettings);

  // Gmail compose URL
  let gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1`;
  gmailUrl += `&to=${encodeURIComponent(recipientEmail)}`;
  gmailUrl += `&su=${encodeURIComponent(subject)}`;
  gmailUrl += `&body=${encodeURIComponent(body)}`;

  const cc = businessSettings?.default_email_cc || businessSettings?.defaultEmailCc || '';
  const bcc = businessSettings?.default_email_bcc || businessSettings?.defaultEmailBcc || '';
  if (cc) gmailUrl += `&cc=${encodeURIComponent(cc)}`;
  if (bcc) gmailUrl += `&bcc=${encodeURIComponent(bcc)}`;

  window.open(gmailUrl, '_blank');

  // Log the email
  logEmailSent(
    invoiceData.id,
    recipientEmail,
    subject,
    'gmass'
  );
}

/**
 * Log a sent email to Supabase.
 */
export async function logEmailSent(invoiceId, recipientEmail, subject, method = 'mailto') {
  if (!isSupabaseConfigured()) return;

  const orgId = getCurrentOrgId();
  const user = await getCurrentUser();
  if (!orgId || !user) return;

  try {
    await supabase.from('email_logs').insert({
      org_id: orgId,
      invoice_id: invoiceId || null,
      recipient_email: recipientEmail,
      subject: subject || '',
      method,
      sent_by: user.id,
    });
  } catch (err) {
    console.warn('[email] Failed to log email:', err);
  }
}

/**
 * Get email send history for the current org.
 */
export async function getEmailLogs(invoiceId) {
  if (!isSupabaseConfigured()) return [];

  const orgId = getCurrentOrgId();
  if (!orgId) return [];

  let query = supabase
    .from('email_logs')
    .select('*')
    .eq('org_id', orgId)
    .order('sent_at', { ascending: false });

  if (invoiceId) {
    query = query.eq('invoice_id', invoiceId);
  }

  const { data } = await query.limit(100);
  return data || [];
}
