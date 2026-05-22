import { LlmInference, FilesetResolver } from '@mediapipe/tasks-genai';

const MODEL_URL = 'https://storage.googleapis.com/jm-downloads/mediapipe/llm/gemma-2b-it-gpu-int4.bin';

class InferenceEngine {
  private llmInference: LlmInference | null = null;
  private isInitializing = false;

  async init() {
    if (this.llmInference || this.isInitializing) return;
    this.isInitializing = true;

    try {
      const genai = await FilesetResolver.forGenAiTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm'
      );

      this.llmInference = await LlmInference.createFromOptions(genai, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
        },
        maxTokens: 512,
        topK: 40,
        temperature: 0.7,
        randomSeed: 101,
      });
      
      console.log('LLM Inference initialized');
    } catch (error) {
      console.error('Failed to initialize LLM Inference:', error);
    } finally {
      this.isInitializing = false;
    }
  }

  async loadLoRAAdapter(loraUrl: string) {
    if (!this.llmInference) {
      await this.init();
    }
    
    if (this.llmInference) {
      // In a real implementation, you'd fetch the LoRA delta and update the options
      // MediaPipe GenAI tasks are evolving, this is the pattern for v1
      console.log(`Hot-swapping LoRA adapter from ${loraUrl}`);
      // this.llmInference.setOptions({ loraPath: loraUrl }); 
    }
  }

  async polishTranscript(rawText: string, style: string, dictionary: string[], customInstruction?: string): Promise<string> {
    if (!this.llmInference) {
      // Return fallback output immediately if the heavy LLM is not ready/downloaded
      return fallbackPolish(rawText, style, dictionary);
    }

    const styleInstructions: Record<string, string> = {
      cleaned: 'Remove filler words, fix grammar and spelling, and output natural, polished prose.',
      bullets: 'Format the main points into a clean, structured bullet-point list.',
      email: 'Write a professional email draft based on the input. Include standard greeting and closing.',
      slack: 'Format as a concise, friendly Slack or team message.',
      raw: 'Output the verbatim transcription exactly as is.'
    };

    let styleInstruction = styleInstructions[style];
    if (!styleInstruction && style === 'custom' && customInstruction) {
      styleInstruction = `Apply this user custom style instruction to the transcript: "${customInstruction}"`;
    } else if (!styleInstruction) {
      styleInstruction = styleInstructions.cleaned;
    }

    const systemPrompt = `You are Wispr Flow, an expert AI speech editor. Rewrite the following transcript based on the instructions.
    
    Instructions: ${styleInstruction}
    
    Personal Dictionary (ensure these specific words are spelled exactly as shown if they appear in the transcript):
    ${dictionary.join(', ')}
    
    Transcript: "${rawText}"
    
    Polished Output:`;

    try {
      const response = await this.llmInference.generateResponse(systemPrompt);
      return response.trim();
    } catch (err) {
      console.warn('Gemma-2B polishing failed, falling back to local processor:', err);
      return fallbackPolish(rawText, style, dictionary);
    }
  }

  async generateResponse(prompt: string, context: string): Promise<string> {
    if (!this.llmInference) {
      await this.init();
    }
    
    if (!this.llmInference) return "AI Engine not ready.";

    const systemPrompt = `You are VoiceMemory AI. Answer the user's question based ONLY on the provided memories.
    If you don't know the answer, say you don't have a memory of it.
    
    Memories:
    ${context}
    
    User Question: ${prompt}
    
    Answer:`;

    return this.llmInference.generateResponse(systemPrompt);
  }

  isReady(): boolean {
    return !!this.llmInference;
  }

  async generateInsights(text: string): Promise<string> {
    if (!this.llmInference) {
      return fallbackInsights(text);
    }

    const systemPrompt = `You are a productivity helper. Extract a list of action items (todos) and key entities (names, dates, organizations) from the following text. Keep it brief and return it formatted nicely.
    
    Text: "${text}"
    
    Insights:`;

    try {
      const response = await this.llmInference.generateResponse(systemPrompt);
      return response.trim();
    } catch (err) {
      console.warn('Gemma-2B insights failed, falling back to local processor:', err);
      return fallbackInsights(text);
    }
  }
}

import { fallbackPolish, fallbackInsights } from './flow';

export const inference = new InferenceEngine();
