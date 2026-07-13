/**
 * register.js — Sign Up page with premium auth layout
 */

import { signUp } from '../utils/auth.js';
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
  // The shared auth styles are injected by login.js — but if register is loaded
  // directly (e.g. via bookmark), inject them here too. The guard inside prevents duplication.
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

function injectRegisterStyles() {
  if (document.getElementById('auth-register-styles')) return;

  const style = document.createElement('style');
  style.id = 'auth-register-styles';
  style.textContent = `
    .auth-card.auth-card-register {
      max-width: 480px;
      padding: 36px 36px 40px;
    }

    .auth-card-register .auth-card-header {
      margin-bottom: 28px;
    }

    .auth-form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .auth-password-strength {
      margin-top: 10px;
    }

    .auth-strength-bar-track {
      width: 100%;
      height: 4px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }

    .auth-strength-bar-fill {
      height: 100%;
      border-radius: 4px;
      width: 0%;
      transition: width 300ms ease, background-color 300ms ease;
    }

    .auth-strength-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 6px;
      font-size: 12px;
      color: #94a3b8;
    }

    .auth-strength-text {
      font-weight: 600;
      transition: color 300ms ease;
    }

    .auth-form-group.compact {
      margin-bottom: 16px;
    }

    @media (max-width: 480px) {
      .auth-form-row {
        grid-template-columns: 1fr;
        gap: 0;
      }
      .auth-card.auth-card-register {
        padding: 24px 20px 28px;
      }
    }
  `;
  document.head.appendChild(style);
}

export async function render(container) {
  injectAuthStyles();
  injectRegisterStyles();

  container.innerHTML = `
    <div class="auth-page" id="authRegisterPage">
      <!-- Branding Panel -->
      <div class="auth-branding">
        <div class="auth-branding-logo">
          <svg viewBox="0 0 44 44" fill="none">
            <rect width="44" height="44" rx="12" fill="rgba(255,255,255,0.15)"/>
            <path d="M13 14h18M13 20h12M13 26h16M13 32h10" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
          <span>InvoiceFlow</span>
        </div>
        <h1>Start managing<br>invoices smarter</h1>
        <p>Join thousands of businesses that trust InvoiceFlow to handle their invoicing, billing, and financial reporting.</p>

        <div class="auth-features">
          <div class="auth-feature">
            <div class="auth-feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <span>Free to get started — no credit card required</span>
          </div>
          <div class="auth-feature">
            <div class="auth-feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span>Enterprise-grade security and encryption</span>
          </div>
          <div class="auth-feature">
            <div class="auth-feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                <polyline points="17 6 23 6 23 12"/>
              </svg>
            </div>
            <span>Real-time dashboards and analytics</span>
          </div>
        </div>
      </div>

      <!-- Form Card -->
      <div class="auth-form-side">
        <div class="auth-card auth-card-register">
          <div class="auth-card-header">
            <h2>Create your account</h2>
            <p>Get started with InvoiceFlow in under a minute</p>
          </div>

          <form id="registerForm" autocomplete="on" novalidate>
            <div class="auth-form-row">
              <div class="auth-form-group compact">
                <label for="regFullName">Full name</label>
                <div class="auth-input-wrapper">
                  <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <input
                    type="text"
                    id="regFullName"
                    class="auth-form-input"
                    placeholder="John Doe"
                    autocomplete="name"
                    required
                  />
                </div>
                <div class="auth-field-error" id="nameError">
                  <span>Full name is required</span>
                </div>
              </div>

              <div class="auth-form-group compact">
                <label for="regOrgName">Organization name</label>
                <div class="auth-input-wrapper">
                  <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <input
                    type="text"
                    id="regOrgName"
                    class="auth-form-input"
                    placeholder="Acme Inc."
                    autocomplete="organization"
                  />
                </div>
              </div>
            </div>

            <div class="auth-form-group compact">
              <label for="regEmail">Email address</label>
              <div class="auth-input-wrapper">
                <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  type="email"
                  id="regEmail"
                  class="auth-form-input"
                  placeholder="you@company.com"
                  autocomplete="email"
                  required
                />
              </div>
              <div class="auth-field-error" id="regEmailError">
                <span>Please enter a valid email address</span>
              </div>
            </div>

            <div class="auth-form-group compact">
              <label for="regPassword">Password</label>
              <div class="auth-input-wrapper">
                <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                <input
                  type="password"
                  id="regPassword"
                  class="auth-form-input"
                  placeholder="Create a strong password"
                  autocomplete="new-password"
                  required
                />
                <button type="button" class="auth-toggle-password" id="toggleRegPassword" aria-label="Toggle password visibility">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="regEyeIcon">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
              <div class="auth-password-strength" id="passwordStrength" style="display:none;">
                <div class="auth-strength-bar-track">
                  <div class="auth-strength-bar-fill" id="strengthBarFill"></div>
                </div>
                <div class="auth-strength-label">
                  <span>Password strength</span>
                  <span class="auth-strength-text" id="strengthText">—</span>
                </div>
              </div>
              <div class="auth-field-error" id="regPasswordError">
                <span>Password must be at least 8 characters</span>
              </div>
            </div>

            <div class="auth-form-group compact">
              <label for="regConfirmPassword">Confirm password</label>
              <div class="auth-input-wrapper">
                <svg class="auth-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <input
                  type="password"
                  id="regConfirmPassword"
                  class="auth-form-input"
                  placeholder="Re-enter your password"
                  autocomplete="new-password"
                  required
                />
              </div>
              <div class="auth-field-error" id="regConfirmError">
                <span>Passwords do not match</span>
              </div>
            </div>

            <button type="submit" class="auth-submit-btn" id="registerSubmitBtn">
              Create Account
            </button>
          </form>

          <div class="auth-footer">
            Already have an account?
            <a class="auth-footer-link" id="goToLogin">Sign in</a>
          </div>
        </div>
      </div>
    </div>
  `;

  // DOM references
  const form = container.querySelector('#registerForm');
  const fullNameInput = container.querySelector('#regFullName');
  const orgNameInput = container.querySelector('#regOrgName');
  const emailInput = container.querySelector('#regEmail');
  const passwordInput = container.querySelector('#regPassword');
  const confirmPasswordInput = container.querySelector('#regConfirmPassword');
  const nameError = container.querySelector('#nameError');
  const emailError = container.querySelector('#regEmailError');
  const passwordError = container.querySelector('#regPasswordError');
  const confirmError = container.querySelector('#regConfirmError');
  const submitBtn = container.querySelector('#registerSubmitBtn');
  const toggleRegPasswordBtn = container.querySelector('#toggleRegPassword');
  const goToLogin = container.querySelector('#goToLogin');
  const strengthContainer = container.querySelector('#passwordStrength');
  const strengthBarFill = container.querySelector('#strengthBarFill');
  const strengthText = container.querySelector('#strengthText');

  // Toggle password visibility
  let passwordVisible = false;
  toggleRegPasswordBtn.addEventListener('click', () => {
    passwordVisible = !passwordVisible;
    passwordInput.type = passwordVisible ? 'text' : 'password';
    const eyeIcon = container.querySelector('#regEyeIcon');
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

  // Navigate to login
  goToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('login');
  });

  // Email validation
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Password strength calculator
  function calcPasswordStrength(password) {
    let score = 0;
    if (!password) return { score: 0, label: '—', color: '#e2e8f0' };

    // Length checks
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character variety
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    // Penalize common patterns
    if (/^[a-zA-Z]+$/.test(password) || /^[0-9]+$/.test(password)) {
      score = Math.max(1, score - 2);
    }

    if (score <= 2) return { score: 1, label: 'Weak', color: '#ef4444', percent: 25 };
    if (score <= 4) return { score: 2, label: 'Fair', color: '#f59e0b', percent: 50 };
    if (score <= 5) return { score: 3, label: 'Good', color: '#10b981', percent: 75 };
    return { score: 4, label: 'Strong', color: '#059669', percent: 100 };
  }

  // Password strength live update
  passwordInput.addEventListener('input', () => {
    const val = passwordInput.value;
    passwordInput.classList.remove('input-error');
    passwordError.classList.remove('visible');

    if (val.length > 0) {
      strengthContainer.style.display = 'block';
      const strength = calcPasswordStrength(val);
      strengthBarFill.style.width = strength.percent + '%';
      strengthBarFill.style.backgroundColor = strength.color;
      strengthText.textContent = strength.label;
      strengthText.style.color = strength.color;
    } else {
      strengthContainer.style.display = 'none';
    }

    // Live confirm-password check
    if (confirmPasswordInput.value) {
      if (val !== confirmPasswordInput.value) {
        confirmPasswordInput.classList.add('input-error');
        confirmError.classList.add('visible');
      } else {
        confirmPasswordInput.classList.remove('input-error');
        confirmError.classList.remove('visible');
      }
    }
  });

  // Clear errors on input
  fullNameInput.addEventListener('input', () => {
    fullNameInput.classList.remove('input-error');
    nameError.classList.remove('visible');
  });

  emailInput.addEventListener('input', () => {
    emailInput.classList.remove('input-error');
    emailError.classList.remove('visible');
  });

  confirmPasswordInput.addEventListener('input', () => {
    confirmPasswordInput.classList.remove('input-error');
    confirmError.classList.remove('visible');
  });

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Reset all errors
    fullNameInput.classList.remove('input-error');
    emailInput.classList.remove('input-error');
    passwordInput.classList.remove('input-error');
    confirmPasswordInput.classList.remove('input-error');
    nameError.classList.remove('visible');
    emailError.classList.remove('visible');
    passwordError.classList.remove('visible');
    confirmError.classList.remove('visible');

    const fullName = fullNameInput.value.trim();
    const orgName = orgNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Client-side validation
    let hasErrors = false;

    if (!fullName) {
      fullNameInput.classList.add('input-error');
      nameError.classList.add('visible');
      hasErrors = true;
    }

    if (!email || !isValidEmail(email)) {
      emailInput.classList.add('input-error');
      emailError.classList.add('visible');
      hasErrors = true;
    }

    if (!password || password.length < 8) {
      passwordInput.classList.add('input-error');
      passwordError.classList.add('visible');
      hasErrors = true;
    }

    if (!confirmPassword || password !== confirmPassword) {
      confirmPasswordInput.classList.add('input-error');
      confirmError.classList.add('visible');
      hasErrors = true;
    }

    if (hasErrors) return;

    // Set loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="auth-spinner"></span> Creating account...`;

    try {
      const { data, error } = await signUp(email, password, fullName, orgName);

      if (error) {
        showToast(error.message || 'Registration failed. Please try again.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
        return;
      }

      showToast('Account created! Please check your email to confirm.', 'success', 5000);
      navigateTo('login');
    } catch (err) {
      console.error('[register] Sign up failed:', err);
      showToast('An unexpected error occurred. Please try again.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });

  // Focus the name field on load
  setTimeout(() => fullNameInput.focus(), 100);
}
