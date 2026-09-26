export type LlmCall = (input: {
  system: string;
  user: string;
  signal: AbortSignal;
}) => Promise<string>;
