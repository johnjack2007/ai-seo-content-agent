-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE content_status AS ENUM ('draft', 'in_review', 'qa', 'approved', 'published');
CREATE TYPE content_type AS ENUM ('blog', 'infographic', 'white_paper', 'social_post');
CREATE TYPE user_role AS ENUM ('admin', 'editor', 'reviewer', 'viewer');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workspaces table
CREATE TABLE public.workspaces (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workspace members with roles
CREATE TABLE public.workspace_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    role user_role DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- Google Sheets connections
CREATE TABLE public.google_sheets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    sheet_id TEXT NOT NULL,
    sheet_name TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    column_mapping JSONB DEFAULT '{}',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Calendar entries from Google Sheets
CREATE TABLE public.calendar_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    google_sheet_id UUID REFERENCES public.google_sheets(id) ON DELETE SET NULL,
    topic TEXT NOT NULL,
    content_type content_type,
    due_date DATE,
    status TEXT,
    assigned_to UUID REFERENCES public.users(id),
    notes TEXT,
    external_id TEXT, -- Google Sheets row ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Research chunks from web scraping
CREATE TABLE public.research_chunks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    summary TEXT,
    keywords TEXT[],
    domain TEXT,
    content_hash TEXT UNIQUE NOT NULL, -- For deduplication
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content drafts
CREATE TABLE public.content_drafts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    calendar_entry_id UUID REFERENCES public.calendar_entries(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content_type content_type NOT NULL,
    status content_status DEFAULT 'draft',
    content JSONB NOT NULL, -- Structured content with sections
    seo_data JSONB DEFAULT '{}', -- Meta description, keywords, etc.
    research_chunks UUID[] DEFAULT '{}', -- Array of research_chunks.id
    word_count INTEGER DEFAULT 0,
    reading_time INTEGER DEFAULT 0,
    seo_score INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.users(id),
    assigned_to UUID REFERENCES public.users(id),
    due_date DATE,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content versions for tracking changes
CREATE TABLE public.content_versions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    draft_id UUID REFERENCES public.content_drafts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content JSONB NOT NULL,
    seo_data JSONB DEFAULT '{}',
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments system
CREATE TABLE public.comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    draft_id UUID REFERENCES public.content_drafts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    block_id TEXT, -- Tiptap block identifier
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES public.users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SEO analysis results
CREATE TABLE public.seo_analyses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    draft_id UUID REFERENCES public.content_drafts(id) ON DELETE CASCADE,
    keyword_density JSONB, -- {keyword: count}
    readability_score INTEGER,
    internal_links JSONB, -- [{text, url, relevance}]
    suggestions JSONB, -- Array of improvement suggestions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Publishing history
CREATE TABLE public.publishing_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    draft_id UUID REFERENCES public.content_drafts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'webflow', 'wordpress', 'markdown', etc.
    status TEXT NOT NULL, -- 'success', 'failed', 'pending'
    published_url TEXT,
    error_message TEXT,
    published_by UUID REFERENCES public.users(id),
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API usage tracking
CREATE TABLE public.api_usage (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    service TEXT NOT NULL, -- 'openai', 'serpapi', 'google_sheets'
    endpoint TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    cost_cents INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File uploads for content planning
CREATE TABLE public.file_uploads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'csv', 'excel', 'json'
    parsed_data JSONB, -- Array of parsed content items
    created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX idx_calendar_entries_workspace_id ON public.calendar_entries(workspace_id);
CREATE INDEX idx_calendar_entries_due_date ON public.calendar_entries(due_date);
CREATE INDEX idx_content_drafts_workspace_id ON public.content_drafts(workspace_id);
CREATE INDEX idx_content_drafts_status ON public.content_drafts(status);
CREATE INDEX idx_content_drafts_slug ON public.content_drafts(slug);
CREATE INDEX idx_research_chunks_content_hash ON public.research_chunks(content_hash);
CREATE INDEX idx_comments_draft_id ON public.comments(draft_id);
CREATE INDEX idx_api_usage_workspace_id ON public.api_usage(workspace_id);
CREATE INDEX idx_api_usage_created_at ON public.api_usage(created_at);
CREATE INDEX idx_file_uploads_workspace_id ON public.file_uploads(workspace_id);
CREATE INDEX idx_file_uploads_created_at ON public.file_uploads(created_at);

-- Row Level Security (RLS) policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publishing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_uploads ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic examples - will be expanded)
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Workspace members can view workspace" ON public.workspaces
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.workspace_members 
            WHERE workspace_id = workspaces.id AND user_id = auth.uid()
        )
    );

-- Functions for automatic timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_drafts_updated_at BEFORE UPDATE ON public.content_drafts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 