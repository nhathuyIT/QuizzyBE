import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { QueryDocumentsDto } from '../dto/query-documents.dto';
import {
  AcademicDocument,
  AcademicDocumentDoc,
} from '../schemas/academic-document.schema';

type DocumentFilter = Record<string, unknown>;

@Injectable()
export class DocumentRepository {
  constructor(
    @InjectModel(AcademicDocument.name)
    private readonly documentModel: Model<AcademicDocumentDoc>,
  ) {}

  async create(
    createDocumentDto: CreateDocumentDto,
    userId: string,
  ): Promise<AcademicDocumentDoc> {
    return this.documentModel.create({
      ...createDocumentDto,
      subjectId: new Types.ObjectId(createDocumentDto.subjectId),
      uploadedBy: new Types.ObjectId(userId),
      tags: createDocumentDto.tags ?? [],
    });
  }

  async findById(id: string): Promise<AcademicDocumentDoc | null> {
    return this.documentModel.findById(id).exec();
  }

  async findBySubject(
    subjectId: string,
    query: QueryDocumentsDto,
  ): Promise<[AcademicDocumentDoc[], number]> {
    const filter = this.buildDocumentFilter(query, {
      subjectId: new Types.ObjectId(subjectId),
      status: 'active',
    });

    return this.findPaginated(filter, query);
  }

  async findByUploader(
    userId: string,
    query: QueryDocumentsDto,
  ): Promise<[AcademicDocumentDoc[], number]> {
    const filter = this.buildDocumentFilter(query, {
      uploadedBy: new Types.ObjectId(userId),
    });

    if (!query.status) {
      filter.status = { $ne: 'archived' };
    }

    return this.findPaginated(filter, query);
  }

  async archive(id: string): Promise<AcademicDocumentDoc | null> {
    return this.documentModel
      .findByIdAndUpdate(id, { status: 'archived' }, { new: true })
      .exec();
  }

  async incrementDownloadCount(
    id: string,
  ): Promise<AcademicDocumentDoc | null> {
    return this.documentModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), status: 'active' },
        { $inc: { downloadCount: 1 } },
        { new: true },
      )
      .exec();
  }

  private async findPaginated(
    filter: DocumentFilter,
    query: QueryDocumentsDto,
  ): Promise<[AcademicDocumentDoc[], number]> {
    const documentsQuery = this.documentModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(query.skip)
      .limit(query.take);

    return Promise.all([
      documentsQuery.exec(),
      this.documentModel.countDocuments(filter).exec(),
    ]);
  }

  private buildDocumentFilter(
    query: QueryDocumentsDto,
    baseFilter: DocumentFilter,
  ): DocumentFilter {
    const filter: DocumentFilter = { ...baseFilter };

    if (query.fileType) {
      filter.fileType = query.fileType;
    }

    if (!('status' in baseFilter) && query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    if (query.keyword?.trim()) {
      const keyword = this.escapeRegex(query.keyword.trim());
      const keywordRegex = new RegExp(keyword, 'i');
      filter.$or = [
        { title: keywordRegex },
        { description: keywordRegex },
        { fileName: keywordRegex },
        { tags: keywordRegex },
      ];
    }

    return filter;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
