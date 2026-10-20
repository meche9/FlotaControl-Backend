import {
    Controller,
    Post,
    Body,
    UseInterceptors,
    UploadedFile,
    ParseFilePipe,
    FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LevantarProgramaService } from './levantar-programa.service.js';

@Controller('schedules')
export class LevantarProgramaController {
    constructor(private readonly levantarProgramaService: LevantarProgramaService) { }

    @Post('preview')
    @UseInterceptors(FileInterceptor('file'))
    async previewSchedule(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new FileTypeValidator({ fileType: 'application/pdf' }),
                ],
            }),
        )
        file: any,
    ) {
        return await this.levantarProgramaService.getSchedulePreview(file);
    }

    @Post('confirm')
    async confirmSchedule(@Body() data: any[]) {
        return await this.levantarProgramaService.saveConfirmedSchedule(data);
    }
}