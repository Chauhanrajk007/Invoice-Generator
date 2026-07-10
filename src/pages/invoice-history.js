/**
 * invoice-history.js — Full invoice list with search, filter, and CRUD
 */

import { getInvoices, deleteInvoice, updateInvoiceStatus } from '../utils/storage.js';
import { formatCurrency, formatDate, navigateTo, showToast, showConfirm } from '../main.js';

let currentFilter = 'all';
let searchQuery = '';

export async function render(container) {
  currentFilter = 'all';
  searchQuery = '';
  renderList(container);
}

function renderList(container) {
  let invoices = getInvoices();

  // Apply filter
  if (currentFilter !== 'all') {
    invoices = invoices.filter(i => i.status === currentFilter);
  }

  // Apply search
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    invoices = invoices.filter(i => {
      const num = String(i.invoiceNumber || '').toLowerCase();
      const name = String(i.customerName || '').toLowerCase();
      return num.includes(q) || name.includes(q);
    });
  }

  const allInvoices = getInvoices();
  const counts = {
    all: allInvoices.length,
    paid: allInvoices.filter(i => i.status === 'paid').length,
    pending: allInvoices.filter(i => i.status === 'pending').length,
    draft: allInvoices.filter(i => i.status === 'draft').length,
  };

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Invoice History</h1>
        <p class="page-header-subtitle">${allInvoices.length} invoice${allInvoices.length !== 1 ? 's' : ''} total</p>
      </div>
      <button class="btn btn-primary" id="histCreateBtn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        New Invoice
      </button>
    </div>

    <!-- Search & Filter -->
    <div class="search-bar">
      <div class="search-input-wrapper">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" class="form-input" id="histSearch" placeholder="Search by invoice number or customer..." value="${escAttr(searchQuery)}" />
      </div>
      <div class="filter-tabs">
        <button class="filter-tab ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All (${counts.all})</button>
        <button class="filter-tab ${currentFilter === 'paid' ? 'active' : ''}" data-filter="paid">Paid (${counts.paid})</button>
        <button class="filter-tab ${currentFilter === 'pending' ? 'active' : ''}" data-filter="pending">Pending (${counts.pending})</button>
        <button class="filter-tab ${currentFilter === 'draft' ? 'active' : ''}" data-filter="draft">Draft (${counts.draft})</button>
      </div>
    </div>

    <!-- Invoice List -->
    <div class="card">
      ${invoices.length === 0 ? `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <h3 class="empty-state-title">${searchQuery ? 'No results found' : 'No invoices yet'}</h3>
          <p class="empty-state-desc">${searchQuery ? 'Try a different search term or filter.' : 'Create your first invoice to see it here.'}</p>
        </div>
      ` : `
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Date</th>
                <th class="text-right">Amount</th>
                <th>Status</th>
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.map(inv => `
                <tr>
                  <td class="fw-600">${escapeHtml(inv.invoiceNumber || '—')}</td>
                  <td>${escapeHtml(inv.customerName || 'Unknown')}</td>
                  <td>${formatDate(inv.date || inv.createdAt)}</td>
                  <td class="text-right fw-600">${formatCurrency(inv.grandTotal)}</td>
                  <td>
                    <select class="badge badge-${inv.status || 'draft'} status-select" data-id="${inv.id}" style="border:none;cursor:pointer;font-size:0.75rem;font-weight:600;padding:3px 8px;border-radius:20px;background-color:inherit;color:inherit;">
                      <option value="draft" ${inv.status === 'draft' ? 'selected' : ''}>Draft</option>
                      <option value="pending" ${inv.status === 'pending' ? 'selected' : ''}>Pending</option>
                      <option value="paid" ${inv.status === 'paid' ? 'selected' : ''}>Paid</option>
                    </select>
                  </td>
                  <td class="text-center">
                    <div style="display:flex;gap:4px;justify-content:center;">
                      <button class="btn btn-ghost btn-sm view-btn" data-id="${inv.id}" title="View">View</button>
                      <button class="btn btn-ghost btn-sm delete-btn" data-id="${inv.id}" title="Delete" style="color:var(--danger);">Delete</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  // Event listeners
  const createBtn = container.querySelector('#histCreateBtn');
  if (createBtn) createBtn.addEventListener('click', () => navigateTo('create'));

  // Search
  const searchInput = container.querySelector('#histSearch');
  if (searchInput) {
    let searchTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchQuery = e.target.value.trim();
        renderList(container);
        // Refocus search and restore cursor position
        const newInput = container.querySelector('#histSearch');
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(newInput.value.length, newInput.value.length);
        }
      }, 300);
    });
  }

  // Filter tabs
  container.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentFilter = tab.getAttribute('data-filter') || 'all';
      renderList(container);
    });
  });

  // View buttons
  container.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id) navigateTo(`create?id=${id}`);
    });
  });

  // Delete buttons
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      const confirmed = await showConfirm('Delete Invoice', 'Are you sure you want to delete this invoice? This action cannot be undone.');
      if (confirmed) {
        deleteInvoice(id);
        showToast('Invoice deleted.', 'info');
        renderList(container);
      }
    });
  });

  // Status change
  container.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const id = select.getAttribute('data-id');
      const newStatus = e.target.value;
      if (id && newStatus) {
        updateInvoiceStatus(id, newStatus);
        showToast(`Status updated to ${newStatus}.`, 'success');
        renderList(container);
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function escAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
