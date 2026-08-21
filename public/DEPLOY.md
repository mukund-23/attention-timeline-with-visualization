# Deploy

## 1. Push to GitHub

```bash
cd attention-timeline
git init
git add -A
git commit -m "Attention timeline: 29 mechanisms, chronological, with trade-offs"
git branch -M main
git remote add origin https://github.com/mukund-23/attention-timeline.git
git push -u origin main
```

Create the empty repo at github.com/new first (name: `attention-timeline`, public, no README).

## 2. Deploy on Vercel

Option A — dashboard (easiest):
1. vercel.com -> Add New -> Project -> Import `mukund-23/attention-timeline`
2. Vercel auto-detects Vite. Confirm:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
3. Deploy. URL appears in ~40s.

Option B — CLI:
```bash
npm i -g vercel
vercel --prod
```

Every push to `main` redeploys automatically.

Free Hobby tier covers this: static build, no serverless functions, no card required.
Netlify equivalent if preferred — build `npm run build`, publish `dist`.

## 3. After deploy

Put the live URL in README.md under "Live:".
