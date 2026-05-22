// Messages sent FROM the main thread TO the worker.
export interface TranscribeRequest { id: number; type: 'TRANSCRIBE'; audio: Float32Array }
export interface EmbedRequest { id: number; type: 'EMBED'; text: string }
export type WorkerRequest = TranscribeRequest | EmbedRequest

// Messages sent FROM the worker TO the main thread.
export interface ResultMessage { id: number; type: 'RESULT'; text?: string; vector?: Float32Array }
export interface ProgressMessage { id: number; type: 'PROGRESS'; file: string; progress: number }
export interface ErrorMessage { id: number; type: 'ERROR'; error: string }
export type WorkerResponse = ResultMessage | ProgressMessage | ErrorMessage
