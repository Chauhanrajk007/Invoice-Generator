/**
 * create-invoice.js — Full invoice form with live preview
 *
 * Updated for:
 * - Async Supabase storage (await getSettings, getInvoiceById, etc.)
 * - RBAC permission checks
 * - Email Invoice button (mailto + GMass)
 * - Self-contained inline-styled preview for PDF generation (no CSS variables)
 * - Status watermark overlay on preview
 * - Payment details section in preview footer
 *
 * Edge cases handled:
 * - Empty items array (at least 1 row always present)
 * - NaN in any numeric field (falls back to 0)
 * - Missing customer/business details (graceful preview)
 * - Auto-save debounced (no rapid localStorage hammering)
 * - Logo/signature from settings auto-loaded
 * - View mode for existing invoices (loaded by ?id= param)
 */

import { getSettings, saveDraft, getDraft, clearDraft, saveInvoice, getInvoiceById, getNextInvoiceNumber, peekNextInvoiceNumber } from '../utils/storage.js';
import { calcRowBase, calcRowTax, calcInvoiceSummary, safeNum, round2 } from '../utils/calculations.js';
import { amountToWords } from '../utils/amount-words.js';
import { downloadPDF, printInvoice, shareInvoice } from '../utils/pdf.js';
import { showToast, formatCurrency, todayISO, navigateTo } from '../main.js';
import { hasPermission, canShow, ACTIONS } from '../utils/rbac.js';
import { sendInvoiceEmail, composeGMassEmail } from '../utils/email.js';

let autoSaveTimer = null;
let currentFormData = null;

export async function render(container, options = {}) {
  const isGstMode = options.isGstMode || false;

  // Show a brief loading state
  container.innerHTML = `
    <div class="page-header"><div><h1>Loading…</h1></div></div>
  `;

  // Check if we're viewing an existing invoice
  const hash = window.location.hash;
  const idMatch = hash.match(/[?&]id=([^&]+)/);
  const existingId = idMatch ? idMatch[1] : null;

  let existingInvoice = null;
  if (existingId) {
    existingInvoice = await getInvoiceById(existingId);
  }

  // Load defaults from settings (async)
  const settings = await getSettings();

  // Load draft if no existing invoice
  const draft = (!existingInvoice && !isGstMode) ? getDraft() : null;

  // Peek at next invoice number (async)
  const nextNumber = await peekNextInvoiceNumber();

  // Initialize form data
  const formData = existingInvoice || draft || {
    invoiceNumber: nextNumber,
    date: todayISO(),
    businessName: settings.businessName || '',
    businessGstin: settings.gstin || '',
    businessPhone: settings.phone || '',
    businessEmail: settings.email || '',
    businessAddress: settings.address || '',
    businessLogo: settings.logo || '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerAddress: '',
    customerGstin: '',
    items: [createEmptyItem(settings.defaultGstPercent)],
    discountValue: 0,
    discountType: 'amount',
    isGstInvoice: isGstMode,
    signature: settings.signature || '',
    termsAndConditions: settings.termsAndConditions || '',
    status: 'draft',
  };

  // Ensure items array is never empty
  if (!Array.isArray(formData.items) || formData.items.length === 0) {
    formData.items = [createEmptyItem(settings.defaultGstPercent)];
  }

  currentFormData = formData;

  renderForm(container, formData, existingInvoice !== null, isGstMode, settings);
}

function createEmptyItem(defaultGst) {
  return {
    name: '',
    hsn: '',
    qty: 1,
    price: 0,
    gstPercent: safeNum(defaultGst) || 18,
  };
}

function renderForm(container, formData, isViewMode, isGstMode, settings) {
  const summary = calcInvoiceSummary(
    formData.items,
    formData.discountValue,
    formData.discountType,
    formData.businessGstin,
    formData.customerGstin,
    formData.isGstInvoice || isGstMode
  );

  // Store grandTotal on formData for email use
  formData.grandTotal = summary.grandTotal;

  const showEmailBtn = canShow(ACTIONS.SEND_EMAIL);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${isViewMode ? 'View Invoice' : (isGstMode ? 'GST Invoice' : 'Create Invoice')}</h1>
        <p class="page-header-subtitle">${isViewMode ? `Invoice ${escAttr(formData.invoiceNumber)}` : 'Fill in the details to generate your invoice'}</p>
      </div>
    </div>

    <div class="invoice-layout">
      <!-- Left: Form -->
      <div class="invoice-form-column">

        ${isGstMode ? `
        <!-- GST Toggle -->
        <div class="card section-gap">
          <div class="toggle-group">
            <button class="toggle-option ${formData.isGstInvoice !== false ? 'active' : ''}" data-gst="true">GST Invoice</button>
            <button class="toggle-option ${formData.isGstInvoice === false ? 'active' : ''}" data-gst="false">Non-GST Invoice</button>
          </div>
        </div>
        ` : ''}

        <!-- Business Details -->
        <div class="card section-gap">
          <div class="card-header">
            <h3 class="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Business Details
            </h3>
            <button class="advanced-toggle" id="bizAdvToggle">
              More Options
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>

          <div class="form-row form-row-2 section-gap">
            <div class="form-group">
              <label class="form-label">Logo</label>
              <div class="logo-upload" id="bizLogoUpload">
                ${formData.businessLogo ? `<img src="${formData.businessLogo}" alt="Logo" id="bizLogoPreview" />` : `
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span>Upload</span>
                `}
                <input type="file" accept="image/*" id="bizLogoInput" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Business Name <span class="required">*</span></label>
              <input type="text" class="form-input" id="bizName" value="${escAttr(formData.businessName)}" placeholder="Your Business Name" data-field="businessName" />
              <span class="form-error" id="bizNameError"></span>
            </div>
          </div>

          <div class="advanced-content" id="bizAdvContent">
            <div class="form-row form-row-2 section-gap">
              <div class="form-group">
                <label class="form-label">GSTIN</label>
                <input type="text" class="form-input" id="bizGstin" value="${escAttr(formData.businessGstin)}" placeholder="22AAAAA0000A1Z5" maxlength="15" data-field="businessGstin" />
              </div>
              <div class="form-group">
                <label class="form-label">Phone</label>
                <input type="tel" class="form-input" id="bizPhone" value="${escAttr(formData.businessPhone)}" placeholder="+91 98765 43210" data-field="businessPhone" />
              </div>
            </div>
            <div class="form-row form-row-2">
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-input" id="bizEmail" value="${escAttr(formData.businessEmail)}" placeholder="email@business.com" data-field="businessEmail" />
              </div>
              <div class="form-group">
                <label class="form-label">Address</label>
                <input type="text" class="form-input" id="bizAddress" value="${escAttr(formData.businessAddress)}" placeholder="Business address" data-field="businessAddress" />
              </div>
            </div>
          </div>
        </div>

        <!-- Invoice Details (Number + Date) -->
        <div class="card section-gap">
          <div class="card-header">
            <h3 class="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Invoice Details
            </h3>
          </div>
          <div class="form-row form-row-2">
            <div class="form-group">
              <label class="form-label">Invoice Number</label>
              <input type="text" class="form-input" id="invNumber" value="${escAttr(formData.invoiceNumber)}" data-field="invoiceNumber" />
            </div>
            <div class="form-group">
              <label class="form-label">Date</label>
              <input type="date" class="form-input" id="invDate" value="${escAttr(formData.date)}" data-field="date" />
            </div>
          </div>
        </div>

        <!-- Customer Details -->
        <div class="card section-gap">
          <div class="card-header">
            <h3 class="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Customer Details
            </h3>
          </div>
          <div class="form-row form-row-2 section-gap">
            <div class="form-group">
              <label class="form-label">Customer Name <span class="required">*</span></label>
              <input type="text" class="form-input" id="custName" value="${escAttr(formData.customerName)}" placeholder="Customer or company name" data-field="customerName" />
              <span class="form-error" id="custNameError"></span>
            </div>
            <div class="form-group">
              <label class="form-label">Phone <span class="required">*</span></label>
              <input type="tel" class="form-input" id="custPhone" value="${escAttr(formData.customerPhone)}" placeholder="+91 98765 43210" data-field="customerPhone" />
              <span class="form-error" id="custPhoneError"></span>
            </div>
          </div>
          <div class="form-row form-row-2">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-input" id="custEmail" value="${escAttr(formData.customerEmail)}" placeholder="customer@email.com" data-field="customerEmail" />
            </div>
            <div class="form-group">
              <label class="form-label">Address</label>
              <textarea class="form-textarea" id="custAddress" placeholder="Customer address" data-field="customerAddress" style="min-height:42px;">${escAttr(formData.customerAddress)}</textarea>
            </div>
          </div>
          ${(isGstMode || formData.isGstInvoice) ? `
          <div class="form-row form-row-2 mt-12">
            <div class="form-group">
              <label class="form-label">Customer GSTIN</label>
              <input type="text" class="form-input" id="custGstin" value="${escAttr(formData.customerGstin)}" placeholder="22AAAAA0000A1Z5" maxlength="15" data-field="customerGstin" />
            </div>
            <div></div>
          </div>
          ` : ''}
        </div>

        <!-- Items Table -->
        <div class="card section-gap">
          <div class="card-header">
            <h3 class="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Items
            </h3>
          </div>
          <div class="table-wrapper">
            <table class="items-table" id="itemsTable">
              <thead>
                <tr>
                  <th class="col-name">Item Name</th>
                  ${(isGstMode || formData.isGstInvoice) ? '<th class="col-hsn">HSN/SAC</th>' : ''}
                  <th class="col-qty">Qty</th>
                  <th class="col-price">Price (₹)</th>
                  <th class="col-gst">GST %</th>
                  <th class="col-total">Total</th>
                  <th class="col-action"></th>
                </tr>
              </thead>
              <tbody id="itemsBody">
                ${formData.items.map((item, idx) => renderItemRow(item, idx, isGstMode || formData.isGstInvoice)).join('')}
              </tbody>
            </table>
          </div>
          <button class="add-item-btn" id="addItemBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            Add Item
          </button>
        </div>

        <!-- Summary -->
        <div class="card section-gap">
          <div class="card-header">
            <h3 class="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
              Summary
            </h3>
          </div>
          <div class="summary-grid" id="summarySection">
            ${renderSummary(summary, formData)}
          </div>
        </div>

        <!-- Actions -->
        <div class="action-bar" id="actionBar">
          <button class="btn btn-secondary" id="saveDraftBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Save Draft
          </button>
          <button class="btn btn-primary" id="downloadPdfBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download PDF
          </button>
          <button class="btn btn-secondary" id="printBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>
          <button class="btn btn-secondary" id="shareBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share
          </button>
          ${showEmailBtn ? `
          <button class="btn btn-secondary" id="emailInvoiceBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Email Invoice
          </button>
          ` : ''}
        </div>
      </div>

      <!-- Right: Live Preview -->
      <div class="preview-panel">
        <div class="preview-container">
          <div class="preview-header">
            <span class="preview-header-title">Live Preview</span>
          </div>
          <div class="preview-body" id="previewBody">
            ${renderPreview(formData, summary, settings)}
          </div>
        </div>
      </div>
    </div>

    <!-- Email Modal (hidden by default) -->
    <div class="modal-overlay" id="emailModal" style="display:none;">
      <div class="modal-box" style="max-width:440px;">
        <h3 class="modal-title">Email Invoice</h3>
        <p class="modal-desc">Send <strong>${escHtml(formData.invoiceNumber || 'this invoice')}</strong> to your customer.</p>
        <div style="margin:16px 0;">
          <label class="form-label">Recipient Email</label>
          <input type="email" class="form-input" id="emailRecipient" value="${escAttr(formData.customerEmail)}" placeholder="customer@email.com" />
        </div>
        <div class="modal-actions" style="gap:8px;">
          <button class="btn btn-secondary" id="emailModalCancel">Cancel</button>
          <button class="btn btn-primary" id="emailSendMailto">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Send via Email
          </button>
          <button class="btn btn-secondary" id="emailSendGMass" style="background:#D44638;color:#fff;border-color:#D44638;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Send via GMass
          </button>
        </div>
      </div>
    </div>
  `;

  // ====== EVENT LISTENERS ======
  bindFormEvents(container, formData, isGstMode, settings);
}

function bindFormEvents(container, formData, isGstMode, settings) {
  // Generic input handler — updates formData + preview + auto-save
  container.addEventListener('input', (e) => {
    const field = e.target.getAttribute('data-field');
    if (field && field in formData) {
      formData[field] = e.target.value;
      updatePreview(container, formData, isGstMode, settings);
      scheduleAutoSave(formData);
    }
  });

  // Items table delegation
  const itemsBody = container.querySelector('#itemsBody');
  if (itemsBody) {
    itemsBody.addEventListener('input', (e) => {
      const row = e.target.closest('tr');
      if (!row) return;
      const idx = parseInt(row.getAttribute('data-idx'));
      if (isNaN(idx) || idx < 0 || idx >= formData.items.length) return;

      const itemField = e.target.getAttribute('data-item-field');
      if (!itemField) return;

      if (['qty', 'price', 'gstPercent'].includes(itemField)) {
        formData.items[idx][itemField] = safeNum(e.target.value);
      } else {
        formData.items[idx][itemField] = e.target.value;
      }

      // Update row total display
      const item = formData.items[idx];
      const rowTotal = calcRowBase(item.qty, item.price) + calcRowTax(item.qty, item.price, item.gstPercent);
      const totalEl = row.querySelector('.row-total');
      if (totalEl) totalEl.textContent = formatCurrency(rowTotal);

      updateSummary(container, formData, isGstMode);
      updatePreview(container, formData, isGstMode, settings);
      scheduleAutoSave(formData);
    });

    // Delete item row
    itemsBody.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.delete-row-btn');
      if (!deleteBtn) return;

      const row = deleteBtn.closest('tr');
      if (!row) return;
      const idx = parseInt(row.getAttribute('data-idx'));
      if (isNaN(idx)) return;

      // Don't delete the last row
      if (formData.items.length <= 1) {
        showToast('You need at least one item.', 'info');
        return;
      }

      formData.items.splice(idx, 1);
      // Re-render items
      const tbody = container.querySelector('#itemsBody');
      if (tbody) {
        tbody.innerHTML = formData.items.map((item, i) => renderItemRow(item, i, isGstMode || formData.isGstInvoice)).join('');
      }
      updateSummary(container, formData, isGstMode);
      updatePreview(container, formData, isGstMode, settings);
      scheduleAutoSave(formData);
    });
  }

  // Add Item button
  const addBtn = container.querySelector('#addItemBtn');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const latestSettings = await getSettings();
      formData.items.push(createEmptyItem(latestSettings.defaultGstPercent));
      const tbody = container.querySelector('#itemsBody');
      if (tbody) {
        tbody.innerHTML = formData.items.map((item, i) => renderItemRow(item, i, isGstMode || formData.isGstInvoice)).join('');
        // Focus the new item's name field
        const lastRow = tbody.lastElementChild;
        if (lastRow) {
          const nameInput = lastRow.querySelector('[data-item-field="name"]');
          if (nameInput) nameInput.focus();
        }
      }
      updateSummary(container, formData, isGstMode);
      updatePreview(container, formData, isGstMode, settings);
      scheduleAutoSave(formData);
    });
  }

  // Logo upload
  const logoInput = container.querySelector('#bizLogoInput');
  if (logoInput) {
    logoInput.addEventListener('change', (e) => {
      handleFileUpload(e.target.files, (dataUrl) => {
        formData.businessLogo = dataUrl;
        const uploadEl = container.querySelector('#bizLogoUpload');
        if (uploadEl) {
          uploadEl.innerHTML = `<img src="${dataUrl}" alt="Logo" id="bizLogoPreview" /><input type="file" accept="image/*" id="bizLogoInput" />`;
          // Re-bind
          const newInput = uploadEl.querySelector('#bizLogoInput');
          if (newInput) newInput.addEventListener('change', (ev) => {
            handleFileUpload(ev.target.files, (url) => {
              formData.businessLogo = url;
              uploadEl.querySelector('img').src = url;
              updatePreview(container, formData, isGstMode, settings);
              scheduleAutoSave(formData);
            });
          });
        }
        updatePreview(container, formData, isGstMode, settings);
        scheduleAutoSave(formData);
      });
    });
  }

  // Advanced toggle
  const advToggle = container.querySelector('#bizAdvToggle');
  const advContent = container.querySelector('#bizAdvContent');
  if (advToggle && advContent) {
    advToggle.addEventListener('click', () => {
      advToggle.classList.toggle('open');
      advContent.classList.toggle('show');
    });
  }

  // GST toggle (for GST invoice page)
  container.querySelectorAll('[data-gst]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-gst]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      formData.isGstInvoice = btn.getAttribute('data-gst') === 'true';
      // Re-render the whole form to show/hide GST fields
      renderForm(container, formData, false, isGstMode, settings);
    });
  });

  // Discount inputs
  const discountInput = container.querySelector('#discountValue');
  const discountType = container.querySelector('#discountType');
  if (discountInput) {
    discountInput.addEventListener('input', (e) => {
      formData.discountValue = safeNum(e.target.value);
      updateSummary(container, formData, isGstMode);
      updatePreview(container, formData, isGstMode, settings);
      scheduleAutoSave(formData);
    });
  }
  if (discountType) {
    discountType.addEventListener('change', (e) => {
      formData.discountType = e.target.value;
      updateSummary(container, formData, isGstMode);
      updatePreview(container, formData, isGstMode, settings);
      scheduleAutoSave(formData);
    });
  }

  // Save Draft
  const saveDraftBtn = container.querySelector('#saveDraftBtn');
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', async () => {
      if (!validateRequired(container, formData)) return;

      const allowed = await hasPermission(ACTIONS.CREATE_INVOICE);
      if (!allowed) {
        showToast('You don\'t have permission to save invoices.', 'error');
        return;
      }

      formData.status = 'draft';
      if (!formData.id) {
        formData.invoiceNumber = await getNextInvoiceNumber();
        const invNumEl = container.querySelector('#invNumber');
        if (invNumEl) invNumEl.value = formData.invoiceNumber;
      }

      // Compute and store grandTotal before saving
      const sum = calcInvoiceSummary(
        formData.items, formData.discountValue, formData.discountType,
        formData.businessGstin, formData.customerGstin,
        formData.isGstInvoice || isGstMode
      );
      formData.grandTotal = sum.grandTotal;

      const success = await saveInvoice(formData);
      if (success) {
        clearDraft();
        showToast('Invoice saved as draft!', 'success');
      } else {
        showToast('Failed to save. Please try again.', 'error');
      }
    });
  }

  // Download PDF
  const downloadBtn = container.querySelector('#downloadPdfBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
      if (!validateRequired(container, formData)) return;

      const allowed = await hasPermission(ACTIONS.CREATE_INVOICE);
      if (!allowed) {
        showToast('You don\'t have permission to create invoices.', 'error');
        return;
      }

      // Save first
      formData.status = formData.status === 'draft' ? 'pending' : formData.status;
      if (!formData.id) {
        formData.invoiceNumber = await getNextInvoiceNumber();
        const invNumEl = container.querySelector('#invNumber');
        if (invNumEl) invNumEl.value = formData.invoiceNumber;
      }

      // Compute and store grandTotal
      const sum = calcInvoiceSummary(
        formData.items, formData.discountValue, formData.discountType,
        formData.businessGstin, formData.customerGstin,
        formData.isGstInvoice || isGstMode
      );
      formData.grandTotal = sum.grandTotal;

      await saveInvoice(formData);
      clearDraft();

      // Update preview before PDF capture
      updatePreview(container, formData, isGstMode, settings);

      const preview = container.querySelector('#previewBody');
      const sum = calcInvoiceSummary(
        formData.items, formData.discountValue, formData.discountType,
        formData.businessGstin, formData.customerGstin,
        formData.isGstInvoice || isGstMode
      );
      await downloadPDF(preview, formData.invoiceNumber || 'invoice', formData, sum, settings);
    });
  }

  // Print
  const printBtn = container.querySelector('#printBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      const preview = container.querySelector('#previewBody');
      const sum = calcInvoiceSummary(
        formData.items, formData.discountValue, formData.discountType,
        formData.businessGstin, formData.customerGstin,
        formData.isGstInvoice || isGstMode
      );
      printInvoice(preview, formData, sum, settings);
    });
  }

  // Share
  const shareBtn = container.querySelector('#shareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const summary = calcInvoiceSummary(
        formData.items, formData.discountValue, formData.discountType,
        formData.businessGstin, formData.customerGstin,
        formData.isGstInvoice || isGstMode
      );
      shareInvoice({
        invoiceNumber: formData.invoiceNumber,
        customerName: formData.customerName,
        grandTotal: summary.grandTotal,
      });
    });
  }

  // ====== EMAIL MODAL ======
  const emailBtn = container.querySelector('#emailInvoiceBtn');
  const emailModal = container.querySelector('#emailModal');
  if (emailBtn && emailModal) {
    emailBtn.addEventListener('click', async () => {
      const allowed = await hasPermission(ACTIONS.SEND_EMAIL);
      if (!allowed) {
        showToast('You don\'t have permission to send emails.', 'error');
        return;
      }
      // Pre-fill recipient
      const recipientInput = emailModal.querySelector('#emailRecipient');
      if (recipientInput) recipientInput.value = formData.customerEmail || '';
      emailModal.style.display = '';
    });

    // Close modal
    const cancelBtn = emailModal.querySelector('#emailModalCancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        emailModal.style.display = 'none';
      });
    }

    // Click overlay to close
    emailModal.addEventListener('click', (e) => {
      if (e.target === emailModal) emailModal.style.display = 'none';
    });

    // Send via mailto
    const mailtoBtn = emailModal.querySelector('#emailSendMailto');
    if (mailtoBtn) {
      mailtoBtn.addEventListener('click', () => {
        const recipient = emailModal.querySelector('#emailRecipient')?.value?.trim() || '';
        if (!recipient) {
          showToast('Please enter a recipient email.', 'error');
          return;
        }
        sendInvoiceEmail(formData, recipient, settings);
        emailModal.style.display = 'none';
        showToast('Opening email client…', 'info');
      });
    }

    // Send via GMass
    const gmassBtn = emailModal.querySelector('#emailSendGMass');
    if (gmassBtn) {
      gmassBtn.addEventListener('click', () => {
        const recipient = emailModal.querySelector('#emailRecipient')?.value?.trim() || '';
        if (!recipient) {
          showToast('Please enter a recipient email.', 'error');
          return;
        }
        composeGMassEmail(formData, recipient, settings);
        emailModal.style.display = 'none';
        showToast('Opening Gmail…', 'info');
      });
    }
  }
}

// ====== ITEM ROW RENDERING ======

function renderItemRow(item, idx, showHsn) {
  const total = calcRowBase(item.qty, item.price) + calcRowTax(item.qty, item.price, item.gstPercent);
  return `
    <tr data-idx="${idx}">
      <td class="col-name"><input type="text" class="form-input" value="${escAttr(item.name)}" placeholder="Item name" data-item-field="name" /></td>
      ${showHsn ? `<td class="col-hsn"><input type="text" class="form-input" value="${escAttr(item.hsn)}" placeholder="HSN/SAC" data-item-field="hsn" /></td>` : ''}
      <td class="col-qty"><input type="number" class="form-input" value="${safeNum(item.qty)}" min="1" step="1" data-item-field="qty" /></td>
      <td class="col-price"><input type="number" class="form-input" value="${safeNum(item.price)}" min="0" step="0.01" data-item-field="price" /></td>
      <td class="col-gst"><input type="number" class="form-input" value="${safeNum(item.gstPercent)}" min="0" max="28" step="0.5" data-item-field="gstPercent" /></td>
      <td class="col-total"><div class="row-total">${formatCurrency(total)}</div></td>
      <td class="col-action">
        <button class="delete-row-btn" title="Remove item" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </td>
    </tr>
  `;
}

// ====== SUMMARY RENDERING ======

function renderSummary(summary, formData) {
  const isGst = formData.isGstInvoice;
  return `
    <div class="summary-row">
      <span class="label">Subtotal</span>
      <span class="value">${formatCurrency(summary.subtotal)}</span>
    </div>
    <div class="summary-row">
      <span class="label">Discount</span>
      <div class="discount-input-group">
        <input type="number" class="form-input" id="discountValue" value="${safeNum(formData.discountValue)}" min="0" step="0.01" />
        <select class="form-select" id="discountType">
          <option value="amount" ${formData.discountType !== 'percent' ? 'selected' : ''}>₹</option>
          <option value="percent" ${formData.discountType === 'percent' ? 'selected' : ''}>%</option>
        </select>
      </div>
    </div>
    ${summary.discount > 0 ? `
    <div class="summary-row">
      <span class="label">Discount Amount</span>
      <span class="value text-danger">-${formatCurrency(summary.discount)}</span>
    </div>
    ` : ''}
    ${isGst ? `
      ${summary.interState ? `
        <div class="summary-row">
          <span class="label">IGST</span>
          <span class="value">${formatCurrency(summary.igst)}</span>
        </div>
      ` : `
        <div class="summary-row">
          <span class="label">CGST</span>
          <span class="value">${formatCurrency(summary.cgst)}</span>
        </div>
        <div class="summary-row">
          <span class="label">SGST</span>
          <span class="value">${formatCurrency(summary.sgst)}</span>
        </div>
      `}
    ` : `
      <div class="summary-row">
        <span class="label">Tax (GST)</span>
        <span class="value">${formatCurrency(summary.totalTax)}</span>
      </div>
    `}
    <div class="summary-row total">
      <span class="label">Grand Total</span>
      <span class="value">${formatCurrency(summary.grandTotal)}</span>
    </div>
  `;
}

function updateSummary(container, formData, isGstMode) {
  const summary = calcInvoiceSummary(
    formData.items, formData.discountValue, formData.discountType,
    formData.businessGstin, formData.customerGstin,
    formData.isGstInvoice || isGstMode
  );
  formData.grandTotal = summary.grandTotal;

  const el = container.querySelector('#summarySection');
  if (el) el.innerHTML = renderSummary(summary, formData);

  // Re-bind discount inputs after re-render
  const discountInput = container.querySelector('#discountValue');
  const discountType = container.querySelector('#discountType');
  if (discountInput) {
    discountInput.addEventListener('input', (e) => {
      formData.discountValue = safeNum(e.target.value);
      updateSummary(container, formData, isGstMode);
      updatePreview(container, formData, isGstMode, null);
      scheduleAutoSave(formData);
    });
  }
  if (discountType) {
    discountType.addEventListener('change', (e) => {
      formData.discountType = e.target.value;
      updateSummary(container, formData, isGstMode);
      updatePreview(container, formData, isGstMode, null);
      scheduleAutoSave(formData);
    });
  }
}

// ====== LIVE PREVIEW ======
// CRITICAL: Uses inline styles and hardcoded colors — NO CSS variables.
// This ensures the PDF renderer captures correct colors.

function renderPreview(formData, summary, settings) {
  const isGst = formData.isGstInvoice;
  const s = settings || {};

  const status = (formData.status || 'draft').toUpperCase();
  const statusColor = status === 'PAID' ? '#22c55e' : status === 'PENDING' ? '#f59e0b' : '#94a3b8';

  // Payment details from settings
  const bankName = s.bankName || '';
  const accountNumber = s.accountNumber || '';
  const ifscCode = s.ifscCode || '';
  const upiId = s.upiId || '';
  const hasPaymentInfo = bankName || accountNumber || upiId;

  const itemRows = formData.items.filter(i => i && i.name).map((item, idx) => {
    const base = calcRowBase(item.qty, item.price);
    const tax = calcRowTax(item.qty, item.price, item.gstPercent);
    const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8f9fc';
    return `
      <tr style="background:${bgColor};">
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#374151;">${idx + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#374151;">${escHtml(item.name)}</td>
        ${isGst ? `<td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#374151;">${escHtml(item.hsn) || '-'}</td>` : ''}
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#374151;text-align:center;">${safeNum(item.qty)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#374151;text-align:right;">${formatCurrency(item.price)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#374151;text-align:center;">${safeNum(item.gstPercent)}%</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#374151;text-align:right;font-weight:600;">${formatCurrency(base + tax)}</td>
      </tr>
    `;
  }).join('');

  const colSpan = isGst ? 7 : 6;

  return `
    <div style="position:relative;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#1f2937;background:#ffffff;overflow:hidden;">

      <!-- Status Watermark -->
      <div style="position:absolute;top:60px;right:-20px;transform:rotate(35deg);font-size:54px;font-weight:800;color:${statusColor};opacity:0.08;letter-spacing:6px;pointer-events:none;z-index:0;white-space:nowrap;">${status}</div>

      <!-- Header Bar -->
      <div style="background:#4F6EF7;color:#ffffff;padding:24px 28px;display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="flex:1;">
          ${formData.businessLogo ? `<img src="${formData.businessLogo}" alt="Logo" style="max-height:48px;max-width:120px;margin-bottom:8px;display:block;border-radius:4px;" />` : ''}
          <div style="font-size:16px;font-weight:700;margin-bottom:2px;">${escHtml(formData.businessName) || 'Your Business'}</div>
          ${formData.businessPhone ? `<div style="font-size:11px;opacity:0.9;">${escHtml(formData.businessPhone)}</div>` : ''}
          ${formData.businessEmail ? `<div style="font-size:11px;opacity:0.9;">${escHtml(formData.businessEmail)}</div>` : ''}
          ${formData.businessAddress ? `<div style="font-size:11px;opacity:0.9;">${escHtml(formData.businessAddress)}</div>` : ''}
          ${formData.businessGstin ? `<div style="font-size:11px;opacity:0.9;margin-top:2px;">GSTIN: ${escHtml(formData.businessGstin)}</div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:22px;font-weight:800;letter-spacing:1px;margin-bottom:4px;">${isGst ? 'GST INVOICE' : 'INVOICE'}</div>
          <div style="font-size:13px;font-weight:600;opacity:0.95;">${escHtml(formData.invoiceNumber) || 'INV-XXXX'}</div>
          <div style="font-size:12px;opacity:0.85;margin-top:2px;">${formData.date || todayISO()}</div>
          <div style="margin-top:8px;display:inline-block;padding:3px 12px;border-radius:12px;font-size:10px;font-weight:700;letter-spacing:0.5px;background:rgba(255,255,255,0.2);color:#fff;">${status}</div>
        </div>
      </div>

      <!-- Bill To -->
      <div style="padding:20px 28px 12px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280;font-weight:600;margin-bottom:6px;">Bill To</div>
        <div style="font-size:14px;font-weight:700;color:#1f2937;margin-bottom:2px;">${escHtml(formData.customerName) || 'Customer Name'}</div>
        ${formData.customerPhone ? `<div style="font-size:12px;color:#4b5563;">${escHtml(formData.customerPhone)}</div>` : ''}
        ${formData.customerEmail ? `<div style="font-size:12px;color:#4b5563;">${escHtml(formData.customerEmail)}</div>` : ''}
        ${formData.customerAddress ? `<div style="font-size:12px;color:#4b5563;">${escHtml(formData.customerAddress)}</div>` : ''}
        ${formData.customerGstin ? `<div style="font-size:12px;color:#4b5563;margin-top:2px;"><strong>GSTIN:</strong> ${escHtml(formData.customerGstin)}</div>` : ''}
      </div>

      <!-- Items Table -->
      <div style="padding:0 28px;">
        <table style="width:100%;border-collapse:collapse;margin-top:4px;">
          <thead>
            <tr style="background:#EEF1FE;">
              <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#4F6EF7;font-weight:700;border-bottom:2px solid #4F6EF7;">#</th>
              <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#4F6EF7;font-weight:700;border-bottom:2px solid #4F6EF7;">Item</th>
              ${isGst ? '<th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#4F6EF7;font-weight:700;border-bottom:2px solid #4F6EF7;">HSN/SAC</th>' : ''}
              <th style="padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#4F6EF7;font-weight:700;border-bottom:2px solid #4F6EF7;">Qty</th>
              <th style="padding:8px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#4F6EF7;font-weight:700;border-bottom:2px solid #4F6EF7;">Price</th>
              <th style="padding:8px 10px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#4F6EF7;font-weight:700;border-bottom:2px solid #4F6EF7;">GST</th>
              <th style="padding:8px 10px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#4F6EF7;font-weight:700;border-bottom:2px solid #4F6EF7;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
            ${formData.items.filter(i => i && i.name).length === 0 ? `
              <tr><td colspan="${colSpan}" style="text-align:center;color:#9ca3af;padding:20px;font-size:12px;">No items added yet</td></tr>
            ` : ''}
          </tbody>
        </table>
      </div>

      <!-- Summary -->
      <div style="padding:16px 28px 0;display:flex;justify-content:flex-end;">
        <div style="min-width:220px;">
          <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#4b5563;">
            <span>Subtotal</span><span style="font-weight:600;">${formatCurrency(summary.subtotal)}</span>
          </div>
          ${summary.discount > 0 ? `
          <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#ef4444;">
            <span>Discount</span><span style="font-weight:600;">-${formatCurrency(summary.discount)}</span>
          </div>
          ` : ''}
          ${isGst ? (summary.interState ? `
            <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#4b5563;">
              <span>IGST</span><span style="font-weight:600;">${formatCurrency(summary.igst)}</span>
            </div>
          ` : `
            <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#4b5563;">
              <span>CGST</span><span style="font-weight:600;">${formatCurrency(summary.cgst)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#4b5563;">
              <span>SGST</span><span style="font-weight:600;">${formatCurrency(summary.sgst)}</span>
            </div>
          `) : (summary.totalTax > 0 ? `
            <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#4b5563;">
              <span>Tax</span><span style="font-weight:600;">${formatCurrency(summary.totalTax)}</span>
            </div>
          ` : '')}
          <div style="display:flex;justify-content:space-between;padding:8px 0 4px;font-size:14px;font-weight:800;color:#1f2937;border-top:2px solid #4F6EF7;margin-top:4px;">
            <span>Grand Total</span><span>${formatCurrency(summary.grandTotal)}</span>
          </div>
        </div>
      </div>

      <!-- Amount in Words -->
      <div style="padding:12px 28px 0;font-size:11px;color:#6b7280;">
        <strong style="color:#374151;">Amount in words:</strong> ${amountToWords(summary.grandTotal)}
      </div>

      <!-- Payment Details -->
      ${hasPaymentInfo ? `
      <div style="padding:14px 28px 0;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280;font-weight:600;margin-bottom:6px;">Payment Details</div>
        <div style="font-size:11px;color:#374151;line-height:1.6;">
          ${bankName ? `<div><strong>Bank:</strong> ${escHtml(bankName)}</div>` : ''}
          ${accountNumber ? `<div><strong>Account:</strong> ${escHtml(accountNumber)}</div>` : ''}
          ${ifscCode ? `<div><strong>IFSC:</strong> ${escHtml(ifscCode)}</div>` : ''}
          ${upiId ? `<div><strong>UPI:</strong> ${escHtml(upiId)}</div>` : ''}
        </div>
      </div>
      ` : ''}

      <!-- Footer -->
      <div style="padding:16px 28px 24px;margin-top:12px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #e5e7eb;">
        <div style="flex:1;font-size:11px;color:#6b7280;line-height:1.6;max-width:60%;white-space:pre-line;">
          ${escHtml(formData.termsAndConditions || s.termsAndConditions || '')}
        </div>
        <div style="text-align:center;min-width:120px;">
          ${(formData.signature || s.signature) ? `<img src="${formData.signature || s.signature}" alt="Signature" style="max-height:40px;max-width:120px;margin-bottom:4px;display:block;margin-left:auto;margin-right:auto;" />` : ''}
          <div style="width:120px;border-top:1px solid #9ca3af;margin:0 auto 4px;"></div>
          <div style="font-size:10px;color:#6b7280;">Authorized Signatory</div>
        </div>
      </div>
    </div>
  `;
}

function updatePreview(container, formData, isGstMode, settings) {
  const summary = calcInvoiceSummary(
    formData.items, formData.discountValue, formData.discountType,
    formData.businessGstin, formData.customerGstin,
    formData.isGstInvoice || isGstMode
  );
  formData.grandTotal = summary.grandTotal;
  const el = container.querySelector('#previewBody');
  if (el) el.innerHTML = renderPreview(formData, summary, settings);
}

// ====== VALIDATION ======

function validateRequired(container, formData) {
  let valid = true;

  // Business name
  const bizNameErr = container.querySelector('#bizNameError');
  const bizNameInput = container.querySelector('#bizName');
  if (!formData.businessName || !formData.businessName.trim()) {
    if (bizNameErr) bizNameErr.textContent = 'Business name is required';
    if (bizNameInput) bizNameInput.classList.add('error');
    valid = false;
  } else {
    if (bizNameErr) bizNameErr.textContent = '';
    if (bizNameInput) bizNameInput.classList.remove('error');
  }

  // Customer name
  const custNameErr = container.querySelector('#custNameError');
  const custNameInput = container.querySelector('#custName');
  if (!formData.customerName || !formData.customerName.trim()) {
    if (custNameErr) custNameErr.textContent = 'Customer name is required';
    if (custNameInput) custNameInput.classList.add('error');
    valid = false;
  } else {
    if (custNameErr) custNameErr.textContent = '';
    if (custNameInput) custNameInput.classList.remove('error');
  }

  // Customer phone
  const custPhoneErr = container.querySelector('#custPhoneError');
  const custPhoneInput = container.querySelector('#custPhone');
  if (!formData.customerPhone || !formData.customerPhone.trim()) {
    if (custPhoneErr) custPhoneErr.textContent = 'Phone number is required';
    if (custPhoneInput) custPhoneInput.classList.add('error');
    valid = false;
  } else {
    if (custPhoneErr) custPhoneErr.textContent = '';
    if (custPhoneInput) custPhoneInput.classList.remove('error');
  }

  // At least one item with a name
  const hasItems = formData.items.some(i => i && i.name && i.name.trim());
  if (!hasItems) {
    showToast('Please add at least one item with a name.', 'error');
    valid = false;
  }

  if (!valid) {
    showToast('Please fill in all required fields.', 'error');
    // Scroll to first error
    const firstError = container.querySelector('.error');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return valid;
}

// ====== AUTO-SAVE ======

function scheduleAutoSave(formData) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveDraft(formData);
  }, 1500);
}

// ====== FILE UPLOAD HELPER ======

function handleFileUpload(files, callback) {
  if (!files || files.length === 0) return;
  const file = files[0];

  if (!file.type.startsWith('image/')) {
    showToast('Please upload an image file.', 'error');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image too large. Max 2MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > 200) { h = Math.round(h * 200 / w); w = 200; }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/png', 0.8));
      } catch {
        showToast('Failed to process image.', 'error');
      }
    };
    img.onerror = () => showToast('Failed to load image.', 'error');
    img.src = e.target.result;
  };
  reader.onerror = () => showToast('Failed to read file.', 'error');
  reader.readAsDataURL(file);
}

// ====== HTML ESCAPE ======

function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}
