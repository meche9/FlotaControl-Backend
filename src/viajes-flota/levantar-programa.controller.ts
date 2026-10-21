import {
    Controller,
    Post,
    Body,
    UseInterceptors,
    UploadedFile,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LevantarProgramaService } from './levantar-programa.service.js';

@Controller('schedules')
export class LevantarProgramaController {
    constructor(private readonly levantarProgramaService: LevantarProgramaService) { }

    @Post('preview')
    @UseInterceptors(FileInterceptor('file'))
    async previewSchedule(@UploadedFile() file: any) {
        if (!file) {
            throw new HttpException('No se ha adjuntado ningún archivo.', HttpStatus.BAD_REQUEST);
        }

        const filename = (file.originalname || '').toLowerCase();
        const isPdf = filename.endsWith('.pdf') || file.mimetype === 'application/pdf';

        if (!isPdf) {
            throw new HttpException('El archivo adjunto debe ser de formato PDF (.pdf).', HttpStatus.BAD_REQUEST);
        }

        return await this.levantarProgramaService.getSchedulePreview(file);
    }

    @Post('confirm')
    async confirmSchedule(@Body() data: any) {
        return await this.levantarProgramaService.saveConfirmedSchedule(data);
    }
}