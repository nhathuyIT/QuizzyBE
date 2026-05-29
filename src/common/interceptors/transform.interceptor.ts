import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PageDto } from '../dto/page.dto';
import { PageMetaDto } from '../dto/page-meta.dto';
import { Types } from 'mongoose';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PageMetaDto;
}

interface ObjectWithToObject {
  toObject(): Record<string, unknown>;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T> | ApiResponse<T[]>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | ApiResponse<T[]>> {
    return next.handle().pipe(map((data) => this.transformResponse(data)));
  }

  private transformResponse(data: T): ApiResponse<T> | ApiResponse<T[]> {
    if (this.isApiResponse(data)) {
      return this.sanitize(data) as ApiResponse<T>;
    }

    if (this.isPageDto(data)) {
      return {
        success: true,
        data: this.sanitize(data.data) as T[],
        meta: data.meta,
      };
    }

    return {
      success: true,
      data: this.sanitize(data) as T,
    };
  }

  private isApiResponse(value: unknown): value is ApiResponse<T> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'success' in value &&
      'data' in value
    );
  }

  private isPageDto(value: unknown): value is PageDto<T> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'data' in value &&
      'meta' in value
    );
  }

  private sanitize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }
    if (value instanceof Types.ObjectId) {
      return value.toString();
    }
    if (value instanceof Date || value === null || typeof value !== 'object') {
      return value;
    }

    const plainValue = this.hasToObject(value) ? value.toObject() : value;

    const sanitized = { ...(plainValue as Record<string, unknown>) };
    delete sanitized.password;
    delete sanitized.passwordHash;
    delete sanitized.__v;

    for (const [key, nestedValue] of Object.entries(sanitized)) {
      sanitized[key] = this.sanitize(nestedValue);
    }

    return sanitized;
  }

  private hasToObject(value: object): value is ObjectWithToObject {
    return (
      'toObject' in value &&
      typeof (value as { toObject?: unknown }).toObject === 'function'
    );
  }
}
