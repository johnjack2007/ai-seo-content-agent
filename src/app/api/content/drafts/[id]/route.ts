import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { content, workspace_id } = body

    if (!content || !workspace_id) {
      return NextResponse.json(
        { error: 'Content and workspace_id are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('content_drafts')
      .update({ 
        content,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('workspace_id', workspace_id)
      .select()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update draft' },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ draft: data[0] })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 