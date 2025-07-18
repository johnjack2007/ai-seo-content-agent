import { createClient } from '@supabase/supabase-js'

// Create Supabase client only when environment variables are available
const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not found');
    return null;
  }
  
  try {
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.warn('Failed to create Supabase client:', error);
    return null;
  }
};

// Export a function that gets the Supabase client
export const getSupabaseClient = () => {
  return createSupabaseClient();
};

// For backward compatibility - this will be null if env vars aren't available
export const supabase = createSupabaseClient();

export interface User {
  id: string
  email: string
  name?: string
}

export interface AuthState {
  user: User | null
  loading: boolean
}

export const signIn = async (email: string, password: string) => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client not initialized - check environment variables');
  }
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) throw error
  return data
}

export const signUp = async (email: string, password: string, name?: string) => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client not initialized - check environment variables');
  }
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  })
  
  if (error) throw error
  return data
}

export const signOut = async () => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client not initialized - check environment variables');
  }
  const { error } = await client.auth.signOut()
  if (error) throw error
}

export const getCurrentUser = async () => {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('Supabase client not initialized - returning null for current user');
    return null;
  }
  const { data: { user }, error } = await client.auth.getUser()
  if (error) throw error
  return user
}

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  const client = getSupabaseClient();
  if (!client) {
    // Return a dummy subscription if client is not available
    return {
      data: {
        subscription: {
          unsubscribe: () => {}
        }
      }
    };
  }
  return client.auth.onAuthStateChange((event: any, session: any) => {
    if (session?.user) {
      callback({
        id: session.user.id,
        email: session.user.email!,
        name: session.user.user_metadata?.name,
      })
    } else {
      callback(null)
    }
  })
} 