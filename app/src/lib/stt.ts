export interface STTResult {
  text: string;
  isFinal: boolean;
}

class STTEngine {
  private worker: Worker | null = null;
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private currentModelName = "Xenova/whisper-tiny.en";
  private mediaRecorder: MediaRecorder | null = null;
  private resolveAudioBlob: ((blob: Blob) => void) | null = null;
  private chunks: Blob[] = [];
  private partialTimer: ReturnType<typeof setInterval> | null = null;
  private currentSessionId: string | null = null;
  private onResultCallback: ((result: STTResult) => void) | null = null;
  private onStatusCallback: ((status: string) => void) | null = null;
  private onProgressCallback: ((file: string, progress: number) => void) | null = null;

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
    onStatus?: ((status: string) => void) | null,
    onProgress?: ((file: string, progress: number) => void) | null,
  ) {
    this.setWordModel(modelName);
    if (onStatus) this.onStatusCallback = onStatus;
    if (onProgress) this.onProgressCallback = onProgress;

    if (!this.worker) {
      this.onStatusCallback?.("Initializing AI Worker...");
      this.worker = new Worker(new URL("./whisper-worker.js", import.meta.url), {
        type: "module",
      });
      this.worker.postMessage({ type: "INIT", data: { modelName: this.currentModelName } });

      this.worker.onmessage = (e) => {
        const { type, data, requestId } = e.data;
        if (type === "INIT_DONE") {
          this.onStatusCallback?.("AI Model Ready");
          this.onProgressCallback?.("", 100);
        } else if (type === "PROGRESS") {
          const { file, progress } = data;
          this.onStatusCallback?.(`Downloading AI Model (${file}): ${progress}%`);
          this.onProgressCallback?.(file, progress);
        } else if (type === "RESULT") {
          if (requestId && this.currentSessionId) {
            const [sessId, isFinalStr] = requestId.split("-");
            if (sessId === this.currentSessionId) {
              const isFinal = isFinalStr === "final";
              if (isFinal) {
                this.onStatusCallback?.("Transcription Complete");
              }
              this.onResultCallback?.({ text: data, isFinal });
            }
          }
        } else if (type === "ERROR") {
          if (requestId && this.currentSessionId) {
            const [sessId] = requestId.split("-");
            if (sessId === this.currentSessionId) {
              this.onStatusCallback?.(`Error: ${data}`);
            }
          } else {
            this.onStatusCallback?.(`Error: ${data}`);
          }
        }
      };
      this.worker.onerror = (err) => {
        this.onStatusCallback?.(`Worker Error: ${err.message || "Check browser console"}`);
      };
    }
  }

  async start(
    onResult: (result: STTResult) => void,
    onStatus?: (status: string) => void,
    onProgress?: (file: string, progress: number) => void,
  ) {
    this.chunks = [];
    this.currentSessionId = Math.random().toString(36).substring(2, 9);
    this.onResultCallback = onResult;
    if (onStatus) this.onStatusCallback = onStatus;
    if (onProgress) this.onProgressCallback = onProgress;

    if (!this.worker) {
      this.preloadModel(this.currentModelName, this.onStatusCallback, this.onProgressCallback);
    }

    try {
      this.onStatusCallback?.("Requesting Microphone...");
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      this.onStatusCallback?.("Recording...");
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        this.onStatusCallback?.("Processing Audio...");
        if (this.stream) {
          this.stream.getTracks().forEach((t) => t.stop());
          this.stream = null;
        }
        this.analyser = null;

        const blob = new Blob(this.chunks, { type: "audio/webm" });

        if (this.resolveAudioBlob) {
          this.resolveAudioBlob(blob);
          this.resolveAudioBlob = null;
        }

        try {
          const arrayBuffer = await blob.arrayBuffer();
          const ctx = this.audioContext;
          if (ctx) {
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            const float32Data = audioBuffer.getChannelData(0);

            if (this.worker && this.currentSessionId) {
              const requestId = `${this.currentSessionId}-final`;
              this.onStatusCallback?.("Transcribing...");
              this.worker.postMessage({
                type: "TRANSCRIBE",
                data: { audio: float32Data, requestId }
              });
            }
          }
        } catch (err) {
          this.onStatusCallback?.(`Decoding/Transcribing Error: ${err}`);
        } finally {
          if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
          }
        }
      };

      this.mediaRecorder.start(1000);

      // Live partial transcription every 8 seconds
      let partialCount = 0;
      this.partialTimer = setInterval(async () => {
        if (!this.mediaRecorder || this.mediaRecorder.state !== "recording") return;
        try {
          if (this.chunks.length > 0 && this.audioContext) {
            const blob = new Blob(this.chunks, { type: "audio/webm" });
            const buf = await blob.arrayBuffer();
            const decoded = await this.audioContext.decodeAudioData(buf.slice(0));
            const float32Data = decoded.getChannelData(0);

            if (this.worker && this.currentSessionId) {
              const requestId = `${this.currentSessionId}-partial-${partialCount++}`;
              this.worker.postMessage({
                type: "TRANSCRIBE",
                data: { audio: float32Data, requestId }
              });
            }
          }
        } catch {
          // Mid-stream decode can fail; ignore and retry next interval
        }
      }, 8000);
    } catch (err) {
      this.onStatusCallback?.(`Error: ${err}`);
      throw err;
    }
  }

  async transcribeBuffer(
    float32Data: Float32Array,
    onResult: (result: STTResult) => void,
    onStatus?: (status: string) => void,
    onProgress?: (file: string, progress: number) => void,
  ) {
    this.currentSessionId = Math.random().toString(36).substring(2, 9);
    this.onResultCallback = onResult;
    if (onStatus) this.onStatusCallback = onStatus;
    if (onProgress) this.onProgressCallback = onProgress;

    if (!this.worker) {
      this.preloadModel(this.currentModelName, this.onStatusCallback, this.onProgressCallback);
    }

    if (this.worker) {
      const requestId = `${this.currentSessionId}-final`;
      this.onStatusCallback?.("Transcribing...");
      this.worker.postMessage({ type: "TRANSCRIBE", data: { audio: float32Data, requestId } });
    } else {
      this.onStatusCallback?.("AI worker failed to initialize");
    }
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  async stop(): Promise<Blob | undefined> {
    if (this.partialTimer) {
      clearInterval(this.partialTimer);
      this.partialTimer = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      const blobPromise = new Promise<Blob>((resolve) => {
        this.resolveAudioBlob = resolve;
      });
      this.mediaRecorder.stop();
      const blob = await blobPromise;
      return blob;
    }
  }
}

export const stt = new STTEngine();
