import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GenerateContentResult,
  GenerativeModel,
  GoogleGenerativeAI,
} from '@google/generative-ai';
import {
  buildFlashcardGenerationPrompt,
  buildTitlePrompt,
} from '../constants/prompts';
import {
  AiChatMessage,
  AiChatResponse,
  AiPdfDocument,
  GeneratedFlashcard,
  GenerateFlashcardOptions,
  GenerateFlashcardsResult,
  IAiProvider,
} from '../interfaces/ai-provider.interface';

interface GeminiFlashcardsPayload {
  cards?: unknown;
}

@Injectable()
export class GeminiProvider implements IAiProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly model?: GenerativeModel;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    const modelName =
      this.configService.get<string>('GEMINI_MODEL')?.trim() ||
      'gemini-2.0-flash';

    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not configured');
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: modelName });
  }

  async chat(
    systemPrompt: string,
    history: AiChatMessage[],
    userMessage: string,
  ): Promise<AiChatResponse> {
    const model = this.getModel();
    const chat = model.startChat({
      history: history.map((message) => ({
        role: message.role,
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1200,
      },
    });

    const result = await chat.sendMessage(
      `${systemPrompt}\n\nUser message:\n${userMessage}`,
    );
    const response = result.response;

    return {
      content: response.text(),
      inputTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
    };
  }

  async chatWithPdf(
    systemPrompt: string,
    history: AiChatMessage[],
    userMessage: string,
    document: AiPdfDocument,
  ): Promise<AiChatResponse> {
    const model = this.getModel();
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: [
                systemPrompt,
                this.formatHistoryForPrompt(history),
                `User message:\n${userMessage}`,
              ]
                .filter(Boolean)
                .join('\n\n'),
            },
            {
              inlineData: {
                mimeType: document.mimeType,
                data: document.data.toString('base64'),
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 1200,
      },
    });
    const response = result.response;

    return {
      content: response.text(),
      inputTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
    };
  }

  async generateFlashcards(
    content: string,
    options: GenerateFlashcardOptions,
  ): Promise<GenerateFlashcardsResult> {
    const model = this.getModel();
    const prompt = buildFlashcardGenerationPrompt(content, options);
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    });
    const response = result.response;
    const cards = this.parseFlashcardsResponse(response.text());

    return {
      cards: cards.slice(0, options.cardCount),
      inputTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
    };
  }

  async generateTitle(firstMessage: string): Promise<string> {
    const model = this.getModel();
    const result: GenerateContentResult = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: buildTitlePrompt(firstMessage.slice(0, 1000)) }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 60,
      },
    });

    return this.cleanTitle(result.response.text());
  }

  private getModel(): GenerativeModel {
    if (!this.model) {
      throw new Error('Gemini API is not configured');
    }

    return this.model;
  }

  private formatHistoryForPrompt(history: AiChatMessage[]): string {
    if (!history.length) {
      return '';
    }

    return [
      'Conversation so far:',
      ...history.map((message) => {
        const speaker = message.role === 'model' ? 'Assistant' : 'User';

        return `${speaker}: ${message.content}`;
      }),
    ].join('\n');
  }

  private parseFlashcardsResponse(rawText: string): GeneratedFlashcard[] {
    const jsonText = this.extractJson(rawText);
    let payload: GeminiFlashcardsPayload;

    try {
      payload = JSON.parse(jsonText) as GeminiFlashcardsPayload;
    } catch (error) {
      this.logger.error(`Failed to parse Gemini JSON response: ${jsonText}`);
      throw new Error('AI returned invalid flashcard data');
    }

    if (!Array.isArray(payload.cards)) {
      throw new Error('AI returned no flashcards');
    }

    const cards = payload.cards
      .map((card) => this.normalizeCard(card))
      .filter((card): card is GeneratedFlashcard => Boolean(card));

    if (!cards.length) {
      throw new Error('AI returned empty flashcards');
    }

    return cards;
  }

  private extractJson(rawText: string): string {
    const trimmed = rawText.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

    if (fenced?.[1]) {
      return fenced[1].trim();
    }

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');

    if (start >= 0 && end > start) {
      return trimmed.slice(start, end + 1);
    }

    return trimmed;
  }

  private normalizeCard(card: unknown): GeneratedFlashcard | null {
    if (!card || typeof card !== 'object') {
      return null;
    }

    const value = card as Record<string, unknown>;
    const front = this.toCleanString(value.front);
    const back = this.toCleanString(value.back);

    if (!front || !back) {
      return null;
    }

    return {
      front,
      back,
      hint: this.toCleanString(value.hint),
      explanation: this.toCleanString(value.explanation),
      examples: Array.isArray(value.examples)
        ? value.examples
            .map((example) => this.toCleanString(example))
            .filter((example): example is string => Boolean(example))
        : [],
    };
  }

  private toCleanString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const cleaned = value.replace(/<[^>]*>/g, '').trim();
    return cleaned || undefined;
  }

  private cleanTitle(title: string): string {
    const cleaned = title
      .replace(/<[^>]*>/g, '')
      .replace(/^["']|["']$/g, '')
      .trim();

    return cleaned.slice(0, 200) || 'New conversation';
  }
}
