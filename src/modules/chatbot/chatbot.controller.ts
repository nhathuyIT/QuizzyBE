import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';
import { ChatbotService, UploadedPdfFile } from './chatbot.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { GenerateFlashcardsAcademicDocumentDto } from './dto/generate-flashcards-academic-document.dto';
import { GenerateFlashcardsPdfDto } from './dto/generate-flashcards-pdf.dto';
import { GenerateFlashcardsTextDto } from './dto/generate-flashcards-text.dto';
import { QueryConversationsDto } from './dto/query-conversations.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

@Controller('v1/chatbot')
export class ChatbotHelpController {
  @Get('generate/pdf')
  getGeneratePdfUsage() {
    return {
      message:
        'PDF flashcard generation is available. Send a POST request with multipart/form-data to use it.',
      method: 'POST',
      path: '/v1/chatbot/generate/pdf',
      auth: 'Bearer access token required',
      contentType: 'multipart/form-data',
      fields: {
        file: 'PDF file, required',
        title: 'Deck title, required',
        cardCount: 'Optional number from 5 to 30',
        difficulty: 'Optional: easy, medium, or hard',
        language: 'Optional output language',
        conversationId: 'Optional MongoDB conversation id',
      },
    };
  }
}

@Controller('v1/chatbot')
@UseGuards(JwtAuthGuard)
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('conversations')
  createConversation(
    @Body() createConversationDto: CreateConversationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.chatbotService.createConversation(
      createConversationDto,
      user.id,
    );
  }

  @Get('conversations')
  getConversations(
    @Query() query: QueryConversationsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.chatbotService.getConversations(query, user.id);
  }

  @Post('conversations/:id/messages')
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ generate: true })
  @Throttle({ chat: { ttl: 60000, limit: 15 } })
  sendMessage(
    @Param('id', new ParseMongoIdPipe()) conversationId: string,
    @Body() sendMessageDto: SendMessageDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.chatbotService.sendMessage(
      conversationId,
      sendMessageDto,
      user.id,
    );
  }

  @Get('conversations/:id/messages')
  getMessages(
    @Param('id', new ParseMongoIdPipe()) conversationId: string,
    @Query() query: QueryMessagesDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.chatbotService.getMessages(conversationId, query, user.id);
  }

  @Get('conversations/:id')
  getConversation(
    @Param('id', new ParseMongoIdPipe()) conversationId: string,
    @Query() query: QueryMessagesDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.chatbotService.getConversation(conversationId, query, user.id);
  }

  @Patch('conversations/:id')
  updateConversation(
    @Param('id', new ParseMongoIdPipe()) conversationId: string,
    @Body() updateConversationDto: UpdateConversationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.chatbotService.updateConversation(
      conversationId,
      updateConversationDto,
      user.id,
    );
  }

  @Delete('conversations/:id')
  deleteConversation(
    @Param('id', new ParseMongoIdPipe()) conversationId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.chatbotService.deleteConversation(conversationId, user.id);
  }

  @Post('generate/text')
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ chat: true })
  @Throttle({ generate: { ttl: 3600000, limit: 5 } })
  generateFromText(
    @Body() generateDto: GenerateFlashcardsTextDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.chatbotService.generateFlashcardsFromText(generateDto, user.id);
  }

  @Post('generate/pdf')
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ chat: true })
  @Throttle({ generate: { ttl: 3600000, limit: 5 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  generateFromPdf(
    @Body() generateDto: GenerateFlashcardsPdfDto,
    @UploadedFile() file: UploadedPdfFile | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.chatbotService.generateFlashcardsFromPdf(
      generateDto,
      file,
      user.id,
    );
  }

  @Post('generate/academic-document')
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ chat: true })
  @Throttle({ generate: { ttl: 3600000, limit: 5 } })
  generateFromAcademicDocument(
    @Body() generateDto: GenerateFlashcardsAcademicDocumentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.chatbotService.generateFlashcardsFromAcademicDocument(
      generateDto,
      user.id,
    );
  }

  @Get('generate/jobs/:id')
  getJobStatus(
    @Param('id', new ParseMongoIdPipe()) jobId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.chatbotService.getJobStatus(jobId, user.id);
  }
}
