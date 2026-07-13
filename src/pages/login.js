/**
 * login.js — Sign In page with premium auth layout
 */

import { signIn } from '../utils/auth.js';
import { showToast, navigateTo } from '../main.js';

function escAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectAuthStyles() {
  if (document.getElementById('auth-page-styles')) return;

  const style = document.createElement('style');
  style.id = 'auth-page-styles';
  style.textContent = `
    .auth-page {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: stretch;
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4338ca 50%, #4F6EF7 75%, #818cf8 100%);
      z-index: 9999;
      overflow: auto;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .auth-branding {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 60px;
      color: #fff;
      position: relative;
      overflow: hidden;
    }

    .auth-branding::before {
      content: '';
      position: absolute;
      top: -120px;
      right: -120px;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.04);
    }

    .auth-branding::after {
      content: '';
      position: absolute;
      bottom: -80px;
      left: -80px;
      width: 300px;
      height: 300px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.03);
    }

    .auth-branding-logo {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 48px;
      position: relative;
      z-index: 1;
    }

    .auth-branding-logo svg {
      width: 44px;
      height: 44px;
      flex-shrink: 0;
    }

    .auth-branding-logo span {
      font-family: 'DM Sans', 'Inter', sans-serif;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .auth-branding h1 {
      font-family: 'DM Sans', 'Inter', sans-serif;
      font-size: 42px;
      font-weight: 700;
      line-height: 1.15;
      margin-bottom: 20px;
      letter-spacing: -1px;
      position: relative;
      z-index: 1;
    }

    .auth-branding p {
      font-size: 17px;
      line-height: 1.7;
      color: rgba(255, 255, 255, 0.75);
      max-width: 440px;
      position: relative;
      z-index: 1;
    }

    .auth-features {
      margin-top: 48px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      position: relative;
      z-index: 1;
    }

    .auth-feature {
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 15px;
      color: rgba(255, 255, 255, 0.85);
    }

    .auth-feature-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      backdrop-filter: blur(4px);
    }

    .auth-feature-icon svg {
      width: 20px;
      height: 20px;
      stroke: #fff;
    }

    .auth-form-side {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      min-height: 100vh;
    }

    .auth-card {
      width: 100%;
      max-width: 440px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 44px 40px;
      box-shadow:
        0 25px 50px rgba(0, 0, 0, 0.15),
        0 0 0 1px rgba(255, 255, 255, 0.2);
      animation: authCardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      opacity: 0;
      transform: translateY(16px) scale(0.98);
    }

    @keyframes authCardIn {
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .auth-card-header {
      text-align: center;
      margin-bottom: 36px;
    }

    .auth-card-header h2 {
      font-family: 'DM Sans', 'Inter', sans-serif;
      font-size: 26px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
    }

    .auth-card-header p {
      font-size: 14.5px;
      color: #64748b;
      line-height: 1.5;
    }

    .auth-form-group {
      margin-bottom: 20px;
    }

    .auth-form-group label {
      display: block;
      font-size: 13.5px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 7px;
      letter-spacing: 0.01em;
    }

    .auth-form-input {
      width: 100%;
      padding: 11px 14px;
      font-size: 14.5px;
      color: #1e293b;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      outline: none;
      transition: all 200ms ease;
      font-family: inherit;
    }

    .auth-form-input::placeholder {
      color: #94a3b8;
    }

    .auth-form-input:focus {
      border-color: #4F6EF7;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(79, 110, 247, 0.1);
    }

    .auth-form-input.input-error {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.08);
    }

    .auth-field-error {
      font-size: 12.5px;
      color: #ef4444;
      margin-top: 6px;
      display: none;
      align-items: center;
      gap: 4px;
    }

    .auth-field-error.visible {
      display: flex;
    }

    .auth-submit-btn {
      width: 100%;
      padding: 12px 24px;
      font-size: 15px;
      font-weight: 600;
      font-family: inherit;
      color: #fff;
      background: linear-gradient(135deg, #4F6EF7, #4338ca);
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: all 200ms ease;
      margin-top: 8px;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      letter-spacing: 0.01em;
    }

    .auth-submit-btn:hover:not(:disabled) {
      background: linear-gradient(135deg, #3B5BDE, #3730a3);
      box-shadow: 0 4px 12px rgba(79, 110, 247, 0.35);
      transform: translateY(-1px);
    }

    .auth-submit-btn:active:not(:disabled) {
      transform: translateY(0);
    }

    .auth-submit-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .auth-spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: authSpin 0.6s linear infinite;
    }

    @keyframes authSpin {
      to { transform: rotate(360deg); }
    }

    .auth-divider {
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 28px 0;
      color: #94a3b8;
      font-size: 13px;
    }

    .auth-divider::before,
    .auth-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e2e8f0;
    }

    .auth-footer {
      text-align: center;
      margin-top: 28px;
      font-size: 14px;
      color: #64748b;
    }

    .auth-footer-link {
      color: #4F6EF7;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: color 200ms ease;
    }

    .auth-footer-link:hover {
      color: #3B5BDE;
      text-decoration: underline;
    }

    .auth-input-wrapper {
      position: relative;
    }

    .auth-input-icon {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      color: #94a3b8;
      pointer-events: none;
    }

    .auth-input-wrapper .auth-form-input {
      padding-left: 42px;
    }

    .auth-toggle-password {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      color: #94a3b8;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 200ms ease;
    }

    .auth-toggle-password:hover {
      color: #475569;
    }

    .auth-toggle-password svg {
      width: 18px;
      height: 18px;
    }

    /* Responsive */
    @media (max-width: 900px) {
      .auth-page {
        flex-direction: column;
      }
      .auth-branding {
        padding: 40px 32px 32px;
        min-height: auto;
      }
      .auth-branding h1 {
        font-size: 28px;
      }
      .auth-features {
        display: none;
      }
      .auth-form-side {
        padding: 24px;
        min-height: auto;
        flex: none;
      }
      .auth-card {
        padding: 32px 24px;
      }
    }

    @media (max-width: 480px) {
      .auth-branding {
        padding: 28px 20px 20px;
      }
      .auth-branding h1 {
        font-size: 22px;
      }
      .auth-branding p {
        font-size: 14px;
      }
      .auth-form-side {
        padding: 16px;
      }
      .auth-card {
        padding: 28px 20px;
        border-radius: 16px;
      }
    }
  `;
  document.head.appendChild(style);
}

export async function render(container) {
  injectAuthStyles();

  container.innerHTML = `
    <div class="auth-page" id="authLoginPage">
      <!-- Branding Panel -->
      <div class="auth-branding">
        <div class="auth-branding-logo">
          <svg viewBox="0 0 44 44" fill="none">
            <rect width="44" height="44" rx="12" fill="rgba(255,255,255,0.15)"/>
            <path d="M13 14h18M13 20h12M13 26h16M13 32h10" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
          <span>InvoiceFlow</span>
        </div>
        <h1>Streamline your<br>invoicing workflow</h1>
        <p>Create professional invoices, track payments, and manage your business finances — all in one place.</p>

        <div class="auth-features">
          <div class="auth-feature">
            <div class="auth-feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <span>Create GST-compliant invoices in seconds</span>
          </div>
          <div class="auth-feature">
            <div class="auth-feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </div>
            <span>Track payments and outstanding balances</span>
          </div>
          <div class="auth-feature">
            <div class="auth-feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                <path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <span>Multi-tenant team collaboration</span>
          </div>
        </div>
      </div>

      <!-- Form Card -->
      <div class="auth-form-side">
        <div class="auth-card">
          <div class="auth-card-header">
            <h2>Welcome back</h2>
            <p>Sign in to your InvoiceFlow account</p>
          </div>

          <form id="loginForm" autocomplete="on" novalidate>
            <div class="auth-form-group">
              <label for="loginEmail">Email address</label>
              <div class="auth-input-wrapper">
                <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  type="email"
                  id="loginEmail"
                  class="auth-form-input"
                  placeholder="you@company.com"
                  autocomplete="email"
                  required
                />
              </div>
              <div class="auth-field-error" id="emailError">
                <span>Please enter a valid email address</span>
              </div>
            </div>

            <div class="auth-form-group">
              <label for="loginPassword">Password</label>
              <div class="auth-input-wrapper">
                <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                <input
                  type="password"
                  id="loginPassword"
                  class="auth-form-input"
                  placeholder="Enter your password"
                  autocomplete="current-password"
                  required
                />
                <button type="button" class="auth-toggle-password" id="togglePassword" aria-label="Toggle password visibility">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="eyeIcon">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
              <div class="auth-field-error" id="passwordError">
                <span>Password is required</span>
              </div>
            </div>

            <button type="submit" class="auth-submit-btn" id="loginSubmitBtn">
              Sign In
            </button>
          </form>

          <div class="auth-footer">
            Don't have an account?
            <a class="auth-footer-link" id="goToRegister">Create one</a>
          </div>
        </div>
      </div>
    </div>
  `;

  // DOM references
  const form = container.querySelector('#loginForm');
  const emailInput = container.querySelector('#loginEmail');
  const passwordInput = container.querySelector('#loginPassword');
  const emailError = container.querySelector('#emailError');
  const passwordError = container.querySelector('#passwordError');
  const submitBtn = container.querySelector('#loginSubmitBtn');
  const togglePasswordBtn = container.querySelector('#togglePassword');
  const goToRegister = container.querySelector('#goToRegister');

  // Toggle password visibility
  let passwordVisible = false;
  togglePasswordBtn.addEventListener('click', () => {
    passwordVisible = !passwordVisible;
    passwordInput.type = passwordVisible ? 'text' : 'password';
    const eyeIcon = container.querySelector('#eyeIcon');
    if (passwordVisible) {
      eyeIcon.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      `;
    } else {
      eyeIcon.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      `;
    }
  });

  // Navigate to register
  goToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('register');
  });

  // Validate email format
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Clear field errors on input
  emailInput.addEventListener('input', () => {
    emailInput.classList.remove('input-error');
    emailError.classList.remove('visible');
  });

  passwordInput.addEventListener('input', () => {
    passwordInput.classList.remove('input-error');
    passwordError.classList.remove('visible');
  });

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Reset errors
    emailInput.classList.remove('input-error');
    passwordInput.classList.remove('input-error');
    emailError.classList.remove('visible');
    passwordError.classList.remove('visible');

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Client-side validation
    let hasErrors = false;

    if (!email || !isValidEmail(email)) {
      emailInput.classList.add('input-error');
      emailError.classList.add('visible');
      hasErrors = true;
    }

    if (!password) {
      passwordInput.classList.add('input-error');
      passwordError.classList.add('visible');
      hasErrors = true;
    }

    if (hasErrors) return;

    // Set loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="auth-spinner"></span> Signing in...`;

    try {
      const { data, error } = await signIn(email, password);

      if (error) {
        showToast(error.message || 'Invalid email or password', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
        return;
      }

      showToast('Welcome back!', 'success');
      navigateTo('dashboard');
    } catch (err) {
      console.error('[login] Sign in failed:', err);
      showToast('An unexpected error occurred. Please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });

  // Focus the email field on load
  setTimeout(() => emailInput.focus(), 100);
}
