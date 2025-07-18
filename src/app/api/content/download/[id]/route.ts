import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Fetch the content draft
    const { data: draft, error } = await supabase
      .from('content_drafts')
      .select('title, content')
      .eq('id', id)
      .single()

    if (error || !draft) {
      return NextResponse.json(
        { error: 'Content not found' },
        { status: 404 }
      )
    }

    // Format the content for download
    const downloadContent = `Title: ${draft.title}\n\n${draft.content}`

    // Create response with file download headers
    const response = new NextResponse(downloadContent)
    response.headers.set('Content-Type', 'text/plain')
    response.headers.set('Content-Disposition', `attachment; filename="${draft.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt"`)

    return response
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { error: 'Failed to download content' },
      { status: 500 }
    )
  }
} 