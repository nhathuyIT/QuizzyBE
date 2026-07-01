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

  async download(storagePath: string, fileUrl?: string): Promise<Buffer> {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL')?.trim();
    const serviceRoleKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
      this.configService.get<string>('SUPABASE_SECRET_KEY')?.trim() ||
      '';
    const bucket =
      this.configService.get<string>('SUPABASE_ACADEMIC_BUCKET')?.trim() ||
      DEFAULT_ACADEMIC_BUCKET;

    if (supabaseUrl && serviceRoleKey) {
      const objectUrl = this.buildObjectUrl(supabaseUrl, bucket, storagePath);

      return this.downloadUrl(objectUrl, storagePath, {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      });
    }

    if (fileUrl) {
      this.logger.warn(
        'SUPABASE_URL and server secret key are missing; falling back to stored public fileUrl',
      );

      return this.downloadUrl(fileUrl, storagePath);
    }

    throw new InternalServerErrorException(
      'Academic document storage is not configured',
    );
  }

  private async downloadUrl(
    url: string,
    storagePath: string,
    headers?: Record<string, string>,
  ): Promise<Buffer> {
    if (!this.isHttpUrl(url)) {
      throw new InternalServerErrorException(
        'Academic document storage URL is not configured correctly',
      );
    }

    let response: Response;

    try {
      response = await fetch(url, { headers });
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

  private isHttpUrl(url: string) {
    try {
      const parsedUrl = new URL(url);

      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
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
