/**
 * create-invoice.js — Full invoice form with live preview
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

let autoSaveTimer = null;
let currentFormData = null;

export async function render(container, options = {}) {
  const isGstMode = options.isGstMode || false;

  // Check if we're viewing an existing invoice
  const hash = window.location.hash;
  const idMatch = hash.match(/[?&]id=([^&]+)/);
  const existingId = idMatch ? idMatch[1] : null;

  let existingInvoice = null;
  if (existingId) {
    existingInvoice = getInvoiceById(existingId);
  }

  // Load defaults from settings
  const settings = getSettings();

  // Load draft if no existing invoice
  const draft = (!existingInvoice && !isGstMode) ? getDraft() : null;

  // Initialize form data
  const formData = existingInvoice || draft || {
    invoiceNumber: peekNextInvoiceNumber(),
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

  renderForm(container, formData, existingInvoice !== null, isGstMode);
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

function renderForm(container, formData, isViewMode, isGstMode) {
  const summary = calcInvoiceSummary(
    formData.items,
    formData.discountValue,
    formData.discountType,
    formData.businessGstin,
    formData.customerGstin,
    formData.isGstInvoice || isGstMode
  );

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
        </div>
      </div>

      <!-- Right: Live Preview -->
      <div class="preview-panel">
        <div class="preview-container">
          <div class="preview-header">
            <span class="preview-header-title">Live Preview</span>
          </div>
          <div class="preview-body" id="previewBody">
            ${renderPreview(formData, summary)}
          </div>
        </div>
      </div>
    </div>
  `;

  // ====== EVENT LISTENERS ======
  bindFormEvents(container, formData, isGstMode);
}

function bindFormEvents(container, formData, isGstMode) {
  // Generic input handler — updates formData + preview + auto-save
  container.addEventListener('input', (e) => {
    const field = e.target.getAttribute('data-field');
    if (field && field in formData) {
      formData[field] = e.target.value;
      updatePreview(container, formData, isGstMode);
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
      updatePreview(container, formData, isGstMode);
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
      updatePreview(container, formData, isGstMode);
      scheduleAutoSave(formData);
    });
  }

  // Add Item button
  const addBtn = container.querySelector('#addItemBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const settings = getSettings();
      formData.items.push(createEmptyItem(settings.defaultGstPercent));
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
      updatePreview(container, formData, isGstMode);
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
              updatePreview(container, formData, isGstMode);
              scheduleAutoSave(formData);
            });
          });
        }
        updatePreview(container, formData, isGstMode);
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
      renderForm(container, formData, false, isGstMode);
    });
  });

  // Discount inputs
  const discountInput = container.querySelector('#discountValue');
  const discountType = container.querySelector('#discountType');
  if (discountInput) {
    discountInput.addEventListener('input', (e) => {
      formData.discountValue = safeNum(e.target.value);
      updateSummary(container, formData, isGstMode);
      updatePreview(container, formData, isGstMode);
      scheduleAutoSave(formData);
    });
  }
  if (discountType) {
    discountType.addEventListener('change', (e) => {
      formData.discountType = e.target.value;
      updateSummary(container, formData, isGstMode);
      updatePreview(container, formData, isGstMode);
      scheduleAutoSave(formData);
    });
  }

  // Save Draft
  const saveDraftBtn = container.querySelector('#saveDraftBtn');
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', () => {
      if (!validateRequired(container, formData)) return;
      formData.status = 'draft';
      if (!formData.id) {
        formData.invoiceNumber = getNextInvoiceNumber();
        container.querySelector('#invNumber').value = formData.invoiceNumber;
      }
      const success = saveInvoice(formData);
      if (success) {
        clearDraft();
        showToast('Invoice saved as draft!', 'success');
      } else {
        showToast('Failed to save. Storage might be full.', 'error');
      }
    });
  }

  // Download PDF
  const downloadBtn = container.querySelector('#downloadPdfBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (!validateRequired(container, formData)) return;
      // Save first
      formData.status = formData.status === 'draft' ? 'pending' : formData.status;
      if (!formData.id) {
        formData.invoiceNumber = getNextInvoiceNumber();
        container.querySelector('#invNumber').value = formData.invoiceNumber;
      }
      saveInvoice(formData);
      clearDraft();
      const preview = container.querySelector('#previewBody');
      downloadPDF(preview, formData.invoiceNumber || 'invoice');
    });
  }

  // Print
  const printBtn = container.querySelector('#printBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      const preview = container.querySelector('#previewBody');
      printInvoice(preview);
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
  const el = container.querySelector('#summarySection');
  if (el) el.innerHTML = renderSummary(summary, formData);

  // Re-bind discount inputs after re-render
  const discountInput = container.querySelector('#discountValue');
  const discountType = container.querySelector('#discountType');
  if (discountInput) {
    discountInput.addEventListener('input', (e) => {
      formData.discountValue = safeNum(e.target.value);
      updateSummary(container, formData, isGstMode);
      updatePreview(container, formData, isGstMode);
      scheduleAutoSave(formData);
    });
  }
  if (discountType) {
    discountType.addEventListener('change', (e) => {
      formData.discountType = e.target.value;
      updateSummary(container, formData, isGstMode);
      updatePreview(container, formData, isGstMode);
      scheduleAutoSave(formData);
    });
  }
}

// ====== LIVE PREVIEW ======

function renderPreview(formData, summary) {
  const isGst = formData.isGstInvoice;
  const settings = getSettings();

  return `
    <div class="inv-header">
      <div>
        ${formData.businessLogo ? `<img class="inv-logo" src="${formData.businessLogo}" alt="Logo" />` : ''}
        <div class="inv-party-name" style="margin-top:4px;">${escHtml(formData.businessName) || 'Your Business'}</div>
        ${formData.businessPhone ? `<div class="inv-party-detail">${escHtml(formData.businessPhone)}</div>` : ''}
        ${formData.businessEmail ? `<div class="inv-party-detail">${escHtml(formData.businessEmail)}</div>` : ''}
        ${formData.businessAddress ? `<div class="inv-party-detail">${escHtml(formData.businessAddress)}</div>` : ''}
        ${formData.businessGstin ? `<div class="inv-party-detail"><strong>GSTIN:</strong> ${escHtml(formData.businessGstin)}</div>` : ''}
      </div>
      <div>
        <div class="inv-title">${isGst ? 'GST INVOICE' : 'INVOICE'}</div>
        <div class="inv-meta">${escHtml(formData.invoiceNumber) || 'INV-XXXX'}</div>
        <div class="inv-meta">${formData.date || todayISO()}</div>
      </div>
    </div>

    <div class="inv-parties">
      <div>
        <div class="inv-party-label">Bill To</div>
        <div class="inv-party-name">${escHtml(formData.customerName) || 'Customer Name'}</div>
        ${formData.customerPhone ? `<div class="inv-party-detail">${escHtml(formData.customerPhone)}</div>` : ''}
        ${formData.customerEmail ? `<div class="inv-party-detail">${escHtml(formData.customerEmail)}</div>` : ''}
        ${formData.customerAddress ? `<div class="inv-party-detail">${escHtml(formData.customerAddress)}</div>` : ''}
        ${formData.customerGstin ? `<div class="inv-party-detail"><strong>GSTIN:</strong> ${escHtml(formData.customerGstin)}</div>` : ''}
      </div>
      <div></div>
    </div>

    <table class="inv-items-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Item</th>
          ${isGst ? '<th>HSN/SAC</th>' : ''}
          <th>Qty</th>
          <th>Price</th>
          <th>GST</th>
          <th style="text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${formData.items.filter(i => i && i.name).map((item, idx) => {
          const base = calcRowBase(item.qty, item.price);
          const tax = calcRowTax(item.qty, item.price, item.gstPercent);
          return `
            <tr>
              <td>${idx + 1}</td>
              <td>${escHtml(item.name)}</td>
              ${isGst ? `<td>${escHtml(item.hsn) || '-'}</td>` : ''}
              <td>${safeNum(item.qty)}</td>
              <td>${formatCurrency(item.price)}</td>
              <td>${safeNum(item.gstPercent)}%</td>
              <td style="text-align:right;">${formatCurrency(base + tax)}</td>
            </tr>
          `;
        }).join('')}
        ${formData.items.filter(i => i && i.name).length === 0 ? `
          <tr><td colspan="${isGst ? 7 : 6}" style="text-align:center;color:var(--text-muted);padding:16px;">No items added yet</td></tr>
        ` : ''}
      </tbody>
    </table>

    <div class="inv-summary">
      <div class="inv-summary-row"><span class="label">Subtotal</span><span class="value">${formatCurrency(summary.subtotal)}</span></div>
      ${summary.discount > 0 ? `<div class="inv-summary-row"><span class="label">Discount</span><span class="value">-${formatCurrency(summary.discount)}</span></div>` : ''}
      ${isGst ? (summary.interState ? `
        <div class="inv-summary-row"><span class="label">IGST</span><span class="value">${formatCurrency(summary.igst)}</span></div>
      ` : `
        <div class="inv-summary-row"><span class="label">CGST</span><span class="value">${formatCurrency(summary.cgst)}</span></div>
        <div class="inv-summary-row"><span class="label">SGST</span><span class="value">${formatCurrency(summary.sgst)}</span></div>
      `) : (summary.totalTax > 0 ? `
        <div class="inv-summary-row"><span class="label">Tax</span><span class="value">${formatCurrency(summary.totalTax)}</span></div>
      ` : '')}
      <div class="inv-summary-row total"><span class="label">Grand Total</span><span class="value">${formatCurrency(summary.grandTotal)}</span></div>
    </div>

    <div class="inv-amount-words">
      <strong>Amount in words:</strong> ${amountToWords(summary.grandTotal)}
    </div>

    <div class="inv-footer">
      <div class="inv-terms">
        ${escHtml(formData.termsAndConditions || settings.termsAndConditions || '')}
      </div>
      <div class="inv-signature">
        ${(formData.signature || settings.signature) ? `<img src="${formData.signature || settings.signature}" alt="Signature" />` : ''}
        <div class="inv-signature-line"></div>
        <div class="inv-signature-label">Authorized Signatory</div>
      </div>
    </div>
  `;
}

function updatePreview(container, formData, isGstMode) {
  const summary = calcInvoiceSummary(
    formData.items, formData.discountValue, formData.discountType,
    formData.businessGstin, formData.customerGstin,
    formData.isGstInvoice || isGstMode
  );
  const el = container.querySelector('#previewBody');
  if (el) el.innerHTML = renderPreview(formData, summary);
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
