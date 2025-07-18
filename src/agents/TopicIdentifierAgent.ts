import { OpenAI } from 'openai';

interface TopicSuggestion {
  title: string;
  description: string;
  confidence: number;
}

interface TopicIdentification {
  isVague: boolean;
  suggestions: TopicSuggestion[];
  extractedTopic?: string;
}

export class TopicIdentifierAgent {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async identifyTopic(userInput: string): Promise<TopicIdentification> {
    console.log('Identifying topic from input:', userInput.substring(0, 100) + '...');
    
    try {
      const prompt = `You are a topic identification agent for a blog content generator. Given a user input, determine if it's a specific topic or a vague description that needs clarification.

If the input is a SPECIFIC TOPIC (e.g., "AI in marketing", "sustainable business practices", "remote work tips"), extract the topic directly.

If the input is VAGUE (e.g., "we help small businesses", "I run a tech company", "we sell products"), suggest 3 specific blog topics.

User Input: "${userInput}"

Return ONLY a JSON object with this exact format:
{
  "isVague": true/false,
  "extractedTopic": "specific topic if not vague",
  "suggestions": [
    {
      "title": "How AI is Transforming Small Business Operations in 2025",
      "description": "Explore the latest AI tools and strategies that small businesses can use to automate processes and improve efficiency",
      "confidence": 0.9
    }
  ]
}

Focus on business, marketing, technology, and professional topics.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      const identification = this.parseTopicIdentification(result);
      
      console.log(`Topic identification: ${identification.isVague ? 'VAGUE' : 'SPECIFIC'}`);
      return identification;
      
    } catch (error) {
      console.error('Topic identification failed:', error);
      // Default to treating as specific topic if identification fails
      return {
        isVague: false,
        suggestions: [],
        extractedTopic: userInput
      };
    }
  }

  private parseTopicIdentification(response: string): TopicIdentification {
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
          isVague: parsed.isVague || false,
          suggestions: parsed.suggestions || [],
          extractedTopic: parsed.extractedTopic
        };
      }
      
      // Fallback: treat as specific topic
      return {
        isVague: false,
        suggestions: [],
        extractedTopic: 'Unknown topic'
      };
      
    } catch (error) {
      console.error('Failed to parse topic identification:', error);
      return {
        isVague: false,
        suggestions: [],
        extractedTopic: 'Parse error'
      };
    }
  }

  // Helper method to get user-friendly suggestions message
  getSuggestionsMessage(identification: TopicIdentification): string {
    if (!identification.isVague || identification.suggestions.length === 0) {
      return '';
    }

    const suggestionsList = identification.suggestions
      .map((suggestion, index) => `${index + 1}. **${suggestion.title}**\n   ${suggestion.description}`)
      .join('\n\n');

    return `💡 I found some great blog topics based on your description! Pick one or edit it to better match your needs:\n\n${suggestionsList}\n\nYou can also provide a more specific topic if none of these match your needs.`;
  }

  // Quick check for vague inputs (for performance)
  isObviouslyVague(input: string): boolean {
    const vaguePatterns = [
      /^we (help|serve|provide|offer)/i,
      /^i (run|own|manage) a/i,
      /^our (company|business|startup)/i,
      /^we (are|do|make|sell)/i,
      /^help me with/i,
      /^i need (ideas|suggestions|help)/i
    ];

    return vaguePatterns.some(pattern => pattern.test(input));
  }
} 