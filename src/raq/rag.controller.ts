/* eslint-disable */
// @ts-nocheck
import { Controller, Post, Get, Delete, UseInterceptors, BadRequestException, NotFoundException, UploadedFile } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { diskStorage } from "multer"
import * as path from "path"

import { RAG_DOCS_DIR } from "./rag.constants"
import { RagService } from "./rag.service"

interface MulterFile {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  size: number
  destination: string
  filename: string
  path: string
  buffer: Buffer
}

@Controller("api/rag")
export class RagController {
  constructor(private readonly rag: RagService) {}

  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: RAG_DOCS_DIR,
        filename: (_req, file, cb) => {
          const base = path.parse(file.originalname).name.replace(/\s+/g, "_");
          const filename = `${base}_${Date.now()}.docx`;
          cb(null, filename);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.toLowerCase().endsWith(".docx")) {
          return cb(new BadRequestException("Envie um arquivo .docx"), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() file?: MulterFile) {
    if (!file) throw new BadRequestException("Arquivo não enviado");
  
    try {
      const document = await this.rag.indexDocx(
        path.join(RAG_DOCS_DIR, file.filename),
        file.originalname,
      );
      return {
        ok: true,
        document: {
          id: document.id,
          filename: document.filename,
          originalName: document.originalName,
          filesize: document.filesize,
          chunks: document.chunks.length,
        },
      };
    } catch (err) {
      console.error("Erro no upload:", err);
      throw new BadRequestException("Falha ao processar o arquivo. Verifique logs do servidor.");
    }
  }  

  @Get("documents")
  async listDocuments() {
    const documents = await this.rag.getAllDocuments()
    return { ok: true, documents }
  }

  @Get("documents/:id")
  async getDocument(id: string) {
    const document = await this.rag.getDocumentById(id)
    if (!document) {
      throw new NotFoundException("Documento não encontrado")
    }
    return { ok: true, document }
  }

  @Delete("documents/:id")
  async deleteDocument(id: string) {
    try {
      const result = await this.rag.deleteDocument(id)
      return result
    } catch {
      throw new NotFoundException("Documento não encontrado")
    }
  }

  @Post("reindex-latest")
  async reindexLatest() {
    const latest = (this.rag as unknown as { findLatestDocx: () => string | null }).findLatestDocx()

    if (!latest) throw new BadRequestException("Nenhum .docx encontrado para reindexar.")
    await this.rag.indexDocx(latest)
    return { ok: true, file: path.basename(latest) }
  }
}
