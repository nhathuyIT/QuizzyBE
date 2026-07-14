import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PageDto } from '../../../common/dto/page.dto';
import { PageMetaDto } from '../../../common/dto/page-meta.dto';
import { CurrentUserPayload } from '../../../common/decorators';
import { RoleType } from '../../../common/enums/role-type.enum';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { QueryDocumentsDto } from '../dto/query-documents.dto';
import { DocumentRepository } from '../repositories/document.repository';
import { SubjectRepository } from '../repositories/subject.repository';
import {
  AcademicDocumentDoc,
  AcademicDocumentFileType,
} from '../schemas/academic-document.schema';
import { SubjectDocument } from '../schemas/subject.schema';

@Injectable()
export class DocumentService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly subjectRepository: SubjectRepository,
  ) {}

  async findBySubject(subjectId: string, query: QueryDocumentsDto) {
    await this.validateSubject(subjectId);

    const [documents, itemCount] = await this.documentRepository.findBySubject(
      subjectId,
      query,
    );
    const meta = new PageMetaDto({ pageOptionsDto: query, itemCount });

    return new PageDto(
      documents.map((document) => this.toResponse(document)),
      meta,
    );
  }

  async findMyDocuments(userId: string, query: QueryDocumentsDto) {
    const [documents, itemCount] = await this.documentRepository.findByUploader(
      userId,
      query,
    );
    const meta = new PageMetaDto({ pageOptionsDto: query, itemCount });

    return new PageDto(
      documents.map((document) => this.toResponse(document)),
      meta,
    );
  }

  async findActiveDocumentForGeneration(
    documentId: string,
  ): Promise<{ document: AcademicDocumentDoc; subject: SubjectDocument }> {
    const document = await this.documentRepository.findById(documentId);

    if (!document || document.status !== 'active') {
      throw new NotFoundException('Academic document not found');
    }

    const subject = await this.validateSubject(document.subjectId.toString());

    return { document, subject };
  }

  async create(createDocumentDto: CreateDocumentDto, userId: string) {
    await this.validateSubject(createDocumentDto.subjectId);
    this.assertValidFileMetadata(createDocumentDto);

    const document = await this.documentRepository.create(
      {
        ...createDocumentDto,
        tags: this.normalizeTags(createDocumentDto.tags),
      },
      userId,
    );

    return this.toResponse(document);
  }

  async softDelete(documentId: string, user: CurrentUserPayload) {
    const document = await this.documentRepository.findById(documentId);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const isOwner = document.uploadedBy.toString() === user.id;
    const isAdmin = user.role === RoleType.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to delete this document',
      );
    }

    if (document.status === 'archived') {
      return this.toResponse(document);
    }

    const archivedDocument = await this.documentRepository.archive(documentId);
    if (document.status === 'active') {
      await this.subjectRepository.incrementDocumentCount(
        document.subjectId.toString(),
        -1,
      );
    }

    return this.toResponse(archivedDocument ?? document);
  }

  async incrementDownloadCount(documentId: string) {
    const document =
      await this.documentRepository.incrementDownloadCount(documentId);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return this.toResponse(document);
  }

  private async validateSubject(subjectId: string) {
    const subject = await this.subjectRepository.findActiveById(subjectId);

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    return subject;
  }

  private assertValidFileMetadata(createDocumentDto: CreateDocumentDto) {
    this.assertHttpUrl(createDocumentDto.fileUrl);
    this.assertStoragePath(createDocumentDto.storagePath);
    this.assertFileNameMatchesType(
      createDocumentDto.fileName,
      createDocumentDto.fileType,
    );
  }

  private assertHttpUrl(fileUrl: string) {
    try {
      const parsedUrl = new URL(fileUrl);

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new BadRequestException('fileUrl must be an HTTP URL');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('fileUrl must be a valid URL');
    }
  }

  private assertStoragePath(storagePath: string) {
    if (
      !storagePath.startsWith('documents/') ||
      storagePath.includes('..') ||
      storagePath.includes('\\')
    ) {
      throw new BadRequestException(
        'storagePath must be under the documents/ folder',
      );
    }
  }

  private assertFileNameMatchesType(
    fileName: string,
    fileType: AcademicDocumentFileType,
  ) {
    if (fileType === 'other') {
      return;
    }

    const lowerFileName = fileName.toLowerCase();
    const extensionByType: Record<
      Exclude<AcademicDocumentFileType, 'other'>,
      string
    > = {
      pdf: '.pdf',
      docx: '.docx',
      pptx: '.pptx',
      xlsx: '.xlsx',
    };

    if (!lowerFileName.endsWith(extensionByType[fileType])) {
      throw new BadRequestException(
        'fileName extension does not match fileType',
      );
    }
  }

  private normalizeTags(tags: string[] | undefined) {
    if (!tags?.length) {
      return [];
    }

    return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
  }

  private toResponse(document: AcademicDocumentDoc) {
    const plain = document.toObject() as Record<string, unknown>;

    return {
      ...plain,
      _id: document._id.toString(),
      subjectId: document.subjectId.toString(),
      uploadedBy: document.uploadedBy.toString(),
      title: document.title,
      description: document.description,
      fileUrl: document.fileUrl,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize,
      storagePath: document.storagePath,
      status: document.status,
      reviewedBy: document.reviewedBy?.toString(),
      reviewedAt: document.reviewedAt,
      reviewNote: document.reviewNote,
      downloadCount: document.downloadCount,
      tags: document.tags,
      createdAt: plain.createdAt as Date,
      updatedAt: plain.updatedAt as Date,
    };
  }
}
