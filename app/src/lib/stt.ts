export interface TranscriptionResult {
  text: string;
  isPartial: boolean;
}

export type TranscriptionCallback = (result: TranscriptionResult) => void;

class SpeechToText {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  async start(callback: TranscriptionCallback) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);
    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(1000); // Send chunks every second

    // Mock live transcription for now
    let mockText = "";
    const phrases = ["Hello", "this", "is", "a", "voice", "memory", "test", "on", "device", "STT"];
    let i = 0;
    
    const interval = setInterval(() => {
      if (this.mediaRecorder?.state !== 'recording') {
        clearInterval(interval);
        return;
      }
      if (i < phrases.length) {
        mockText += phrases[i] + " ";
        callback({ text: mockText, isPartial: true });
        i++;
      }
    }, 1500);
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return resolve(new Blob());

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    });
  }
}

export const stt = new SpeechToText();
