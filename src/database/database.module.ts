import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri =
          configService.get<string>('MONGODB_URI') ??
          configService.get<string>('MONGO_URI');

        if (!uri) {
          throw new Error('Missing MONGODB_URI or MONGO_URI in .env');
        }

        return { uri };
      },
    }),
  ],
})
export class DatabaseModule {}
