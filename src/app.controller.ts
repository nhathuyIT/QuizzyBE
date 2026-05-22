import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
  @Get('ping')
  pingTest() {
    return {
      status: 'success',
      message: 'API is healthy',
      time: new Date(),
    };
  }
}
