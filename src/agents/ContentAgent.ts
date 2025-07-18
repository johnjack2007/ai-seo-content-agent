import { OpenAI } from 'openai';

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

interface ContentDraft {
  title: string;
  content: string;
  seo_score: number;
  word_count: number;
  reading_time: number;
  keywords: string[];
  meta_description: string;
}

interface ContentOptions {
  topic: string;
  content_type?: string;
  audience?: string;
  tone?: string;
  content_purpose?: string;
  word_count: number;
  seo_keywords: string[];
  research_summaries: ResearchSummary[];
}

export class ContentAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateContent(options: ContentOptions): Promise<ContentDraft> {
    // Set defaults for missing values
    const content_type = options.content_type || 'blog';
    const audience = options.audience || 'general';
    const tone = options.tone || 'professional';
    const content_purpose = options.content_purpose || 'informational';
    
    console.log(`Generating ${content_type} about "${options.topic}" (${options.word_count} words)`);
    console.log(`Content purpose: ${content_purpose}`);
    console.log(`SEO keywords: ${options.seo_keywords.join(', ')}`);
    
    try {
      const researchContext = this.formatResearchContext(options.research_summaries);
      const keywordsContext = options.seo_keywords.length > 0 ? 
        `\nPRIMARY SEO KEYWORDS: ${options.seo_keywords.join(', ')}` : '';

      const prompt = `You are a professional content writer and SEO specialist. Create high-quality, human-sounding content that is optimized for search engines while maintaining natural readability.

CONTEXT:
- Topic: ${options.topic}
- Content Type: ${content_type}
- Target Audience: ${audience}
- Tone: ${tone}
- Target Word Count: ${options.word_count} words (CRITICAL REQUIREMENT - must be EXACTLY ${options.word_count} words ±5%)
- Content Purpose: ${content_purpose}${keywordsContext}

RESEARCH INSIGHTS:
${researchContext}

CONTENT REQUIREMENTS:
1. Create a compelling, SEO-optimized title (50-60 characters) that incorporates the topic and primary keywords naturally
2. Write engaging, informative content that provides real value about the topic
3. Integrate research insights naturally with proper attribution: "According to [Source Name], ..." or "Research from [Source Name] shows..."
4. Use the specified tone throughout (${tone})
5. If SEO keywords are provided, incorporate them naturally throughout the content (avoid keyword stuffing)
6. Include specific examples, data points, and expert insights from research
7. Make the content sound human and natural - vary sentence structure, use conversational language where appropriate
8. Include actionable insights and takeaways related to the topic
9. Do NOT fabricate quotes - only use information from the provided research sources
10. CRITICAL: The content MUST be EXACTLY ${options.word_count} words (±5% tolerance: ${Math.floor(options.word_count * 0.95)}-${Math.floor(options.word_count * 1.05)})
11. Generate a compelling meta description (150-160 characters) with primary keywords
12. Calculate an SEO score based on keyword integration, readability, and content quality

HUMANIZATION TECHNIQUES TO APPLY:
- Vary sentence structure and length
- Use natural transitions and flow
- Add personal insights and examples
- Use conversational language where appropriate
- Include rhetorical questions and engagement
- Use specific, vivid language instead of generic terms
- Avoid repetitive patterns and AI-like structures

SEO OPTIMIZATION TECHNIQUES:
- Include primary keywords in the first paragraph
- Use keywords in headings where appropriate
- Include keywords in the conclusion
- Use semantic variations of keywords
- Ensure proper keyword distribution throughout the content
- Maintain keyword density between 1-3% for each keyword

REQUIRED OUTPUT FORMAT (valid JSON only):
{
  "title": "SEO-optimized title about the topic",
  "content": "Full content as a single string with proper citations and natural flow",
  "metaDescription": "Compelling meta description with primary keywords",
  "seoScore": 85,
  "keywordDensity": {
    "keyword1": 2.1,
    "keyword2": 1.8
  },
  "wordCount": ${options.word_count},
  "readingTime": ${Math.ceil(options.word_count / 200)}
}

CRITICAL: Before submitting, count the words in your content. It must be between ${Math.floor(options.word_count * 0.95)} and ${Math.floor(options.word_count * 1.05)} words. If it's not, adjust the content length accordingly.

Write the complete ${content_type} following these guidelines. Ensure the content is original, valuable, professionally written, meets the exact word count requirement, sounds human, and is optimized for search engines.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 4000,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('Failed to generate content');
      }

      const parsed = this.safeParseJSON(result, 'Content');
      if (!parsed) {
        throw new Error('Failed to parse content JSON');
      }

      // Verify word count with retry logic
      const actualWordCount = this.countWords(parsed.content);
      const tolerance = Math.floor(options.word_count * 0.05); // 5% tolerance
      const minWords = options.word_count - tolerance;
      const maxWords = options.word_count + tolerance;

      if (actualWordCount < minWords || actualWordCount > maxWords) {
        console.log(`Word count ${actualWordCount} is outside target range ${minWords}-${maxWords}. Attempting regeneration...`);
        
        // Try one more time with more explicit word count instructions
        const retryPrompt = prompt + `\n\nIMPORTANT: Your previous response was ${actualWordCount} words, but you need EXACTLY ${options.word_count} words. Please rewrite the content to be exactly ${options.word_count} words.`;
        
        const retryResponse = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: retryPrompt }],
          temperature: 0.3,
          max_tokens: 4000,
        });

        const retryResult = retryResponse.choices[0]?.message?.content;
        if (retryResult) {
          const retryParsed = this.safeParseJSON(retryResult, 'Content');
          if (retryParsed) {
            const retryWordCount = this.countWords(retryParsed.content);
            if (retryWordCount >= minWords && retryWordCount <= maxWords) {
              parsed.content = retryParsed.content;
              parsed.title = retryParsed.title;
              parsed.metaDescription = retryParsed.metaDescription;
              parsed.seoScore = retryParsed.seoScore;
              console.log(`Retry successful: ${retryWordCount} words`);
            } else {
              console.log(`Retry failed. Using original content with ${actualWordCount} words (target: ${options.word_count})`);
            }
          }
        }
      }

      const finalWordCount = this.countWords(parsed.content);
      console.log(`Content generation completed: ${finalWordCount} words`);

      return {
        title: parsed.title || `Comprehensive Guide to ${options.topic}`,
        content: parsed.content,
        seo_score: parsed.seoScore || 75,
        word_count: finalWordCount,
        reading_time: this.calculateReadingTime(parsed.content),
        keywords: options.seo_keywords,
        meta_description: parsed.metaDescription || `Learn about ${options.topic} with expert insights and actionable strategies.`
      };

    } catch (error) {
      console.error('Content generation failed:', error);
      throw error;
    }
  }

  private formatResearchContext(researchSummaries: ResearchSummary[]): string {
    if (researchSummaries.length === 0) {
      return 'No specific research data available. Generate content based on general industry knowledge, best practices, and established principles. Focus on providing valuable, accurate information without citing specific sources or making up statistics.';
    }

    return researchSummaries.map((summary, index) => {
      const keyPoints = summary.key_points.join('. ');
      const expertQuotes = summary.expert_quotes.length > 0 ? 
        `\nExpert Insights: ${summary.expert_quotes.join('. ')}` : '';
      const dataPoints = summary.data_points.length > 0 ? 
        `\nData Points: ${summary.data_points.join('. ')}` : '';

      return `Source ${index + 1}: ${summary.title} (${summary.url})
Key Points: ${keyPoints}${expertQuotes}${dataPoints}
Relevance Score: ${summary.relevance_score}/100`;
    }).join('\n\n');
  }

  private safeParseJSON(jsonString: string, context: string): any {
    try {
      // Clean the response to ensure valid JSON
      let cleaned = jsonString.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      cleaned = cleaned.trim();
      
      // Ensure it starts and ends with braces
      if (!cleaned.startsWith('{')) {
        const startIndex = cleaned.indexOf('{');
        if (startIndex !== -1) {
          cleaned = cleaned.substring(startIndex);
        }
      }
      
      if (!cleaned.endsWith('}')) {
        const endIndex = cleaned.lastIndexOf('}');
        if (endIndex !== -1) {
          cleaned = cleaned.substring(0, endIndex + 1);
        }
      }
      
      const parsed = JSON.parse(cleaned);
      
      // Validate required fields
      if (!parsed.content || !parsed.title) {
        console.error(`Invalid ${context} JSON - missing required fields:`, parsed);
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error(`Failed to parse ${context} JSON:`, error);
      console.error('Raw response:', jsonString);
      return null;
    }
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  private calculateReadingTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = this.countWords(content);
    return Math.ceil(wordCount / wordsPerMinute);
  }
} 