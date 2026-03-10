# ContentFlow - Video Idea Generator

Automated daily video idea generation for YouTube, TikTok, Instagram, and X with AI-powered content creation.

## Features

- **3 Profile Support**: Personal Brand, DrivesWise (Music Distribution), ProFleetHire (UK Car Rental)
- **Daily Automated Generation**: 10 ideas per day (3 personal, 3 music, 4 rental)
- **Cross-Platform Descriptions**: One description works for all platforms
- **5-Second Hook Scripts**: Engaging opening scripts
- **Full Scripts**: Under 60 seconds total
- **4 Hashtags**: Optimized mix of niche and broad tags

## Quick Start

### 1. Set Up Supabase Database

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `ieahjkraxawvmzhkcwwb`
3. Go to **SQL Editor**
4. Copy and paste the contents of `database/schema.sql`
5. Run the SQL

### 2. Backend (Render)

1. Create a new **Web Service** on [Render](https://render.com)
2. Connect your GitHub repository
3. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. Add Environment Variables:
   ```
   SUPABASE_URL: https://ieahjkraxawvmzhkcwwb.supabase.co
   SUPABASE_SERVICE_KEY: (your service role key)
   YOUTUBE_API_KEY: AIzaSyBYjz4PL-NYLXyv9zvdedakRJOubVbzwKY
   OPENAI_API_KEY: (your OpenAI key)
   APIFY_API_KEY: bNHcHbwoK83CXrOn0BCiq4t6gHG5UP0oa0qa
   ```

### 3. Frontend (Vercel/Netlify)

1. Build the frontend:
   ```bash
   cd frontend
   npm install
   npm run build
   ```
2. Deploy the `dist` folder to Vercel or Netlify
3. Configure environment variable:
   ```
   VITE_SUPABASE_URL: https://ieahjkraxawvmzhkcwwb.supabase.co
   VITE_SUPABASE_ANON_KEY: (your anon key)
   ```

## Project Structure

```
video-idea-generator/
├── database/
│   └── schema.sql          # Database schema
├── backend/
│   ├── server.js           # Main backend server
│   ├── package.json        # Dependencies
│   └── .env.example        # Environment template
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main React app
│   │   └── main.jsx       # Entry point
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/profiles` | Get all profiles |
| GET | `/api/ideas/:profileName` | Get ideas for profile |
| GET | `/api/ideas` | Get all ideas grouped |
| POST | `/api/generate` | Manually trigger generation |
| PATCH | `/api/ideas/:id/complete` | Mark idea as completed |
| GET | `/api/settings` | Get API settings |
| POST | `/api/settings` | Update settings |

## Scheduled Automation

The backend runs a daily cron job at **6:00 AM UTC** to:
1. Fetch trending videos from YouTube
2. Generate 10 new video ideas using AI
3. Store them in the database

## Required API Keys

| API | Purpose | Where to Get |
|-----|---------|--------------|
| YouTube Data API | Trend discovery | [Google Cloud Console](https://console.cloud.google.com) |
| OpenAI API | AI generation | [OpenAI Platform](https://platform.openai.com) |
| Apify | Advanced scraping | [Apify](https://apify.com) |

## Security Notes

⚠️ **IMPORTANT**: Never commit API keys to version control!

- Use environment variables in production
- Rotate keys regularly
- Restrict API key permissions

## License

MIT
