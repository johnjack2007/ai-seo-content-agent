import { createClient } from '@supabase/supabase-js';
import { trackAPIUsage } from '@/lib/supabase';

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

interface CachedResearch {
  topic: string;
  summaries: ResearchSummary[];
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class ResearchAgent {
  private supabase: any = null;
  private serpApiKey: string;
  private researchCache: Map<string, CachedResearch> = new Map();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.serpApiKey = process.env.SERPAPI_KEY || '';
  }

  // Lazy initialization of Supabase client
  private getSupabaseClient() {
    if (!this.supabase) {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseAnonKey) {
        this.supabase = createClient(supabaseUrl, supabaseAnonKey);
      } else {
        console.warn('Supabase environment variables not found, database features will be disabled');
        this.supabase = null;
      }
    }
    return this.supabase;
  }

  // Simplified research with 2-stage pipeline
  async researchTopic(topic: string, keywords: string[] = [], workspaceId: string = '', userId: string = ''): Promise<ResearchSummary[]> {
    console.log(`Starting research for topic: ${topic}`);
    
    // Step 1: Check cache first
    const cacheKey = this.generateCacheKey(topic, keywords);
    const cached = this.getCachedResearch(cacheKey);
    if (cached) {
      console.log(`Using cached research for: ${topic}`);
      return cached;
    }

    try {
      // Step 2: Execute simplified research pipeline
      const researchData = await this.executeResearchPipeline(topic, keywords, workspaceId, userId);
      
      // Step 3: Cache the results (only if we have real data)
      if (researchData.length > 0) {
        this.cacheResearch(cacheKey, researchData);
      }
      
      console.log(`Research completed: ${researchData.length} quality sources found`);
      return researchData;
      
    } catch (error) {
      console.error('Research failed:', error);
      console.log('Proceeding without research data - no fake data will be generated');
      return []; // Return empty array instead of fake data
    }
  }

  // Simplified 2-stage research pipeline
  private async executeResearchPipeline(topic: string, keywords: string[], workspaceId: string = '', userId: string = ''): Promise<ResearchSummary[]> {
    // Stage 1: Search with strategic queries
    const searchQueries = this.generateStrategicQueries(topic, keywords);
    const allResults = await this.parallelSearch(searchQueries, workspaceId, userId);
    
    if (allResults.length === 0) {
      console.log('No search results found - proceeding without research data');
      return []; // Return empty array instead of fake data
    }
    
    // Stage 2: Summarize and filter results
    const researchSummaries = await this.summarizeResults(allResults, topic);
    
    if (researchSummaries.length === 0) {
      console.log('No quality summaries generated - proceeding without research data');
      return []; // Return empty array instead of fake data
    }
    
    return researchSummaries.slice(0, 5); // Return top 5 summaries
  }

  // Generate strategic search queries
  private generateStrategicQueries(topic: string, keywords: string[]): string[] {
    const baseQueries = [
      `${topic} trends 2024`,
      `${topic} best practices`,
      `${topic} industry insights`,
      `${topic} guide`,
      `${topic} tips`,
      `${topic} strategies`,
      `${topic} examples`
    ];
    
    // Add keyword-specific queries
    const keywordQueries = keywords.map(keyword => `${topic} ${keyword}`);
    
    return [...baseQueries, ...keywordQueries].slice(0, 10); // Limit to 10 queries
  }

  // Parallel search execution
  private async parallelSearch(queries: string[], workspaceId: string = '', userId: string = ''): Promise<any[]> {
    console.log(`Executing ${queries.length} parallel searches...`);
    console.log('Search queries:', queries);
    
    try {
      const searchPromises = queries.map(query => 
        this.searchSerpAPI(query, 3, workspaceId, userId)
      );
      
      const results = await Promise.all(searchPromises);
      const allResults = results.flat().filter(result => result && result.link);
      
      console.log(`Search completed: ${allResults.length} total results found`);
      return allResults;
      
    } catch (error) {
      console.error('Parallel search failed:', error);
      return [];
    }
  }

  // Summarize search results
  private async summarizeResults(results: any[], topic: string): Promise<ResearchSummary[]> {
    console.log(`Summarizing ${results.length} search results...`);
    
    try {
      const summaryPromises = results.slice(0, 8).map(result => 
        this.summarizeWithAttribution(result, topic)
      );
      
      const summaries = await Promise.all(summaryPromises);
      const validSummaries = summaries.filter(summary => summary !== null);
      
      // Sort by relevance score
      validSummaries.sort((a, b) => b.relevance_score - a.relevance_score);
      
      console.log(`Summarization completed: ${validSummaries.length} summaries generated`);
      return validSummaries;
      
    } catch (error) {
      console.error('Summarization failed:', error);
      return [];
    }
  }

  // Summarize individual result with attribution
  private async summarizeWithAttribution(result: any, topic: string): Promise<ResearchSummary | null> {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `You are a senior content strategist and research analyst. Extract the most valuable insights from the provided search result and create a comprehensive, well-attributed summary.

CONTEXT:
- Topic: ${topic}
- Source: ${result.title || 'Unknown'}
- URL: ${result.link}
- Snippet: ${result.snippet || 'No snippet available'}

INSTRUCTIONS:
1. Identify the 3-5 most valuable insights related to ${topic}
2. Extract specific data points, statistics, or expert quotes with proper attribution
3. Note any actionable strategies, tips, or recommendations
4. Ensure all insights are properly cited to maintain credibility
5. Focus on recent trends, best practices, and industry developments
6. Rate the relevance of this source to the topic (0-100)

REQUIRED OUTPUT FORMAT (valid JSON only):
{
  "title": "Concise title summarizing the main insight",
  "url": "${result.link}",
  "key_points": [
    "Specific insight with attribution (e.g., 'According to [Source], 67% of marketers...')",
    "Another key point with proper citation",
    "Third insight with attribution"
  ],
  "expert_quotes": [
    "Any relevant expert quotes from the content with speaker attribution"
  ],
  "data_points": [
    "Specific statistics or data mentioned with source attribution"
  ],
  "relevance_score": 85,
  "source_authority": "high|medium|low"
}

Focus on extracting insights that would be valuable for creating high-quality, authoritative content about ${topic}. Ensure all information is properly attributed to maintain credibility and avoid plagiarism.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1200,
      });

      const result = response.choices[0]?.message?.content;
      if (result) {
        try {
          const cleanedResult = this.cleanJSONResponse(result);
          const summary = JSON.parse(cleanedResult);
          
          return {
            title: summary.title,
            url: summary.url,
            key_points: summary.key_points || [],
            expert_quotes: summary.expert_quotes || [],
            data_points: summary.data_points || [],
            relevance_score: summary.relevance_score || 80,
            source_authority: summary.source_authority || 'medium',
            publication_date: new Date().toISOString().split('T')[0]
          };
        } catch (parseError) {
          console.log('Failed to parse summary JSON:', parseError);
          return null;
        }
      }
    } catch (error) {
      console.error('Summarization failed:', error);
    }
    
    return null;
  }

  // Caching methods
  private generateCacheKey(topic: string, keywords: string[]): string {
    const normalizedTopic = topic.toLowerCase().trim();
    const normalizedKeywords = keywords.map(k => k.toLowerCase().trim()).sort().join(',');
    return `${normalizedTopic}:${normalizedKeywords}`;
  }

  private getCachedResearch(cacheKey: string): ResearchSummary[] | null {
    const cached = this.researchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.summaries;
    }
    this.researchCache.delete(cacheKey);
    return null;
  }

  private cacheResearch(cacheKey: string, summaries: ResearchSummary[]): void {
    this.researchCache.set(cacheKey, {
      topic: cacheKey,
      summaries,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    });
  }

  // Utility methods
  private cleanJSONResponse(response: string): string {
    // Remove markdown code blocks if present
    let cleaned = response.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
    
    // Remove any leading/trailing whitespace
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
    
    return cleaned;
  }

  // SerpAPI search
  async searchSerpAPI(query: string, numResults: number = 3, workspaceId: string = '', userId: string = ''): Promise<any[]> {
    try {
      const url = `https://serpapi.com/search?q=${encodeURIComponent(query)}&api_key=${this.serpApiKey}&num=${numResults}&gl=us&hl=en`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        throw new Error(`SerpAPI error: ${data.error}`);
      }

      const organicResults = data.organic_results || [];
      
      // Track API usage (only if Supabase is available)
      try {
        await trackAPIUsage(workspaceId, userId, 'serpapi', query, organicResults.length);
      } catch (error) {
        // Silently fail if tracking is not available
        console.log('API usage tracking not available');
      }

      return organicResults;
    } catch (error) {
      console.error('SerpAPI search failed:', error);
      return [];
    }
  }

  // Intelligent fallback research using OpenAI when real research fails
  private async handleResearchFailure(topic: string, error: any): Promise<ResearchSummary[]> {
    console.log('Research failed - no fallback to mock data allowed');
    console.error('Research failure details:', error);
    
    // Return empty array - no mock data should ever be generated
    // The content generation will proceed with general knowledge instead
    return [];
  }

  // Remove the basic template fallback - no mock data allowed
  // private createBasicFallbackResearch(topic: string): ResearchSummary[] {
  //   This method has been removed to prevent mock data generation
  // }
} 