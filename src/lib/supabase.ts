import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Debug logging
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key length:', supabaseAnonKey?.length || 0);

// Only validate URL format if it's not a placeholder
if (supabaseUrl !== 'https://placeholder.supabase.co' && !supabaseUrl.startsWith('https://')) {
  throw new Error(`Invalid Supabase URL: ${supabaseUrl}`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Helper function to get the current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

// Helper function to get user profile
export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data;
};

// Helper function to get user workspaces
export const getUserWorkspaces = async (userId: string) => {
  const { data, error } = await supabase
    .from('workspace_members')
    .select(`
      workspace_id,
      role,
      workspaces (
        id,
        name,
        slug,
        description,
        settings
      )
    `)
    .eq('user_id', userId);
  
  if (error) throw error;
  return data;
};

// Helper function to check if user has permission in workspace
export const checkWorkspacePermission = async (
  userId: string, 
  workspaceId: string, 
  requiredRole: 'admin' | 'editor' | 'reviewer' | 'viewer' = 'viewer'
) => {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .single();
  
  if (error) return false;
  
  const roleHierarchy = {
    'admin': 4,
    'editor': 3,
    'reviewer': 2,
    'viewer': 1
  };
  
  return roleHierarchy[data.role as keyof typeof roleHierarchy] >= roleHierarchy[requiredRole];
};

// Helper function to track API usage
export const trackAPIUsage = async (
  workspaceId: string,
  userId: string,
  service: 'openai' | 'serpapi',
  endpoint: string,
  tokensUsed: number = 0,
  costCents: number = 0,
  success: boolean = true,
  errorMessage?: string
) => {
  // Validate UUID format for workspace_id and user_id
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  // Skip tracking if IDs are not valid UUIDs (like demo mode or search queries)
  if (!uuidRegex.test(workspaceId) || !uuidRegex.test(userId)) {
    console.log(`Skipping API usage tracking for non-UUID IDs: workspace=${workspaceId}, user=${userId}`);
    return;
  }

  try {
    const { error } = await supabase
      .from('api_usage')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        service,
        endpoint,
        tokens_used: tokensUsed,
        cost_cents: costCents,
        success,
        error_message: errorMessage
      });
    
    if (error) {
      console.error('Failed to track API usage:', error);
    }
  } catch (error) {
    console.error('Failed to track API usage:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : '',
      hint: 'This might be due to database connection issues or invalid data',
      code: error instanceof Error ? (error as any).code : ''
    });
  }
};

// Helper function to get workspace settings
export const getWorkspaceSettings = async (workspaceId: string) => {
  const { data, error } = await supabase
    .from('workspaces')
    .select('settings')
    .eq('id', workspaceId)
    .single();
  
  if (error) throw error;
  return data.settings;
};

// Helper function to update workspace settings
export const updateWorkspaceSettings = async (
  workspaceId: string, 
  settings: Record<string, any>
) => {
  const { error } = await supabase
    .from('workspaces')
    .update({ settings })
    .eq('id', workspaceId);
  
  if (error) throw error;
};

// Helper function to create a new workspace
export const createWorkspace = async (
  name: string,
  slug: string,
  description?: string,
  settings?: Record<string, any>
) => {
  const { data, error } = await supabase
    .from('workspaces')
    .insert({
      name,
      slug,
      description,
      settings: settings || {}
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Helper function to add user to workspace
export const addUserToWorkspace = async (
  workspaceId: string,
  userId: string,
  role: 'admin' | 'editor' | 'reviewer' | 'viewer' = 'viewer'
) => {
  const { error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      role
    });
  
  if (error) throw error;
};

// Helper function to remove user from workspace
export const removeUserFromWorkspace = async (
  workspaceId: string,
  userId: string
) => {
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  
  if (error) throw error;
}; 