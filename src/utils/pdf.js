/**
 * pdf.js — Professional PDF Download, Print, and Share
 * 
 * Uses html2pdf.js (loaded via CDN in index.html).
 * Generates a professional invoice template with:
 * - Colored header bar with branding
 * - Professional table with alternating rows
 * - Status watermark (PAID/DRAFT/PENDING)
 * - Payment details section
 * - Signature and terms footer
 * 
 * FIXES the white PDF bug by using inline styles (no CSS variables).
 */

import { showToast } from '../main.js';
import { amountToWords } from '../utils/amount-words.js';

/**
 * Generate professional invoice HTML for PDF/Print.
 * Uses ONLY inline styles — no CSS variables, no external stylesheets.
 * This ensures html2pdf.js and print iframes render correctly.
 */
export function generateProfessionalInvoiceHTML(formData, summary, settings) {
  const isGst = formData.isGstInvoice;
  const status = (formData.status || 'draft').toUpperCase();

  const watermarkColors = { PAID: '#10B981', PENDING: '#F59E0B', DRAFT: '#94A3B8' };
  const wmColor = watermarkColors[status] || '#94A3B8';

  const statusBg = { PAID: '#ECFDF5', PENDING: '#FFFBEB', DRAFT: '#F1F5F9' };
  const statusFg = { PAID: '#059669', PENDING: '#D97706', DRAFT: '#64748B' };

  const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let amountWords = '';
  try { amountWords = amountToWords(summary.grandTotal); } catch { amountWords = ''; }

  const items = (formData.items || []).filter(i => i && i.name);
  const colCount = isGst ? 7 : 6;

  return `
<div style="position:relative;width:794px;min-height:1123px;padding:0;margin:0 auto;background:#ffffff;font-family:'Inter','Segoe UI',system-ui,sans-serif;color:#1E293B;font-size:11px;line-height:1.55;overflow:hidden;">

  <!-- Watermark -->
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:96px;font-weight:900;color:${wmColor};opacity:0.05;pointer-events:none;white-space:nowrap;z-index:0;letter-spacing:12px;">${status}</div>

  <!-- ═══ HEADER ═══ -->
  <div style="background:linear-gradient(135deg,#2D3A8C 0%,#4F6EF7 60%,#7B8FF7 100%);padding:32px 40px 28px;position:relative;z-index:1;">
    <!-- Decorative corner -->
    <div style="position:absolute;top:0;right:0;width:160px;height:160px;background:radial-gradient(circle at top right,rgba(255,255,255,0.08) 0%,transparent 70%);pointer-events:none;"></div>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;position:relative;">
      <!-- Left: Business Info -->
      <div style="color:#ffffff;max-width:58%;">
        ${formData.businessLogo ? `<img src="${formData.businessLogo}" alt="Logo" style="max-width:72px;max-height:44px;margin-bottom:10px;border-radius:6px;background:rgba(255,255,255,0.15);padding:4px;" />` : ''}
        <div style="font-size:21px;font-weight:800;letter-spacing:-0.3px;margin-bottom:4px;color:#ffffff;font-family:'DM Sans','Inter',sans-serif;">${esc(formData.businessName) || 'Your Business'}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.8);line-height:1.6;">
          ${[formData.businessAddress, formData.businessPhone, formData.businessEmail].filter(Boolean).map(esc).join('&nbsp;&nbsp;·&nbsp;&nbsp;')}
        </div>
        ${formData.businessGstin ? `<div style="font-size:10.5px;color:rgba(255,255,255,0.7);margin-top:5px;letter-spacing:0.3px;">GSTIN: <span style="color:rgba(255,255,255,0.95);font-weight:600;">${esc(formData.businessGstin)}</span></div>` : ''}
      </div>

      <!-- Right: Invoice Meta -->
      <div style="text-align:right;color:#ffffff;">
        <div style="font-size:30px;font-weight:800;letter-spacing:2px;text-transform:uppercase;font-family:'DM Sans','Inter',sans-serif;opacity:0.95;">${isGst ? 'TAX INVOICE' : 'INVOICE'}</div>
        <div style="margin-top:10px;font-size:13px;font-weight:600;color:rgba(255,255,255,0.9);letter-spacing:0.3px;">${esc(formData.invoiceNumber) || 'INV-XXXX'}</div>
        <div style="font-size:11.5px;margin-top:3px;color:rgba(255,255,255,0.75);">${esc(formData.date) || ''}</div>
        <div style="margin-top:10px;display:inline-block;padding:4px 16px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.8px;background:${statusBg[status] || '#F1F5F9'};color:${statusFg[status] || '#64748B'};text-transform:uppercase;">${status}</div>
      </div>
    </div>
  </div>

  <!-- Thin accent line -->
  <div style="height:3px;background:linear-gradient(90deg,#4F6EF7,#7B8FF7,#4F6EF7);position:relative;z-index:1;"></div>

  <!-- ═══ BILL TO + SUMMARY ═══ -->
  <div style="padding:28px 40px 20px;display:flex;gap:32px;position:relative;z-index:1;">
    <!-- Bill To -->
    <div style="flex:1;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#4F6EF7;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <span style="display:inline-block;width:14px;height:2px;background:#4F6EF7;border-radius:1px;"></span>Bill To
      </div>
      <div style="font-size:15px;font-weight:700;color:#1E293B;margin-bottom:6px;font-family:'DM Sans','Inter',sans-serif;">${esc(formData.customerName) || 'Customer Name'}</div>
      <div style="font-size:11px;color:#64748B;line-height:1.7;">
        ${formData.customerAddress ? `<div>${esc(formData.customerAddress)}</div>` : ''}
        ${formData.customerPhone ? `<div>${esc(formData.customerPhone)}</div>` : ''}
        ${formData.customerEmail ? `<div>${esc(formData.customerEmail)}</div>` : ''}
      </div>
      ${formData.customerGstin ? `<div style="margin-top:6px;font-size:10.5px;color:#64748B;">GSTIN: <span style="color:#1E293B;font-weight:600;">${esc(formData.customerGstin)}</span></div>` : ''}
    </div>

    <!-- Summary Cards -->
    <div style="width:260px;flex-shrink:0;">
      <div style="background:linear-gradient(135deg,#F8FAFC,#F1F5F9);border-radius:10px;padding:16px 18px;border:1px solid #E2E8F0;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#4F6EF7;margin-bottom:10px;">Summary</div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:11px;color:#64748B;border-bottom:1px solid #E2E8F0;">
          <span>Items</span><span style="font-weight:600;color:#1E293B;">${items.length}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:11px;color:#64748B;border-bottom:1px solid #E2E8F0;">
          <span>Subtotal</span><span style="font-weight:600;color:#1E293B;">${fmt(summary.subtotal)}</span>
        </div>
        ${summary.discount > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:11px;color:#EF4444;border-bottom:1px solid #E2E8F0;">
          <span>Discount</span><span style="font-weight:600;">-${fmt(summary.discount)}</span>
        </div>` : ''}
        ${isGst ? (summary.interState ? `
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:11px;color:#64748B;border-bottom:1px solid #E2E8F0;">
          <span>IGST</span><span style="font-weight:600;color:#1E293B;">${fmt(summary.igst)}</span>
        </div>` : `
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:11px;color:#64748B;">
          <span>CGST + SGST</span><span style="font-weight:600;color:#1E293B;">${fmt(summary.cgst + summary.sgst)}</span>
        </div>`) : (summary.totalTax > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:11px;color:#64748B;border-bottom:1px solid #E2E8F0;">
          <span>Tax</span><span style="font-weight:600;color:#1E293B;">${fmt(summary.totalTax)}</span>
        </div>` : '')}
        <div style="display:flex;justify-content:space-between;padding:10px 0 4px;margin-top:4px;border-top:2px solid #4F6EF7;">
          <span style="font-size:13px;font-weight:800;color:#1E293B;">Grand Total</span>
          <span style="font-size:14px;font-weight:800;color:#4F6EF7;">${fmt(summary.grandTotal)}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ ITEMS TABLE ═══ -->
  <div style="padding:0 40px;position:relative;z-index:1;">
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="padding:10px 14px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#4F6EF7;background:#F1F5F9;border-bottom:2px solid #D6DDFC;border-radius:6px 0 0 0;">#</th>
          <th style="padding:10px 14px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#4F6EF7;background:#F1F5F9;border-bottom:2px solid #D6DDFC;">Item Description</th>
          ${isGst ? `<th style="padding:10px 14px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#4F6EF7;background:#F1F5F9;border-bottom:2px solid #D6DDFC;">HSN/SAC</th>` : ''}
          <th style="padding:10px 14px;text-align:center;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#4F6EF7;background:#F1F5F9;border-bottom:2px solid #D6DDFC;">Qty</th>
          <th style="padding:10px 14px;text-align:right;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#4F6EF7;background:#F1F5F9;border-bottom:2px solid #D6DDFC;">Rate</th>
          <th style="padding:10px 14px;text-align:center;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#4F6EF7;background:#F1F5F9;border-bottom:2px solid #D6DDFC;">GST%</th>
          <th style="padding:10px 14px;text-align:right;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#4F6EF7;background:#F1F5F9;border-bottom:2px solid #D6DDFC;border-radius:0 6px 0 0;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items.length === 0 ? `
          <tr><td colspan="${colCount}" style="text-align:center;padding:32px 14px;color:#94A3B8;font-style:italic;font-size:12px;">No items added</td></tr>
        ` : items.map((item, idx) => {
          const base = Number(item.qty || 0) * Number(item.price || 0);
          const tax = base * (Number(item.gstPercent || 0) / 100);
          const bg = idx % 2 === 0 ? '#ffffff' : '#FAFBFF';
          return `
            <tr style="background:${bg};">
              <td style="padding:11px 14px;border-bottom:1px solid #F1F5F9;font-size:11px;color:#94A3B8;font-weight:600;">${String(idx + 1).padStart(2, '0')}</td>
              <td style="padding:11px 14px;border-bottom:1px solid #F1F5F9;font-size:11.5px;font-weight:600;color:#1E293B;">${esc(item.name)}</td>
              ${isGst ? `<td style="padding:11px 14px;border-bottom:1px solid #F1F5F9;font-size:11px;color:#64748B;">${esc(item.hsn) || '—'}</td>` : ''}
              <td style="padding:11px 14px;border-bottom:1px solid #F1F5F9;font-size:11px;text-align:center;color:#1E293B;font-weight:500;">${Number(item.qty || 0)}</td>
              <td style="padding:11px 14px;border-bottom:1px solid #F1F5F9;font-size:11px;text-align:right;color:#64748B;">${fmt(item.price)}</td>
              <td style="padding:11px 14px;border-bottom:1px solid #F1F5F9;font-size:11px;text-align:center;color:#64748B;">${Number(item.gstPercent || 0)}%</td>
              <td style="padding:11px 14px;border-bottom:1px solid #F1F5F9;font-size:11.5px;text-align:right;font-weight:700;color:#1E293B;">${fmt(base + tax)}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>

  <!-- ═══ BOTTOM SECTION ═══ -->
  <div style="padding:20px 40px 0;display:flex;gap:24px;position:relative;z-index:1;">
    <!-- Left: Amount in Words + Payment -->
    <div style="flex:1;">
      ${amountWords ? `
      <div style="background:#F8FAFC;border-radius:8px;padding:10px 14px;font-size:10.5px;color:#64748B;margin-bottom:12px;border-left:3px solid #4F6EF7;">
        <span style="font-weight:700;color:#1E293B;">Amount in Words:</span> ${amountWords}
      </div>` : ''}

      ${(settings?.bankName || settings?.accountNumber || settings?.upiId) ? `
      <div style="background:linear-gradient(135deg,#F0FDF4,#ECFDF5);border:1px solid #BBF7D0;border-radius:8px;padding:14px 16px;">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#16A34A;margin-bottom:8px;">Bank / Payment Details</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px 28px;font-size:11px;color:#475569;">
          ${settings.bankName ? `<div><span style="color:#64748B;">Bank:</span> <span style="font-weight:600;color:#1E293B;">${esc(settings.bankName)}</span></div>` : ''}
          ${settings.accountNumber ? `<div><span style="color:#64748B;">A/C No:</span> <span style="font-weight:600;color:#1E293B;">${esc(settings.accountNumber)}</span></div>` : ''}
          ${settings.ifscCode ? `<div><span style="color:#64748B;">IFSC:</span> <span style="font-weight:600;color:#1E293B;">${esc(settings.ifscCode)}</span></div>` : ''}
          ${settings.upiId ? `<div><span style="color:#64748B;">UPI:</span> <span style="font-weight:600;color:#1E293B;">${esc(settings.upiId)}</span></div>` : ''}
        </div>
      </div>` : ''}
    </div>

    <!-- Right: Signature -->
    <div style="text-align:center;min-width:160px;padding-top:8px;">
      ${(formData.signature || settings?.signature) ? `
        <img src="${formData.signature || settings?.signature}" alt="Signature" style="max-width:120px;max-height:48px;margin-bottom:4px;" />
      ` : `<div style="height:48px;"></div>`}
      <div style="width:150px;border-top:1.5px solid #CBD5E1;margin:0 auto;padding-top:6px;">
        <div style="font-size:9.5px;color:#94A3B8;font-weight:500;">Authorized Signatory</div>
      </div>
    </div>
  </div>

  <!-- ═══ TERMS ═══ -->
  ${(formData.termsAndConditions || settings?.termsAndConditions) ? `
  <div style="padding:14px 40px 0;position:relative;z-index:1;">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#4F6EF7;margin-bottom:5px;">Terms &amp; Conditions</div>
    <div style="font-size:9.5px;color:#94A3B8;line-height:1.6;white-space:pre-line;">${esc(formData.termsAndConditions || settings?.termsAndConditions || '')}</div>
  </div>` : ''}

  <!-- Spacer -->
  <div style="flex:1;min-height:20px;"></div>

  <!-- ═══ FOOTER ═══ -->
  <div style="background:linear-gradient(135deg,#F8FAFC,#F1F5F9);padding:12px 40px;display:flex;justify-content:space-between;align-items:center;border-top:1.5px solid #E2E8F0;position:relative;z-index:1;">
    <div style="font-size:9px;color:#94A3B8;font-weight:500;">
      © ${new Date().getFullYear()} ${esc(formData.businessName) || 'InvoiceFlow'}
    </div>
    <div style="font-size:9px;color:#94A3B8;font-weight:500;display:flex;align-items:center;gap:6px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      Powered by InvoiceFlow &nbsp;·&nbsp; ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
    </div>
  </div>

</div>`;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Download the invoice as PDF via browser print dialog.
 * Opens a popup window with the invoice, then triggers print (Save as PDF).
 * This approach uses the browser's native rendering engine — no html2canvas needed.
 */
export function downloadPDF(previewElement, filename, formData, summary, settings) {
  const safeName = String(filename || 'invoice').replace(/[^a-zA-Z0-9_-]/g, '_');

  try {
    const invoiceHTML = (formData && summary)
      ? generateProfessionalInvoiceHTML(formData, summary, settings || {})
      : (previewElement ? previewElement.innerHTML : '');

    // Open a popup window — browser renders it natively (colors, gradients, fonts all work)
    const w = 820;
    const h = 1160;
    const left = (screen.width - w) / 2;
    const top = (screen.height - h) / 2;
    const popup = window.open('', '_blank', `width=${w},height=${h},left=${left},top=${top}`);

    if (!popup || popup.closed) {
      showToast('Popup blocked. Please allow popups for this site and try again.', 'error');
      return;
    }

    popup.document.open();
    popup.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice - ${esc(invoiceNumber(formData))}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
      color: #1E293B;
      background: #fff;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page { size: A4; margin: 0; }
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      html, body { margin: 0; padding: 0; }
    }
  </style>
</head>
<body>${invoiceHTML}</body>
</html>`);
    popup.document.close();

    // Wait for fonts to load, then auto-trigger print
    let printed = false;
    const doPrint = () => {
      if (printed) return;
      printed = true;
      try {
        popup.focus();
        popup.print();
      } catch {
        showToast('Please use Ctrl+P / Cmd+P to save as PDF.', 'info');
      }
    };

    // Wait for fonts to be ready
    try {
      popup.document.fonts.ready.then(() => setTimeout(doPrint, 300));
    } catch {
      setTimeout(doPrint, 1500);
    }

    // Safety fallback — print after 3s even if fonts are slow
    setTimeout(doPrint, 3000);

    showToast('PDF ready — choose "Save as PDF" in the print dialog.', 'info', 5000);
  } catch (err) {
    console.error('[pdf] Download failed:', err);
    showToast('Failed to open PDF. Please try again.', 'error');
  }
}

function invoiceNumber(formData) {
  return formData ? (formData.invoiceNumber || 'invoice') : 'invoice';
}

/**
 * Open print dialog with the professional invoice template.
 */
export function printInvoice(previewElement, formData, summary, settings) {
  try {
    const invoiceHTML = (formData && summary)
      ? generateProfessionalInvoiceHTML(formData, summary, settings || {})
      : previewElement.innerHTML;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:100%;height:100%;border:none;opacity:0;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <title>Print Invoice</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; color: #1E293B; background: #fff; }
    @page { size: A4; margin: 0; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>${invoiceHTML}</body>
</html>`);
    doc.close();

    // Wait for fonts + content to fully render before printing
    setTimeout(() => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch { window.print(); }
      setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 1000);
    }, 800);
  } catch (err) {
    console.error('[pdf] Print failed:', err);
    window.print();
  }
}

/**
 * Share the invoice via Web Share API or clipboard.
 */
export async function shareInvoice(invoiceData) {
  const data = invoiceData || {};
  const total = Number(data.grandTotal || data.grand_total || 0);
  const formatted = '₹' + total.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const text = `Invoice ${data.invoiceNumber || data.invoice_number || ''} for ${data.customerName || data.customer_name || 'Customer'} — ${formatted}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: `Invoice ${data.invoiceNumber || ''}`, text });
      showToast('Invoice shared!', 'success');
    } catch (err) {
      if (err.name !== 'AbortError') fallbackCopy(text);
    }
  } else {
    fallbackCopy(text);
  }
}

async function fallbackCopy(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Invoice details copied to clipboard!', 'success');
  } catch {
    showToast('Unable to share. Please copy manually.', 'error');
  }
}
