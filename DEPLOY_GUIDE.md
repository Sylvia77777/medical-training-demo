# Medical Training Demo Deployment Guide

This guide publishes your demo to the public internet with:

- Frontend: Vercel
- Backend: Render (free plan)

## 1) Prepare code and push to GitHub

1. Create a GitHub repository.
2. Push this project root to GitHub.
3. Keep `backend` and `frontend` in the same repo.

## 2) Deploy backend on Render

1. Go to [Render](https://render.com/) and sign in.
2. Click **New +** -> **Blueprint**.
3. Select your GitHub repo.
4. Render will detect `render.yaml` and create service `medical-training-demo-backend`.
5. In service **Environment** add:
   - `AI_API_KEY` = your provider key
   - `AI_MODEL` = `gpt-4o-mini` (or your target model)
   - `AI_BASE_URL` = leave empty for OpenAI, set for DeepSeek (for example `https://api.deepseek.com/v1`)
6. Deploy and wait until service is live.
7. Copy the backend public URL, e.g. `https://medical-training-demo-backend.onrender.com`.

## 3) Deploy frontend on Vercel

1. Go to [Vercel](https://vercel.com/) and sign in.
2. Click **Add New...** -> **Project** and import the same GitHub repo.
3. In **Root Directory**, choose `frontend`.
4. Build settings:
   - Framework preset: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
5. Add environment variable:
   - `VITE_API_BASE_URL` = your Render backend URL from step 2.
6. Deploy.

## 4) Verify public demo

1. Open your Vercel URL in a browser.
2. Send a doctor question in chat.
3. Confirm header shows backend mode and chat keeps history after refresh.

## 5) Common issues

- If frontend still hits local API:
  - Confirm Vercel env var `VITE_API_BASE_URL` is set.
  - Redeploy frontend after changing env vars.
- If backend returns mock content:
  - Confirm `AI_API_KEY` is set on Render.
  - Check Render logs for provider errors.
- If CORS issues appear:
  - Backend currently allows all origins for demo use.
