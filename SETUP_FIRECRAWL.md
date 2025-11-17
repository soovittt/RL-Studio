# Setting Up Firecrawl API Key

The Firecrawl API key needs to be configured in Convex (not in a `.env` file).

## Quick Setup

Run this command in your terminal:

```bash
npx convex env set FIRECRAWL_API_KEY your-api-key-here
```

Replace `your-api-key-here` with your actual Firecrawl API key.

## Get Your Firecrawl API Key

1. Go to https://firecrawl.dev
2. Sign up or log in
3. Navigate to your API keys section
4. Copy your API key

## Verify It's Set

Check that the environment variable is set:

```bash
npx convex env list
```

You should see `FIRECRAWL_API_KEY` in the list.

## Alternative: Set via Dashboard

1. Go to your Convex dashboard: https://dashboard.convex.dev
2. Select your project
3. Go to Settings > Environment Variables
4. Add `FIRECRAWL_API_KEY` with your API key value
5. Save

## After Setting

Once the API key is set, restart your Convex dev server if it's running:

```bash
# Stop the current dev server (Ctrl+C)
# Then restart it
npx convex dev
```

The Firecrawl import features should now work!

