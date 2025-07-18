import { OpenAI } from 'openai';

export type IntentType = 'BLOG_GENERATION' | 'BLOG_IDEATION' | 'OUT_OF_SCOPE';

interface IntentClassification {
  intent: IntentType;
  confidence: number;
  reason?: string;
}

export class IntentClassifierAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async classifyIntent(userInput: string): Promise<IntentClassification> {
    console.log('Classifying user intent:', userInput.substring(0, 100) + '...');
    
    try {
      const prompt = `You are a content request classifier. Given a user input, classify it into one of the following categories:

1. BLOG_GENERATION — User wants a blog post generated on a specific topic (e.g., "Write a blog about AI in marketing", "Create content about sustainable business practices")
2. BLOG_IDEATION — User is asking for blog ideas or brainstorming (e.g., "Give me blog ideas for a tech company", "What should I write about for my fitness blog?")
3. OUT_OF_SCOPE — Anything unrelated to blog content creation (e.g., math problems, technical help, personal advice, general questions)

User Input: "${userInput}"

Analyze the intent and return ONLY a JSON object with this exact format:
{
  "intent": "BLOG_GENERATION|BLOG_IDEATION|OUT_OF_SCOPE",
  "confidence": 0.95,
  "reason": "Brief explanation of classification"
}

Focus on whether the user wants blog content created or blog ideas generated.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      const classification = this.parseClassification(result);
      
      console.log(`Intent classified as: ${classification.intent} (confidence: ${classification.confidence})`);
      return classification;
      
    } catch (error) {
      console.error('Intent classification failed:', error);
      // Default to OUT_OF_SCOPE if classification fails
      return {
        intent: 'OUT_OF_SCOPE',
        confidence: 0.5,
        reason: 'Classification failed, defaulting to out of scope'
      };
    }
  }

  private parseClassification(response: string): IntentClassification {
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
          intent: parsed.intent as IntentType,
          confidence: parsed.confidence || 0.8,
          reason: parsed.reason
        };
      }
      
      // Fallback: try to extract intent from text
      const intentMatch = cleaned.match(/"(BLOG_GENERATION|BLOG_IDEATION|OUT_OF_SCOPE)"/);
      if (intentMatch) {
        return {
          intent: intentMatch[1] as IntentType,
          confidence: 0.7,
          reason: 'Extracted from text response'
        };
      }
      
      throw new Error('Could not parse classification response');
      
    } catch (error) {
      console.error('Failed to parse classification:', error);
      return {
        intent: 'OUT_OF_SCOPE',
        confidence: 0.5,
        reason: 'Parse error, defaulting to out of scope'
      };
    }
  }

  // Helper method to get user-friendly error message
  getErrorMessage(intent: IntentType): string {
    switch (intent) {
      case 'OUT_OF_SCOPE':
        return "❌ This tool is designed to generate or brainstorm blog content only. Please rephrase your request in that context. For example: 'Write a blog about AI in marketing' or 'Give me blog ideas for a tech company'.";
      case 'BLOG_GENERATION':
      case 'BLOG_IDEATION':
        return ''; // No error, proceed with content generation
      default:
        return "❌ I'm not sure how to help with that request. This tool is specifically for blog content creation and ideation.";
    }
  }
} 