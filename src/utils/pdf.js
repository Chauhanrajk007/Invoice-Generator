/**
 * pdf.js — PDF download, print, and share utilities
 * 
 * Uses html2pdf.js (loaded via CDN in index.html).
 * Handles: missing library, generation failures, unsupported browsers.
 */

import { showToast } from '../main.js';

/**
 * Download the invoice preview as a PDF.
 * @param {HTMLElement} element - The preview element to convert
 * @param {string} filename - The PDF filename (without extension)
 */
export async function downloadPDF(element, filename) {
  if (!element) {
    showToast('Nothing to download. Please fill in the invoice first.', 'error');
    return;
  }

  // Check if html2pdf is loaded
  if (typeof html2pdf === 'undefined') {
    showToast('PDF library is still loading. Please try again in a moment.', 'error');
    return;
  }

  const safeName = String(filename || 'invoice').replace(/[^a-zA-Z0-9_-]/g, '_');

  try {
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${safeName}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
      },
    };

    await html2pdf().set(opt).from(element).save();
    showToast('PDF downloaded successfully!', 'success');
  } catch (err) {
    console.error('[pdf] Download failed:', err);
    showToast('Failed to generate PDF. Please try again.', 'error');
  }
}

/**
 * Open print dialog for the invoice preview.
 * @param {HTMLElement} element - The preview element to print
 */
export function printInvoice(element) {
  if (!element) {
    showToast('Nothing to print. Please fill in the invoice first.', 'error');
    return;
  }

  try {
    // Create a hidden iframe for cleaner printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Invoice</title>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Inter', sans-serif; padding: 20px; color: #1E293B; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #E2E8F0; font-size: 12px; }
          th { font-weight: 600; background: #EEF1FE; color: #4F6EF7; font-size: 10px; text-transform: uppercase; }
          img { max-width: 100px; max-height: 60px; }
        </style>
      </head>
      <body>${element.innerHTML}</body>
      </html>
    `);
    doc.close();

    // Wait for fonts to load before printing
    iframe.contentWindow.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow.print();
        } catch {
          // Fallback: just print the main window
          window.print();
        }
        // Cleanup after print dialog closes
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch { /* already removed */ }
        }, 1000);
      }, 500);
    };
  } catch (err) {
    console.error('[pdf] Print failed:', err);
    // Fallback to simple window.print()
    window.print();
  }
}

/**
 * Share the invoice via Web Share API or copy to clipboard as fallback.
 * @param {object} invoiceData - { invoiceNumber, customerName, grandTotal }
 */
export async function shareInvoice(invoiceData) {
  const data = invoiceData || {};
  const text = `Invoice ${data.invoiceNumber || ''} for ${data.customerName || 'Customer'} — ₹${data.grandTotal || 0}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: `Invoice ${data.invoiceNumber || ''}`,
        text: text,
      });
      showToast('Invoice shared!', 'success');
    } catch (err) {
      // User cancelled or share failed
      if (err.name !== 'AbortError') {
        fallbackCopy(text);
      }
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
    showToast('Unable to share. Please copy the invoice details manually.', 'error');
  }
}
