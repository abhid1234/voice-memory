export interface STTResult {
  text: string;
  isFinal: boolean;
}

class STTEngine {
  private worker: Worker | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;

  async start(onResult: (result: STTResult) => void, onStatus?: (status: string) => void) {
    if (!this.worker) {
      onStatus?.('Initializing AI Worker...');
      this.worker = new Worker(new URL('./whisper-worker.js', import.meta.url), {
        type: 'module'
      });
      this.worker.postMessage({ type: 'INIT' });
      
      this.worker.onmessage = (e) => {
        if (e.data.type === 'INIT_DONE') {
          onStatus?.('AI Model Ready');
        } else if (e.data.type === 'PROGRESS') {
          const { file, progress } = e.data.data;
          onStatus?.(`Downloading AI Model (${file}): ${progress}%`);
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
      onStatus?.('Recording...');
    
      const mediaRecorder = new MediaRecorder(this.stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        onStatus?.('Processing Audio...');
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
        const float32Data = audioBuffer.getChannelData(0);
        
        onStatus?.('Transcribing...');
        this.worker?.postMessage({ type: 'TRANSCRIBE', data: { audio: float32Data } });
      };

      mediaRecorder.start();
      (this as any).mediaRecorder = mediaRecorder;
    } catch (err) {
      onStatus?.(`Error: ${err}`);
      throw err;
    }
  }

  async stop(): Promise<Blob | undefined> {
    if ((this as any).mediaRecorder) {
      (this as any).mediaRecorder.stop();
      this.stream?.getTracks().forEach(t => t.stop());
      return new Blob([], { type: 'audio/webm' }); 
    }
  }
}

export const stt = new STTEngine();
