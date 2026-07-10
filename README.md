# InvoiceFlow — Free Invoice Generator 🧾

A clean, modern, and beginner-friendly invoice generator. Create professional invoices with GST support in under 2 minutes — no signup, no backend, completely free.

## ✨ Features

- **Create Invoices** — Fill a simple form, get a live A4 preview
- **GST Support** — Auto-calculates CGST/SGST (intra-state) or IGST (inter-state)
- **Download PDF** — One-click PDF export via html2pdf.js
- **Print & Share** — Print via iframe or share via Web Share API
- **Dashboard** — Track total invoices, paid, pending, and revenue
- **Invoice History** — Search, filter, and manage all invoices
- **Auto-Save Drafts** — Never lose your work
- **Settings** — Save business defaults to auto-fill future invoices
- **Responsive** — Works on desktop and mobile
- **No Backend** — All data stored in localStorage

## 🛠️ Tech Stack

| Layer | Choice |
|-------|--------|
| Build | [Vite](https://vitejs.dev/) |
| Language | Vanilla JavaScript (ES Modules) |
| Styling | Vanilla CSS3 with CSS Custom Properties |
| PDF | [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) (CDN) |
| Fonts | [Inter](https://fonts.google.com/specimen/Inter) + [DM Sans](https://fonts.google.com/specimen/DM+Sans) |
| Storage | localStorage |

## 📂 Project Structure

```
invoice-generator/
├── index.html              ← SPA shell with sidebar navigation
├── package.json            ← Vite dev dependency
├── vite.config.js          ← Dev server config
├── vercel.json             ← Vercel deployment config
├── .gitignore
└── src/
    ├── main.js             ← SPA router, toast system, modals
    ├── style.css           ← Full design system (28KB)
    ├── pages/
    │   ├── dashboard.js        ← Stats cards + recent invoices
    │   ├── create-invoice.js   ← Invoice form + live A4 preview
    │   ├── gst-invoice.js      ← GST invoice wrapper
    │   ├── invoice-history.js  ← Search, filter, CRUD
    │   └── settings.js         ← Business defaults & preferences
    └── utils/
        ├── storage.js          ← Bulletproof localStorage CRUD
        ├── calculations.js     ← Invoice math (NaN-safe)
        ├── amount-words.js     ← INR number-to-words
        └── pdf.js              ← PDF download, print, share
```

## 💻 Local Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Opens at `http://localhost:5173`

## ☁️ Deploy to Vercel

1. Push this repo to GitHub
2. Import the repo on [vercel.com](https://vercel.com)
3. Vercel auto-detects Vite — click **Deploy**

Or use the Vercel CLI:

```bash
npx -y vercel
```

## 📄 License

MIT
