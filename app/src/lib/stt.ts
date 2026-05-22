export interface STTResult {
  text: string;
  isFinal: boolean;
}

class STTEngine {
  private worker: Worker | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private currentModelName = 'Xenova/whisper-tiny.en';
  private mediaRecorder: MediaRecorder | null = null;
  private resolveAudioBlob: ((blob: Blob) => void) | null = null;

  setWordModel(modelName: string) {
    if (this.currentModelName !== modelName) {
      this.currentModelName = modelName;
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
    }
  }

  getCurrentModel() {
    return this.currentModelName;
  }

  preloadModel(
    modelName: string,
    onStatus?: (status: string) => void,
    onProgress?: (file: string, progress: number) => void
  ) {
    this.setWordModel(modelName);
    if (!this.worker) {
      onStatus?.('Initializing AI Worker...');
      this.worker = new Worker(new URL('./whisper-worker.js', import.meta.url), {
        type: 'module'
      });
      this.worker.postMessage({ type: 'INIT', data: { modelName: this.currentModelName } });
      
      this.worker.onmessage = (e) => {
        if (e.data.type === 'INIT_DONE') {
          onStatus?.('AI Model Ready');
          onProgress?.('', 100);
        } else if (e.data.type === 'PROGRESS') {
          const { file, progress } = e.data.data;
          onStatus?.(`Downloading AI Model (${file}): ${progress}%`);
          onProgress?.(file, progress);
        } else if (e.data.type === 'ERROR') {
          onStatus?.(`Error: ${e.data.data}`);
        }
      };
      this.worker.onerror = (err) => {
        onStatus?.(`Worker Load Error: ${err.message || 'Check browser console'}`);
      };
    }
  }

  async start(
    onResult: (result: STTResult) => void,
    onStatus?: (status: string) => void,
    onProgress?: (file: string, progress: number) => void
  ) {
    if (!this.worker) {
      onStatus?.('Initializing AI Worker...');
      this.worker = new Worker(new URL('./whisper-worker.js', import.meta.url), {
        type: 'module'
      });
      this.worker.postMessage({ type: 'INIT', data: { modelName: this.currentModelName } });
      
      this.worker.onmessage = (e) => {
        if (e.data.type === 'INIT_DONE') {
          onStatus?.('AI Model Ready');
          onProgress?.('', 100);
        } else if (e.data.type === 'PROGRESS') {
          const { file, progress } = e.data.data;
          onStatus?.(`Downloading AI Model (${file}): ${progress}%`);
          onProgress?.(file, progress);
        } else if (e.data.type === 'RESULT') {
          onStatus?.('Transcription Complete');
          onResult({ text: e.data.data, isFinal: true });
        } else if (e.data.type === 'ERROR') {
          onStatus?.(`Error: ${e.data.data}`);
        }
      };

      this.worker.onerror = (err) => {
        onStatus?.(`Worker Load Error: ${err.message || 'Check browser console'}`);
      };
    }

    try {
      onStatus?.('Requesting Microphone...');
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      onStatus?.('Recording...');
    
      this.mediaRecorder = new MediaRecorder(this.stream);
      const chunks: Blob[] = [];
      this.mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      this.mediaRecorder.onstop = async () => {
        onStatus?.('Processing Audio...');
        
        // Stop stream tracks inside onstop to avoid truncating audio capture
        if (this.stream) {
          this.stream.getTracks().forEach(t => t.stop());
          this.stream = null;
        }
        this.analyser = null;

        const blob = new Blob(chunks, { type: 'audio/webm' });
        
        if (this.resolveAudioBlob) {
          this.resolveAudioBlob(blob);
          this.resolveAudioBlob = null;
        }

        try {
          const arrayBuffer = await blob.arrayBuffer();
          const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
          const float32Data = audioBuffer.getChannelData(0);
          
          onStatus?.('Transcribing...');
          this.worker?.postMessage({ type: 'TRANSCRIBE', data: { audio: float32Data } });
        } catch (err) {
          onStatus?.(`Decoding/Transcribing Error: ${err}`);
        }
      };

      this.mediaRecorder.start();
    } catch (err) {
      onStatus?.(`Error: ${err}`);
      throw err;
    }
  }

  async transcribeBuffer(
    float32Data: Float32Array,
    onResult: (result: STTResult) => void,
    onStatus?: (status: string) => void,
    onProgress?: (file: string, progress: number) => void
  ) {
    if (!this.worker) {
      this.preloadModel(this.currentModelName, onStatus, onProgress);
    }
    
    if (this.worker) {
      const originalOnMessage = this.worker.onmessage;
      this.worker.onmessage = (e) => {
        if (e.data.type === 'RESULT') {
          onStatus?.('Transcription Complete');
          onResult({ text: e.data.data, isFinal: true });
          this.worker!.onmessage = originalOnMessage;
        } else if (e.data.type === 'ERROR') {
          onStatus?.(`Error: ${e.data.data}`);
          this.worker!.onmessage = originalOnMessage;
        } else if (originalOnMessage) {
          originalOnMessage.call(this.worker!, e);
        }
      };
      
      onStatus?.('Transcribing...');
      this.worker.postMessage({ type: 'TRANSCRIBE', data: { audio: float32Data } });
    } else {
      onStatus?.('AI worker failed to initialize');
    }
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  async stop(): Promise<Blob | undefined> {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      const blobPromise = new Promise<Blob>((resolve) => {
        this.resolveAudioBlob = resolve;
      });
      this.mediaRecorder.stop();
      return blobPromise;
    }
  }
}

export const stt = new STTEngine();

