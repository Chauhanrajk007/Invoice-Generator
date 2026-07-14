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

  // Status watermark color
  const watermarkColors = {
    PAID: '#10B981',
    PENDING: '#F59E0B',
    DRAFT: '#94A3B8',
  };
  const wmColor = watermarkColors[status] || '#94A3B8';

  // Format currency
  const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Amount in words
  let amountWords = '';
  try {
    amountWords = amountToWords(summary.grandTotal);
  } catch {
    amountWords = '';
  }

  const items = (formData.items || []).filter(i => i && i.name);

  return `
<div style="position:relative;width:210mm;height:297mm;padding:0;margin:0 auto;background:#ffffff;font-family:'Inter','Segoe UI',Arial,sans-serif;color:#1E293B;font-size:12px;line-height:1.5;overflow:hidden;display:flex;flex-direction:column;">
  
  <!-- Status Watermark -->
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:100px;font-weight:900;color:${wmColor};opacity:0.06;pointer-events:none;white-space:nowrap;z-index:0;letter-spacing:8px;">
    ${status}
  </div>

  <!-- Header Bar -->
  <div style="background:linear-gradient(135deg,#4F6EF7 0%,#3B5BDE 100%);padding:28px 36px;display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:1;flex-shrink:0;">
    <div style="color:#ffffff;max-width:55%;">
      ${formData.businessLogo ? `<img src="${formData.businessLogo}" alt="Logo" style="max-width:80px;max-height:50px;margin-bottom:8px;border-radius:6px;" />` : ''}
      <div style="font-size:20px;font-weight:700;margin-bottom:2px;color:#ffffff;">${esc(formData.businessName) || 'Your Business'}</div>
      ${formData.businessPhone ? `<div style="font-size:11px;color:rgba(255,255,255,0.9);margin-top:2px;">${esc(formData.businessPhone)}</div>` : ''}
      ${formData.businessEmail ? `<div style="font-size:11px;color:rgba(255,255,255,0.9);">${esc(formData.businessEmail)}</div>` : ''}
      ${formData.businessAddress ? `<div style="font-size:11px;color:rgba(255,255,255,0.9);">${esc(formData.businessAddress)}</div>` : ''}
      ${formData.businessGstin ? `<div style="font-size:11px;color:rgba(255,255,255,0.9);margin-top:4px;"><strong>GSTIN:</strong> ${esc(formData.businessGstin)}</div>` : ''}
    </div>
    <div style="text-align:right;color:#ffffff;">
      <div style="font-size:28px;font-weight:800;letter-spacing:1px;color:#ffffff;">${isGst ? 'GST INVOICE' : 'INVOICE'}</div>
      <div style="font-size:14px;font-weight:600;margin-top:6px;color:rgba(255,255,255,0.95);">${esc(formData.invoiceNumber) || 'INV-XXXX'}</div>
      <div style="font-size:12px;margin-top:2px;color:rgba(255,255,255,0.85);">Date: ${esc(formData.date) || ''}</div>
      <div style="margin-top:10px;display:inline-block;padding:4px 14px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.5px;background:rgba(255,255,255,0.2);color:#ffffff;text-transform:uppercase;">${status}</div>
    </div>
  </div>

  <!-- Bill To Section -->
  <div style="padding:24px 36px 16px;display:flex;justify-content:space-between;gap:24px;position:relative;z-index:1;flex-shrink:0;">
    <div style="flex:1;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#4F6EF7;margin-bottom:6px;">Bill To</div>
      <div style="font-size:15px;font-weight:700;color:#1E293B;margin-bottom:4px;">${esc(formData.customerName) || 'Customer Name'}</div>
      ${formData.customerPhone ? `<div style="font-size:11px;color:#475569;">${esc(formData.customerPhone)}</div>` : ''}
      ${formData.customerEmail ? `<div style="font-size:11px;color:#475569;">${esc(formData.customerEmail)}</div>` : ''}
      ${formData.customerAddress ? `<div style="font-size:11px;color:#475569;margin-top:2px;">${esc(formData.customerAddress)}</div>` : ''}
      ${formData.customerGstin ? `<div style="font-size:11px;color:#475569;margin-top:4px;"><strong>GSTIN:</strong> ${esc(formData.customerGstin)}</div>` : ''}
    </div>
    <div style="text-align:right;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#4F6EF7;margin-bottom:6px;">Invoice Summary</div>
      <div style="font-size:11px;color:#475569;">Items: ${items.length}</div>
      <div style="font-size:11px;color:#475569;">Subtotal: ${fmt(summary.subtotal)}</div>
      <div style="font-size:16px;font-weight:800;color:#1E293B;margin-top:6px;">${fmt(summary.grandTotal)}</div>
    </div>
  </div>

  <!-- Items Table -->
  <div style="padding:0 36px;position:relative;z-index:1;flex-shrink:0;">
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">
      <thead>
        <tr style="background:#EEF1FE;">
          <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#4F6EF7;border-bottom:2px solid #D6DDFC;">#</th>
          <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#4F6EF7;border-bottom:2px solid #D6DDFC;">Item</th>
          ${isGst ? '<th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#4F6EF7;border-bottom:2px solid #D6DDFC;">HSN/SAC</th>' : ''}
          <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#4F6EF7;border-bottom:2px solid #D6DDFC;">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#4F6EF7;border-bottom:2px solid #D6DDFC;">Price</th>
          <th style="padding:10px 12px;text-align:center;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#4F6EF7;border-bottom:2px solid #D6DDFC;">GST</th>
          <th style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#4F6EF7;border-bottom:2px solid #D6DDFC;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.length === 0 ? `
          <tr><td colspan="${isGst ? 7 : 6}" style="text-align:center;padding:24px;color:#94A3B8;font-style:italic;">No items added</td></tr>
        ` : items.map((item, idx) => {
          const base = Number(item.qty || 0) * Number(item.price || 0);
          const tax = base * (Number(item.gstPercent || 0) / 100);
          const bg = idx % 2 === 0 ? '#ffffff' : '#FAFBFF';
          return `
            <tr style="background:${bg};">
              <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:12px;color:#1E293B;">${idx + 1}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:12px;font-weight:600;color:#1E293B;">${esc(item.name)}</td>
              ${isGst ? `<td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:12px;color:#475569;">${esc(item.hsn) || '—'}</td>` : ''}
              <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:12px;text-align:center;color:#1E293B;">${Number(item.qty || 0)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:12px;text-align:right;color:#1E293B;">${fmt(item.price)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:12px;text-align:center;color:#1E293B;">${Number(item.gstPercent || 0)}%</td>
              <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:12px;text-align:right;font-weight:600;color:#1E293B;">${fmt(base + tax)}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>

  <!-- Summary -->
  <div style="padding:16px 36px 0;display:flex;justify-content:flex-end;position:relative;z-index:1;flex-shrink:0;">
    <div style="width:280px;">
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:#475569;">
        <span>Subtotal</span><span style="font-weight:600;color:#1E293B;">${fmt(summary.subtotal)}</span>
      </div>
      ${summary.discount > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:#EF4444;">
          <span>Discount</span><span style="font-weight:600;">-${fmt(summary.discount)}</span>
        </div>
      ` : ''}
      ${isGst ? (summary.interState ? `
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:#475569;">
          <span>IGST</span><span style="font-weight:600;color:#1E293B;">${fmt(summary.igst)}</span>
        </div>
      ` : `
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:#475569;">
          <span>CGST</span><span style="font-weight:600;color:#1E293B;">${fmt(summary.cgst)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:#475569;">
          <span>SGST</span><span style="font-weight:600;color:#1E293B;">${fmt(summary.sgst)}</span>
        </div>
      `) : (summary.totalTax > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:#475569;">
          <span>Tax (GST)</span><span style="font-weight:600;color:#1E293B;">${fmt(summary.totalTax)}</span>
        </div>
      ` : '')}
      <div style="display:flex;justify-content:space-between;padding:12px 0 6px;font-size:16px;font-weight:800;color:#1E293B;border-top:2px solid #4F6EF7;margin-top:6px;">
        <span>Grand Total</span><span>${fmt(summary.grandTotal)}</span>
      </div>
    </div>
  </div>

  <!-- Amount in Words -->
  ${amountWords ? `
  <div style="padding:12px 36px;position:relative;z-index:1;flex-shrink:0;">
    <div style="background:#F8FAFC;border-radius:8px;padding:10px 16px;font-size:11px;color:#475569;">
      <strong style="color:#1E293B;">Amount in words:</strong> ${amountWords}
    </div>
  </div>
  ` : ''}

  <!-- Payment Details -->
  ${(settings?.bankName || settings?.accountNumber || settings?.upiId) ? `
  <div style="padding:8px 36px;position:relative;z-index:1;flex-shrink:0;">
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:12px 16px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#16A34A;margin-bottom:6px;">Payment Details</div>
      <div style="display:flex;gap:32px;flex-wrap:wrap;font-size:11px;color:#475569;">
        ${settings.bankName ? `<div><strong style="color:#1E293B;">Bank:</strong> ${esc(settings.bankName)}</div>` : ''}
        ${settings.accountNumber ? `<div><strong style="color:#1E293B;">A/C:</strong> ${esc(settings.accountNumber)}</div>` : ''}
        ${settings.ifscCode ? `<div><strong style="color:#1E293B;">IFSC:</strong> ${esc(settings.ifscCode)}</div>` : ''}
        ${settings.upiId ? `<div><strong style="color:#1E293B;">UPI:</strong> ${esc(settings.upiId)}</div>` : ''}
      </div>
    </div>
  </div>
  ` : ''}

  <!-- Spacer to push footer to bottom -->
  <div style="flex:1;"></div>

  <!-- Footer: Terms + Signature — always at the bottom of the page -->
  <div style="padding:20px 36px 16px;display:flex;justify-content:space-between;align-items:flex-end;gap:24px;position:relative;z-index:1;flex-shrink:0;">
    <div style="flex:1;max-width:60%;">
      ${(formData.termsAndConditions || settings?.termsAndConditions) ? `
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#4F6EF7;margin-bottom:6px;">Terms &amp; Conditions</div>
        <div style="font-size:10px;color:#64748B;line-height:1.5;white-space:pre-line;">${esc(formData.termsAndConditions || settings?.termsAndConditions || '')}</div>
      ` : ''}
    </div>
    <div style="text-align:center;min-width:150px;">
      ${(formData.signature || settings?.signature) ? `<img src="${formData.signature || settings?.signature}" alt="Signature" style="max-width:120px;max-height:50px;margin-bottom:4px;" />` : ''}
      <div style="width:140px;border-top:1px solid #CBD5E1;margin:0 auto;padding-top:6px;font-size:10px;color:#64748B;">Authorized Signatory</div>
    </div>
  </div>

  <!-- Bottom Bar — copyright always at the very bottom -->
  <div style="background:#EEF1FE;padding:10px 36px;text-align:center;font-size:9px;color:#4F6EF7;border-top:2px solid #D6DDFC;position:relative;z-index:1;flex-shrink:0;font-weight:600;letter-spacing:0.3px;">
    © ${new Date().getFullYear()} ${esc(formData.businessName) || 'InvoiceFlow'} &nbsp;|&nbsp; Generated by InvoiceFlow &nbsp;|&nbsp; ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
  </div>
</div>`;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Download the invoice as a PDF.
 * Creates a dedicated container with the professional template to avoid the white sheet bug.
 */
export async function downloadPDF(previewElement, filename, formData, summary, settings) {
  if (typeof html2pdf === 'undefined') {
    showToast('PDF library is still loading. Please try again.', 'error');
    return;
  }

  const safeName = String(filename || 'invoice').replace(/[^a-zA-Z0-9_-]/g, '_');

  try {
    const invoiceHTML = generateProfessionalInvoiceHTML(formData, summary, settings || {});

    // Temporarily swap the preview element's content with the PDF-ready HTML
    // so html2canvas captures what's already visible on screen.
    const originalHTML = previewElement.innerHTML;
    const originalStyle = previewElement.getAttribute('style') || '';

    // Store original classes and container styles
    const previewParent = previewElement.parentElement;
    const parentOriginalStyle = previewParent ? previewParent.getAttribute('style') || '' : '';
    const grandParent = previewParent ? previewParent.parentElement : null;
    const grandParentOriginalStyle = grandParent ? grandParent.getAttribute('style') || '' : '';

    try {
      // Expand the preview to full A4 width so html2canvas captures it properly
      if (grandParent) grandParent.style.cssText = 'width:794px;overflow:visible;position:static !important;';
      if (previewParent) previewParent.style.cssText = 'width:794px;overflow:visible;position:static !important;';
      previewElement.style.cssText = 'width:794px;overflow:visible;position:static !important;padding:0;margin:0;';
      previewElement.innerHTML = invoiceHTML;

      // Wait for rendering
      const imgs = previewElement.querySelectorAll('img');
      if (imgs.length > 0) {
        await Promise.all(Array.from(imgs).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(r => { img.onload = r; img.onerror = r; setTimeout(r, 2000); });
        }));
      }
      await document.fonts.ready;
      await new Promise(r => setTimeout(r, 300));

      await html2pdf()
        .set({
          margin: 0,
          filename: `${safeName}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            letterRendering: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
          },
          jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
          },
        })
        .from(previewElement)
        .save();

      showToast('PDF downloaded successfully!', 'success');
    } finally {
      // Restore everything
      previewElement.innerHTML = originalHTML;
      previewElement.setAttribute('style', originalStyle);
      if (previewParent) previewParent.setAttribute('style', parentOriginalStyle);
      if (grandParent) grandParent.setAttribute('style', grandParentOriginalStyle);
    }
  } catch (err) {
    console.error('[pdf] Download failed:', err);
    showToast('Failed to generate PDF. Please try again.', 'error');
  }
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
