export class CreateIaFaqDto {
  message: string;
  sessionId: string;
  userId?: number;
  images?: Array<{
    data: string;
    mimeType: string;
  }>;
}
