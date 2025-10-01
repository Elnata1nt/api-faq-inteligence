declare module 'groq-sdk' {
  export interface ChatCompletionMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
  }

  export interface ChatCompletionChoice {
    message: ChatCompletionMessage;
    finish_reason: string;
    index: number;
  }

  export interface ChatCompletion {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: ChatCompletionChoice[];
  }

  export interface ChatCompletionCreateParams {
    messages: ChatCompletionMessage[];
    model: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    stream?: boolean;
  }

  export class Groq {
    constructor(config: { apiKey: string });
    chat: {
      completions: {
        create(params: ChatCompletionCreateParams): Promise<ChatCompletion>;
      };
    };
  }

  export default Groq;
}
