/**
 * main.js — SPA Router, Navigation, Toast, and App Initialization
 */

// ========== TOAST SYSTEM ==========

/**
 * Show a toast notification.
 * @param {string} message 
 * @param {'success'|'error'|'info'} type 
 * @param {number} duration - ms before auto-dismiss (default 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message || 'Something happened';

  container.appendChild(toast);

  // Auto-remove
  const timer = setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => {
      try { container.removeChild(toast); } catch { /* already removed */ }
    }, 200);
  }, Math.max(1000, duration));

  // Click to dismiss early
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    toast.classList.add('removing');
    setTimeout(() => {
      try { container.removeChild(toast); } catch { /* already removed */ }
    }, 200);
  });
}

// ========== SPA ROUTER ==========

const routes = {};
let currentRoute = null;

/**
 * Register a route.
 * @param {string} path - Route path (e.g., 'dashboard')
 * @param {Function} renderFn - Async function that returns HTML string or renders into app container
 */
export function registerRoute(path, renderFn) {
  routes[path] = renderFn;
}

/**
 * Navigate to a route programmatically.
 */
export function navigateTo(path) {
  window.location.hash = `#/${path}`;
}

async function handleRoute() {
  const rawHash = window.location.hash.replace('#/', '') || 'dashboard';
  // Separate route from query params (e.g., "create?id=abc" → route="create")
  const [hash] = rawHash.split('?');
  const app = document.getElementById('app');
  if (!app) return;

  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    const route = item.getAttribute('data-route');
    item.classList.toggle('active', route === hash);
  });

  // Close mobile sidebar on navigation
  closeMobileSidebar();

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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <h3 class="empty-state-title">Something went wrong</h3>
          <p class="empty-state-desc">We couldn't load this page. Please try again.</p>
          <button class="btn btn-primary" onclick="location.reload()">Reload</button>
        </div>
      `;
    }
  } else {
    // Unknown route — redirect to dashboard
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
      if (isOpen) {
        closeMobileSidebar();
      } else {
        sidebar.classList.add('open');
        overlay.classList.add('visible');
        hamburger.classList.add('open');
      }
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeMobileSidebar);
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobileSidebar();
  });
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
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#modalCancel').addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(false);
    });

    overlay.querySelector('#modalConfirm').addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(true);
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve(false);
      }
    });

    // Close on Escape
    const handler = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', handler);
        try { document.body.removeChild(overlay); } catch {}
        resolve(false);
      }
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

// ========== INITIALIZATION ==========

async function initApp() {
  // Import and register all page modules
  const [dashboard, createInvoice, gstInvoice, invoiceHistory, settings] = await Promise.all([
    import('./pages/dashboard.js'),
    import('./pages/create-invoice.js'),
    import('./pages/gst-invoice.js'),
    import('./pages/invoice-history.js'),
    import('./pages/settings.js'),
  ]);

  registerRoute('dashboard', dashboard.render);
  registerRoute('create', createInvoice.render);
  registerRoute('gst', gstInvoice.render);
  registerRoute('history', invoiceHistory.render);
  registerRoute('settings', settings.render);

  // Listen for route changes
  window.addEventListener('hashchange', handleRoute);

  // Initialize mobile sidebar
  initMobileSidebar();

  // Handle initial route
  if (!window.location.hash) {
    window.location.hash = '#/dashboard';
  } else {
    handleRoute();
  }
}

// Start the app
initApp().catch(err => {
  console.error('[app] Initialization failed:', err);
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <div class="empty-state">
        <h3 class="empty-state-title">Failed to start</h3>
        <p class="empty-state-desc">Please refresh the page to try again.</p>
        <button class="btn btn-primary" onclick="location.reload()">Reload</button>
      </div>
    `;
  }
});
