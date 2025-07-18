import { NextRequest, NextResponse } from 'next/server';
import { IntentClassifierAgent } from '@/agents/IntentClassifierAgent';
import { TopicSanitizerAgent } from '@/agents/TopicSanitizerAgent';
import { TopicIdentifierAgent } from '@/agents/TopicIdentifierAgent';

export async function POST(request: NextRequest) {
  try {
    const { topic, userInput } = await request.json();

    if (!topic && !userInput) {
      return NextResponse.json(
        { error: 'Missing required fields: topic or userInput' },
        { status: 400 }
      );
    }

    const input = topic || userInput;
    console.log('Validating input:', input.substring(0, 100) + '...');

    // Initialize validation agents
    const intentClassifier = new IntentClassifierAgent();
    const topicSanitizer = new TopicSanitizerAgent();
    const topicIdentifier = new TopicIdentifierAgent();

    // Step 1: Intent Classification
    console.log('Step 1: Classifying intent...');
    const intentResult = await intentClassifier.classifyIntent(input);
    
    if (intentResult.intent === 'OUT_OF_SCOPE') {
      return NextResponse.json({
        valid: false,
        error: intentClassifier.getErrorMessage(intentResult.intent),
        validationResults: {
          intent: intentResult,
          safety: null,
          topicIdentification: null
        }
      });
    }

    // Step 2: Topic Safety Check
    console.log('Step 2: Checking topic safety...');
    const safetyResult = await topicSanitizer.sanitizeTopic(input);
    
    if (safetyResult.safety === 'UNSAFE') {
      return NextResponse.json({
        valid: false,
        error: topicSanitizer.getErrorMessage(safetyResult),
        validationResults: {
          intent: intentResult,
          safety: safetyResult,
          topicIdentification: null
        }
      });
    }

    // Step 3: Topic Identification
    console.log('Step 3: Identifying topic...');
    const topicResult = await topicIdentifier.identifyTopic(input);

    // Determine final validation result
    const isValid = (intentResult.intent === 'BLOG_GENERATION' || intentResult.intent === 'BLOG_IDEATION') && 
                   safetyResult.safety === 'SAFE';

    const response: {
      valid: boolean;
      error: string | null;
      validationResults: {
        intent: any;
        safety: any;
        topicIdentification: any;
      };
      suggestions: any[] | null;
      extractedTopic: string;
    } = {
      valid: isValid,
      error: null,
      validationResults: {
        intent: intentResult,
        safety: safetyResult,
        topicIdentification: topicResult
      },
      suggestions: topicResult.isVague ? topicResult.suggestions : null,
      extractedTopic: topicResult.extractedTopic || input
    };

    // Add error message if topic is vague
    if (topicResult.isVague && topicResult.suggestions.length > 0) {
      response.error = topicIdentifier.getSuggestionsMessage(topicResult);
    }

    console.log('Validation completed:', { valid: isValid, intent: intentResult.intent, safety: safetyResult.safety });
    return NextResponse.json(response);

  } catch (error) {
    console.error('Validation failed:', error);
    return NextResponse.json(
      { 
        error: 'Validation failed: ' + (error as Error).message,
        valid: false 
      },
      { status: 500 }
    );
  }
} 