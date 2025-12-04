# Deployment Guide - Where to Live NL

## 🚀 Complete Deployment Instructions

This guide covers deploying both frontend (Vercel) and backend (Railway) for production.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Backend Deployment (Railway)](#backend-deployment-railway)
3. [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
4. [Environment Variables](#environment-variables)
5. [Custom Domain Setup](#custom-domain-setup)
6. [Post-Deployment](#post-deployment)
7. [Alternative: Other Hosting Options](#alternative-hosting-options)

---

## Prerequisites

### Accounts Needed
- [x] GitHub account (code repository)
- [ ] Vercel account (frontend hosting) - **FREE**
- [ ] Railway account (backend hosting) - **$5 FREE credit**
- [ ] Domain registrar (optional, for custom domain)

### Repository Setup
```bash
# Ensure your code is pushed to GitHub
git add .
git commit -m "Ready for production deployment"
git push origin main
```

---

## Backend Deployment (Railway)

Railway is perfect for Python backends. $5 free credit, then ~$5-20/month.

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app/)
2. Sign up with GitHub
3. Get $5 free credit (no credit card required)

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your `where-to-live-nl` repository
4. Railway will auto-detect Python

### Step 3: Configure Build Settings

Railway should auto-detect, but verify:

**Root Directory**: `/backend`

**Build Command** (create `railway.json` in project root):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd backend && pip install -r requirements.txt"
  },
  "deploy": {
    "startCommand": "cd backend && uvicorn api_server:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300
  }
}
```

Or manually set:
- **Start Command**: `cd backend && uvicorn api_server:app --host 0.0.0.0 --port $PORT`

### Step 4: Add Environment Variables

In Railway dashboard → Variables tab:

```bash
OPENROUTESERVICE_API_KEY=your_actual_api_key_here
PYTHONUNBUFFERED=1
PORT=8000
```

### Step 5: Add Data Files

Railway doesn't include your local `data/` directory. Options:

#### Option A: Upload to Railway Volume (Recommended)
1. Railway dashboard → Data tab → New Volume
2. Name: `data`
3. Mount path: `/app/data`
4. Upload your Parquet files via Railway CLI or dashboard

#### Option B: Use Cloud Storage (Better for large datasets)
```python
# backend/api_server.py
# Modify to load from S3/R2/Azure Blob instead of local filesystem

import boto3

s3 = boto3.client('s3',
    endpoint_url='https://your-r2-endpoint.com',
    aws_access_key_id=os.getenv('R2_ACCESS_KEY'),
    aws_secret_access_key=os.getenv('R2_SECRET_KEY')
)

# Load Parquet from cloud
def load_dataframe(name: str, s3_key: str):
    obj = s3.get_object(Bucket='where-to-live-nl', Key=s3_key)
    return pl.read_parquet(io.BytesIO(obj['Body'].read()))
```

### Step 6: Deploy
1. Click "Deploy"
2. Wait for build (2-3 minutes)
3. Railway will give you a URL: `https://your-app.up.railway.app`

### Step 7: Test Backend
```bash
curl https://your-app.up.railway.app/health
# Should return: {"status": "healthy"}

curl https://your-app.up.railway.app/api/cache-stats
# Should return cache statistics
```

---

## Frontend Deployment (Vercel)

Vercel is made for Next.js. 100% free for personal projects.

### Step 1: Create Vercel Account
1. Go to [vercel.com](https://vercel.com/)
2. Sign up with GitHub
3. Free forever for personal projects

### Step 2: Import Project
1. Click "Add New..." → "Project"
2. Import `where-to-live-nl` from GitHub
3. Vercel auto-detects Next.js

### Step 3: Configure Build Settings

**Framework Preset**: Next.js
**Root Directory**: `frontend`
**Build Command**: `npm run build`
**Output Directory**: `.next`
**Install Command**: `npm install`

### Step 4: Environment Variables

In Vercel dashboard → Settings → Environment Variables:

```bash
NEXT_PUBLIC_BACKEND_URL=https://your-app.up.railway.app
NEXT_PUBLIC_PDOK_TILES_URL=https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0
NEXT_PUBLIC_PDOK_GEOCODING_URL=https://api.pdok.nl/bzk/locatieserver/search/v3_1
```

### Step 5: Deploy
1. Click "Deploy"
2. Wait for build (1-2 minutes)
3. Vercel gives you: `https://your-app.vercel.app`

### Step 6: Test Frontend
1. Open `https://your-app.vercel.app`
2. Try searching for an address
3. Check browser console for errors
4. Verify data loads from backend

---

## Environment Variables

### Backend (.env for Railway)
```bash
# OpenRouteService
OPENROUTESERVICE_API_KEY=your_api_key_here

# Python
PYTHONUNBUFFERED=1

# Port (Railway provides this automatically)
PORT=8000

# Optional: Database URLs if using cloud storage
R2_ACCESS_KEY=your_r2_access_key
R2_SECRET_KEY=your_r2_secret_key
R2_BUCKET_NAME=where-to-live-nl
```

### Frontend (.env.local for Vercel)
```bash
# Backend URL (Railway deployment URL)
NEXT_PUBLIC_BACKEND_URL=https://your-app.up.railway.app

# PDOK APIs (optional, has defaults)
NEXT_PUBLIC_PDOK_TILES_URL=https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0
NEXT_PUBLIC_PDOK_GEOCODING_URL=https://api.pdok.nl/bzk/locatieserver/search/v3_1

# App metadata
NEXT_PUBLIC_APP_NAME=Where to Live NL
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## Custom Domain Setup

### Option 1: Vercel Domain (Easiest)
Vercel provides free `.vercel.app` domain:
- `where-to-live-nl.vercel.app`
- HTTPS automatic
- No configuration needed

### Option 2: Custom Domain (Professional)

#### Buy Domain
- Namecheap: ~$10/year (.com)
- Cloudflare: ~$9/year (.com)
- Google Domains: ~$12/year (.com)

Recommended domain: `wheretolivenl.com` or `wheretolivenl.nl`

#### Configure DNS (Vercel)

1. **Vercel Dashboard** → Settings → Domains
2. Add your custom domain: `wheretolivenl.com`
3. Vercel provides DNS records to add:

```
Type    Name    Value
A       @       76.76.21.21
CNAME   www     cname.vercel-dns.com
```

4. Add these to your domain registrar's DNS settings
5. Wait 24-48 hours for propagation
6. Vercel auto-provisions SSL certificate

#### Configure DNS (Railway Backend)

For backend subdomain (`api.wheretolivenl.com`):

1. **Railway Dashboard** → Settings → Domains
2. Add custom domain: `api.wheretolivenl.com`
3. Railway provides:

```
Type    Name    Value
CNAME   api     your-app.up.railway.app
```

4. Update Vercel env var:
```bash
NEXT_PUBLIC_BACKEND_URL=https://api.wheretolivenl.com
```

---

## Post-Deployment

### 1. Test Everything
- [ ] Search for address works
- [ ] Map loads with PDOK tiles
- [ ] Crime overlay toggles work
- [ ] Travel time calculator works
- [ ] Wijkagent information displays
- [ ] Demographics load correctly
- [ ] Mobile responsive

### 2. Monitor Performance

#### Vercel Analytics (Free)
1. Vercel Dashboard → Analytics
2. Enable Web Analytics
3. Track Core Web Vitals automatically

#### Railway Logs
1. Railway Dashboard → Deployments → Logs
2. Monitor API errors
3. Check response times

### 3. Set Up Error Tracking

#### Sentry (Recommended - Free tier)
```bash
# Frontend
npm install @sentry/nextjs

# Backend
pip install sentry-sdk
```

**Frontend** (`frontend/sentry.config.js`):
```javascript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "your_sentry_dsn",
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

**Backend** (`backend/api_server.py`):
```python
import sentry_sdk

sentry_sdk.init(
    dsn="your_sentry_dsn",
    environment="production",
    traces_sample_rate=0.1
)
```

### 4. Set Up Uptime Monitoring

#### UptimeRobot (Free - 50 monitors)
1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Add monitors:
   - Frontend: `https://your-app.vercel.app`
   - Backend: `https://your-app.up.railway.app/health`
3. Set up email alerts

---

## Alternative Hosting Options

### Backend Alternatives

#### 1. Render (Similar to Railway)
- **Cost**: Free tier (sleeps after 15min inactivity), then $7/month
- **Pros**: Simple, good docs
- **Cons**: Slower cold starts on free tier

#### 2. DigitalOcean App Platform
- **Cost**: $5/month (always on)
- **Pros**: Reliable, good performance
- **Cons**: More configuration needed

#### 3. Fly.io
- **Cost**: Free tier (3 shared VMs), then $2/month per VM
- **Pros**: Global deployment, fast
- **Cons**: Steeper learning curve

#### 4. AWS Lambda + API Gateway (Serverless)
- **Cost**: Free tier (1M requests/month), then $0.20 per 1M
- **Pros**: True serverless, scales to zero
- **Cons**: Complex setup, cold starts

**Recommendation**: Stick with **Railway** for simplicity.

### Frontend Alternatives

#### 1. Netlify
- **Cost**: Free (100GB bandwidth), then $19/month
- **Pros**: Similar to Vercel
- **Cons**: Slightly slower builds

#### 2. Cloudflare Pages
- **Cost**: Free (unlimited bandwidth!)
- **Pros**: Global CDN, super fast
- **Cons**: Fewer features than Vercel

#### 3. GitHub Pages (Static only)
- **Cost**: Free
- **Pros**: Simple
- **Cons**: No SSR, limited functionality

**Recommendation**: Stick with **Vercel** for Next.js.

---

## Deployment Checklist

### Pre-Deployment
- [x] Code pushed to GitHub
- [x] All features tested locally
- [x] Environment variables documented
- [x] Data files prepared
- [ ] Remove console.logs and debug code
- [ ] Run `npm run build` locally to test

### Backend Deployment
- [ ] Railway account created
- [ ] Project created from GitHub
- [ ] Environment variables set
- [ ] Data files uploaded (volume or cloud storage)
- [ ] Health check endpoint working
- [ ] API endpoints tested

### Frontend Deployment
- [ ] Vercel account created
- [ ] Project imported from GitHub
- [ ] Environment variables set
- [ ] Build successful
- [ ] Site loads correctly
- [ ] Backend connection working

### Post-Deployment
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active
- [ ] Error tracking set up (Sentry)
- [ ] Uptime monitoring set up (UptimeRobot)
- [ ] Analytics enabled
- [ ] Performance tested (Lighthouse)

---

## Cost Summary

### Month 1 (Free Tier)
- **Vercel**: $0 (free forever for personal)
- **Railway**: $0 (using $5 credit)
- **OpenRouteService**: $0 (free tier: 2,000/day)
- **Domain** (optional): $10/year (~$1/month)
- **Total**: **$0-1/month**

### Month 2+ (Paid)
- **Vercel**: $0 (still free)
- **Railway**: $5-15/month (depends on usage)
- **OpenRouteService**: $0 (caching keeps you under limit)
- **Domain**: ~$1/month
- **Total**: **$6-16/month**

### At Scale (1,000+ users/day)
- **Vercel**: $0 (unless you exceed 100GB bandwidth)
- **Railway**: $20-50/month (larger instance)
- **OpenRouteService**: $49/month (if you exceed free tier)
- **Domain**: ~$1/month
- **Total**: **$70-100/month**

**Profitable with just 50 premium users at €10/month = €500 revenue!**

---

## Troubleshooting

### Backend Won't Start
```bash
# Check Railway logs
railway logs

# Common issues:
# 1. Missing requirements.txt
# 2. Wrong start command
# 3. Port not set correctly (use $PORT)
# 4. Missing environment variables
```

### Frontend Build Fails
```bash
# Check Vercel logs in dashboard

# Common issues:
# 1. Missing dependencies in package.json
# 2. TypeScript errors
# 3. Environment variables not set
# 4. Next.js version mismatch
```

### CORS Errors
```python
# backend/api_server.py
# Update allowed origins to include your Vercel domain

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-app.vercel.app",  # Add this
        "https://wheretolivenl.com"     # And your custom domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Data Not Loading
1. Check Railway volume is mounted correctly
2. Verify Parquet files exist in `/app/data/processed/`
3. Check file permissions
4. Test backend endpoint directly: `/api/snapshot?lat=52.37&lng=4.90&area_code=BU03630000`

---

## Next Steps

1. **Deploy backend to Railway** (15 minutes)
2. **Deploy frontend to Vercel** (10 minutes)
3. **Test everything** (30 minutes)
4. **Set up custom domain** (optional, 1 hour)
5. **Configure monitoring** (20 minutes)
6. **Share with friends for beta testing** (ongoing)
7. **Launch publicly!** 🚀

---

**You're ready to deploy!** Follow this guide step-by-step and you'll be live in under an hour.

Good luck! 🎉
