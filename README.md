# InvoiceFlow — Multi-Tenant Invoice SaaS 🧾

A professional, multi-tenant invoice management platform with role-based access control, team management, GST support, and email integration — powered by Supabase.

## ✨ Features

### Core
- **Multi-Tenant** — Organizations with isolated data; switch between orgs
- **RBAC** — Owner / Admin / Member / Viewer role hierarchy
- **Team Management** — Invite members, assign roles, remove members
- **Authentication** — Supabase Auth (email + password)

### Invoicing
- **Create Invoices** — Form-based with live A4 preview
- **GST Support** — Auto-calculates CGST/SGST (intra-state) or IGST (inter-state)
- **Professional PDF** — Download beautiful invoices with colored headers, status watermarks, payment details
- **Print** — Print-optimized output with embedded styles
- **Invoice History** — Search, filter by status, CRUD operations

### Communication
- **Email Integration** — Send invoices via mailto: or Gmail/GMass
- **Email Logs** — Track sent emails per invoice

### Business
- **Dashboard** — Stats cards, recent invoices, revenue overview
- **Settings** — Business details, payment info, signature, email defaults
- **Auto-Save Drafts** — Never lose work in progress

## 🛠️ Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Vanilla JavaScript (ES Modules) |
| Build | [Vite](https://vitejs.dev/) |
| Styling | Vanilla CSS3 with Custom Properties |
| Backend | [Supabase](https://supabase.com) (Auth + PostgreSQL + RLS) |
| PDF | [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) (CDN) |
| Fonts | [Inter](https://fonts.google.com/specimen/Inter) + [DM Sans](https://fonts.google.com/specimen/DM+Sans) |

## 📂 Project Structure

```
invoice-generator/
├── index.html              ← SPA shell with sidebar, org switcher, user menu
├── package.json            ← Vite config
├── vite.config.js          ← Dev server
├── vercel.json             ← Vercel SPA deployment
├── supabase-schema.sql     ← Database tables + RLS policies
├── .env.example            ← Required environment variables
├── .gitignore
└── src/
    ├── main.js             ← Auth-guarded SPA router, org context
    ├── style.css           ← Full design system
    ├── pages/
    │   ├── login.js            ← Auth login page
    │   ├── register.js         ← Auth register page
    │   ├── dashboard.js        ← Stats + recent invoices
    │   ├── create-invoice.js   ← Invoice form + live preview + email
    │   ├── gst-invoice.js      ← GST invoice wrapper
    │   ├── invoice-history.js  ← Search, filter, CRUD, email
    │   ├── team.js             ← Team management (RBAC-gated)
    │   └── settings.js         ← Business, payment, email settings
    └── utils/
        ├── supabase.js         ← Supabase client (ESM CDN)
        ├── auth.js             ← Sign up/in/out, session mgmt
        ├── tenant.js           ← Org CRUD, member management
        ├── rbac.js             ← Role-based permission matrix
        ├── storage.js          ← Supabase-backed invoice/settings CRUD
        ├── email.js            ← Email via mailto/GMass + logging
        ├── calculations.js     ← Invoice math (NaN-safe)
        ├── amount-words.js     ← INR number-to-words
        └── pdf.js              ← Professional PDF/print generation
```

## 🚀 Setup & Deploy

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Open **SQL Editor** → paste contents of `supabase-schema.sql` → Run
3. Go to **Settings → API** → copy your **Project URL** and **anon/public key**

### 2. Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import from GitHub
3. Add **Environment Variables** in Vercel dashboard:

   | Variable | Value |
   |----------|-------|
   | `VITE_SUPABASE_URL` | `https://your-project.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `your-anon-key-here` |

4. Click **Deploy** — Vercel auto-detects Vite

### 3. Supabase Auth Settings

In your Supabase dashboard:
1. Go to **Authentication → URL Configuration**
2. Set **Site URL** to your Vercel domain (e.g., `https://your-app.vercel.app`)
3. Add redirect URLs if needed

## 🔐 RBAC Permissions

| Permission | Owner | Admin | Member | Viewer |
|-----------|-------|-------|--------|--------|
| View invoices | ✅ | ✅ | ✅ | ✅ |
| Download/Print | ✅ | ✅ | ✅ | ✅ |
| Create invoice | ✅ | ✅ | ✅ | ❌ |
| Edit invoice | ✅ | ✅ | ✅ | ❌ |
| Send email | ✅ | ✅ | ✅ | ❌ |
| Delete invoice | ✅ | ✅ | ❌ | ❌ |
| Manage settings | ✅ | ✅ | ❌ | ❌ |
| Manage team | ✅ | ✅ | ❌ | ❌ |
| Delete org | ✅ | ❌ | ❌ | ❌ |

## 📧 Email Integration (GMass Method)

InvoiceFlow uses the **GMass method** for sending invoice emails:

1. **mailto:** — Opens the user's default email client with pre-filled subject, body, and invoice details
2. **Gmail/GMass** — Opens Gmail compose URL so GMass Chrome extension can handle mass sending
3. **Email logs** — All sent emails are logged to Supabase for tracking

## 📄 License

MIT
