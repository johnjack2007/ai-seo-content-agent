// Core entity types
export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'admin' | 'editor' | 'reviewer' | 'viewer';
  created_at: string;
}

export interface CalendarEntry {
  id: string;
  workspace_id: string;
  google_sheet_id?: string;
  topic: string;
  content_type?: 'blog' | 'infographic' | 'white_paper' | 'social_post';
  due_date?: string;
  status?: string;
  assigned_to?: string;
  notes?: string;
  external_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ResearchChunk {
  id: string;
  workspace_id: string;
  source_url: string;
  title?: string;
  content: string;
  summary?: string;
  keywords?: string[];
  domain?: string;
  content_hash: string;
  created_at: string;
}

export interface ContentSection {
  id: string;
  type: 'title' | 'intro' | 'body' | 'conclusion' | 'cta';
  content: string;
  word_count: number;
  seo_score?: number;
}

export interface ContentDraft {
  id: string;
  workspace_id: string;
  calendar_entry_id?: string;
  title: string;
  slug: string;
  content_type: 'blog' | 'infographic' | 'white_paper' | 'social_post';
  status: 'draft' | 'in_review' | 'qa' | 'approved' | 'published';
  content: {
    sections: ContentSection[];
    metadata: {
      target_audience?: string;
      tone?: string;
      keywords?: string[];
      internal_links?: Array<{
        text: string;
        url: string;
        relevance: number;
      }>;
    };
  };
  seo_data: {
    meta_description?: string;
    meta_title?: string;
    focus_keyword?: string;
    keyword_density?: Record<string, number>;
    readability_score?: number;
    suggestions?: string[];
  };
  research_chunks: string[];
  word_count: number;
  reading_time: number;
  seo_score: number;
  created_by?: string;
  assigned_to?: string;
  due_date?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ContentVersion {
  id: string;
  draft_id: string;
  version_number: number;
  content: ContentDraft['content'];
  seo_data: ContentDraft['seo_data'];
  created_by?: string;
  created_at: string;
}

export interface Comment {
  id: string;
  draft_id: string;
  user_id: string;
  content: string;
  block_id?: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SEOAnalysis {
  id: string;
  draft_id: string;
  keyword_density?: Record<string, number>;
  readability_score?: number;
  internal_links?: Array<{
    text: string;
    url: string;
    relevance: number;
  }>;
  suggestions?: string[];
  created_at: string;
}

export interface PublishingHistory {
  id: string;
  draft_id: string;
  platform: string;
  status: 'success' | 'failed' | 'pending';
  published_url?: string;
  error_message?: string;
  published_by?: string;
  published_at: string;
}

export interface APIUsage {
  id: string;
  workspace_id: string;
  user_id: string;
  service: 'openai' | 'serpapi';
  endpoint: string;
  tokens_used: number;
  cost_cents: number;
  success: boolean;
  error_message?: string;
  created_at: string;
}

// Form types
export interface CreateTopicForm {
  topic: string;
  audience?: string;
  tone?: string;
  content_type: 'blog' | 'infographic' | 'white_paper' | 'social_post';
  due_date?: string;
  keywords?: string[];
}

// API Response types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// Research and SEO types
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
}

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  domain: string;
  word_count: number;
}

export interface ResearchSummary {
  title: string;
  url: string;
  key_points: string[];
  expert_quotes?: string[];
  data_points?: string[];
  relevance_score?: number;
}

export interface SEORecommendation {
  type: 'keyword' | 'readability' | 'structure' | 'links';
  priority: 'high' | 'medium' | 'low';
  message: string;
  suggestion?: string;
  current_value?: any;
  target_value?: any;
}

// Editor types
export interface EditorBlock {
  id: string;
  type: string;
  content: any;
  attributes?: Record<string, any>;
}

export interface EditorState {
  blocks: EditorBlock[];
  selection?: {
    from: number;
    to: number;
  };
}

// Notification types
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  action_url?: string;
  read: boolean;
  created_at: string;
}

// Settings types
export interface WorkspaceSettings {
  seo: {
    target_keyword_density: number;
    min_word_count: number;
    max_word_count: number;
    readability_target: number;
  };
  publishing: {
    auto_publish: boolean;
    require_approval: boolean;
    platforms: string[];
  };
  notifications: {
    email_notifications: boolean;
    review_reminders: boolean;
  };
  ai: {
    model: 'gpt-4o' | 'gpt-4' | 'gpt-3.5-turbo';
    max_tokens: number;
    temperature: number;
  };
} 