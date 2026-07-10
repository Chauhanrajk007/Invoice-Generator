/**
 * gst-invoice.js — GST Invoice page
 * 
 * Wraps the create-invoice form with GST mode enabled.
 * Shows GST toggle, GSTIN fields, HSN/SAC, and CGST/SGST/IGST auto-calculation.
 */

import { render as renderCreateInvoice } from './create-invoice.js';

export async function render(container) {
  // Delegate to create-invoice with GST mode flag
  await renderCreateInvoice(container, { isGstMode: true });
}
