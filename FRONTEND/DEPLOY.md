# 🚀 Frontend - Vercel Deployment Guide

Production React frontend for NCERT + PYQ AI Study Assistant.

## 📦 Tech Stack

- **Framework:** React 18.2 + Vite 6.3
- **Styling:** Tailwind CSS 3.3
- **UI:** Radix UI, Framer Motion, Lucide Icons
- **Auth & DB:** Firebase Authentication + Firestore
- **HTTP Client:** Axios

## 🔧 Local Development

```bash
npm install
cp .env.example .env
# Edit .env with your Firebase config
npm run dev
```

## 🚀 Deploy to Vercel

### Web UI Method (Recommended):
1. Go to [vercel.com](https://vercel.com)
2. Import GitHub repo
3. Set root directory to `FRONTEND`
4. Add environment variables (see below)
5. Deploy!

### Required Environment Variables:
```
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_BASE_URL=https://your-backend.railway.app
```

## 🔗 Connect to Backend

After deployment:
1. Get Railway URL
2. Update `VITE_API_BASE_URL` in Vercel
3. Add Vercel URL to Railway's `ALLOWED_ORIGINS`

See main project README for full deployment guide.
