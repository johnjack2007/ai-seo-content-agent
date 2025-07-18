import { OpenAI } from 'openai';

export type SafetyLevel = 'SAFE' | 'UNSAFE';
export type IntentType = 'BLOG_GENERATION' | 'BLOG_IDEATION' | 'OUT_OF_SCOPE';

interface ValidationResult {
  isValid: boolean;
  intent: IntentType;
  safety: SafetyLevel;
  topic: string;
  confidence: number;
  error?: string;
  suggestions?: Array<{
    title: string;
    description: string;
    confidence: number;
  }>;
  needsClarification?: boolean;
}

export class ValidationAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async validateInput(userInput: string): Promise<ValidationResult> {
    console.log('Validating input:', userInput.substring(0, 100) + '...');
    
    try {
      const prompt = `You are a comprehensive content validation agent for a business blog generator. Analyze the user input and perform all validation checks in one pass.

USER INPUT: "${userInput}"

PERFORM THE FOLLOWING VALIDATION CHECKS:

1. INTENT CLASSIFICATION:
   - BLOG_GENERATION: User wants a blog post generated on a specific topic
   - BLOG_IDEATION: User is asking for blog ideas or brainstorming
   - OUT_OF_SCOPE: Anything unrelated to blog content creation

2. SAFETY ASSESSMENT:
   - SAFE: Business, marketing, technology, education, professional topics
   - UNSAFE: Political, religious, adult content, violence, conspiracy theories, personal attacks

3. TOPIC SPECIFICITY:
   - SPECIFIC: Clear, actionable topic (e.g., "AI in marketing", "sustainable business practices")
   - VAGUE: Needs clarification (e.g., "we help small businesses", "I run a tech company")

4. TOPIC EXTRACTION:
   - Extract the specific topic if the input is specific
   - Suggest 3 specific blog topics if the input is vague

RETURN ONLY A JSON OBJECT WITH THIS EXACT FORMAT:
{
  "intent": "BLOG_GENERATION|BLOG_IDEATION|OUT_OF_SCOPE",
  "safety": "SAFE|UNSAFE",
  "topicSpecificity": "SPECIFIC|VAGUE",
  "extractedTopic": "specific topic if not vague, otherwise null",
  "confidence": 0.95,
  "suggestions": [
    {
      "title": "How AI is Transforming Small Business Operations in 2025",
      "description": "Explore the latest AI tools and strategies that small businesses can use to automate processes and improve efficiency",
      "confidence": 0.9
    }
  ],
  "reason": "Brief explanation of validation results"
}

IMPORTANT GUIDELINES:
- Law enforcement, security, and protection topics are SAFE when discussed in professional context
- Be conservative - when in doubt, flag as UNSAFE
- Focus on business, marketing, technology, and professional topics
- If input is OUT_OF_SCOPE or UNSAFE, set isValid to false
- If input is VAGUE, provide helpful suggestions for clarification`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 800,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      const validation = this.parseValidationResult(result);
      
      // Determine if input is valid
      const isValid = validation.intent !== 'OUT_OF_SCOPE' && 
                     validation.safety === 'SAFE' && 
                     validation.topicSpecificity === 'SPECIFIC';

      // Generate error message if invalid
      let error: string | undefined;
      if (!isValid) {
        if (validation.intent === 'OUT_OF_SCOPE') {
          error = 'This request is outside the scope of blog content generation. Please provide a topic related to business, marketing, technology, or professional development.';
        } else if (validation.safety === 'UNSAFE') {
          error = '⚠️ This topic contains inappropriate content and cannot be processed. Please try a more neutral or business-relevant topic.';
        } else if (validation.topicSpecificity === 'VAGUE') {
          error = 'Your topic needs more specificity. Here are some suggestions to help you get started:';
        }
      }

      console.log(`Validation result: ${isValid ? 'VALID' : 'INVALID'} - Intent: ${validation.intent}, Safety: ${validation.safety}, Specificity: ${validation.topicSpecificity}`);

      return {
        isValid,
        intent: validation.intent,
        safety: validation.safety,
        topic: validation.extractedTopic || userInput,
        confidence: validation.confidence,
        error,
        suggestions: validation.suggestions,
        needsClarification: validation.topicSpecificity === 'VAGUE'
      };

    } catch (error) {
      console.error('Validation failed:', error);
      // Default to invalid if validation fails (conservative approach)
      return {
        isValid: false,
        intent: 'OUT_OF_SCOPE',
        safety: 'UNSAFE',
        topic: userInput,
        confidence: 0.5,
        error: 'Validation failed, please try a different topic.'
      };
    }
  }

  private parseValidationResult(response: string): any {
    try {
      // Clean the response and extract JSON
      const cleaned = response
        .replace(/[\r\n\t\x00-\x1F\x7F-\x9F]/g, ' ')
        .replace(/\"/g, '"')
        .trim();
      
      // Try to extract JSON object
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Could not parse validation response');
      
    } catch (error) {
      console.error('Failed to parse validation result:', error);
      return {
        intent: 'OUT_OF_SCOPE',
        safety: 'UNSAFE',
        topicSpecificity: 'VAGUE',
        extractedTopic: null,
        confidence: 0.5,
        suggestions: [],
        reason: 'Parse error, defaulting to invalid'
      };
    }
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