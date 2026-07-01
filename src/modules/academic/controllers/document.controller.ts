import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators';
import type { CurrentUserPayload } from '../../../common/decorators';
import { JwtAuthGuard } from '../../../common/guards/jwt.guard';
import { ParseMongoIdPipe } from '../../../common/pipes/parse-mongo-id.pipe';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { QueryDocumentsDto } from '../dto/query-documents.dto';
import { DocumentService } from '../services/document.service';

@Controller('v1/academic')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Get('subjects/:subjectId/documents')
  findBySubject(
    @Param('subjectId', new ParseMongoIdPipe()) subjectId: string,
    @Query() query: QueryDocumentsDto,
  ) {
    return this.documentService.findBySubject(subjectId, query);
  }

  @Get('documents/my')
  @UseGuards(JwtAuthGuard)
  findMyDocuments(
    @Query() query: QueryDocumentsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.documentService.findMyDocuments(user.id, query);
  }

  @Post('documents')
  @UseGuards(JwtAuthGuard)
  create(
    @Body() createDocumentDto: CreateDocumentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.documentService.create(createDocumentDto, user.id);
  }

  @Delete('documents/:id')
  @UseGuards(JwtAuthGuard)
  delete(
    @Param('id', new ParseMongoIdPipe()) documentId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.documentService.softDelete(documentId, user);
  }

  @Patch('documents/:id/download-count')
  incrementDownloadCount(
    @Param('id', new ParseMongoIdPipe()) documentId: string,
  ) {
    return this.documentService.incrementDownloadCount(documentId);
  }
}
