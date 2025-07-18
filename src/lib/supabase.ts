import { createClient } from '@supabase/supabase-js';

// Create Supabase client only when environment variables are available
const createSupabaseClient = () => {
  // Get environment variables
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('Supabase URL:', supabaseUrl);
    console.log('Supabase Key length:', supabaseAnonKey?.length || 0);
  }

  // Create Supabase client only if environment variables are available
  if (supabaseUrl && supabaseAnonKey) {
    // Validate URL format
    if (!supabaseUrl.startsWith('https://')) {
      console.warn(`Invalid Supabase URL format: ${supabaseUrl}`);
      return null;
    } else if (supabaseUrl.includes('placeholder') || supabaseAnonKey.length < 50) {
      console.warn('Invalid Supabase credentials detected. Please check your environment variables.');
      return null;
    } else {
      try {
        return createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
          },
        });
      } catch (error) {
        console.warn('Failed to create Supabase client:', error);
        return null;
      }
    }
  } else {
    console.warn('Supabase environment variables not found - database features will be disabled');
    return null;
  }
};

// Export a function that gets the Supabase client
export const getSupabaseClient = () => {
  return createSupabaseClient();
};

// For backward compatibility - this will be null if env vars aren't available
export const supabase = createSupabaseClient();

// Helper function to get the current user
export const getCurrentUser = async () => {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('Supabase client not initialized - returning null for current user');
    return null;
  }
  const { data: { user }, error } = await client.auth.getUser();
  if (error) throw error;
  return user;
};

// Helper function to get user profile
export const getUserProfile = async (userId: string) => {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('Supabase client not initialized - returning null for user profile');
    return null;
  }
  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data;
};

// Helper function to get user workspaces
export const getUserWorkspaces = async (userId: string) => {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('Supabase client not initialized - returning empty array for user workspaces');
    return [];
  }
  const { data, error } = await client
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
  const client = getSupabaseClient();
  if (!client) {
    console.warn('Supabase not available - returning false for permission check');
    return false;
  }
  
  const { data, error } = await client
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
  const client = getSupabaseClient();
  if (!client) {
    console.log('Supabase not available - skipping API usage tracking');
    return;
  }
  
  // Validate UUID format for workspace_id and user_id
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  // Skip tracking if IDs are not valid UUIDs (like demo mode or search queries)
  if (!uuidRegex.test(workspaceId) || !uuidRegex.test(userId)) {
    console.log(`Skipping API usage tracking for non-UUID IDs: workspace=${workspaceId}, user=${userId}`);
    return;
  }

  try {
    const { error } = await client
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
  const client = getSupabaseClient();
  if (!client) {
    console.warn('Supabase client not initialized - returning default settings');
    return {};
  }
  const { data, error } = await client
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
  const client = getSupabaseClient();
  if (!client) {
    console.warn('Supabase client not initialized - skipping workspace settings update');
    return;
  }
  const { error } = await client
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
  const client = getSupabaseClient();
  if (!client) {
    console.warn('Supabase client not initialized - returning mock workspace data');
    return {
      id: 'demo-workspace-id',
      name,
      slug,
      description,
      settings: settings || {},
      created_at: new Date().toISOString()
    };
  }
  const { data, error } = await client
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
  const client = getSupabaseClient();
  if (!client) {
    console.warn('Supabase client not initialized - skipping add user to workspace');
    return;
  }
  const { error } = await client
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
  const client = getSupabaseClient();
  if (!client) {
    console.warn('Supabase client not initialized - skipping remove user from workspace');
    return;
  }
  const { error } = await client
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  
  if (error) throw error;
}; 