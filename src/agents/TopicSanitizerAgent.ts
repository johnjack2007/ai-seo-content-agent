import { OpenAI } from 'openai';

export type SafetyLevel = 'SAFE' | 'UNSAFE';

interface SafetyClassification {
  safety: SafetyLevel;
  confidence: number;
  reason?: string;
  flaggedCategories?: string[];
}

export class TopicSanitizerAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async sanitizeTopic(topic: string): Promise<SafetyClassification> {
    console.log('Sanitizing topic:', topic.substring(0, 100) + '...');
    
    try {
      const prompt = `You are a topic safety filter for a business blog content generator. Your job is to classify topics as SAFE or UNSAFE.

SAFE topics include:
- Business, marketing, technology, education
- Industry trends, professional development
- Product reviews, how-to guides
- Company news, case studies
- Neutral educational content
- Law enforcement and security (professional context only)
- Private security and protection services
- Professional training and certification
- Workplace safety and security
- Career development in security fields

UNSAFE topics include:
- Political content, elections, government policy
- Religious content, spiritual beliefs
- Adult content, NSFW material
- Violence, weapons, hate speech (outside professional context)
- Personal attacks, defamation
- Conspiracy theories, misinformation
- Personally identifiable information
- Controversial social issues (abortion, gun rights advocacy, etc.)
- Medical advice, legal advice
- Financial advice (investment recommendations)
- Weapons advocacy or promotion (outside professional/educational context)

Topic: "${topic}"

Return ONLY a JSON object with this exact format:
{
  "safety": "SAFE|UNSAFE",
  "confidence": 0.95,
  "reason": "Brief explanation",
  "flaggedCategories": ["category1", "category2"] // Only if UNSAFE
}

IMPORTANT: Law enforcement, security, and protection topics are SAFE when discussed in a professional, educational, or business context. Only flag as UNSAFE if the content promotes violence, illegal activities, or controversial advocacy outside professional contexts.

Be conservative - when in doubt, flag as UNSAFE.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      const classification = this.parseSafetyClassification(result);
      
      console.log(`Topic safety: ${classification.safety} (confidence: ${classification.confidence})`);
      return classification;
      
    } catch (error) {
      console.error('Topic sanitization failed:', error);
      // Default to UNSAFE if sanitization fails (conservative approach)
      return {
        safety: 'UNSAFE',
        confidence: 0.5,
        reason: 'Sanitization failed, defaulting to unsafe',
        flaggedCategories: ['unknown']
      };
    }
  }

  private parseSafetyClassification(response: string): SafetyClassification {
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
          safety: parsed.safety as SafetyLevel,
          confidence: parsed.confidence || 0.8,
          reason: parsed.reason,
          flaggedCategories: parsed.flaggedCategories || []
        };
      }
      
      // Fallback: try to extract safety from text
      const safetyMatch = cleaned.match(/"(SAFE|UNSAFE)"/);
      if (safetyMatch) {
        return {
          safety: safetyMatch[1] as SafetyLevel,
          confidence: 0.7,
          reason: 'Extracted from text response',
          flaggedCategories: safetyMatch[1] === 'UNSAFE' ? ['unknown'] : []
        };
      }
      
      throw new Error('Could not parse safety classification response');
      
    } catch (error) {
      console.error('Failed to parse safety classification:', error);
      return {
        safety: 'UNSAFE',
        confidence: 0.5,
        reason: 'Parse error, defaulting to unsafe',
        flaggedCategories: ['parse_error']
      };
    }
  }

  // Helper method to get user-friendly error message
  getErrorMessage(classification: SafetyClassification): string {
    if (classification.safety === 'SAFE') {
      return ''; // No error, proceed with content generation
    }

    const categories = classification.flaggedCategories?.join(', ') || 'inappropriate content';
    return `⚠️ This topic isn't appropriate for blog generation in this workspace. The content was flagged as: ${categories}. Please try a more neutral or business-relevant topic.`;
  }

  // Quick check for obviously unsafe topics (for performance)
  isObviouslyUnsafe(topic: string): boolean {
    const unsafeKeywords = [
      'politics', 'political', 'election', 'vote', 'democrat', 'republican',
      'religion', 'religious', 'god', 'jesus', 'allah', 'buddha',
      'porn', 'sex', 'adult', 'nsfw', 'nude', 'naked',
      'violence', 'bomb', 'kill', 'murder',
      'conspiracy', 'qanon', 'flat earth', 'anti-vax',
      'abortion', 'pro-life', 'pro-choice',
      'investment advice', 'financial advice', 'legal advice', 'medical advice'
    ];

    // More nuanced check for weapons - allow legitimate professional contexts
    const weaponKeywords = ['gun', 'weapon', 'firearm'];
    const professionalContexts = [
      'law enforcement', 'police', 'cop', 'officer', 'security', 'private security',
      'off duty', 'contractor', 'professional', 'training', 'certification',
      'safety', 'protection', 'defense', 'military', 'veteran'
    ];

    const lowerTopic = topic.toLowerCase();
    
    // Check for obviously unsafe keywords
    if (unsafeKeywords.some(keyword => lowerTopic.includes(keyword))) {
      return true;
    }
    
    // Check for weapon keywords - only flag if not in professional context
    if (weaponKeywords.some(keyword => lowerTopic.includes(keyword))) {
      // Allow if topic contains professional context keywords
      if (professionalContexts.some(context => lowerTopic.includes(context))) {
        return false; // Safe in professional context
      }
      return true; // Unsafe if no professional context
    }
    
    return false; // Safe by default
  }
} 