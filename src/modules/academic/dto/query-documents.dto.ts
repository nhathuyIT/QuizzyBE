import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Order } from '../../../common/enums/order.enum';
import type {
  AcademicDocumentFileType,
  AcademicDocumentStatus,
} from '../schemas/academic-document.schema';

export class QueryDocumentsDto {
  readonly order = Order.DESC;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = 20;

  @IsString()
  @IsOptional()
  keyword?: string;

  @IsIn(['pdf', 'docx', 'pptx', 'xlsx', 'other'])
  @IsOptional()
  fileType?: AcademicDocumentFileType;

  @IsIn(['pending', 'active', 'rejected', 'archived', 'all'])
  @IsOptional()
  status?: AcademicDocumentStatus | 'all';

  get skip(): number {
    return (this.page - 1) * this.limit;
  }

  get take(): number {
    return this.limit;
  }
}
