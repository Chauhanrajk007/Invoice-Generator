/**
 * dashboard.js — Dashboard with stats cards and recent invoices table
 *
 * Updated for async Supabase storage, RBAC, user/org display.
 */

import { getInvoices } from '../utils/storage.js';
import { formatCurrency, formatDate, navigateTo } from '../main.js';
import { getCurrentUser } from '../utils/auth.js';
import { getCurrentOrg } from '../utils/tenant.js';
import { canShow, ACTIONS } from '../utils/rbac.js';

export async function render(container) {
  // Show a loading skeleton while we fetch
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Dashboard</h1>
        <p class="page-header-subtitle">Loading…</p>
      </div>
    </div>
    <div class="stats-grid">
      ${Array.from({ length: 4 }, () => '<div class="stat-card" style="min-height:88px;opacity:.5;"></div>').join('')}
    </div>
  `;

  // Fetch data in parallel
  const [invoices, user, org] = await Promise.all([
    getInvoices(),
    getCurrentUser(),
    getCurrentOrg(),
  ]);

  // Greeting
  const userName = user?.user_metadata?.full_name || user?.email || '';
  const orgName = org?.name || '';
  const greeting = userName ? `Welcome back, ${escapeHtml(userName.split(' ')[0])}!` : 'Welcome!';

  // Calculate stats safely
  const total = invoices.length;
  const paid = invoices.filter(i => i.status === 'paid').length;
  const pending = invoices.filter(i => i.status === 'pending').length;
  const revenue = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => {
      const amt = Number(i.grandTotal);
      return sum + (isFinite(amt) ? amt : 0);
    }, 0);

  // Get recent invoices (latest 10)
  const recent = invoices.slice(0, 10);

  const showCreate = canShow(ACTIONS.CREATE_INVOICE);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${escapeHtml(greeting)}</h1>
        <p class="page-header-subtitle">${orgName ? escapeHtml(orgName) + ' — ' : ''}Overview of your invoicing activity</p>
      </div>
      ${showCreate ? `
      <button class="btn btn-primary btn-lg" id="createNewBtn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        Create Invoice
      </button>
      ` : ''}
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-label">Total Invoices</span>
          <span class="stat-value">${total}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-label">Paid</span>
          <span class="stat-value">${paid}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-label">Pending</span>
          <span class="stat-value">${pending}</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
        </div>
        <div class="stat-info">
          <span class="stat-label">Revenue</span>
          <span class="stat-value">${formatCurrency(revenue)}</span>
        </div>
      </div>
    </div>

    <!-- Recent Invoices -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Recent Invoices
        </h3>
        ${total > 0 ? '<button class="btn btn-ghost btn-sm" id="viewAllBtn">View All</button>' : ''}
      </div>
      ${recent.length === 0 ? `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <h3 class="empty-state-title">No invoices yet</h3>
          <p class="empty-state-desc">Create your first invoice to get started. It only takes a couple of minutes!</p>
          ${showCreate ? '<button class="btn btn-primary" id="emptyCreateBtn">Create Your First Invoice</button>' : ''}
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
                <th class="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              ${recent.map(inv => `
                <tr>
                  <td class="fw-600">${escapeHtml(inv.invoiceNumber || '—')}</td>
                  <td>${escapeHtml(inv.customerName || 'Unknown')}</td>
                  <td>${formatDate(inv.date || inv.createdAt)}</td>
                  <td class="text-right fw-600">${formatCurrency(inv.grandTotal)}</td>
                  <td><span class="badge badge-${inv.status || 'draft'}">${capitalize(inv.status || 'draft')}</span></td>
                  <td class="text-center">
                    <button class="btn btn-ghost btn-sm view-invoice-btn" data-id="${escapeAttr(inv.id)}">View</button>
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
  const createNewBtn = container.querySelector('#createNewBtn');
  if (createNewBtn) createNewBtn.addEventListener('click', () => navigateTo('create'));

  const emptyCreateBtn = container.querySelector('#emptyCreateBtn');
  if (emptyCreateBtn) emptyCreateBtn.addEventListener('click', () => navigateTo('create'));

  const viewAllBtn = container.querySelector('#viewAllBtn');
  if (viewAllBtn) viewAllBtn.addEventListener('click', () => navigateTo('history'));

  container.querySelectorAll('.view-invoice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id) navigateTo(`create?id=${id}`);
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
