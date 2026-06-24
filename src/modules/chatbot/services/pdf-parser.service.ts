import { BadRequestException, Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class PdfParserService {
  async extractText(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      const text = result.text.trim();

      if (text.length < 50) {
        throw new BadRequestException(
          'PDF does not contain enough readable text',
        );
      }

      return text;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        'Could not read this PDF. The file may be corrupted or password protected',
      );
    } finally {
      await parser.destroy();
    }
  }
}
