import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { DatabaseModule } from './database/database.module';
import { AiGeneratorModule } from './modules/ai-generator/ai-generator.module';
import { CardProgressModule } from './modules/card-progress/card-progress.module';
import { CardModule } from './modules/card/card.module';
import { DeckModule } from './modules/deck/deck.module';
import { StudyModule } from './modules/study/study.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    DatabaseModule,
    UserModule,
    AiGeneratorModule,
    DeckModule,
    CardModule,
    StudyModule,
    CardProgressModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
