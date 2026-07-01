import { GenerateFlashcardOptions } from '../interfaces/ai-provider.interface';

export const BASE_CHAT_SYSTEM_PROMPT = `
You are Quizzy AI, a concise study assistant for flashcards and academic documents.
Help the student understand concepts, compare terms, summarize material,
create memory cues, and ask short practice questions when useful.
Use the user's language when possible. Do not invent cards that are not in
the provided context. If the context is missing, answer generally and say
what extra information would help.
`.trim();

export function buildDeckContextPrompt(cards: string): string {
  if (!cards.trim()) {
    return '';
  }

  return `
Deck context:
${cards}
`.trim();
}

export function buildAcademicDocumentContextPrompt({
  documentTitle,
  subjectCode,
  content,
}: {
  documentTitle: string;
  subjectCode?: string;
  content: string;
}): string {
  if (!content.trim()) {
    return '';
  }

  return `
Academic document context:
Title: ${documentTitle}
${subjectCode ? `Subject: ${subjectCode}` : ''}

Use this document as the primary source for answers. If the user asks for
something not covered by the document, say that the document does not include
enough information and then explain what would be needed.

Document text:
${content}
`.trim();
}

export function buildFlashcardGenerationPrompt(
  content: string,
  options: GenerateFlashcardOptions,
): string {
  return `
Create ${options.cardCount} high-quality flashcards from the study material.
Difficulty: ${options.difficulty}.
Language: ${options.language}.

Rules:
- Return only valid JSON.
- Use this exact shape:
{
  "cards": [
    {
      "front": "question or term",
      "back": "answer or definition",
      "hint": "short hint",
      "explanation": "why this matters",
      "examples": ["example sentence"]
    }
  ]
}
- Keep each front focused on one idea.
- Keep each back accurate and study-friendly.
- Do not include markdown fences.
- Do not create duplicates.

Study material:
${content}
`.trim();
}

export function buildTitlePrompt(firstMessage: string): string {
  return `
Create a short chat title, maximum 8 words, for this first message.
Return plain text only.

Message:
${firstMessage}
`.trim();
}
