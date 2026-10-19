import {
    Controller,
    Post,
    Body,
    UseInterceptors,
    UploadedFile,
    ParseFilePipe,
    MaxFileSizePipe,
    FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SchedulesService } from './levantar-programa.service.js';

@Controller('schedules')
export class SchedulesController {
    constructor(private readonly schedulesService: SchedulesService) { }

    @Post('preview')
    @UseInterceptors(FileInterceptor('file'))
    async previewSchedule(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizePipe({ maxSize: 10 * 1024 * 1024 }),
                    new FileTypeValidator({ fileType: 'application/pdf' }),
                ],
            }),
        )
        file: Express.Multer.File,
    ) {
        return await this.schedulesService.getSchedulePreview(file);
    }

    @Post('confirm')
    async confirmSchedule(@Body() data: any[]) {
        return await this.schedulesService.saveConfirmedSchedule(data);
    }
}