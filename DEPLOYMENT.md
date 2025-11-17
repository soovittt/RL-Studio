# Deployment Guide - RL Studio

This guide covers deploying RL Studio to production using Netlify (frontend) and Convex (backend).

## 🚀 Quick Deploy to Netlify

### Prerequisites

1. **Netlify Account**: Sign up at https://netlify.com
2. **Convex Account**: Sign up at https://convex.dev
3. **GitHub Repository**: Push your code to GitHub

### Step 1: Deploy Convex Backend

1. **Deploy Convex functions**:
   ```bash
   npx convex deploy --prod
   ```

2. **Set Convex environment variables** (in Convex dashboard or CLI):
   ```bash
   # Set Firecrawl API key (optional)
   npx convex env set FIRECRAWL_API_KEY your-key-here --prod
   
   # Set CodeRabbit API key (optional)
   npx convex env set CODERABBIT_API_KEY your-key-here --prod
   ```

3. **Get your Convex deployment URL**:
   - After deploying, Convex will give you a URL like: `https://your-project.convex.cloud`
   - Or find it in the Convex dashboard: https://dashboard.convex.dev

### Step 2: Configure Netlify

#### Option A: Deploy via Netlify CLI (Recommended)

1. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**:
   ```bash
   netlify login
   ```

3. **Initialize Netlify**:
   ```bash
   netlify init
   ```
   - Choose "Create & configure a new site"
   - Choose your team
   - Site name (or use auto-generated)
   - Build command: `npm run build`
   - Publish directory: `dist`

4. **Set environment variables**:
   ```bash
   # Set Convex URL (REQUIRED)
   netlify env:set VITE_CONVEX_URL https://your-project.convex.cloud
   
   # Optional: Set other environment variables
   netlify env:set VITE_APP_NAME "RL Studio"
   ```

5. **Deploy**:
   ```bash
   netlify deploy --prod
   ```

#### Option B: Deploy via Netlify Dashboard

1. **Connect GitHub Repository**:
   - Go to https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub and select your repository

2. **Configure Build Settings**:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Node version**: `18` (or latest)

3. **Set Environment Variables**:
   - Go to Site settings → Environment variables
   - Add the following:
     - `VITE_CONVEX_URL` = `https://your-project.convex.cloud` (REQUIRED)
     - `VITE_APP_NAME` = `RL Studio` (optional)

4. **Deploy**:
   - Click "Deploy site"
   - Netlify will automatically build and deploy

### Step 3: Verify Deployment

1. **Check Convex deployment**:
   ```bash
   npx convex deploy --prod --once
   ```
   Should show: "✔ Convex functions ready!"

2. **Check Netlify deployment**:
   - Visit your Netlify site URL
   - Check build logs in Netlify dashboard
   - Verify the app loads correctly

## 📋 Environment Variables Reference

### Netlify Environment Variables (Build-time)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CONVEX_URL` | ✅ Yes | Your Convex deployment URL |
| `VITE_APP_NAME` | ❌ No | App name (default: "RL Studio") |

### Convex Environment Variables (Runtime)

Set these in Convex dashboard (Settings → Environment Variables) or via CLI:

| Variable | Required | Description |
|----------|----------|-------------|
| `FIRECRAWL_API_KEY` | ❌ No | For paper/GitHub import features |
| `CODERABBIT_API_KEY` | ❌ No | For code review features |

## 🔧 Build Configuration

The `netlify.toml` file is already configured with:
- ✅ Build command: `npm run build`
- ✅ Publish directory: `dist`
- ✅ Node version: `18`
- ✅ SPA routing (redirects all routes to index.html)
- ✅ Security headers
- ✅ Asset caching

## 🐛 Troubleshooting

### Build Fails

1. **Check build logs** in Netlify dashboard
2. **Verify Node version**: Ensure Node 18+ is used
3. **Check dependencies**: Run `npm install` locally to verify
4. **TypeScript errors**: Fix any TypeScript errors before deploying

### App Doesn't Load

1. **Check Convex URL**: Verify `VITE_CONVEX_URL` is set correctly
2. **Check browser console**: Look for errors
3. **Verify Convex deployment**: Ensure Convex functions are deployed
4. **Check network tab**: Verify API calls to Convex are working

### Convex Functions Not Working

1. **Verify deployment**: Run `npx convex deploy --prod`
2. **Check environment variables**: Ensure API keys are set in Convex
3. **Check Convex dashboard**: Look for errors in function logs

## 🔄 Continuous Deployment

Netlify automatically deploys when you push to your main branch:

1. Push to GitHub
2. Netlify detects the push
3. Runs build command
4. Deploys to production

To disable auto-deploy or configure branch deploys:
- Go to Site settings → Build & deploy → Continuous Deployment

## 📦 Production Checklist

Before going live:

- [ ] Convex functions deployed to production
- [ ] `VITE_CONVEX_URL` set in Netlify
- [ ] All environment variables configured
- [ ] Test all features (create env, train, etc.)
- [ ] Verify authentication works
- [ ] Check mobile responsiveness
- [ ] Set up custom domain (optional)
- [ ] Enable HTTPS (automatic with Netlify)
- [ ] Set up error monitoring (Sentry, etc.)

## 🌐 Custom Domain

1. Go to Netlify dashboard → Domain settings
2. Add custom domain
3. Follow DNS configuration instructions
4. SSL certificate is automatically provisioned

## 📊 Monitoring

- **Netlify Analytics**: Available in Netlify dashboard
- **Convex Dashboard**: Monitor function calls and errors
- **Error Tracking**: Consider adding Sentry or similar

## 🔐 Security

- ✅ HTTPS is automatically enabled
- ✅ Security headers configured in `netlify.toml`
- ✅ Environment variables are encrypted
- ✅ Convex API keys stored securely in Convex dashboard

## 🚀 Next Steps

After deployment:

1. Share your Netlify URL with users
2. Monitor usage in Netlify and Convex dashboards
3. Set up alerts for errors
4. Consider adding analytics (Google Analytics, etc.)
5. Set up CI/CD for automated testing

## 📚 Additional Resources

- [Netlify Documentation](https://docs.netlify.com/)
- [Convex Documentation](https://docs.convex.dev/)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)

