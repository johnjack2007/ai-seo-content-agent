import { OpenAI } from 'openai';

interface SEOOptimizationResult {
  optimizedContent: string;
  seoScore: number;
  keywordDensity: Record<string, number>;
  metaDescription: string;
  title: string;
  suggestions: string[];
}

export class SEOOptimizationAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async optimizeContentForSEO(
    content: string,
    seoKeywords: string[],
    topic: string,
    contentPurpose: string,
    tone: string
  ): Promise<SEOOptimizationResult> {
    console.log('Starting SEO optimization...');
    console.log(`Optimizing content with ${seoKeywords.length} keywords:`, seoKeywords);

    if (seoKeywords.length === 0) {
      console.log('No SEO keywords provided, returning original content');
      return {
        optimizedContent: content,
        seoScore: 85, // Base score for well-written content
        keywordDensity: {},
        metaDescription: this.generateMetaDescription(content, topic),
        title: this.extractTitle(content),
        suggestions: ['Content is well-written but could benefit from specific SEO keywords']
      };
    }

    try {
      const prompt = `You are an expert SEO content optimizer. Your task is to optimize the provided content for search engines while maintaining readability and natural flow.

CONTENT TO OPTIMIZE:
${content}

TOPIC: ${topic}
CONTENT PURPOSE: ${contentPurpose}
TONE: ${tone}
SEO KEYWORDS TO INTEGRATE: ${seoKeywords.join(', ')}

OPTIMIZATION REQUIREMENTS:
1. Naturally integrate the SEO keywords throughout the content
2. Maintain the original meaning and flow
3. Ensure keyword density is between 1-3% for each keyword
4. Include keywords in headings, subheadings, and naturally in paragraphs
5. Create an SEO-optimized title (50-60 characters)
6. Generate a compelling meta description (150-160 characters)
7. Maintain the specified tone and content purpose
8. Do NOT keyword stuff - make it sound natural

OPTIMIZATION TECHNIQUES TO USE:
- Include primary keywords in the first paragraph
- Use keywords in H2 and H3 headings where appropriate
- Include keywords in the conclusion
- Use semantic variations of keywords
- Ensure proper keyword distribution throughout the content

REQUIRED OUTPUT FORMAT (valid JSON only):
{
  "optimizedContent": "The fully optimized content with natural keyword integration",
  "seoScore": 85,
  "keywordDensity": {
    "keyword1": 2.1,
    "keyword2": 1.8
  },
  "metaDescription": "Compelling meta description with primary keywords",
  "title": "SEO-optimized title",
  "suggestions": [
    "Consider adding more internal links",
    "Include more long-tail keywords"
  ]
}

Focus on creating content that ranks well in search engines while providing genuine value to readers.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      const optimization = this.parseOptimizationResult(result);
      
      console.log(`SEO optimization completed. Score: ${optimization.seoScore}`);
      return optimization;

    } catch (error) {
      console.error('SEO optimization failed:', error);
      // Return original content with base score if optimization fails
      return {
        optimizedContent: content,
        seoScore: 70,
        keywordDensity: {},
        metaDescription: this.generateMetaDescription(content, topic),
        title: this.extractTitle(content),
        suggestions: ['SEO optimization failed, using original content']
      };
    }
  }

  private parseOptimizationResult(response: string): SEOOptimizationResult {
    try {
      // Clean the response and extract JSON
      const cleaned = response
        .replace(/[\r\n\t\x00-\x1F\x7F-\x9F]/g, ' ')
        .replace(/\"/g, '"')
        .trim();
      
      // Try to extract JSON object
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          optimizedContent: parsed.optimizedContent || '',
          seoScore: parsed.seoScore || 70,
          keywordDensity: parsed.keywordDensity || {},
          metaDescription: parsed.metaDescription || '',
          title: parsed.title || '',
          suggestions: parsed.suggestions || []
        };
      }
      
      throw new Error('No JSON found in response');
      
    } catch (error) {
      console.error('Failed to parse SEO optimization result:', error);
      throw new Error('Failed to parse SEO optimization result');
    }
  }

  private generateMetaDescription(content: string, topic: string): string {
    // Extract first few sentences for meta description
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const firstSentence = sentences[0]?.trim() || '';
    
    if (firstSentence.length > 160) {
      return firstSentence.substring(0, 157) + '...';
    }
    
    return firstSentence || `Learn about ${topic} in this comprehensive guide.`;
  }

  private extractTitle(content: string): string {
    // Try to extract title from first line or generate one
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const firstLine = lines[0]?.trim() || '';
    
    if (firstLine.length > 0 && firstLine.length < 60) {
      return firstLine;
    }
    
    return 'Comprehensive Guide';
  }
} 