# 🚀 Backend API - Railway Deployment

Production Flask backend for NCERT + PYQ AI Study Assistant.

## 📦 Tech Stack

- **Framework:** Flask 3.0
- **AI:** Groq API (LLM), Sentence Transformers (Embeddings)
- **Vector DB:** Pinecone
- **Server:** Gunicorn (2 workers)
- **Python:** 3.11

## 🔧 Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your API keys

# Run locally
python app.py
```

Server runs on `http://localhost:5000`

## 🚀 Deploy to Railway

### Option 1: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add environment variables
railway variables set GROQ_API_KEY=your_key
railway variables set PINECONE_API_KEY=your_key
railway variables set FLASK_ENV=production
railway variables set ALLOWED_ORIGINS=https://your-app.vercel.app

# Deploy
railway up
```

### Option 2: Railway Web UI

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Set root directory to `backend/` (if monorepo)
5. Add environment variables in Railway dashboard
6. Deploy!

## 🔐 Environment Variables (Railway)

Required:
```
GROQ_API_KEY=gsk_xxx
PINECONE_API_KEY=xxx
FLASK_ENV=production
ALLOWED_ORIGINS=https://your-frontend.vercel.app
PORT=5000
```

## 📡 API Endpoints

- `GET /api/health` - Health check
- `POST /api/search` - RAG search with AI response
- `POST /api/pyq/search` - Search PYQ questions
- `POST /api/pyq/random` - Get random quiz questions
- `GET /api/pyq/filters` - Get available filters
- `GET /api/stats` - System statistics

## ⚡ Performance

- Cold start: ~5-10s
- Warm requests: <500ms
- Rate limit: 50 req/min per endpoint
- Memory: ~800MB (with models loaded)

## 🔒 Security Features

- CORS protection
- Rate limiting
- Environment-based debug mode
- Error handling & logging
- Input validation

## 📊 Monitoring

Check logs in Railway dashboard:
```bash
railway logs
```

## 🆘 Troubleshooting

**Cold starts too slow?**
- Railway free tier sleeps after 30min inactivity
- Consider implementing keep-alive ping from frontend

**Out of memory?**
- Check Railway logs
- Models use ~500MB RAM
- Upgrade to Hobby plan ($5/mo) for 1GB RAM

**CORS errors?**
- Verify `ALLOWED_ORIGINS` includes your Vercel URL
- Check Vercel deployment URL (not preview URL)
