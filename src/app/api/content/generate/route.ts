import { NextRequest, NextResponse } from 'next/server';
import { ResearchAgent } from '@/agents/ResearchAgent';
import { GenerationAgent } from '@/agents/GenerationAgent';
import { HumanizerAgent } from '@/agents/HumanizerAgent';
import { ExportAgent } from '@/agents/ExportAgent';
import { SEOOptimizationAgent } from '@/agents/SEOOptimizationAgent';
import { IntentClassifierAgent } from '@/agents/IntentClassifierAgent';
import { TopicSanitizerAgent } from '@/agents/TopicSanitizerAgent';
import { TopicIdentifierAgent } from '@/agents/TopicIdentifierAgent';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';
// Using the ResearchSummary type from ResearchAgent
interface ResearchSummary {
  title: string;
  url: string;
  key_points: string[];
  expert_quotes: string[];
  data_points: string[];
  relevance_score: number;
  source_authority: string;
  publication_date?: string;
}

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      topic,
      content_purpose = 'informational',
      audience = 'general',
      tone = 'professional',
      content_type,
      due_date,
      seo_keywords: rawSeoKeywords = [],
      workspace_id,
      word_count
    } = body;

    // Ensure SEO keywords is always an array
    const seoKeywords = Array.isArray(rawSeoKeywords) ? rawSeoKeywords : 
                       typeof rawSeoKeywords === 'string' ? rawSeoKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0) : [];

    // Validate required fields
    if (!topic || !content_purpose || !workspace_id) {
      return NextResponse.json(
        { error: 'Missing required fields: topic, content_purpose, workspace_id' },
        { status: 400 }
      );
    }

    console.log(`Starting content generation for topic: ${topic}`);

    // Initialize validation agents
    const intentClassifier = new IntentClassifierAgent();
    const topicSanitizer = new TopicSanitizerAgent();
    const topicIdentifier = new TopicIdentifierAgent();

    // Step 0: Validate input before proceeding
    console.log('Step 0: Validating input...');
    
    // Quick safety check for performance
    if (topicSanitizer.isObviouslyUnsafe(topic)) {
      return NextResponse.json(
        { error: '⚠️ This topic contains inappropriate content and cannot be processed. Please try a more neutral or business-relevant topic.' },
        { status: 400 }
      );
    }

    // Full validation pipeline
    const intentResult = await intentClassifier.classifyIntent(topic);
    if (intentResult.intent === 'OUT_OF_SCOPE') {
      return NextResponse.json(
        { error: intentClassifier.getErrorMessage(intentResult.intent) },
        { status: 400 }
      );
    }

    const safetyResult = await topicSanitizer.sanitizeTopic(topic);
    if (safetyResult.safety === 'UNSAFE') {
      return NextResponse.json(
        { error: topicSanitizer.getErrorMessage(safetyResult) },
        { status: 400 }
      );
    }

    const topicResult = await topicIdentifier.identifyTopic(topic);
    if (topicResult.isVague && topicResult.suggestions.length > 0) {
      return NextResponse.json(
        { 
          error: topicIdentifier.getSuggestionsMessage(topicResult),
          suggestions: topicResult.suggestions,
          needsClarification: true
        },
        { status: 400 }
      );
    }

    // Use extracted topic if available
    const finalTopic = topicResult.extractedTopic || topic;
    console.log(`Validation passed. Using topic: ${finalTopic}`);

    // Initialize content generation agents
    const researchAgent = new ResearchAgent();
    const generationAgent = new GenerationAgent();
    const humanizerAgent = new HumanizerAgent();
    const exportAgent = new ExportAgent();
    const seoOptimizationAgent = new SEOOptimizationAgent();

    // Step 1: Research the topic
    console.log(`Starting research for topic: ${finalTopic}`);
    
    // Always use real research - no more test mode
    const researchSummaries = await researchAgent.researchTopic(finalTopic, []); // No keywords for research
    
    if (researchSummaries.length === 0) {
      return NextResponse.json(
        { error: 'No relevant research found for this topic' },
        { status: 400 }
      );
    }
    
    console.log(`Research completed: ${researchSummaries.length} summaries found`);
    
    // Check if fallback research was used (indicated by fallback URLs)
    const isFallbackResearch = researchSummaries.some(summary => 
      summary.url.includes('research-fallback.com') || 
      summary.url.includes('example.com/fallback-research')
    );
    
    if (isFallbackResearch) {
      console.log('⚠️ Using fallback research due to SerpAPI limitations');
    }

    // Convert ResearchAgent format to GenerationAgent format
    const convertedSummaries = researchSummaries.map(summary => ({
      ...summary,
      keywords: [], // No keywords for content generation
      summary: summary.key_points.join('. ') + '. ' + summary.expert_quotes.join('. ')
    }));

    // Step 2: Generate content based on topic and purpose (no SEO keywords)
    console.log(`Generating content for topic: ${finalTopic}`);
    console.log(`Content purpose: ${content_purpose}`);
    console.log(`SEO keywords: ${seoKeywords.join(', ')}`);
    
    let contentDraft;
    try {
      contentDraft = await generationAgent.generateContent(
        finalTopic,
        content_type,
        audience,
        tone,
        content_purpose,
        convertedSummaries,
        word_count || 500,
        seoKeywords // Pass SEO keywords to GenerationAgent
      );
      
      console.log(`Content generation completed: ${contentDraft.word_count} words`);
    } catch (error) {
      console.error('Content generation failed:', error);
      return NextResponse.json(
        { error: 'Content generation failed: ' + (error as Error).message },
        { status: 500 }
      );
    }

    // Step 3: Humanize content (optional but recommended)
    console.log('Humanizing content...');
    let humanizedContent = contentDraft.content;
    try {
      humanizedContent = await humanizerAgent.humanizeContent(
        contentDraft.content,
        finalTopic,
        {
          tone: tone as any,
          style: content_type as any,
          targetAudience: audience
        }
      );
      console.log('Content humanization completed');
    } catch (error) {
      console.error('Humanization failed, using original content:', error);
    }

    // Step 4: SEO Optimization (second stage)
    console.log('Starting SEO optimization...');
    let optimizedContent = humanizedContent;
    let finalSeoScore = contentDraft.seo_score;
    let finalTitle = contentDraft.title;
    let finalMetaDescription = contentDraft.meta_description;
    
    if (seoKeywords.length > 0) {
      try {
        const seoResult = await seoOptimizationAgent.optimizeContentForSEO(
          humanizedContent,
          seoKeywords,
          finalTopic,
          content_purpose,
          tone
        );
        
        optimizedContent = seoResult.optimizedContent;
        finalSeoScore = seoResult.seoScore;
        finalTitle = seoResult.title;
        finalMetaDescription = seoResult.metaDescription;
        
        console.log(`SEO optimization completed. Score: ${finalSeoScore}`);
      } catch (error) {
        console.error('SEO optimization failed, using original content:', error);
      }
    } else {
      console.log('No SEO keywords provided, skipping optimization');
    }

    // Step 5: Generate export formats
    console.log('Generating export formats...');
    let exportedContent;
    try {
      exportedContent = await exportAgent.exportContent(
        finalTitle,
        optimizedContent,
        finalTopic,
        { 
          format: 'all', 
          includeMetadata: true,
          keywords: seoKeywords,
          metaDescription: finalMetaDescription
        }
      );
      console.log('Export formats generated');
    } catch (error) {
      console.error('Export generation failed:', error);
      exportedContent = { filename: `${finalTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}` };
    }

    // Save to database
    try {
      // Convert test workspace IDs to proper UUIDs for database compatibility
      const workspaceId = workspace_id === 'test-workspace' || workspace_id === 'demo-workspace' 
        ? '00000000-0000-0000-0000-000000000001' 
        : workspace_id;

      // For demo/test mode, skip database save and use local storage
      if (workspace_id === 'test-workspace' || workspace_id === 'demo-workspace') {
        console.log('Demo mode: Skipping database save, using local storage');
        const localId = `local-${Date.now()}`;
        
        return NextResponse.json({ 
          success: true, 
          data: {
            draft: {
              id: localId,
              title: finalTitle,
              content: {
                body: optimizedContent,
                sections: [
                  {
                    type: 'introduction',
                    content: optimizedContent.split('\n\n')[0] || ''
                  }
                ],
                word_count: optimizedContent.split(' ').length
              },
              seo_data: {
                meta_description: finalMetaDescription || '',
                keywords: seoKeywords,
                seo_score: finalSeoScore,
                title: finalTitle
              },
              word_count: optimizedContent.split(' ').length,
              reading_time: Math.ceil(optimizedContent.split(' ').length / 200),
              humanized: humanizedContent !== contentDraft.content,
              downloads: {
                markdown: exportedContent?.markdown ? `/api/content/download/${localId}/markdown` : null,
                html: exportedContent?.html ? `/api/content/download/${localId}/html` : null,
                word: exportedContent?.word ? `/api/content/download/${localId}/word` : null,
                filename: exportedContent?.filename || `${finalTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`
              }
            },
            research_count: researchSummaries.length,
            research_quality: isFallbackResearch ? 'fallback' : 'real-time',
            seo_score: finalSeoScore,
            word_count: optimizedContent.split(' ').length,
            reading_time: Math.ceil(optimizedContent.split(' ').length / 200),
            humanized: humanizedContent !== contentDraft.content,
            downloads: {
              markdown: exportedContent?.markdown ? `/api/content/download/${localId}/markdown` : null,
              html: exportedContent?.html ? `/api/content/download/${localId}/html` : null,
              word: exportedContent?.word ? `/api/content/download/${localId}/word` : null,
              filename: exportedContent?.filename || `${finalTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`
            }
          }
        });
      }

      const supabase = createSupabaseClient();
      if (!supabase) {
        console.error('Supabase client not initialized, skipping database save.');
        // Fallback: return content without database save
        const localId = `local-${Date.now()}`;
        console.log('Content draft created locally (database unavailable):', localId);
        
        return NextResponse.json({ 
          success: true, 
          data: {
            draft: {
              id: localId,
              title: finalTitle,
              content: {
                body: optimizedContent,
                sections: [
                  {
                    type: 'introduction',
                    content: optimizedContent.split('\n\n')[0] || ''
                  }
                ],
                word_count: optimizedContent.split(' ').length
              },
              seo_data: {
                meta_description: finalMetaDescription || '',
                keywords: seoKeywords,
                seo_score: finalSeoScore,
                title: finalTitle
              },
              word_count: optimizedContent.split(' ').length,
              reading_time: Math.ceil(optimizedContent.split(' ').length / 200),
              humanized: humanizedContent !== contentDraft.content,
              downloads: {
                markdown: exportedContent?.markdown ? `/api/content/download/${localId}/markdown` : null,
                html: exportedContent?.html ? `/api/content/download/${localId}/html` : null,
                word: exportedContent?.word ? `/api/content/download/${localId}/word` : null,
                filename: exportedContent?.filename || `${finalTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`
              }
            },
            research_count: researchSummaries.length,
            research_quality: isFallbackResearch ? 'fallback' : 'real-time',
            seo_score: finalSeoScore,
            word_count: optimizedContent.split(' ').length,
            reading_time: Math.ceil(optimizedContent.split(' ').length / 200),
            humanized: humanizedContent !== contentDraft.content,
            downloads: {
              markdown: exportedContent?.markdown ? `/api/content/download/${localId}/markdown` : null,
              html: exportedContent?.html ? `/api/content/download/${localId}/html` : null,
              word: exportedContent?.word ? `/api/content/download/${localId}/word` : null,
              filename: exportedContent?.filename || `${finalTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`
            }
          }
        });
      }

      const { data: draft, error } = await supabase
        .from('content_drafts')
        .insert({
          workspace_id: workspaceId,
          title: finalTitle,
          slug: finalTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
          content_type: content_type,
          content: {
            body: optimizedContent,
            sections: [
              {
                type: 'introduction',
                content: optimizedContent.split('\n\n')[0] || ''
              }
            ],
            word_count: optimizedContent.split(' ').length
          },
          seo_data: {
            meta_description: finalMetaDescription || '',
            keywords: seoKeywords,
            seo_score: finalSeoScore,
            title: finalTitle
          },
          word_count: optimizedContent.split(' ').length,
          reading_time: Math.ceil(optimizedContent.split(' ').length / 200), // Average reading speed
          seo_score: finalSeoScore,
          created_by: null, // Assuming no user is logged in for now
          due_date: due_date ? new Date(due_date) : null
        })
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        throw error;
      }

      console.log('Content draft saved to database:', draft.id);
      return NextResponse.json({ 
        success: true, 
        data: {
          draft: {
            ...draft,
            created_at: draft.created_at
          },
          research_count: researchSummaries.length,
          research_quality: isFallbackResearch ? 'fallback' : 'real-time',
          seo_score: finalSeoScore,
          word_count: optimizedContent.split(' ').length,
          reading_time: Math.ceil(optimizedContent.split(' ').length / 200),
          humanized: humanizedContent !== contentDraft.content,
          downloads: {
            markdown: exportedContent?.markdown ? `/api/content/download/${draft.id}/markdown` : null,
            html: exportedContent?.html ? `/api/content/download/${draft.id}/html` : null,
            word: exportedContent?.word ? `/api/content/download/${draft.id}/word` : null,
            filename: exportedContent?.filename || `${finalTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`
          }
        }
      });

    } catch (error) {
      console.error('Failed to save to database:', error);
      
      // Fallback: return content without database save
      const localId = `local-${Date.now()}`;
      console.log('Content draft created locally (database unavailable):', localId);
      
      return NextResponse.json({ 
        success: true, 
        data: {
          draft: {
            id: localId,
            title: finalTitle,
            content: {
              body: optimizedContent,
              sections: [
                {
                  type: 'introduction',
                  content: optimizedContent.split('\n\n')[0] || ''
                }
              ],
              word_count: optimizedContent.split(' ').length
            },
            seo_data: {
              meta_description: finalMetaDescription || '',
              keywords: seoKeywords,
              seo_score: finalSeoScore,
              title: finalTitle
            },
            word_count: optimizedContent.split(' ').length,
            reading_time: Math.ceil(optimizedContent.split(' ').length / 200),
            humanized: humanizedContent !== contentDraft.content,
            downloads: {
              markdown: exportedContent?.markdown ? `/api/content/download/${localId}/markdown` : null,
              html: exportedContent?.html ? `/api/content/download/${localId}/html` : null,
              word: exportedContent?.word ? `/api/content/download/${localId}/word` : null,
              filename: exportedContent?.filename || `${finalTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`
            }
          },
          research_count: researchSummaries.length,
          research_quality: isFallbackResearch ? 'fallback' : 'real-time',
          seo_score: finalSeoScore,
          word_count: optimizedContent.split(' ').length,
          reading_time: Math.ceil(optimizedContent.split(' ').length / 200),
          humanized: humanizedContent !== contentDraft.content,
          downloads: {
            markdown: exportedContent?.markdown ? `/api/content/download/${localId}/markdown` : null,
            html: exportedContent?.html ? `/api/content/download/${localId}/html` : null,
            word: exportedContent?.word ? `/api/content/download/${localId}/word` : null,
            filename: exportedContent?.filename || `${finalTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`
          }
        }
      });
    }

  } catch (error) {
    console.error('Content generation failed:', error);
    return NextResponse.json(
      { error: 'Content generation failed: ' + (error as Error).message },
      { status: 500 }
    );
  }
} 