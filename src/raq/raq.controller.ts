import {
  Controller,
  Post,
  UseInterceptors,
  BadRequestException,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';

import { RAG_DOCS_DIR } from './rag.constants';
import { RagService } from './raq.service';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

@Controller('api/rag')
export class RagController {
  constructor(private readonly rag: RagService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: RAG_DOCS_DIR,
        filename: (_req, file: MulterFile, cb) => {
          const base = path.parse(file.originalname).name.replace(/\s+/g, '_');
          const filename = `${base}_${Date.now()}.docx`;
          cb(null, filename);
        },
      }),
      fileFilter: (_req, file: MulterFile, cb) => {
        if (!file.originalname.toLowerCase().endsWith('.docx')) {
          return cb(new BadRequestException('Envie um arquivo .docx'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() file?: MulterFile) {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    await this.rag.indexDocx(path.join(RAG_DOCS_DIR, file.filename));
    return { ok: true, file: file.filename };
  }

  @Post('reindex-latest')
  async reindexLatest() {
    const latest = (
      this.rag as unknown as { findLatestDocx: () => string | null }
    ).findLatestDocx();

    if (!latest)
      throw new BadRequestException('Nenhum .docx encontrado para reindexar.');
    await this.rag.indexDocx(latest);
    return { ok: true, file: path.basename(latest) };
  }
}
