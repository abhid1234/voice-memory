import { pipeline, env } from '@xenova/transformers';

// Configuration
env.allowLocalModels = false;

let transcriber = null;

async function init() {
  if (transcriber) return;
  try {
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
      progress_callback: (progress) => {
        if (progress.status === 'progress') {
          self.postMessage({ 
            type: 'PROGRESS', 
            data: { 
              file: progress.file || 'model data', 
              progress: Math.round(progress.progress) 
            } 
          });
        } else if (progress.status === 'initiate') {
          self.postMessage({ type: 'PROGRESS', data: { file: progress.file || 'model data', progress: 0 } });
        } else if (progress.status === 'done') {
          self.postMessage({ type: 'PROGRESS', data: { file: progress.file || 'model data', progress: 100 } });
        }
      }
    });
    self.postMessage({ type: 'INIT_DONE' });
  } catch (err) {
    self.postMessage({ type: 'ERROR', data: `Init error: ${err.message || err}` });
  }
}

self.onmessage = async (e) => {
  const { type, data } = e.data;
  
  if (type === 'INIT') {
    await init();
  } else if (type === 'TRANSCRIBE') {
    if (!transcriber) {
      self.postMessage({ type: 'ERROR', data: 'Transcriber not initialized' });
      return;
    }
    
    try {
      const output = await transcriber(data.audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
      });
      
      self.postMessage({ type: 'RESULT', data: output.text });
    } catch (err) {
      self.postMessage({ type: 'ERROR', data: `Transcription error: ${err.message || err}` });
    }
  }
};
