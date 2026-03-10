# ContentFlow - Supabase Deployment Guide

## ⚠️ SECURITY WARNING - ROTATE YOUR KEYS

Your previous API keys were exposed in chat. **Immediately** rotate these:
1. **Supabase Service Role Key**: Go to Settings → API → Regenerate
2. **Google API Key**: Go to Google Cloud Console → Credentials → Regenerate

---

## Deployment Steps

### Step 1: Set Up Database

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select project: `ieahjkraxawvmzhkcwwb`
3. Go to **SQL Editor**
4. Copy and paste the contents of: `supabase/migrations/20240310000000_initial_schema.sql`
5. Click **Run**

### Step 2: Set Environment Variables

In Supabase Dashboard → Settings → Edge Functions:

```
OPENAI_API_KEY=sk-your-openai-key
YOUTUBE_API_KEY=your-google-api-key
```

### Step 3: Deploy Edge Functions

Install Supabase CLI, then:

```bash
# Login
supabase login

# Link to project
supabase link --project-ref ieahjkraxawvmzhkcwwb

# Deploy functions
supabase functions deploy generate-ideas
supabase functions deploy daily-scheduler
```

### Step 4: Set Cron Schedule

The `daily-scheduler` function is configured to run daily at 6 AM UTC.

To enable:
```bash
supabase functions serve daily-scheduler --schedule "0 6 * * *"
```

Or configure in Supabase Dashboard → Edge Functions → daily-scheduler → Schedule

### Step 5: Deploy Frontend

Upload `frontend/index.html` to:
- **Supabase Storage**: Create bucket `webapp`, set as public, upload the HTML file
- **Or**: Deploy to Vercel/Netlify

---

## Files Structure

```
video-idea-generator/
├── supabase/
│   ├── migrations/
│   │   └── 20240310000000_initial_schema.sql
│   ├── functions/
│   │   ├── generate-ideas/
│   │   │   └── index.ts
│   │   └── daily-scheduler/
│   │       └── index.ts
│   ├── config.toml
│   └── README.md
├── frontend/
│   └── index.html
└── README.md
```

## API Endpoints

| Function | Description |
|----------|-------------|
| `generate-ideas` | Manually trigger idea generation |
| `daily-scheduler` | Runs automatically daily at 6 AM UTC |

## Testing

### Test Edge Function:
```bash
curl -X POST "https://ieahjkraxawvmzhkcwwb.supabase.co/functions/v1/generate-ideas" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

---

## API Keys Needed

| Service | Key | Where to Get |
|---------|-----|--------------|
| **YouTube Data API** | `YOUTUBE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com) |
| **OpenAI** | `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com) |

---

## After Deployment

1. Open your frontend URL
2. Click "Generate New Ideas"
3. Check database for new rows in `generated_ideas` table
4. Ideas will appear in the UI with:
   - Title
   - Universal Description (works for all platforms)
   - 5-Second Hook Script
   - Full Script (<60s)
   - 4 Hashtags
