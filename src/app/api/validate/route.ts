import { NextRequest, NextResponse } from 'next/server';
import { ValidationAgent } from '@/agents/ValidationAgent';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topic } = body;

    if (!topic) {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    console.log('Validating topic:', topic);

    const validationAgent = new ValidationAgent();
    const validation = await validationAgent.validateInput(topic);

    return NextResponse.json({
      isValid: validation.isValid,
      intent: validation.intent,
      safety: validation.safety,
      topic: validation.topic,
      confidence: validation.confidence,
      error: validation.error,
      suggestions: validation.suggestions,
      needsClarification: validation.needsClarification
    });

  } catch (error) {
    console.error('Validation failed:', error);
    return NextResponse.json({
      error: 'Validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 