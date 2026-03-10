// =============================================
// CONTENT FLOW GENERATOR - BACKEND SERVER
// Using Apify for all social media data
// =============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
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
// API CONFIGURATION - Just Apify!
// =============================================
const apifyApiKey = process.env.APIFY_API_KEY || 'bNHcHbwoK83CXrOn0BCiq4t6gHG5UP0oa0qa';

// AI Options: OpenAI or Anthropic (Claude)
const openaiApiKey = process.env.OPENAI_API_KEY || '';
const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';

// =============================================
// PROFILE CONFIGURATIONS
// =============================================
const PROFILES = {
  personal: {
    id: null,
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
    const { data, error } = await supabase.from('profiles').select('*').order('name');
    if (error) throw error;
    data.forEach(p => { if (PROFILES[p.name]) PROFILES[p.name].id = p.id; });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get ideas by profile
app.get('/api/ideas/:profileName', async (req, res) => {
  try {
    const { profileName } = req.params;
    const { data, error } = await supabase
      .from('generated_ideas')
      .select('*')
      .eq('profile_id', PROFILES[profileName]?.id || profileName)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get all ideas
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
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Manually trigger generation
app.post('/api/generate', async (req, res) => {
  try {
    res.json({ message: 'Generation started', status: 'success' });
    await generateDailyIdeas();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get settings
app.get('/api/settings', async (req, res) => {
  try {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) throw error;
    const settings = {};
    data.forEach(s => { settings[s.key] = s.value; });
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// =============================================
// APIFY SCRAPER FUNCTIONS
// =============================================

// Run Apify actor and wait for results
async function runApifyActor(actorId, input) {
  try {
    // Start the actor
    const startResponse = await axios.post(
      `https://api.apify.com/v2/acts/${actorId}/runs`,
      input,
      {
        headers: {
          'Authorization': `Bearer ${apifyApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const runId = startResponse.data.data.id;
    console.log(`Started Apify actor: ${actorId}, run ID: ${runId}`);

    // Wait for completion (max 60 seconds)
    let attempts = 0;
    while (attempts < 12) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await axios.get(
        `https://api.apify.com/v2/acts/${actorId}/runs/${runId}`,
        { headers: { 'Authorization': `Bearer ${apifyApiKey}` } }
      );

      const status = statusResponse.data.data.status;
      console.log(`Actor status: ${status}`);

      if (status === 'SUCCEEDED') break;
      if (status === 'FAILED') throw new Error('Apify actor failed');

      attempts++;
    }

    // Get results
    const resultResponse = await axios.get(
      `https://api.apify.com/v2/acts/${actorId}/runs/${runId}/dataset/items`,
      { headers: { 'Authorization': `Bearer ${apifyApiKey}` } }
    );

    return resultResponse.data;
  } catch (err) {
    console.error(`Apify error for ${actorId}:`, err.message);
    return [];
  }
}

// Fetch from YouTube using Apify
async function fetchYouTubeTrends(keywords) {
  try {
    if (!apifyApiKey) {
      console.log('No Apify API key, skipping YouTube');
      return [];
    }

    const trends = [];

    for (const keyword of keywords.slice(0, 2)) {
      console.log(`Fetching YouTube for: ${keyword}`);

      const results = await runApifyActor('apify~youtube-scraper', {
        searchQuery: keyword,
        maxResults: 10
      });

      if (Array.isArray(results)) {
        results.forEach(video => {
          trends.push({
            platform: 'youtube',
            title: video.title || 'YouTube Video',
            description: video.description || '',
            videoUrl: video.url || '',
            channelTitle: video.channelName || '',
            viewCount: video.viewCount || 0
          });
        });
      }
    }

    console.log(`Fetched ${trends.length} YouTube trends`);
    return trends;
  } catch (err) {
    console.error('YouTube/Apify Error:', err.message);
    return [];
  }
}

// Fetch from TikTok using Apify
async function fetchTikTokTrends(keywords) {
  try {
    if (!apifyApiKey) {
      console.log('No Apify API key, skipping TikTok');
      return [];
    }

    const trends = [];

    for (const keyword of keywords.slice(0, 2)) {
      console.log(`Fetching TikTok for: ${keyword}`);

      const results = await runApifyActor('ted8889~tiktok-hashtag-scraper', {
        hashtag: keyword,
        count: 10
      });

      if (Array.isArray(results)) {
        results.forEach(video => {
          trends.push({
            platform: 'tiktok',
            title: video.desc || video.text || 'TikTok Video',
            description: video.text || '',
            videoUrl: video.videoUrl || '',
            author: video.author?.nickname || '',
            likes: video.diggCount || 0
          });
        });
      }
    }

    console.log(`Fetched ${trends.length} TikTok trends`);
    return trends;
  } catch (err) {
    console.error('TikTok/Apify Error:', err.message);
    return [];
  }
}

// Fetch from Instagram using Apify
async function fetchInstagramTrends(keywords) {
  try {
    if (!apifyApiKey) {
      console.log('No Apify API key, skipping Instagram');
      return [];
    }

    const trends = [];

    for (const keyword of keywords.slice(0, 2)) {
      console.log(`Fetching Instagram for: ${keyword}`);

      const results = await runApifyActor('apify~instagram-hashtag-scraper', {
        hashtag: keyword,
        count: 10
      });

      if (Array.isArray(results)) {
        results.forEach(post => {
          trends.push({
            platform: 'instagram',
            title: post.caption || 'Instagram Post',
            description: post.caption || '',
            videoUrl: post.url || '',
            author: post.owner?.username || '',
            likes: post.likes || 0
          });
        });
      }
    }

    console.log(`Fetched ${trends.length} Instagram trends`);
    return trends;
  } catch (err) {
    console.error('Instagram/Apify Error:', err.message);
    return [];
  }
}

// Fetch from X (Twitter) using Apify
async function fetchXTrends(keywords) {
  try {
    if (!apifyApiKey) {
      console.log('No Apify API key, skipping X/Twitter');
      return [];
    }

    const trends = [];

    for (const keyword of keywords.slice(0, 2)) {
      console.log(`Fetching X/Twitter for: ${keyword}`);

      const results = await runApifyActor('apify~twitter-scraper', {
        search: keyword,
        count: 10
      });

      if (Array.isArray(results)) {
        results.forEach(tweet => {
          trends.push({
            platform: 'x',
            title: tweet.text || 'Tweet',
            description: tweet.text || '',
            videoUrl: tweet.urls?.[0] || '',
            author: tweet.author?.username || '',
            likes: tweet.likes || 0
          });
        });
      }
    }

    console.log(`Fetched ${trends.length} X/Twitter trends`);
    return trends;
  } catch (err) {
    console.error('X/Apify Error:', err.message);
    return [];
  }
}

// =============================================
// AI GENERATION FUNCTIONS
// =============================================

async function generateWithAI(prompt) {
  // Try OpenAI first
  if (openaiApiKey) {
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: openaiApiKey });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8
      });

      return completion.choices[0].message.content;
    } catch (err) {
      console.error('OpenAI Error:', err.message);
    }
  }

  // Try Anthropic (Claude) second
  if (anthropicApiKey) {
    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
        },
        {
          headers: {
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.content[0].text;
    } catch (err) {
      console.error('Anthropic Error:', err.message);
    }
  }

  return null;
}

async function generateVideoIdeas(profileName, trends) {
  const profile = PROFILES[profileName];

  // If no AI, use template-based generation
  if (!openaiApiKey && !anthropicApiKey) {
    console.log('No AI key - using template generation');
    return trends.slice(0, 5).map((trend, i) => ({
      title: `${trend.title?.substring(0, 45) || 'Trending'} - ${profile.name} Version`,
      description: `In this video, we explore ${trend.title?.substring(0, 50) || 'this trending topic'} and how it relates to ${profile.name}. Whether you're into ${profile.niche_keywords?.[0] || 'content creation'}, this is for you! Watch till the end for the full breakdown.`,
      script_hook: `Hey! Did you know ${trend.title?.substring(0, 30) || 'this is trending'}? Let me explain why it matters for ${profile.name}...`,
      script_full: `Hey! Did you know ${trend.title?.substring(0, 30) || 'this is trending'}? Let me break it down for you. This is huge for ${profile.name} because it shows how the industry is changing. Here's what you need to know: First, ${trend.description?.substring(0, 50) || 'the basics'}. Second, why this matters for you. And finally, how to use this to grow. Don't forget to like and subscribe for more!`,
      hashtags: [`#${profile.name.replace(/\s/g, '')}`, '#viral', '#trending', '#fyp'],
      source_topic: trend.title
    }));
  }

  // Use AI for generation
  const prompt = `You are a viral content strategist. Generate 3 unique video ideas for a ${profile.name} YouTube Shorts/Instagram Reel/TikTok.

Context: ${profile.niche_keywords?.join(', ') || profile.name}

Trending content to reference:
${trends.map(t => `- ${t.title} (${t.platform})`).join('\n')}

Requirements:
1. Catchy title (max 60 characters)
2. Universal description (100-150 words) that works on YouTube, TikTok, Instagram, X
3. 5-second hook script - powerful opener to grab attention
4. Full script (under 60 seconds / ~100 words)
5. Exactly 4 hashtags (mix of niche and broad)

Respond in JSON format:
[{"title": "...", "description": "...", "script_hook": "...", "script_full": "...", "hashtags": ["#...", "#...", "#...", "#..."]}]`;

  try {
    const content = await generateWithAI(prompt);
    if (content) {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (err) {
    console.error('AI Generation Error:', err.message);
  }

  // Fallback
  return trends.slice(0, 3).map((trend, i) => ({
    title: `${trend.title?.substring(0, 45) || 'Trending'} - ${profile.name}`,
    description: `Discover how this relates to ${profile.name}. Watch till the end!`,
    script_hook: `Hey! Did you know ${trend.title?.substring(0, 30)}? Let me explain...`,
    script_full: `Hey! Did you know ${trend.title?.substring(0, 30)}? Let me explain why this matters for ${profile.name}. In this video, we'll cover the key points and how you can apply this to your journey. Don't forget to like and subscribe!`,
    hashtags: [`#${profile.name.replace(/\s/g, '')}`, '#viral', '#trending', '#fyp'],
    source_topic: trend.title
  }));
}

// =============================================
// MAIN GENERATION FUNCTION
// =============================================

async function generateDailyIdeas() {
  console.log('Starting daily idea generation...');

  // Get profile IDs from database
  const { data: profiles } = await supabase.from('profiles').select('id, name');
  profiles.forEach(p => { if (PROFILES[p.name]) PROFILES[p.name].id = p.id; });

  const ideasPerProfile = { personal: 3, driveswise: 3, profleethire: 4 };

  for (const [profileName, count] of Object.entries(ideasPerProfile)) {
    try {
      const keywords = PROFILES[profileName].keywords;

      // Fetch from ALL platforms using Apify
      console.log(`Fetching trends for ${profileName}...`);

      const [ytTrends, ttTrends, igTrends, xTrends] = await Promise.all([
        fetchYouTubeTrends(keywords).catch(() => []),
        fetchTikTokTrends(keywords).catch(() => []),
        fetchInstagramTrends(keywords).catch(() => []),
        fetchXTrends(keywords).catch(() => [])
      ]);

      // Combine all trends
      const allTrends = [...ytTrends, ...ttTrends, ...igTrends, ...xTrends];
      console.log(`Total trends for ${profileName}: ${allTrends.length}`);

      if (allTrends.length === 0) {
        // Create fallback trends if no data
        keywords.forEach(k => {
          allTrends.push({ platform: 'fallback', title: `Trending: ${k}`, description: '' });
        });
      }

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
          source_topic: allTrends[i]?.title || 'Generated'
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
  console.log(`Using Apify: ${apifyApiKey ? 'Yes' : 'No'}`);
  console.log(`Using OpenAI: ${openaiApiKey ? 'Yes' : 'No'}`);
  console.log(`Using Anthropic: ${anthropicApiKey ? 'Yes' : 'No'}`);

  // Run initial generation on startup
  generateDailyIdeas();
});
