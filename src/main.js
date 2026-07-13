/**
 * main.js — SPA Router, Auth Guard, Navigation, Toast, and App Initialization
 * 
 * Features:
 * - Auth gate: redirects to login if not authenticated
 * - Org context: loads current org, shows org switcher
 * - RBAC-aware nav: hides items based on permissions
 * - Toast system for notifications
 */

import { isSupabaseConfigured } from './utils/supabase.js';
import { getCurrentUser, onAuthStateChange, signOut } from './utils/auth.js';
import { getUserOrganizations, getCurrentOrgId, setCurrentOrgId, getCurrentOrg } from './utils/tenant.js';
import { warmRoleCache, clearRoleCache, canShow, ACTIONS, getCachedRole, getRoleLabel } from './utils/rbac.js';

// ========== TOAST SYSTEM ==========

export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message || 'Something happened';
  container.appendChild(toast);

  const timer = setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => { try { container.removeChild(toast); } catch {} }, 200);
  }, Math.max(1000, duration));

  toast.addEventListener('click', () => {
    clearTimeout(timer);
    toast.classList.add('removing');
    setTimeout(() => { try { container.removeChild(toast); } catch {} }, 200);
  });
}

// ========== SPA ROUTER ==========

const routes = {};
let currentRoute = null;

export function registerRoute(path, renderFn) {
  routes[path] = renderFn;
}

export function navigateTo(path) {
  window.location.hash = `#/${path}`;
}

async function handleRoute() {
  const rawHash = window.location.hash.replace('#/', '') || 'dashboard';
  const [hash] = rawHash.split('?');
  const app = document.getElementById('app');
  if (!app) return;

  // Auth gate: allow login/register without auth
  const publicRoutes = ['login', 'register'];
  if (!publicRoutes.includes(hash)) {
    const user = await getCurrentUser();
    if (!user) {
      navigateTo('login');
      return;
    }

    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      app.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <h3 class="empty-state-title">Supabase Not Configured</h3>
          <p class="empty-state-desc">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Vercel environment variables.</p>
        </div>`;
      return;
    }
  }

  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    const route = item.getAttribute('data-route');
    item.classList.toggle('active', route === hash);
  });

  closeMobileSidebar();

  // Show/hide sidebar for auth pages
  const sidebar = document.getElementById('sidebar');
  const mobileHeader = document.getElementById('mobileHeader');
  if (publicRoutes.includes(hash)) {
    if (sidebar) sidebar.style.display = 'none';
    if (mobileHeader) mobileHeader.style.display = 'none';
    if (app) app.style.marginLeft = '0';
  } else {
    if (sidebar) sidebar.style.display = '';
    if (mobileHeader) mobileHeader.style.display = '';
    if (app) app.style.marginLeft = '';
  }

  const renderFn = routes[hash];
  if (renderFn) {
    currentRoute = hash;
    app.innerHTML = '<div class="page-enter" id="pageContent"></div>';
    const pageEl = document.getElementById('pageContent');
    try {
      await renderFn(pageEl);
    } catch (err) {
      console.error(`[router] Failed to render page "${hash}":`, err);
      pageEl.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <h3 class="empty-state-title">Something went wrong</h3>
          <p class="empty-state-desc">We couldn't load this page. Please try again.</p>
          <button class="btn btn-primary" onclick="location.reload()">Reload</button>
        </div>`;
    }
  } else {
    navigateTo('dashboard');
  }
}

// ========== MOBILE SIDEBAR ==========

function initMobileSidebar() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      const isOpen = sidebar.classList.contains('open');
      if (isOpen) closeMobileSidebar();
      else {
        sidebar.classList.add('open');
        overlay.classList.add('visible');
        hamburger.classList.add('open');
      }
    });
  }
  if (overlay) overlay.addEventListener('click', closeMobileSidebar);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMobileSidebar(); });
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const hamburger = document.getElementById('hamburger');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('visible');
  if (hamburger) hamburger.classList.remove('open');
}

// ========== CONFIRMATION MODAL ==========

export function showConfirm(title, description) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <h3 class="modal-title">${title}</h3>
        <p class="modal-desc">${description}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modalCancel">Cancel</button>
          <button class="btn btn-danger" id="modalConfirm">Confirm</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const cleanup = (result) => {
      try { document.body.removeChild(overlay); } catch {}
      resolve(result);
    };

    overlay.querySelector('#modalCancel').addEventListener('click', () => cleanup(false));
    overlay.querySelector('#modalConfirm').addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });

    const handler = (e) => {
      if (e.key === 'Escape') { document.removeEventListener('keydown', handler); cleanup(false); }
    };
    document.addEventListener('keydown', handler);
  });
}

// ========== FORMAT HELPERS ==========

export function formatCurrency(amount) {
  const num = Number(amount);
  if (!isFinite(num)) return '₹0.00';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ========== ORG SWITCHER ==========

async function updateOrgSwitcher() {
  const switcher = document.getElementById('orgSwitcher');
  const orgName = document.getElementById('orgNameDisplay');
  const orgDropdown = document.getElementById('orgDropdown');
  if (!switcher || !orgName || !orgDropdown) return;

  const currentOrg = await getCurrentOrg();
  const { data: orgs } = await getUserOrganizations();

  orgName.textContent = currentOrg?.name || 'Select Organization';

  orgDropdown.innerHTML = orgs.map(org => `
    <button class="org-option ${org.id === currentOrg?.id ? 'active' : ''}" data-org-id="${org.id}">
      <span class="org-option-name">${escHtml(org.name)}</span>
      <span class="org-option-role">${getRoleLabel(org.role)}</span>
    </button>
  `).join('') + `
    <button class="org-option org-option-create" id="createNewOrg">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
      New Organization
    </button>
  `;

  // Bind events
  orgDropdown.querySelectorAll('[data-org-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const orgId = btn.getAttribute('data-org-id');
      setCurrentOrgId(orgId);
      clearRoleCache();
      await warmRoleCache();
      updateNavVisibility();
      updateOrgSwitcher();
      handleRoute(); // Reload current page with new org context
      orgDropdown.classList.remove('show');
    });
  });

  const createBtn = orgDropdown.querySelector('#createNewOrg');
  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const name = prompt('Organization name:');
      if (!name || !name.trim()) return;
      const { createOrganization } = await import('./utils/tenant.js');
      const { data, error } = await createOrganization(name.trim());
      if (error) { showToast(error.message || 'Failed to create org', 'error'); return; }
      setCurrentOrgId(data.id);
      clearRoleCache();
      await warmRoleCache();
      updateNavVisibility();
      updateOrgSwitcher();
      handleRoute();
      showToast('Organization created!', 'success');
      orgDropdown.classList.remove('show');
    });
  }
}

function initOrgSwitcher() {
  const switcher = document.getElementById('orgSwitcher');
  const dropdown = document.getElementById('orgDropdown');
  if (!switcher || !dropdown) return;

  switcher.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
  });

  document.addEventListener('click', () => dropdown.classList.remove('show'));
  dropdown.addEventListener('click', (e) => e.stopPropagation());
}

// ========== NAV VISIBILITY ==========

function updateNavVisibility() {
  const role = getCachedRole();
  const settingsNav = document.querySelector('[data-route="settings"]');
  const teamNav = document.querySelector('[data-route="team"]');

  // Settings: admin+
  if (settingsNav) {
    settingsNav.style.display = canShow(ACTIONS.MANAGE_SETTINGS) ? '' : 'none';
  }
  // Team: admin+
  if (teamNav) {
    teamNav.style.display = canShow(ACTIONS.MANAGE_MEMBERS) ? '' : 'none';
  }
}

// ========== USER MENU ==========

function initUserMenu() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await signOut();
      clearRoleCache();
      navigateTo('login');
      showToast('Signed out successfully.', 'info');
    });
  }
}

async function updateUserInfo() {
  const user = await getCurrentUser();
  const userName = document.getElementById('userName');
  const userEmail = document.getElementById('userEmail');
  const userAvatar = document.getElementById('userAvatar');

  if (userName && user) userName.textContent = user.user_metadata?.full_name || 'User';
  if (userEmail && user) userEmail.textContent = user.email || '';
  if (userAvatar && user) {
    const initial = (user.user_metadata?.full_name || user.email || 'U').charAt(0).toUpperCase();
    userAvatar.textContent = initial;
  }
}

// ========== INITIALIZATION ==========

async function initApp() {
  const [dashboard, createInvoice, gstInvoice, invoiceHistory, settings, login, register, team] = await Promise.all([
    import('./pages/dashboard.js'),
    import('./pages/create-invoice.js'),
    import('./pages/gst-invoice.js'),
    import('./pages/invoice-history.js'),
    import('./pages/settings.js'),
    import('./pages/login.js'),
    import('./pages/register.js'),
    import('./pages/team.js'),
  ]);

  registerRoute('dashboard', dashboard.render);
  registerRoute('create', createInvoice.render);
  registerRoute('gst', gstInvoice.render);
  registerRoute('history', invoiceHistory.render);
  registerRoute('settings', settings.render);
  registerRoute('login', login.render);
  registerRoute('register', register.render);
  registerRoute('team', team.render);

  window.addEventListener('hashchange', handleRoute);
  initMobileSidebar();
  initOrgSwitcher();
  initUserMenu();

  // Check auth state
  const user = await getCurrentUser();
  if (user && getCurrentOrgId()) {
    await warmRoleCache();
    updateNavVisibility();
    updateOrgSwitcher();
    updateUserInfo();
  }

  // Listen for auth changes
  onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      navigateTo('login');
    } else if (event === 'SIGNED_IN' && session?.user) {
      await warmRoleCache();
      updateNavVisibility();
      updateOrgSwitcher();
      updateUserInfo();
    }
  });

  // Initial route
  if (!window.location.hash) {
    window.location.hash = user ? '#/dashboard' : '#/login';
  } else {
    handleRoute();
  }
}

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// Start
initApp().catch(err => {
  console.error('[app] Initialization failed:', err);
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <div class="empty-state">
        <h3 class="empty-state-title">Failed to start</h3>
        <p class="empty-state-desc">Please refresh the page to try again.</p>
        <button class="btn btn-primary" onclick="location.reload()">Reload</button>
      </div>`;
  }
});
