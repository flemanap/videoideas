// =============================================
// SUPABASE EDGE FUNCTION - GENERATE IDEAS
// =============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Idea {
  title: string
  description: string
  script_hook: string
  script_full: string
  hashtags: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY')

    // Get profiles
    const { data: profiles } = await supabase.from('profiles').select('*')

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ error: 'No profiles found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const ideasPerProfile: Record<string, number> = {
      personal: 3,
      driveswise: 3,
      profleethire: 4,
    }

    const results: Record<string, Idea[]> = {}

    // Generate ideas for each profile
    for (const profile of profiles) {
      const count = ideasPerProfile[profile.name] || 3
      const keywords = profile.niche_keywords || []

      // Fetch trending from YouTube
      const trends = await fetchYouTubeTrends(keywords, youtubeApiKey || '')

      // Generate ideas using OpenAI
      const ideas = await generateIdeasWithAI(
        profile.name,
        profile.display_name,
        trends,
        count,
        openaiApiKey || ''
      )

      // Save ideas to database
      for (const idea of ideas) {
        await supabase.from('generated_ideas').insert({
          profile_id: profile.id,
          title: idea.title,
          description: idea.description,
          script_hook: idea.script_hook,
          script_full: idea.script_full,
          hashtags: idea.hashtags,
          source_topic: trends[0]?.title || 'AI Generated',
        })
      }

      results[profile.name] = ideas
    }

    // Update last generation date
    await supabase.from('settings').upsert({
      key: 'last_generation_date',
      value: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Generated ${Object.values(ideasPerProfile).reduce((a, b) => a + b, 0)} ideas`,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// =============================================
// HELPER FUNCTIONS
// =============================================

async function fetchYouTubeTrends(
  keywords: string[],
  apiKey: string
): Promise<{ title: string; description: string }[]> {
  if (!apiKey) {
    // Return fallback topics if no API key
    return keywords.slice(0, 5).map((k) => ({
      title: `Trending: ${k}`,
      description: `Content about ${k}`,
    }))
  }

  try {
    const keyword = keywords[Math.floor(Math.random() * keywords.length)]
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      keyword
    )}&type=video&videoDuration=short&order=relevance&maxResults=5&key=${apiKey}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.items) {
      return data.items.map((item: any) => ({
        title: item.snippet.title,
        description: item.snippet.description,
      }))
    }
  } catch (error) {
    console.error('YouTube API error:', error)
  }

  return keywords.slice(0, 5).map((k) => ({
    title: `Trending: ${k}`,
    description: `Content about ${k}`,
  }))
}

async function generateIdeasWithAI(
  profileName: string,
  displayName: string,
  trends: { title: string; description: string }[],
  count: number,
  apiKey: string
): Promise<Idea[]> {
  const profileConfig: Record<string, string> = {
    personal: 'personal brand, entrepreneurship, lifestyle, motivation',
    driveswise: 'music distribution, indie artist, spotify promotion, music marketing',
    profleethire: 'UK car rental, van hire, HPI check, used car buying, vehicle finance',
  }

  const niche = profileConfig[profileName] || profileName

  const prompt = `You are a viral content strategist. Generate ${count} unique video ideas for a ${displayName} YouTube channel/Instagram Reel/TikTok.

The ideas should be:
1. Based on these trending topics: ${trends.map((t) => t.title).join(', ')}
2. Adapted for short-form content (under 60 seconds)
3. Engaging with a strong 5-second hook
4. Include a catchy title (under 60 characters)
5. Include a description that works for ALL platforms (YouTube, TikTok, Instagram, X) - no platform-specific calls to action
6. Include exactly 4 hashtags (mix of niche and broad)

For each idea, provide:
- title: Catchy headline (max 60 chars)
- description: Universal description (100-150 words)
- script_hook: The first 5 seconds - a powerful hook
- script_full: Full script concept (under 60 seconds / ~100 words)
- hashtags: Array of exactly 4 hashtags

Respond in JSON format:
[{"title": "...", "description": "...", "script_hook": "...", "script_full": "...", "hashtags": ["#...", "#...", "#...", "#..."]}]`

  if (!apiKey) {
    // Return fallback ideas if no OpenAI key
    return trends.slice(0, count).map((trend, i) => ({
      title: `${trend.title.substring(0, 50)} - ${displayName} Edition`,
      description: `Discover how this relates to ${displayName}. Watch till the end!`,
      script_hook: `Hey! Did you know ${trend.title.substring(0, 30)}? Let me explain...`,
      script_full: `Hey! Did you know ${trend.title.substring(0, 30)}? Let me explain why this matters for ${displayName}. In this video, we'll cover the key points and how you can apply this to your journey. Don't forget to like and subscribe!`,
      hashtags: [`#${profileName.replace(/\s/g, '')}`, '#viral', '#trending', '#fyp'],
    }))
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
      }),
    })

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (error) {
    console.error('OpenAI API error:', error)
  }

  // Fallback
  return trends.slice(0, count).map((trend, i) => ({
    title: `${trend.title.substring(0, 50)} - ${displayName} Edition`,
    description: `Discover how this relates to ${displayName}. Watch till the end!`,
    script_hook: `Hey! Did you know ${trend.title.substring(0, 30)}? Let me explain...`,
    script_full: `Hey! Did you know ${trend.title.substring(0, 30)}? Let me explain why this matters for ${displayName}. In this video, we'll cover the key points and how you can apply this to your journey. Don't forget to like and subscribe!`,
    hashtags: [`#${profileName.replace(/\s/g, '')}`, '#viral', '#trending', '#fyp'],
  }))
}
