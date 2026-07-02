# Deployment Guide — Voter Data System
**Stack:** Neon (PostgreSQL) · Render (FastAPI backend) · Vercel (Next.js frontend)
All three have free tiers.

---

## Step 1 — Push code to GitHub

Create a new **private** GitHub repository and push your project:

```bash
cd "/Users/meeranmaqsusi/Claude/Projects/Highly Classified - Confidential/voter-data-system"
git init
git add .
git commit -m "initial commit"
# Create a repo at https://github.com/new  (name: voter-data-system, Private)
git remote add origin https://github.com/YOUR_USERNAME/voter-data-system.git
git push -u origin main
```

---

## Step 2 — Create a Neon PostgreSQL database (free)

1. Go to **https://neon.tech** → Sign up (free)
2. Click **New Project** → name it `voter-data`
3. Once created, go to **Connection Details**
4. Copy the **Connection string** — it looks like:
   ```
   postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. **Save this URL** — you'll need it in Step 3.

---

## Step 3 — Deploy backend on Render (free)

1. Go to **https://render.com** → Sign up / Log in
2. Click **New → Web Service**
3. Connect your GitHub repo (`voter-data-system`)
4. Configure:
   - **Name:** `voter-data-backend`
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Scroll to **Environment Variables** → add these:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | *(paste Neon connection string from Step 2)* |
   | `JWT_SECRET` | *(any long random string, e.g. `mdis-voter-2024-xYz9`)* |
   | `ADMIN_USERNAME` | `admin` |
   | `ADMIN_PASSWORD` | *(your desired password)* |
   | `ALLOWED_ORIGINS` | *(leave blank for now — add Vercel URL after Step 4)* |

6. Click **Create Web Service** → wait ~3 minutes for the build
7. Once deployed, note your backend URL:
   ```
   https://voter-data-backend.onrender.com
   ```
8. Test it: open `https://voter-data-backend.onrender.com/health` in your browser
   → should return `{"status":"healthy"}`

---

## Step 4 — Deploy frontend on Vercel (free)

1. Go to **https://vercel.com** → Sign up / Log in
2. Click **Add New → Project**
3. Import your GitHub repo (`voter-data-system`)
4. In **Configure Project**:
   - **Root Directory:** `frontend`  ← click Edit and set this
   - **Framework Preset:** Next.js (auto-detected)
5. Expand **Environment Variables** → add:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_URL` | `https://voter-data-backend.onrender.com` |

6. Click **Deploy** → wait ~2 minutes
7. Note your frontend URL:
   ```
   https://voter-data-system.vercel.app
   ```

---

## Step 5 — Update CORS on Render

Go back to Render → your backend service → **Environment** tab → update:

| Key | Value |
|-----|-------|
| `ALLOWED_ORIGINS` | `https://voter-data-system.vercel.app` |

Render will auto-redeploy with the new setting.

---

## Step 6 — Test the full deployment

Open your Vercel URL in the browser:
- You should see the login page
- Log in with `admin` / *(your password from Step 3)*
- The app should be fully functional

---

## Important notes

**Free tier limits:**
- **Render free tier** spins down after 15 min of inactivity — the first request after spin-down takes ~30 seconds (cold start). Paid tier ($7/mo) keeps it always-on.
- **Neon free tier** gives 512 MB storage — enough for millions of voter records.
- **Vercel free tier** is unlimited for Next.js apps.

**Data persistence:**
- All voter data is stored in Neon PostgreSQL — it persists permanently regardless of Render restarts.

**Updating the app:**
- Push changes to GitHub → Render and Vercel auto-deploy within 2-3 minutes.

**Changing admin password:**
- Update the `ADMIN_PASSWORD` environment variable on Render → trigger a redeploy.
