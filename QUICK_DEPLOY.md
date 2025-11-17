# 🚀 Quick Deploy Guide

## Option 1: One-Click Deploy (Recommended)

### Deploy to Netlify via GitHub

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Netlify**:
   - Go to https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub and select your repository
   - Configure:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`
   - Add environment variable:
     - `VITE_CONVEX_URL` = `https://your-project.convex.cloud`
   - Click "Deploy site"

3. **Deploy Convex**:
   ```bash
   npx convex deploy --prod
   ```

Done! Your site will be live at `https://your-site.netlify.app`

---

## Option 2: Using the Deployment Script

```bash
# Make script executable (first time only)
chmod +x deploy.sh

# Run deployment script
./deploy.sh
```

The script will:
1. ✅ Deploy Convex backend
2. ✅ Set Netlify environment variables
3. ✅ Build the application
4. ✅ Deploy to Netlify

---

## Option 3: Manual Deployment

### Step 1: Deploy Convex

```bash
# Deploy to production
npx convex deploy --prod

# Set environment variables (optional)
npx convex env set FIRECRAWL_API_KEY your-key --prod
npx convex env set CODERABBIT_API_KEY your-key --prod
```

**Note your Convex URL** (e.g., `https://your-project.convex.cloud`)

### Step 2: Deploy to Netlify

#### Via Netlify CLI:

```bash
# Install Netlify CLI (if not installed)
npm install -g netlify-cli

# Login
netlify login

# Initialize (first time only)
netlify init

# Set environment variable
netlify env:set VITE_CONVEX_URL https://your-project.convex.cloud --prod

# Build and deploy
npm run build
netlify deploy --prod
```

#### Via Netlify Dashboard:

1. Go to https://app.netlify.com
2. Add new site → Import from Git
3. Connect GitHub repository
4. Configure:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Add environment variable:
   - Key: `VITE_CONVEX_URL`
   - Value: `https://your-project.convex.cloud`
6. Deploy!

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Site loads at Netlify URL
- [ ] Can create an environment
- [ ] Can login/authenticate
- [ ] Convex functions work (check browser console)
- [ ] All features work correctly

---

## 🔧 Troubleshooting

### Build Fails
- Check build logs in Netlify dashboard
- Ensure Node 18+ is used
- Fix any TypeScript errors

### App Doesn't Load
- Verify `VITE_CONVEX_URL` is set correctly
- Check browser console for errors
- Ensure Convex is deployed

### Convex Errors
- Check Convex dashboard for function errors
- Verify environment variables are set
- Check Convex deployment status

---

## 📚 Full Documentation

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

