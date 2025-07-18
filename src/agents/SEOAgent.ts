import { openAIService, GenerationOptions } from '@/lib/openai';
import { ContentDraft, SEOAnalysis, SEORecommendation } from '@/types';
import { supabase } from '@/lib/supabase';
import Levenshtein from 'levenshtein';

export interface SEOAnalysisOptions {
  workspace_id: string;
  user_id: string;
  target_keywords?: string[];
  min_keyword_density?: number;
  max_keyword_density?: number;
  readability_target?: number;
}

export class SEOAgent {
  private readonly DEFAULT_MIN_KEYWORD_DENSITY = 0.5; // 0.5%
  private readonly DEFAULT_MAX_KEYWORD_DENSITY = 2.5; // 2.5%
  private readonly DEFAULT_READABILITY_TARGET = 60; // Flesch Reading Ease

  private calculateFleschReadingEase(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const syllables = this.countSyllables(text);

    if (sentences.length === 0 || words.length === 0) return 0;

    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;

    return 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  }

  private countSyllables(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    let syllableCount = 0;

    for (const word of words) {
      syllableCount += this.countWordSyllables(word);
    }

    return syllableCount;
  }

  private countWordSyllables(word: string): number {
    word = word.toLowerCase();
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, ''); // Remove common endings
    word = word.replace(/^y/, ''); // Remove starting y

    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  private calculateKeywordDensity(
    content: string,
    keywords: string[]
  ): Record<string, number> {
    const contentLower = content.toLowerCase();
    const wordCount = contentLower.split(/\s+/).length;
    const density: Record<string, number> = {};

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = contentLower.match(regex);
      const count = matches ? matches.length : 0;
      density[keyword] = wordCount > 0 ? (count / wordCount) * 100 : 0;
    }

    return density;
  }

  private findInternalLinkOpportunities(
    content: string,
    keywords: string[],
    existingInternalLinks: Array<{ text: string; url: string }> = []
  ): Array<{ text: string; url: string; relevance: number }> {
    const opportunities: Array<{ text: string; url: string; relevance: number }> = [];
    const contentLower = content.toLowerCase();

    // Get existing internal URLs from the workspace
    const existingUrls = existingInternalLinks.map(link => link.url);

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      
      // Find exact matches in content
      const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = contentLower.match(regex);
      
      if (matches && matches.length > 0) {
        // Check if this keyword is already linked
        const alreadyLinked = existingInternalLinks.some(link => 
          link.text.toLowerCase().includes(keywordLower)
        );

        if (!alreadyLinked) {
          // Find the best matching internal URL
          const bestMatch = this.findBestInternalUrl(keyword, existingUrls);
          if (bestMatch) {
            opportunities.push({
              text: keyword,
              url: bestMatch,
              relevance: this.calculateRelevanceScore(keyword, bestMatch)
            });
          }
        }
      }
    }

    return opportunities.sort((a, b) => b.relevance - a.relevance);
  }

  private findBestInternalUrl(keyword: string, urls: string[]): string | null {
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const url of urls) {
      const urlPath = new URL(url).pathname;
      const urlWords = urlPath.split(/[\/\-_]+/).filter(w => w.length > 0);
      
      for (const urlWord of urlWords) {
        const distanceScore = new Levenshtein(keyword.toLowerCase(), urlWord.toLowerCase()).distance;
        const relevance = 1 / (distanceScore + 1); // Higher relevance for closer matches
        
        if (relevance > bestScore && relevance > 0.3) { // Minimum threshold
          bestScore = relevance;
          bestMatch = url;
        }
      }
    }

    return bestMatch;
  }

  private calculateRelevanceScore(keyword: string, url: string): number {
    const urlPath = new URL(url).pathname;
    const urlWords = urlPath.split(/[\/\-_]+/).filter(w => w.length > 0);
    
    let maxRelevance = 0;
    for (const urlWord of urlWords) {
              const distanceScore = new Levenshtein(keyword.toLowerCase(), urlWord.toLowerCase()).distance;
      const relevance = 1 / (distanceScore + 1);
      maxRelevance = Math.max(maxRelevance, relevance);
    }
    
    return Math.round(maxRelevance * 100);
  }

  private generateSEORecommendations(
    content: string,
    keywordDensity: Record<string, number>,
    readabilityScore: number,
    internalLinks: Array<{ text: string; url: string; relevance: number }>,
    options: SEOAnalysisOptions
  ): SEORecommendation[] {
    const recommendations: SEORecommendation[] = [];
    const { min_keyword_density = this.DEFAULT_MIN_KEYWORD_DENSITY, max_keyword_density = this.DEFAULT_MAX_KEYWORD_DENSITY, readability_target = this.DEFAULT_READABILITY_TARGET } = options;

    // Keyword density recommendations
    for (const [keyword, density] of Object.entries(keywordDensity)) {
      if (density < min_keyword_density) {
        recommendations.push({
          type: 'keyword',
          priority: 'high',
          message: `Keyword "${keyword}" is underused (${density.toFixed(1)}% density)`,
          suggestion: `Increase usage of "${keyword}" to reach target density of ${min_keyword_density}%`,
          current_value: density,
          target_value: min_keyword_density
        });
      } else if (density > max_keyword_density) {
        recommendations.push({
          type: 'keyword',
          priority: 'medium',
          message: `Keyword "${keyword}" is overused (${density.toFixed(1)}% density)`,
          suggestion: `Reduce usage of "${keyword}" to avoid keyword stuffing`,
          current_value: density,
          target_value: max_keyword_density
        });
      }
    }

    // Readability recommendations
    if (readabilityScore < readability_target) {
      recommendations.push({
        type: 'readability',
        priority: 'high',
        message: `Content readability score is ${readabilityScore} (target: ${readability_target})`,
        suggestion: 'Simplify sentence structure and use shorter words to improve readability',
        current_value: readabilityScore,
        target_value: readability_target
      });
    }

    // Internal linking recommendations
    if (internalLinks.length === 0) {
      recommendations.push({
        type: 'links',
        priority: 'medium',
        message: 'No internal links found in content',
        suggestion: 'Add relevant internal links to improve site structure and SEO',
        current_value: 0,
        target_value: 3
      });
    } else if (internalLinks.length < 3) {
      recommendations.push({
        type: 'links',
        priority: 'low',
        message: `Only ${internalLinks.length} internal links found`,
        suggestion: 'Consider adding more internal links to improve site structure',
        current_value: internalLinks.length,
        target_value: 3
      });
    }

    // Content structure recommendations
    const headings = content.match(/^#{1,6}\s+.+$/gm);
    if (!headings || headings.length < 2) {
      recommendations.push({
        type: 'structure',
        priority: 'medium',
        message: 'Content lacks proper heading structure',
        suggestion: 'Add H2 and H3 headings to improve content organization and SEO',
        current_value: headings?.length || 0,
        target_value: 3
      });
    }

    return recommendations;
  }

  async analyzeContent(
    content: string,
    options: SEOAnalysisOptions
  ): Promise<SEOAnalysis> {
    const { target_keywords = [], workspace_id, user_id } = options;

    // Calculate keyword density
    const keywordDensity = this.calculateKeywordDensity(content, target_keywords);

    // Calculate readability score
    const readabilityScore = Math.round(this.calculateFleschReadingEase(content));

    // Find internal link opportunities
    const internalLinks = this.findInternalLinkOpportunities(content, target_keywords);

    // Generate recommendations
    const recommendations = this.generateSEORecommendations(
      content,
      keywordDensity,
      readabilityScore,
      internalLinks,
      options
    );

    // Calculate overall SEO score
    const seoScore = this.calculateSEOScore(
      keywordDensity,
      readabilityScore,
      internalLinks.length,
      recommendations
    );

    return {
      id: '', // Will be set by database
      draft_id: '', // Will be set by caller
      keyword_density: keywordDensity,
      readability_score: readabilityScore,
      internal_links: internalLinks,
      suggestions: recommendations.map(r => r.message),
      created_at: new Date().toISOString()
    };
  }

  private calculateSEOScore(
    keywordDensity: Record<string, number>,
    readabilityScore: number,
    internalLinkCount: number,
    recommendations: SEORecommendation[]
  ): number {
    let score = 100;

    // Deduct points for keyword issues
    for (const density of Object.values(keywordDensity)) {
      if (density < this.DEFAULT_MIN_KEYWORD_DENSITY || density > this.DEFAULT_MAX_KEYWORD_DENSITY) {
        score -= 10;
      }
    }

    // Deduct points for readability issues
    if (readabilityScore < this.DEFAULT_READABILITY_TARGET) {
      score -= Math.max(0, (this.DEFAULT_READABILITY_TARGET - readabilityScore) / 2);
    }

    // Deduct points for lack of internal links
    if (internalLinkCount === 0) {
      score -= 15;
    } else if (internalLinkCount < 3) {
      score -= 5;
    }

    // Deduct points for high-priority recommendations
    const highPriorityIssues = recommendations.filter(r => r.priority === 'high').length;
    score -= highPriorityIssues * 10;

    return Math.max(0, Math.round(score));
  }

  async improveContentSEO(
    content: string,
    targetKeywords: string[],
    options: GenerationOptions
  ): Promise<string> {
    const prompt = `Improve the following content for better SEO optimization. Focus on:

1. Natural keyword integration (target keywords: ${targetKeywords.join(', ')})
2. Improved readability and flow
3. Better sentence structure
4. Maintaining the original meaning and value

Content to improve:
${content}

Improved content:`;

    const response = await openAIService.generateContent(prompt, {
      ...options,
      max_tokens: Math.min(content.length * 2, 4000),
      temperature: 0.5
    });

    return response.content.trim();
  }

  async generateMetaDescription(
    content: string,
    targetKeywords: string[],
    options: GenerationOptions
  ): Promise<string> {
    const prompt = `Write a compelling meta description for the following content. Requirements:

- Keep it under 160 characters
- Include target keywords naturally: ${targetKeywords.join(', ')}
- Be engaging and encourage clicks
- Summarize the main value proposition

Content:
${content.substring(0, 500)}...

Meta Description:`;

    const response = await openAIService.generateContent(prompt, {
      ...options,
      max_tokens: 100,
      temperature: 0.7
    });

    return response.content.trim();
  }

  async generateTitleTag(
    content: string,
    targetKeywords: string[],
    options: GenerationOptions
  ): Promise<string> {
    const prompt = `Write an SEO-optimized title tag for the following content. Requirements:

- Keep it under 60 characters
- Include primary keyword: ${targetKeywords[0] || 'main topic'}
- Be compelling and click-worthy
- Accurately represent the content

Content:
${content.substring(0, 300)}...

Title Tag:`;

    const response = await openAIService.generateContent(prompt, {
      ...options,
      max_tokens: 50,
      temperature: 0.7
    });

    return response.content.trim();
  }

  async getInternalLinks(workspaceId: string): Promise<Array<{ text: string; url: string }>> {
    try {
      // Get published content from the workspace to use as internal link targets
      const { data, error } = await supabase
        .from('content_drafts')
        .select('title, slug')
        .eq('workspace_id', workspaceId)
        .eq('status', 'published');

      if (error) throw error;

      return data.map(draft => ({
        text: draft.title,
        url: `/blog/${draft.slug}` // Assuming this is the URL structure
      }));
    } catch (error) {
      console.error('Failed to get internal links:', error);
      return [];
    }
  }
}

export const seoAgent = new SEOAgent(); 