import OpenAI from 'openai';
import { trackAPIUsage } from './supabase';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface OpenAIResponse {
  content: string;
  tokens_used: number;
  cost_cents: number;
}

export interface GenerationOptions {
  model?: 'gpt-4o' | 'gpt-4' | 'gpt-3.5-turbo';
  max_tokens?: number;
  temperature?: number;
  workspace_id: string;
  user_id: string;
}

// Token pricing per 1K tokens (in cents)
const TOKEN_PRICING = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4': { input: 3, output: 6 },
  'gpt-3.5-turbo': { input: 0.15, output: 0.2 },
};

export class OpenAIService {
  private static instance: OpenAIService;
  private requestQueue: Array<() => Promise<any>> = [];
  private processing = false;
  private rateLimitDelay = 1000; // 1 second between requests

  static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  private async processQueue() {
    if (this.processing || this.requestQueue.length === 0) return;
    
    this.processing = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        try {
          await request();
          await this.delay(this.rateLimitDelay);
        } catch (error) {
          console.error('OpenAI request failed:', error);
        }
      }
    }
    
    this.processing = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing = TOKEN_PRICING[model as keyof typeof TOKEN_PRICING];
    if (!pricing) return 0;
    
    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;
    return Math.round((inputCost + outputCost) * 100); // Convert to cents
  }

  async generateContent(
    prompt: string,
    options: GenerationOptions
  ): Promise<OpenAIResponse> {
    const {
      model = 'gpt-4o',
      max_tokens = 2000,
      temperature = 0.7,
      workspace_id,
      user_id
    } = options;

    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const startTime = Date.now();
          
          const response = await openai.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens,
            temperature,
            stream: false,
          });

          const endTime = Date.now();
          const duration = endTime - startTime;

          const content = response.choices[0]?.message?.content || '';
          const inputTokens = response.usage?.prompt_tokens || 0;
          const outputTokens = response.usage?.completion_tokens || 0;
          const totalTokens = response.usage?.total_tokens || 0;
          const costCents = this.calculateCost(model, inputTokens, outputTokens);

          // Track API usage
          await trackAPIUsage(
            workspace_id,
            user_id,
            'openai',
            'chat.completions',
            totalTokens,
            costCents,
            true
          );

          resolve({
            content,
            tokens_used: totalTokens,
            cost_cents: costCents,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Track failed API usage
          await trackAPIUsage(
            workspace_id,
            user_id,
            'openai',
            'chat.completions',
            0,
            0,
            false,
            errorMessage
          );

          reject(error);
        }
      });

      this.processQueue();
    });
  }

  async generateContentStream(
    prompt: string,
    options: GenerationOptions,
    onChunk: (chunk: string) => void
  ): Promise<OpenAIResponse> {
    const {
      model = 'gpt-4o',
      max_tokens = 2000,
      temperature = 0.7,
      workspace_id,
      user_id
    } = options;

    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const startTime = Date.now();
          let fullContent = '';
          let inputTokens = 0;
          let outputTokens = 0;

          const stream = await openai.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens,
            temperature,
            stream: true,
          });

          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            fullContent += content;
            onChunk(content);

            // Update token counts if available
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens || inputTokens;
              outputTokens = chunk.usage.completion_tokens || outputTokens;
            }
          }

          const endTime = Date.now();
          const totalTokens = inputTokens + outputTokens;
          const costCents = this.calculateCost(model, inputTokens, outputTokens);

          // Track API usage
          await trackAPIUsage(
            workspace_id,
            user_id,
            'openai',
            'chat.completions.stream',
            totalTokens,
            costCents,
            true
          );

          resolve({
            content: fullContent,
            tokens_used: totalTokens,
            cost_cents: costCents,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Track failed API usage
          await trackAPIUsage(
            workspace_id,
            user_id,
            'openai',
            'chat.completions.stream',
            0,
            0,
            false,
            errorMessage
          );

          reject(error);
        }
      });

      this.processQueue();
    });
  }

  async summarizeText(
    text: string,
    options: GenerationOptions
  ): Promise<OpenAIResponse> {
    const prompt = `Please provide a concise summary of the following text, highlighting the key points and main ideas:

${text}

Summary:`;

    return this.generateContent(prompt, {
      ...options,
      max_tokens: 500,
      temperature: 0.3,
    });
  }

  async extractKeywords(
    text: string,
    options: GenerationOptions
  ): Promise<OpenAIResponse> {
    const prompt = `Please extract the most relevant keywords and key phrases from the following text. Return them as a comma-separated list:

${text}

Keywords:`;

    return this.generateContent(prompt, {
      ...options,
      max_tokens: 200,
      temperature: 0.1,
    });
  }

  async improveSEO(
    content: string,
    targetKeywords: string[],
    options: GenerationOptions
  ): Promise<OpenAIResponse> {
    const prompt = `Please improve the SEO of the following content by incorporating the target keywords naturally. Maintain readability and flow while optimizing for search engines.

Target Keywords: ${targetKeywords.join(', ')}

Content:
${content}

Improved content:`;

    return this.generateContent(prompt, {
      ...options,
      max_tokens: Math.min(content.length * 2, 4000),
      temperature: 0.5,
    });
  }

  async generateMetaDescription(
    content: string,
    options: GenerationOptions
  ): Promise<OpenAIResponse> {
    const prompt = `Please write a compelling meta description for the following content. Keep it under 160 characters and include relevant keywords naturally:

${content}

Meta Description:`;

    return this.generateContent(prompt, {
      ...options,
      max_tokens: 100,
      temperature: 0.7,
    });
  }
}

export const openAIService = OpenAIService.getInstance(); 