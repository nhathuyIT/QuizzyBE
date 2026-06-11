import {
  BadRequestException,
  Injectable,
  PipeTransform,
  type ArgumentMetadata,
} from '@nestjs/common';
import { isMongoId } from '../utils/mongo-id.util';

@Injectable()
export class ParseMongoIdPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata) {
    if (!isMongoId(value)) {
      const field = metadata.data ?? 'id';

      throw new BadRequestException(
        `${field} must be a valid MongoDB ObjectId`,
      );
    }

    return value;
  }
}
