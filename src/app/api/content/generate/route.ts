import { NextRequest, NextResponse } from 'next/server';
import { ValidationAgent } from '@/agents/ValidationAgent';
import { ResearchAgent } from '@/agents/ResearchAgent';
import { ContentAgent } from '@/agents/ContentAgent';
import { ExportAgent } from '@/agents/ExportAgent';
import { getSupabaseClient, getCurrentUser } from '@/lib/supabase';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      topic,
      content_purpose = 'informational',
      audience = 'general',
      tone = 'professional',
      content_type = 'blog',
      seo_keywords = [],
      workspace_id,
      word_count = 500,
      due_date
    } = body;

    console.log('Starting content generation for topic:', topic);

    // Step 0: Validate input using consolidated ValidationAgent
    console.log('Step 0: Validating input...');
    const validationAgent = new ValidationAgent();
    const validation = await validationAgent.validateInput(topic);

    if (!validation.isValid) {
      return NextResponse.json({
        error: validation.error,
        suggestions: validation.suggestions,
        needsClarification: validation.needsClarification
      }, { status: 400 });
    }

    console.log(`Validation passed. Using topic: ${validation.topic}`);

    // Step 1: Research using simplified ResearchAgent
    console.log('Starting research for topic:', validation.topic);
    const researchAgent = new ResearchAgent();
    const researchSummaries = await researchAgent.researchTopic(
      validation.topic,
      seo_keywords,
      workspace_id,
      ''
    );

    console.log(`Research completed: ${researchSummaries.length} summaries found`);

    // Step 2: Generate content using consolidated ContentAgent
    console.log('Generating content for topic:', validation.topic);
    const contentAgent = new ContentAgent();
    const contentDraft = await contentAgent.generateContent({
      topic: validation.topic,
      content_type,
      audience,
      tone,
      content_purpose,
      word_count,
      seo_keywords,
      research_summaries: researchSummaries
    });

    console.log(`Content generation completed: ${contentDraft.word_count} words`);

    // Step 3: Export using ExportAgent
    console.log('Generating export formats...');
    const exportAgent = new ExportAgent();
    const exportFormats = await exportAgent.exportContent(contentDraft);
    console.log('Export formats generated');

    // Step 4: Save to database
    const client = getSupabaseClient();
    let draftId = '';
    
    if (client) {
      try {
        const user = await getCurrentUser();
        const userId = user?.id || 'anonymous';
        
        const { data: draft, error: insertError } = await client
          .from('content_drafts')
          .insert({
            title: contentDraft.title,
            content: contentDraft.content,
            meta_description: contentDraft.meta_description,
            seo_score: contentDraft.seo_score,
            word_count: contentDraft.word_count,
            reading_time: contentDraft.reading_time,
            keywords: contentDraft.keywords,
            topic: validation.topic,
            content_type,
            audience,
            tone,
            content_purpose,
            workspace_id,
            user_id: userId,
            status: 'draft',
            export_formats: exportFormats,
            research_summaries: researchSummaries,
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Database insert error:', insertError);
          throw insertError;
        }

        draftId = draft.id;
        console.log('Content draft saved to database:', draftId);

      } catch (dbError) {
        console.error('Failed to save to database:', dbError);
        // Continue with local storage fallback
      }
    }

    // Fallback to local storage if database is unavailable
    if (!draftId) {
      const localId = `local-${Date.now()}`;
      console.log('Demo mode: Skipping database save, using local storage');
      
      // Store in local storage for demo purposes
      if (typeof window !== 'undefined') {
        const drafts = JSON.parse(localStorage.getItem('content_drafts') || '[]');
        drafts.push({
          id: localId,
          title: contentDraft.title,
          content: contentDraft.content,
          meta_description: contentDraft.meta_description,
          seo_score: contentDraft.seo_score,
          word_count: contentDraft.word_count,
          reading_time: contentDraft.reading_time,
          keywords: contentDraft.keywords,
          topic: validation.topic,
          content_type,
          audience,
          tone,
          content_purpose,
          workspace_id,
          status: 'draft',
          export_formats: exportFormats,
          research_summaries: researchSummaries,
          created_at: new Date().toISOString()
        });
        localStorage.setItem('content_drafts', JSON.stringify(drafts));
      }
      
      draftId = localId;
      console.log('Content draft created locally (database unavailable):', draftId);
    }

    return NextResponse.json({
      success: true,
      draft_id: draftId,
      title: contentDraft.title,
      content: contentDraft.content,
      meta_description: contentDraft.meta_description,
      seo_score: contentDraft.seo_score,
      word_count: contentDraft.word_count,
      reading_time: contentDraft.reading_time,
      keywords: contentDraft.keywords,
      export_formats: exportFormats,
      research_summaries: researchSummaries,
      topic: validation.topic,
      content_type,
      audience,
      tone,
      content_purpose
    });

  } catch (error) {
    console.error('Content generation failed:', error);
    return NextResponse.json({
      error: 'Content generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 