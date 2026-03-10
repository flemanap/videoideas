// =============================================
// CONTENT FLOW GENERATOR - BACKEND SERVER
// =============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const OpenAI = require('openai');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// =============================================
// SUPABASE CONFIGURATION
// =============================================
const supabaseUrl = process.env.SUPABASE_URL || 'https://ieahjkraxawvmzhkcwwb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllYWhqa3JheGF3dm16aGN3d2IiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzM4MTQwMDY5LCJleHAiOjE5NTM3MTYwNjl9.W_wjlvVq7CVzjJLFJP4CT1lJ2jCrBBMq7qF2kBJd6oE';

const supabase = createClient(supabaseUrl, supabaseKey);

// =============================================
// API CONFIGURATION
// =============================================
const youtubeApiKey = process.env.YOUTUBE_API_KEY || 'AIzaSyBYjz4PL-NYLXyv9zvdedakRJOubVbzwKY';
const openaiApiKey = process.env.OPENAI_API_KEY || '';
const apifyApiKey = process.env.APIFY_API_KEY || 'bNHcHbwoK83CXrOn0BCiq4t6gHG5UP0oa0qa';

let openai;
if (openaiApiKey) {
  openai = new OpenAI({ apiKey: openaiApiKey });
}

// =============================================
// YOUTUBE API CLIENT
// =============================================
const youtube = google.youtube({
  version: 'v3',
  auth: youtubeApiKey
});

// =============================================
// PROFILE CONFIGURATIONS
// =============================================
const PROFILES = {
  personal: {
    id: null, // Will be fetched from DB
    keywords: ['personal development', 'entrepreneurship', 'motivation', 'success', 'lifestyle', 'mindset'],
    name: 'Personal Brand'
  },
  driveswise: {
    id: null,
    keywords: ['music distribution', 'indie artist', 'spotify promotion', 'music marketing', 'new music', 'artist tips'],
    name: 'DrivesWise'
  },
  profleethire: {
    id: null,
    keywords: ['car rental', 'van hire', 'used car', 'hpi check', 'vehicle check', 'uk car finance', 'turo'],
    name: 'ProFleetHire'
  }
};

// =============================================
// API ROUTES
// =============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all profiles
app.get('/api/profiles', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name');

    if (error) throw error;

    // Update profile IDs
    data.forEach(p => {
      PROFILES[p.name].id = p.id;
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get ideas by profile
app.get('/api/ideas/:profileName', async (req, res) => {
  try {
    const { profileName } = req.params;
    const { date } = req.query;

    let query = supabase
      .from('generated_ideas')
      .select('*')
      .eq('profile_id', PROFILES[profileName]?.id || profileName);

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query = query
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all ideas grouped by date
app.get('/api/ideas', async (req, res) => {
  try {
    const { data: profiles } = await supabase.from('profiles').select('id, name, display_name');

    const ideasByProfile = {};

    for (const profile of profiles) {
      const { data: ideas } = await supabase
        .from('generated_ideas')
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50);

      ideasByProfile[profile.name] = ideas || [];
    }

    res.json(ideasByProfile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark idea as completed
app.patch('/api/ideas/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('generated_ideas')
      .update({ is_completed: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manually trigger generation
app.post('/api/generate', async (req, res) => {
  try {
    res.json({ message: 'Generation started', status: 'success' });
    await generateDailyIdeas();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get settings
app.get('/api/settings', async (req, res) => {
  try {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) throw error;

    const settings = {};
    data.forEach(s => { settings[s.key] = s.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update settings
app.post('/api/settings', async (req, res) => {
  try {
    const { key, value } = req.body;

    const { error } = await supabase
      .from('settings')
      .upsert({ key, value, updated_at: new Date().toISOString() });

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// GENERATION FUNCTIONS
// =============================================

async function fetchYouTubeTrends(keywords, maxResults = 10) {
  try {
    const trends = [];

    for (const keyword of keywords.slice(0, 3)) {
      const response = await youtube.search.list({
        part: 'snippet',
        q: keyword,
        type: 'video',
        videoDuration: 'short',
        order: 'relevance',
        maxResults: maxResults
      });

      if (response.data.items) {
        response.data.items.forEach(item => {
          trends.push({
            platform: 'youtube',
            title: item.snippet.title,
            description: item.snippet.description,
            videoId: item.id.videoId,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt
          });
        });
      }
    }

    return trends;
  } catch (err) {
    console.error('YouTube API Error:', err.message);
    return [];
  }
}

// Fetch TikTok trends using Apify
async function fetchTikTokTrends(keywords) {
  try {
    if (!apifyApiKey) {
      console.log('No Apify API key, skipping TikTok');
      return [];
    }

    const trends = [];

    for (const keyword of keywords.slice(0, 2)) {
      // Use Apify's TikTok scraper
      const response = await axios.post(
        'https://api.apify.com/v2/acts/ted8889~tiktok-hashtag-scraper/runs',
        {
          hashtag: keyword,
          count: 10
        },
        {
          headers: {
            'Authorization': `Bearer ${apifyApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const runId = response.data.data.id;

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Get results
      const resultResponse = await axios.get(
        `https://api.apify.com/v2/acts/ted8889~tiktok-hashtag-scraper/runs/${runId}/dataset/items`,
        {
          headers: { 'Authorization': `Bearer ${apifyApiKey}` }
        }
      );

      if (resultResponse.data) {
        resultResponse.data.forEach(item => {
          trends.push({
            platform: 'tiktok',
            title: item.desc || item.text || 'TikTok Video',
            description: item.text || '',
            videoUrl: item.videoUrl,
            author: item.author?.nickname || '',
            likes: item.diggCount || 0
          });
        });
      }
    }

    return trends;
  } catch (err) {
    console.error('TikTok/Apify Error:', err.message);
    return [];
  }
}

async function generateVideoIdeas(profileName, trends) {
  const profile = PROFILES[profileName];

  if (!openaiApiKey) {
    // Fallback to manual generation if no OpenAI key
    return trends.slice(0, 3).map((trend, i) => ({
      title: `${trend.title.substring(0, 50)} - ${profile.name} Edition`,
      description: `Discover how this relates to ${profile.name} and why it matters for your content strategy. Watch till the end!`,
      script_hook: `Hey! Did you know ${trend.title.substring(0, 30)}? Let me explain...`,
      script_full: `Hey! Did you know ${trend.title.substring(0, 30)}? Let me explain why this matters for ${profile.name}. In this video, we'll cover the key points and how you can apply this to your own journey. Don't forget to like and subscribe!`,
      hashtags: [`#${profile.name.replace(/\s/g, '')}`, '#viral', '#trending', '#fyp'],
      source_topic: trend.title
    }));
  }

  const prompt = `You are a viral content strategist. Generate 3 unique video ideas for a ${profile.name} YouTube channel/Instagram Reel/TikTok.

The ideas should be:
1. Based on these trending topics: ${trends.map(t => t.title).join(', ')}
2. Adapted for short-form content (under 60 seconds)
3. Engaging with a strong 5-second hook
4. Include a catchy title (under 60 characters)
5. Include a description that works for ALL platforms (YouTube, TikTok, Instagram, X) - no platform-specific calls to action
6. Include exactly 4 hashtags (mix of niche and broad)

For each idea, provide:
- title: Catchy headline (max 60 chars)
- description: Universal description (100-150 words) that works everywhere
- script_hook: The first 5 seconds - a powerful hook to grab attention
- script_full: Full script concept (under 60 seconds / ~100 words)
- hashtags: Array of exactly 4 hashtags

Respond in JSON format:
[{"title": "...", "description": "...", "script_hook": "...", "script_full": "...", "hashtags": ["#...", "#...", "#...", "#..."]}]`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8
    });

    const content = completion.choices[0].message.content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (err) {
    console.error('OpenAI Error:', err.message);
    return [];
  }
}

async function generateDailyIdeas() {
  console.log('Starting daily idea generation...');

  // Get profile IDs from database
  const { data: profiles } = await supabase.from('profiles').select('id, name');

  profiles.forEach(p => {
    if (PROFILES[p.name]) {
      PROFILES[p.name].id = p.id;
    }
  });

  const ideasPerProfile = {
    personal: 3,
    driveswise: 3,
    profleethire: 4
  };

  for (const [profileName, count] of Object.entries(ideasPerProfile)) {
    try {
      const keywords = PROFILES[profileName].keywords;

      // Fetch from YouTube
      const youtubeTrends = await fetchYouTubeTrends(keywords, 10);

      // Fetch from TikTok using Apify
      const tiktokTrends = await fetchTikTokTrends(keywords);

      // Combine trends
      const allTrends = [...youtubeTrends, ...tiktokTrends];

      const ideas = await generateVideoIdeas(profileName, allTrends);

      for (let i = 0; i < Math.min(count, ideas.length); i++) {
        const idea = ideas[i];

        await supabase.from('generated_ideas').insert({
          profile_id: PROFILES[profileName].id,
          title: idea.title,
          description: idea.description,
          script_hook: idea.script_hook,
          script_full: idea.script_full,
          hashtags: idea.hashtags,
          source_topic: allTrends[i]?.title || 'AI Generated'
        });
      }

      console.log(`Generated ${count} ideas for ${profileName}`);
    } catch (err) {
      console.error(`Error generating for ${profileName}:`, err.message);
    }
  }

  // Update last generation date
  await supabase.from('settings').upsert({
    key: 'last_generation_date',
    value: new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString()
  });

  console.log('Daily generation complete!');
}

// =============================================
// SCHEDULED TASKS
// =============================================

// Run daily at 6 AM UTC
cron.schedule('0 6 * * *', async () => {
  console.log('Running scheduled daily generation...');
  await generateDailyIdeas();
});

// =============================================
// START SERVER
// =============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ContentFlow Backend running on port ${PORT}`);

  // Run initial generation on startup (if enabled)
  generateDailyIdeas();
});
