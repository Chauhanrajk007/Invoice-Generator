/**
 * settings.js — Business defaults, invoice preferences, signature upload
 */

import { getSettings, saveSettings } from '../utils/storage.js';
import { showToast } from '../main.js';

export async function render(container) {
  const settings = getSettings();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Settings</h1>
        <p class="page-header-subtitle">Set your business defaults to auto-fill invoices</p>
      </div>
    </div>

    <div class="card section-gap">
      <div class="settings-section">
        <h3 class="settings-section-title">Business Details</h3>
        <div class="form-row form-row-2 section-gap">
          <div class="form-group">
            <label class="form-label">Business Logo</label>
            <div class="logo-upload" id="logoUpload">
              ${settings.logo ? `<img src="${settings.logo}" alt="Logo" id="logoPreview" />` : `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Upload</span>
              `}
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" id="logoInput" />
            </div>
          </div>
          <div></div>
        </div>
        <div class="form-row form-row-2 section-gap">
          <div class="form-group">
            <label class="form-label">Business Name</label>
            <input type="text" class="form-input" id="settBusinessName" value="${escAttr(settings.businessName)}" placeholder="Your Business Name" />
          </div>
          <div class="form-group">
            <label class="form-label">GSTIN</label>
            <input type="text" class="form-input" id="settGstin" value="${escAttr(settings.gstin)}" placeholder="22AAAAA0000A1Z5" maxlength="15" />
          </div>
        </div>
        <div class="form-row form-row-2 section-gap">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="tel" class="form-input" id="settPhone" value="${escAttr(settings.phone)}" placeholder="+91 98765 43210" />
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="settEmail" value="${escAttr(settings.email)}" placeholder="business@example.com" />
          </div>
        </div>
        <div class="form-row form-row-2 section-gap">
          <div class="form-group">
            <label class="form-label">Address</label>
            <textarea class="form-textarea" id="settAddress" placeholder="Business address">${escAttr(settings.address)}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">State</label>
            <input type="text" class="form-input" id="settState" value="${escAttr(settings.state)}" placeholder="Maharashtra" />
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Invoice Preferences</h3>
        <div class="form-row form-row-3 section-gap">
          <div class="form-group">
            <label class="form-label">Invoice Number Prefix</label>
            <input type="text" class="form-input" id="settPrefix" value="${escAttr(settings.invoicePrefix)}" placeholder="INV-" />
          </div>
          <div class="form-group">
            <label class="form-label">Starting Number</label>
            <input type="number" class="form-input" id="settStartNum" value="${Math.max(1, Number(settings.startingNumber) || 1)}" min="1" />
          </div>
          <div class="form-group">
            <label class="form-label">Default GST %</label>
            <input type="number" class="form-input" id="settGstPercent" value="${Number(settings.defaultGstPercent) || 18}" min="0" max="28" step="0.5" />
          </div>
        </div>
        <div class="form-group section-gap">
          <label class="form-label">Terms & Conditions</label>
          <textarea class="form-textarea" id="settTerms" placeholder="Payment terms, notes, etc.">${escAttr(settings.termsAndConditions)}</textarea>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">Signature</h3>
        <div class="form-group">
          <label class="form-label">Upload Signature Image</label>
          <div class="logo-upload" id="sigUpload" style="width: 180px; height: 80px;">
            ${settings.signature ? `<img src="${settings.signature}" alt="Signature" id="sigPreview" />` : `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
              <span>Upload Signature</span>
            `}
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" id="sigInput" />
          </div>
        </div>
      </div>

      <div class="action-bar">
        <button class="btn btn-primary btn-lg" id="saveSettingsBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Save Settings
        </button>
      </div>
    </div>
  `;

  // Logo upload
  const logoInput = container.querySelector('#logoInput');
  const logoUpload = container.querySelector('#logoUpload');
  if (logoInput) {
    logoInput.addEventListener('change', (e) => {
      handleImageUpload(e.target.files, logoUpload, 'logoPreview', 200);
    });
  }

  // Signature upload
  const sigInput = container.querySelector('#sigInput');
  const sigUpload = container.querySelector('#sigUpload');
  if (sigInput) {
    sigInput.addEventListener('change', (e) => {
      handleImageUpload(e.target.files, sigUpload, 'sigPreview', 300);
    });
  }

  // Save
  const saveBtn = container.querySelector('#saveSettingsBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const data = {
        businessName: getVal('settBusinessName'),
        gstin: getVal('settGstin').toUpperCase(),
        phone: getVal('settPhone'),
        email: getVal('settEmail'),
        address: getVal('settAddress'),
        state: getVal('settState'),
        invoicePrefix: getVal('settPrefix') || 'INV-',
        startingNumber: Math.max(1, parseInt(getVal('settStartNum')) || 1),
        defaultGstPercent: Math.max(0, Math.min(28, parseFloat(getVal('settGstPercent')) || 18)),
        termsAndConditions: getVal('settTerms'),
      };

      // Get images from preview elements if they exist
      const logoImg = container.querySelector('#logoPreview');
      if (logoImg) data.logo = logoImg.src;

      const sigImg = container.querySelector('#sigPreview');
      if (sigImg) data.signature = sigImg.src;

      const success = saveSettings(data);
      if (success) {
        showToast('Settings saved!', 'success');
      } else {
        showToast('Failed to save settings. Storage might be full.', 'error');
      }
    });
  }
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function handleImageUpload(files, uploadEl, previewId, maxWidth) {
  if (!files || files.length === 0) return;
  const file = files[0];

  // Validate file type
  if (!file.type.startsWith('image/')) {
    showToast('Please upload an image file.', 'error');
    return;
  }

  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image is too large. Maximum size is 2MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    // Resize image to save localStorage space
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round(h * maxWidth / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/png', 0.8);

        uploadEl.innerHTML = `<img src="${dataUrl}" alt="Uploaded" id="${previewId}" /><input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" id="${uploadEl.querySelector('input') ? uploadEl.querySelector('input').id : 'fileInput'}" />`;
        // Re-attach event listener
        const newInput = uploadEl.querySelector('input[type=file]');
        if (newInput) {
          newInput.addEventListener('change', (ev) => {
            handleImageUpload(ev.target.files, uploadEl, previewId, maxWidth);
          });
        }
      } catch {
        showToast('Failed to process image. Please try another file.', 'error');
      }
    };
    img.onerror = () => {
      showToast('Failed to load image. Please try another file.', 'error');
    };
    img.src = e.target.result;
  };
  reader.onerror = () => {
    showToast('Failed to read file. Please try again.', 'error');
  };
  reader.readAsDataURL(file);
}

function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
