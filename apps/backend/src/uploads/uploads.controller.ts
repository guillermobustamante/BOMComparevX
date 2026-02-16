import { Controller, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { UploadValidationService } from './upload-validation.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadValidationService: UploadValidationService) {}

  @Post('validate')
  @UseGuards(SessionAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'fileA', maxCount: 1 },
      { name: 'fileB', maxCount: 1 }
    ])
  )
  validate(
    @UploadedFiles()
    files: {
      fileA?: Express.Multer.File[];
      fileB?: Express.Multer.File[];
    }
  ) {
    return this.uploadValidationService.validate(files);
  }
}
