import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { supabase, getCurrentUser } from '@/lib/supabase';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // TODO: Re-enable auth check when Supabase auth is properly set up
    // const user = await getCurrentUser();
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // For testing, use a mock user ID
    const mockUserId = '00000000-0000-0000-0000-000000000000';

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const workspaceId = formData.get('workspace_id') as string;

    if (!file || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing file or workspace_id' },
        { status: 400 }
      );
    }

    // TODO: Re-enable workspace permission check when auth is set up
    // Check workspace permission
    // const hasPermission = await supabase
    //   .from('workspace_members')
    //   .select('role')
    //   .eq('workspace_id', workspaceId)
    //   .eq('user_id', user.id)
    //   .single();

    // if (!hasPermission.data) {
    //   return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    // }

    // Validate file type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload CSV, Excel, or JSON files.' },
        { status: 400 }
      );
    }

    // Read file content
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let parsedData: any[] = [];
    let fileType = '';

    // Parse file based on type
    if (file.type === 'text/csv') {
      fileType = 'csv';
      const csvContent = buffer.toString('utf-8');
      parsedData = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
    } else if (file.type === 'application/json') {
      fileType = 'json';
      const jsonContent = buffer.toString('utf-8');
      parsedData = JSON.parse(jsonContent);
      
      // Ensure it's an array
      if (!Array.isArray(parsedData)) {
        parsedData = [parsedData];
      }
    } else if (file.type.includes('excel') || file.type.includes('spreadsheet')) {
      fileType = 'excel';
      // For now, we'll handle Excel files as CSV
      // In production, you'd use a library like 'xlsx'
      return NextResponse.json(
        { error: 'Excel files not yet supported. Please convert to CSV.' },
        { status: 400 }
      );
    }

    // Validate and clean data
    const validatedData = parsedData.map((row, index) => {
      const validated = {
        topic: row.topic || row.title || row.subject || '',
        content_type: row.content_type || row.type || 'blog',
        audience: row.audience || row.target_audience || 'general',
        tone: row.tone || row.style || 'professional',
        keywords: row.keywords ? row.keywords.split(',').map((k: string) => k.trim()) : [],
        due_date: row.due_date || row.deadline || null,
        description: row.description || row.summary || '',
        word_count_target: parseInt(row.word_count_target || row.word_count || '1500'),
        status: 'pending'
      };

      // Validate required fields
      if (!validated.topic) {
        throw new Error(`Row ${index + 1}: Missing required field 'topic'`);
      }

      // Validate content type
      const validContentTypes = ['blog', 'infographic', 'white_paper', 'social_post'];
      if (!validContentTypes.includes(validated.content_type)) {
        validated.content_type = 'blog';
      }

      return validated;
    });

    // Store file upload record
    const dbWorkspaceId = workspaceId === 'test-workspace' || workspaceId === 'demo-workspace' 
      ? '00000000-0000-0000-0000-000000000001' 
      : workspaceId;

    const { data: uploadRecord, error: uploadError } = await supabase
      .from('file_uploads')
      .insert({
        workspace_id: dbWorkspaceId,
        filename: file.name,
        file_type: fileType,
        parsed_data: validatedData,
        created_by: mockUserId // Use mockUserId for testing
      })
      .select()
      .single();

    if (uploadError) {
      console.error('Failed to store upload record:', uploadError);
      return NextResponse.json(
        { error: 'Failed to store upload record' },
        { status: 500 }
      );
    }

    // Create calendar entries for content with due dates
    const calendarEntries = validatedData
      .filter(item => item.due_date)
      .map(item => ({
        workspace_id: dbWorkspaceId, // Use the converted workspaceId
        topic: item.topic,
        content_type: item.content_type,
        due_date: item.due_date,
        status: 'pending',
        assigned_to: mockUserId, // Use mockUserId for testing
        metadata: {
          audience: item.audience,
          tone: item.tone,
          keywords: item.keywords,
          description: item.description,
          word_count_target: item.word_count_target
        }
      }));

    if (calendarEntries.length > 0) {
      const { error: calendarError } = await supabase
        .from('calendar_entries')
        .insert(calendarEntries);

      if (calendarError) {
        console.error('Failed to create calendar entries:', calendarError);
        // Don't fail the entire request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        upload_id: uploadRecord.id,
        filename: file.name,
        records_processed: validatedData.length,
        calendar_entries_created: calendarEntries.length,
        content_items: validatedData
      }
    });

  } catch (error) {
    console.error('File upload failed:', error);
    return NextResponse.json(
      { 
        error: 'File upload failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // TODO: Re-enable auth check when Supabase auth is properly set up
    // const user = await getCurrentUser();
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing workspace_id' },
        { status: 400 }
      );
    }

    // Get uploads for workspace
    const { data: uploads, error } = await supabase
      .from('file_uploads')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch uploads:', error);
      return NextResponse.json(
        { error: 'Failed to fetch uploads' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: uploads
    });

  } catch (error) {
    console.error('Failed to fetch uploads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch uploads' },
      { status: 500 }
    );
  }
} 