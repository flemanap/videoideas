-- =============================================
-- CONTENT FLOW GENERATOR - DATABASE SCHEMA
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    niche_keywords TEXT[], -- Array of keywords for trend searching
    brand_voice TEXT, -- Tone/style guide for AI generation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert the 3 profiles
INSERT INTO profiles (name, display_name, description, niche_keywords, brand_voice) VALUES
('personal', 'Personal Brand', 'My personal brand content - lifestyle, business, motivation', ARRAY['personal development', 'entrepreneurship', 'motivation', 'lifestyle'], 'Professional yet relatable, behind-the-scenes, authentic'),
('driveswise', 'DrivesWise', 'Music distribution business - helping artists get their music on all platforms', ARRAY['music distribution', 'indie artist', 'spotify promotion', 'music marketing', 'artist growth'], 'Educational, empowering, industry insider'),
('profleethire', 'ProFleetHire', 'UK peer-to-peer car rental + HPI data checks', ARRAY['car rental', 'uk van hire', 'hpi check', 'used car buying', 'turo host', 'vehicle finance'], 'Trustworthy, data-driven, helpful');

-- =============================================
-- COMPETITORS/TRACKERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS competitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'x')),
    handle TEXT NOT NULL,
    display_name TEXT,
    url TEXT,
    follower_count INTEGER DEFAULT 0,
    avg_views INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TRENDING CONTENT TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS trending_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'instagram', 'x')),
    external_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    engagement_rate FLOAT,
    viral_score FLOAT, -- Calculated: views / avg_views
    published_at TIMESTAMP WITH TIME ZONE,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_high_priority BOOLEAN DEFAULT false
);

-- =============================================
-- GENERATED IDEAS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS generated_ideas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    script_hook TEXT NOT NULL, -- 5-second engaging hook
    script_full TEXT, -- Full script under 60 seconds
    hashtags TEXT[] DEFAULT '{}',
    source_trend_id UUID REFERENCES trending_content(id),
    source_topic TEXT, -- Topic/keyword that inspired this idea
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SETTINGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert API settings (will be updated by the app)
INSERT INTO settings (key, value) VALUES
('youtube_api_key', ''),
('openai_api_key', ''),
('apify_api_key', ''),
('last_generation_date', ''),
('cron_enabled', 'false');

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_competitors_profile ON competitors(profile_id);
CREATE INDEX IF NOT EXISTS idx_trending_profile ON trending_content(profile_id);
CREATE INDEX IF NOT EXISTS idx_trending_priority ON trending_content(is_high_priority) WHERE is_high_priority = true;
CREATE INDEX IF NOT EXISTS idx_ideas_profile ON generated_ideas(profile_id);
CREATE INDEX IF NOT EXISTS idx_ideas_date ON generated_ideas(created_at DESC);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE trending_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for frontend)
CREATE POLICY "Allow public read access" ON profiles FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON competitors FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON trending_content FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON generated_ideas FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON settings FOR SELECT USING (true);

-- Allow service role full access (for backend)
CREATE POLICY "Service role full access" ON profiles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON competitors FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON trending_content FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON generated_ideas FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON settings FOR ALL USING (auth.role() = 'service_role');
