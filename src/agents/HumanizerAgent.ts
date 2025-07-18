import { OpenAI } from 'openai';

interface HumanizationOptions {
  tone?: 'conversational' | 'professional' | 'casual' | 'authoritative';
  style?: 'blog' | 'article' | 'guide' | 'case-study';
  targetAudience?: string;
}

export class HumanizerAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Main humanization method with prompt chaining
  async humanizeContent(
    content: string,
    topic: string,
    options: HumanizationOptions = {}
  ): Promise<string> {
    console.log('Starting content humanization...');
    
    try {
      // Step 1: Analyze content for AI patterns
      const analysis = await this.analyzeAIPatterns(content);
      
      // Step 2: Apply humanization techniques
      const humanized = await this.applyHumanization(content, topic, analysis, options);
      
      // Step 3: Final polish and naturalization
      const polished = await this.finalPolish(humanized, topic, options);
      
      console.log('Content humanization completed');
      return polished;
      
    } catch (error) {
      console.error('Humanization failed:', error);
      return content; // Return original if humanization fails
    }
  }

  // Step 1: Analyze content for common AI patterns
  private async analyzeAIPatterns(content: string): Promise<any> {
    const prompt = `Analyze this content for AI-generated patterns that need humanization:

CONTENT:
${content.substring(0, 2000)}...

Identify:
1. Repetitive sentence structures
2. Overly formal language
3. Generic transitions
4. Lack of personal voice
5. Predictable paragraph patterns
6. Overuse of certain phrases

Return as JSON:
{
  "repetitive_patterns": ["pattern1", "pattern2"],
  "formal_language": ["phrase1", "phrase2"],
  "generic_transitions": ["transition1", "transition2"],
  "needs_personal_voice": true/false,
  "predictable_structures": ["structure1", "structure2"]
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('Failed to analyze AI patterns');
    
    try {
      return JSON.parse(result);
    } catch {
      return { needs_personal_voice: true };
    }
  }

  // Step 2: Apply humanization techniques
  private async applyHumanization(
    content: string,
    topic: string,
    analysis: any,
    options: HumanizationOptions
  ): Promise<string> {
    const tone = options.tone || 'conversational';
    const style = options.style || 'blog';
    
    const prompt = `You are a skilled human editor. Rewrite this AI-generated content to sound natural, personal, and engaging while maintaining accuracy and value.

ORIGINAL CONTENT:
${content}

ANALYSIS OF AI PATTERNS:
${JSON.stringify(analysis, null, 2)}

HUMANIZATION REQUIREMENTS:
- Tone: ${tone}
- Style: ${style}
- Topic: ${topic}
- Target Audience: ${options.targetAudience || 'general'}

HUMANIZATION TECHNIQUES TO APPLY:
1. Vary sentence structure and length
2. Use natural transitions and flow
3. Add personal insights and examples
4. Break up repetitive patterns
5. Use conversational language where appropriate
6. Include rhetorical questions and engagement
7. Add natural pauses and rhythm
8. Use specific, vivid language instead of generic terms

IMPORTANT GUIDELINES:
- Maintain all factual information and accuracy
- Keep the same structure and key points
- Make it sound like a human expert wrote it
- Avoid AI detection patterns
- Ensure readability and flow

Rewrite the content with these humanization techniques applied.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 4000,
    });

    return response.choices[0]?.message?.content || content;
  }

  // Step 3: Final polish for natural flow
  private async finalPolish(
    content: string,
    topic: string,
    options: HumanizationOptions
  ): Promise<string> {
    const prompt = `Perform a final polish on this humanized content to ensure it flows naturally and sounds completely human-written.

CONTENT TO POLISH:
${content}

POLISH REQUIREMENTS:
- Ensure natural paragraph transitions
- Check for consistent tone throughout
- Verify sentence variety and rhythm
- Add final touches for engagement
- Remove any remaining AI-like patterns
- Ensure professional quality

Make minimal but impactful changes to perfect the human voice and flow.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 4000,
    });

    return response.choices[0]?.message?.content || content;
  }

  // Utility method to check if content needs humanization
  async needsHumanization(content: string): Promise<boolean> {
    const prompt = `Quickly assess if this content needs humanization (sounds too AI-generated):

CONTENT SAMPLE:
${content.substring(0, 1000)}...

Return only "true" if it needs humanization, "false" if it already sounds human.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 10,
    });

    const result = response.choices[0]?.message?.content?.toLowerCase();
    return result?.includes('true') || false;
  }
} 