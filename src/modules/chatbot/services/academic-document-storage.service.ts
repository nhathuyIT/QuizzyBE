import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_ACADEMIC_BUCKET = 'academic-documents';

@Injectable()
export class AcademicDocumentStorageService {
  private readonly logger = new Logger(AcademicDocumentStorageService.name);

  constructor(private readonly configService: ConfigService) {}

  async download(storagePath: string): Promise<Buffer> {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL')?.trim();
    const serviceRoleKey = this.configService
      .get<string>('SUPABASE_SERVICE_ROLE_KEY')
      ?.trim();
    const bucket =
      this.configService.get<string>('SUPABASE_ACADEMIC_BUCKET')?.trim() ||
      DEFAULT_ACADEMIC_BUCKET;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new InternalServerErrorException(
        'Academic document storage is not configured',
      );
    }

    const objectUrl = this.buildObjectUrl(supabaseUrl, bucket, storagePath);
    let response: Response;

    try {
      response = await fetch(objectUrl, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown storage error';
      this.logger.error(`Academic storage download failed: ${message}`);
      throw new ServiceUnavailableException(
        'Could not connect to academic document storage',
      );
    }

    if (!response.ok) {
      this.logger.warn(
        `Academic storage returned ${response.status} for ${storagePath}`,
      );

      if (response.status === 404) {
        throw new NotFoundException(
          'Academic document file not found in storage',
        );
      }

      throw new BadRequestException(
        'Could not download academic document file',
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength === 0) {
      throw new BadRequestException('Academic document file is empty');
    }

    return Buffer.from(arrayBuffer);
  }

  private buildObjectUrl(
    supabaseUrl: string,
    bucket: string,
    storagePath: string,
  ) {
    const baseUrl = supabaseUrl.replace(/\/+$/, '');
    const encodedBucket = encodeURIComponent(bucket);
    const encodedPath = storagePath
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');

    return `${baseUrl}/storage/v1/object/${encodedBucket}/${encodedPath}`;
  }
}
