import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client only if environment variables are available
const createSupabaseClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase environment variables not found')
    return null
  }
  
  return createClient(supabaseUrl, supabaseAnonKey)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing workspace_id' },
        { status: 400 }
      );
    }

    // Try to create Supabase client
    const supabase = createSupabaseClient()
    if (!supabase) {
      // Return empty drafts if database is not configured
      return NextResponse.json({
        drafts: []
      });
    }

    // Convert test workspace IDs to proper UUIDs for database compatibility
    const dbWorkspaceId = workspaceId === 'test-workspace' || workspaceId === 'demo-workspace' 
      ? '00000000-0000-0000-0000-000000000001' 
      : workspaceId;

    const { data: drafts, error } = await supabase
      .from('content_drafts')
      .select('*')
      .eq('workspace_id', dbWorkspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch drafts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch drafts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      drafts: drafts || []
    });

  } catch (error) {
    console.error('Failed to fetch drafts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drafts' },
      { status: 500 }
    );
  }
} 