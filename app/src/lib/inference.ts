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
}

export const inference = new InferenceEngine();
