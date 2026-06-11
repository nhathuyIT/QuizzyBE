import { Injectable } from '@nestjs/common';
import { CardDocument } from '../../card/schemas/card.schema';
import { StudyItem, StudyMode } from '../interface/study.interface';

@Injectable()
export class StudyItemsBuilder {
  build(mode: StudyMode, cards: CardDocument[]): StudyItem[] {
    switch (mode) {
      case 'flashcard':
        return this.buildFlashcardItems(cards);
      case 'learn':
        return this.buildLearnItems(cards);
      case 'test':
        return this.buildTestItems(cards);
      case 'match':
        return this.buildMatchItems(cards);
      default:
        return this.buildFlashcardItems(cards);
    }
  }

  private buildFlashcardItems(cards: CardDocument[]): StudyItem[] {
    return cards.map((card) => ({
      cardId: this.getDocumentId(card),
      type: 'flashcard',
      front: card.front,
      back: card.back,
      hint: card.hint,
      explanation: card.explanation,
      imageUrl: card.imageUrl,
    }));
  }

  private buildLearnItems(cards: CardDocument[]): StudyItem[] {
    return cards.map((card) => ({
      cardId: this.getDocumentId(card),
      type: 'written',
      prompt: card.front,
      hint: card.hint,
    }));
  }

  private buildTestItems(cards: CardDocument[]): StudyItem[] {
    return cards.map((card, index) => {
      const type = index % 2 === 0 ? 'written' : 'multiple_choice';

      return {
        cardId: this.getDocumentId(card),
        questionId: this.getDocumentId(card),
        type,
        prompt: card.front,
        options:
          type === 'multiple_choice'
            ? this.buildMultipleChoiceOptions(cards, card)
            : undefined,
      };
    });
  }

  private buildMatchItems(cards: CardDocument[]): StudyItem[] {
    const fronts = cards.map((card) => ({
      tileId: `${this.getDocumentId(card)}:front`,
      cardId: this.getDocumentId(card),
      side: 'front' as const,
      text: card.front,
    }));

    const backs = cards.map((card) => ({
      tileId: `${this.getDocumentId(card)}:back`,
      cardId: this.getDocumentId(card),
      side: 'back' as const,
      text: card.back,
    }));

    return this.shuffle([...fronts, ...backs]);
  }

  private buildMultipleChoiceOptions(
    cards: CardDocument[],
    currentCard: CardDocument,
  ) {
    const currentCardId = this.getDocumentId(currentCard);
    const wrongAnswers = cards
      .filter((card) => this.getDocumentId(card) !== currentCardId)
      .slice(0, 3)
      .map((card) => card.back);

    return this.shuffle([currentCard.back, ...wrongAnswers]).map((answer) => ({
      value: answer,
      label: answer,
    }));
  }

  private shuffle<T>(items: T[]): T[] {
    return [...items].sort(() => Math.random() - 0.5);
  }

  private getDocumentId(document: { _id: unknown }) {
    return String(document._id);
  }
}
