import { createClient } from '@supabase/supabase-js';
import { trackAPIUsage } from '@/lib/supabase';

interface ContentDraft {
  title: string;
  content: string;
  seo_score: number;
  word_count: number;
  reading_time: number;
  keywords: string[];
  meta_description: string;
}

interface ResearchSummary {
  title: string;
  url: string;
  key_points: string[];
  keywords: string[];
  summary: string;
  expert_quotes?: string[];
  data_points?: string[];
  relevance_score?: number;
  source_authority?: string;
  publication_date?: string;
}

export class GenerationAgent {
  private supabase: any;

  constructor() {
    // Create Supabase client only if environment variables are available
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (supabaseUrl && supabaseAnonKey) {
      this.supabase = createClient(supabaseUrl, supabaseAnonKey)
    } else {
      console.warn('Supabase environment variables not found, database features will be disabled')
      this.supabase = null
    }
  }

  // Professional content generation with prompt chaining
  async generateContent(
    topic: string,
    content_type: string,
    audience: string,
    tone: string,
    content_purpose: string,
    researchSummaries: ResearchSummary[],
    word_count_target: number,
    seoKeywords: string[] = []
  ): Promise<ContentDraft> {
    console.log(`Generating ${content_type} about "${topic}" (${word_count_target} words)`);
    console.log(`Content purpose: ${content_purpose}`);
    console.log(`SEO keywords: ${seoKeywords.join(', ')}`);
    
    try {
      // Step 1: Create comprehensive outline
      const outline = await this.createDetailedOutline(topic, content_type, audience, tone, content_purpose, researchSummaries, word_count_target, seoKeywords);
      
      // Step 2: Generate content based on outline with strict word count enforcement
      const content = await this.generateContentFromOutline(outline, topic, content_type, audience, tone, content_purpose, researchSummaries, word_count_target, seoKeywords);
      
      // Step 3: Generate meta description
      const metaDescription = await this.generateMetaDescription(content.content, topic, seoKeywords);
      
      const finalWordCount = this.countWords(content.content);
      console.log(`Content generation completed: ${finalWordCount} words`);
      
      return {
        title: content.title,
        content: content.content,
        seo_score: 75, // Base score - will be optimized later
        word_count: finalWordCount,
        reading_time: this.calculateReadingTime(content.content),
        keywords: seoKeywords,
        meta_description: metaDescription
      };
      
    } catch (error) {
      console.error('Content generation failed:', error);
      throw error;
    }
  }

  // Robust JSON parsing with error handling
  private safeParseJSON(raw: string, context: string): any {
    if (!raw || typeof raw !== 'string') {
      console.error(`${context} parsing failed: Invalid input type`, { type: typeof raw, value: raw });
      return null;
    }

    // Clean the input string
    let cleaned = raw.trim();
    
    // Remove any markdown code block markers
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    
    // Handle common control character issues
    cleaned = cleaned
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\u2028/g, '') // Remove line separators
      .replace(/\u2029/g, '') // Remove paragraph separators
      .replace(/[\uFFFD]/g, ''); // Remove replacement characters
    
    // Try to find JSON content if it's embedded in other text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    try {
      const parsed = JSON.parse(cleaned);
      
      // Validate the parsed data
      if (!this.validateParsedData(parsed, context)) {
        console.error(`${context} validation failed: Invalid structure`);
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error(`${context} JSON parsing failed:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        input: raw.substring(0, 200) + (raw.length > 200 ? '...' : ''),
        cleaned: cleaned.substring(0, 200) + (cleaned.length > 200 ? '...' : '')
      });
      
      // Try to fix common JSON issues
      try {
        // Fix unescaped quotes in strings
        const fixed = cleaned.replace(/(?<!\\)"/g, '\\"').replace(/\\"/g, '"');
        const parsed = JSON.parse(fixed);
        if (this.validateParsedData(parsed, context)) {
          console.log(`${context} parsing succeeded after quote fixing`);
          return parsed;
        }
      } catch (fixError) {
        console.error(`${context} quote fixing failed:`, fixError);
      }
      
      return null;
    }
  }

  private validateParsedData(parsed: any, context: string): boolean {
    if (context === 'Content' && (!parsed.title || !parsed.content)) {
      return false;
    }
    if (context === 'SEO' && (!parsed.title || !parsed.content || typeof parsed.seo_score !== 'number')) {
      return false;
    }
    return true;
  }

  // Step 1: Create detailed content outline
  private async createDetailedOutline(
    topic: string,
    content_type: string,
    audience: string,
    tone: string,
    content_purpose: string,
    researchSummaries: ResearchSummary[],
    word_count_target: number,
    seoKeywords: string[] = []
  ): Promise<any> {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const researchContext = this.formatResearchContext(researchSummaries);
    const keywordsContext = seoKeywords.length > 0 ? `\nPRIMARY SEO KEYWORDS: ${seoKeywords.join(', ')}` : '';
    
    const prompt = `You are a senior content strategist and editor. Create a detailed, professional outline for a ${content_type} about "${topic}".

CONTEXT:
- Topic: ${topic}
- Content Type: ${content_type}
- Target Audience: ${audience}
- Tone: ${tone}
- Target Word Count: ${word_count_target} words (STRICT REQUIREMENT)
- Content Purpose: ${content_purpose}${keywordsContext}

RESEARCH INSIGHTS:
${researchContext}

OUTLINE REQUIREMENTS:
1. Create a compelling headline that incorporates the topic and primary keywords naturally
2. Design an introduction that hooks the reader and establishes authority on the topic
3. Structure 3-5 main sections with clear subheadings that flow logically
4. Include specific points where research insights should be integrated
5. Plan for proper citation and attribution throughout
6. Ensure the outline supports the EXACT target word count of ${word_count_target} words
7. Include a strong conclusion with actionable takeaways
8. Allocate word counts to each section to meet the target
9. If SEO keywords are provided, incorporate them naturally throughout the outline

IMPORTANT: Format the response as valid JSON. Escape all quotes and special characters in the content field properly.

REQUIRED OUTPUT FORMAT (JSON):
{
  "headline": "Compelling headline incorporating the topic and keywords",
  "introduction": {
    "hook": "Opening hook related to the topic",
    "context": "Background context about the topic",
    "thesis": "Main argument/purpose statement",
    "target_length": 100
  },
  "sections": [
    {
      "heading": "Section heading related to the topic",
      "subheadings": ["Subheading 1", "Subheading 2"],
      "key_points": ["Point 1", "Point 2", "Point 3"],
      "research_integration": ["Which research insights to include"],
      "target_length": 150
    }
  ],
  "conclusion": {
    "summary": "Key takeaways related to the topic",
    "call_to_action": "Actionable next steps",
    "target_length": 100
  },
  "citation_plan": ["Where to cite specific sources"],
  "total_target_length": ${word_count_target}
}

Focus on creating an outline that will result in high-quality, well-researched content that provides genuine value to the audience and meets the exact word count requirement. The outline should be specifically tailored to the topic "${topic}" and the content purpose "${content_purpose}".`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('Failed to generate outline');
    const parsed = this.safeParseJSON(result, 'Outline');
    if (!parsed) throw new Error('Failed to parse outline JSON');
    return parsed;
  }

  // Step 2: Generate content from outline with strict word count enforcement
  private async generateContentFromOutline(
    outline: any,
    topic: string,
    content_type: string,
    audience: string,
    tone: string,
    content_purpose: string,
    researchSummaries: ResearchSummary[],
    word_count_target: number,
    seoKeywords: string[] = []
  ): Promise<{ title: string; content: string }> {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const researchContext = this.formatResearchContext(researchSummaries);
    const keywordsContext = seoKeywords.length > 0 ? `\nPRIMARY SEO KEYWORDS: ${seoKeywords.join(', ')}` : '';
    
    const prompt = `You are a professional content writer specializing in ${content_type} creation. Write high-quality content based on the provided outline and research.

CONTEXT:
- Topic: ${topic}
- Content Type: ${content_type}
- Target Audience: ${audience}
- Tone: ${tone}
- Target Word Count: ${word_count_target} words (CRITICAL REQUIREMENT - must be EXACTLY ${word_count_target} words ±5%)
- Content Purpose: ${content_purpose}${keywordsContext}

OUTLINE:
${JSON.stringify(outline, null, 2)}

RESEARCH INSIGHTS:
${researchContext}

WRITING REQUIREMENTS:
1. Follow the outline structure exactly
2. Integrate research insights naturally with proper attribution
3. Use the specified tone throughout
4. If SEO keywords are provided, incorporate them naturally (avoid keyword stuffing)
5. Write engaging, informative content that provides real value about the topic
6. Include specific examples, data points, and expert insights from research
7. Ensure proper citation format: "According to [Source Name], ..." or "Research from [Source Name] shows..."
8. CRITICAL: The content MUST be EXACTLY ${word_count_target} words (±5% tolerance: ${Math.floor(word_count_target * 0.95)}-${Math.floor(word_count_target * 1.05)} words)
9. Use clear, professional language appropriate for the topic
10. Include actionable insights and takeaways related to the topic
11. Do NOT fabricate quotes - only use information from the provided research sources
12. If no specific quotes are available, use general insights and attribute to the source
13. Make the content specifically relevant to the topic "${topic}" and purpose "${content_purpose}"
14. COUNT YOUR WORDS CAREFULLY before submitting

IMPORTANT: Format the response as valid JSON. Escape all quotes and special characters in the content field properly.

REQUIRED OUTPUT FORMAT (JSON):
{
  "title": "Compelling title about the topic",
  "content": "Full content as a single string with proper citations"
}

CRITICAL: Before submitting, count the words in your content. It must be between ${Math.floor(word_count_target * 0.95)} and ${Math.floor(word_count_target * 1.05)} words. If it's not, adjust the content length accordingly.

Write the complete ${content_type} following these guidelines. Ensure the content is original, valuable, professionally written, and meets the exact word count requirement. The content should be specifically tailored to the topic "${topic}" and provide genuine value to the target audience.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 4000,
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('Failed to generate content');
    const parsed = this.safeParseJSON(result, 'Content');
    if (!parsed) throw new Error('Failed to parse content JSON');
    
    // Verify word count with retry logic
    const actualWordCount = this.countWords(parsed.content);
    const tolerance = Math.floor(word_count_target * 0.05); // 5% tolerance
    const minWords = word_count_target - tolerance;
    const maxWords = word_count_target + tolerance;
    
    if (actualWordCount < minWords || actualWordCount > maxWords) {
      console.warn(`Word count ${actualWordCount} is outside target range ${minWords}-${maxWords}. Attempting regeneration...`);
      
      // Try one more time with more explicit word count instructions
      const retryPrompt = `The previous content was ${actualWordCount} words, but the target is ${word_count_target} words (±10% tolerance: ${minWords}-${maxWords} words). 

Please regenerate the content with STRICT word count adherence. The content must be between ${minWords} and ${maxWords} words.

${prompt}

CRITICAL: The final content MUST be between ${minWords} and ${maxWords} words. Count carefully and adjust accordingly.`;
      
      const retryResponse = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: retryPrompt }],
        temperature: 0.3,
        max_tokens: 4000,
      });
      
      const retryResult = retryResponse.choices[0]?.message?.content;
      if (retryResult) {
        const retryParsed = this.safeParseJSON(retryResult, 'Content Retry');
        if (retryParsed) {
          const retryWordCount = this.countWords(retryParsed.content);
          if (retryWordCount >= minWords && retryWordCount <= maxWords) {
            console.log(`Retry successful: ${retryWordCount} words (target: ${word_count_target})`);
            return { title: retryParsed.title, content: retryParsed.content };
          }
        }
      }
      
      console.warn(`Retry failed. Using original content with ${actualWordCount} words (target: ${word_count_target})`);
    }
    
    return { title: parsed.title, content: parsed.content };
  }

  // Step 3: SEO optimization
  private async optimizeForSEO(
    content: { title: string; content: string },
    topic: string,
    keywords: string[]
  ): Promise<{ title: string; content: string; seo_score: number }> {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Debug logging and validation
    console.log('SEO optimization input:', {
      title: content.title,
      contentLength: content.content?.length || 0,
      contentType: typeof content.content
    });

    if (!content.content || typeof content.content !== 'string') {
      throw new Error(`Invalid content for SEO optimization. Expected string, got: ${typeof content.content}`);
    }

    const prompt = `You are an SEO expert. Analyze and optimize the provided content for search engines while maintaining readability and quality.

CONTENT TO OPTIMIZE:
Topic: ${topic}
Title: ${content.title}
Content: ${content.content.substring(0, 2000)}...

TARGET KEYWORDS: ${keywords.join(', ')}

OPTIMIZATION REQUIREMENTS:
1. Ensure the title includes primary keywords naturally
2. Optimize headings and subheadings for SEO
3. Improve keyword density without stuffing
4. Add relevant internal linking opportunities
5. Optimize content structure for featured snippets
6. Ensure proper heading hierarchy (H1, H2, H3)
7. Add relevant meta information suggestions
8. Maintain readability and user experience
9. Keep the content focused on the topic "${topic}"

IMPORTANT: Format the response as valid JSON. Escape all quotes and special characters in the content field properly.

PROVIDE:
1. Optimized title
2. Optimized content with improved structure
3. SEO score (0-100) with detailed breakdown
4. Specific optimization recommendations

OUTPUT FORMAT (JSON):
{
  "title": "Optimized title incorporating keywords",
  "content": "Optimized content with proper heading structure",
  "seo_score": 85,
  "optimization_notes": ["Note 1", "Note 2"]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 3000,
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('Failed to optimize content');
    const parsed = this.safeParseJSON(result, 'SEO');
    if (!parsed) throw new Error('Failed to parse SEO JSON');
    return {
      title: parsed.title,
      content: parsed.content,
      seo_score: parsed.seo_score
    };
  }

  // Step 4: Generate meta description
  private async generateMetaDescription(content: string, topic: string, keywords: string[]): Promise<string> {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Debug logging and validation
    console.log('Meta description input:', {
      contentLength: content?.length || 0,
      contentType: typeof content
    });

    if (!content || typeof content !== 'string') {
      throw new Error(`Invalid content for meta description. Expected string, got: ${typeof content}`);
    }

    const keywordsContext = keywords.length > 0 ? `\nPRIMARY KEYWORDS: ${keywords.join(', ')}` : '';
    
    const prompt = `Create a compelling meta description for the following content. The meta description should be 150-160 characters and include primary keywords naturally.

CONTENT TOPIC: ${topic}${keywordsContext}
CONTENT PREVIEW: ${content.substring(0, 500)}...

REQUIREMENTS:
- 150-160 characters maximum
- Include primary keywords naturally if provided
- Compelling and click-worthy
- Accurately describe the content about "${topic}"
- Include a call-to-action if appropriate
- Focus on the specific topic and value proposition

Provide only the meta description text, no additional formatting.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 100,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  }

  // Helper method to format research context
  private formatResearchContext(researchSummaries: ResearchSummary[]): string {
    if (researchSummaries.length === 0) {
      return "No specific research insights available. Focus on general best practices and industry knowledge.";
    }

    return researchSummaries.map(summary => `
SOURCE: ${summary.title} (${summary.url})
KEY INSIGHTS:
${summary.key_points.map(point => `- ${point}`).join('\n')}
SUMMARY:
${summary.summary}
${summary.expert_quotes && summary.expert_quotes.length > 0 ? `\nEXPERT QUOTES:\n${summary.expert_quotes.map(quote => `- "${quote}"`).join('\n')}` : ''}
${summary.data_points && summary.data_points.length > 0 ? `\nDATA POINTS:\n${summary.data_points.map(data => `- ${data}`).join('\n')}` : ''}

IMPORTANT: When citing this source, use the format "According to ${summary.title}..." or "Research from ${summary.title} shows..." and include the URL for reference. Only use quotes and data points that are explicitly provided in the research.
`).join('\n');
  }

  // Helper methods
  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private calculateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const wordCount = this.countWords(text);
    return Math.ceil(wordCount / wordsPerMinute);
  }

  // Remove fallback research - only use real research
  private async handleResearchFailure(topic: string, error: any): Promise<ResearchSummary[]> {
    console.error(`Research failed for topic: ${topic}`, error);
    throw new Error(`Failed to research topic: ${topic}. Please try again with a different topic.`);
  }

  // Database saving is handled by the main content generation route
  // This method is kept for compatibility but not used
  async saveContentDraft(
    draft: ContentDraft,
    workspace_id: string,
    topic: string,
    content_type: string
  ): Promise<any> {
    console.log('GenerationAgent saveContentDraft called - this should not happen');
    throw new Error('Database saving is handled by the main route');
  }

  // Helper method to generate URL-friendly slug
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
} 