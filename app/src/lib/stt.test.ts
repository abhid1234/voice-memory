import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { stt } from "./stt";

describe("STTEngine", () => {
  let mockWorkerInstance: any = null;
  const originalWorker = (globalThis as any).Worker;

  beforeEach(() => {
    mockWorkerInstance = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    };

    // Mock global Worker as a constructible spy
    (globalThis as any).Worker = vi.fn().mockImplementation(function () {
      return mockWorkerInstance;
    }) as any;

    // Isolate tests by resetting stt singleton state
    (stt as any).worker = null;
    (stt as any).audioContext = null;
    (stt as any).stream = null;
    (stt as any).analyser = null;
  });

  afterEach(() => {
    (globalThis as any).Worker = originalWorker;
    // Terminate any active worker on stt singleton to avoid leaking state
    stt.setWordModel("Xenova/whisper-tiny.en");
  });

  it("should get and set word model", () => {
    expect(stt.getCurrentModel()).toBe("Xenova/whisper-tiny.en");
    stt.setWordModel("Xenova/whisper-base");
    expect(stt.getCurrentModel()).toBe("Xenova/whisper-base");
  });

  it("should preload model and send INIT message to worker", () => {
    const onStatus = vi.fn();
    const onProgress = vi.fn();

    stt.preloadModel("Xenova/whisper-tiny.en", onStatus, onProgress);

    expect((globalThis as any).Worker).toHaveBeenCalled();
    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
      type: "INIT",
      data: { modelName: "Xenova/whisper-tiny.en" },
    });

    // Simulate PROGRESS message from worker
    mockWorkerInstance.onmessage({
      data: {
        type: "PROGRESS",
        data: { file: "model.onnx", progress: 50 },
      },
    });
    expect(onStatus).toHaveBeenCalledWith("Downloading AI Model (model.onnx): 50%");
    expect(onProgress).toHaveBeenCalledWith("model.onnx", 50);

    // Simulate INIT_DONE
    mockWorkerInstance.onmessage({
      data: {
        type: "INIT_DONE",
      },
    });
    expect(onStatus).toHaveBeenCalledWith("AI Model Ready");
    expect(onProgress).toHaveBeenCalledWith("", 100);
  });

  it("should handle error messages from worker during preload", () => {
    const onStatus = vi.fn();
    stt.preloadModel("Xenova/whisper-tiny.en", onStatus);

    mockWorkerInstance.onmessage({
      data: {
        type: "ERROR",
        data: "failed to load",
      },
    });
    expect(onStatus).toHaveBeenCalledWith("Error: failed to load");
  });

  it("should transcribeBuffer using worker postMessage", async () => {
    const audioData = new Float32Array([0.1, 0.2, 0.3]);
    const onResult = vi.fn();
    const onStatus = vi.fn();

    // Call preloadModel first to instantiate the mock worker
    stt.preloadModel("Xenova/whisper-tiny.en");

    await stt.transcribeBuffer(audioData, onResult, onStatus);

    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
      type: "TRANSCRIBE",
      data: { audio: audioData },
    });
    expect(onStatus).toHaveBeenCalledWith("Transcribing...");

    // Simulate RESULT message from worker
    mockWorkerInstance.onmessage({
      data: {
        type: "RESULT",
        data: "transcribed text",
      },
    });

    expect(onStatus).toHaveBeenCalledWith("Transcription Complete");
    expect(onResult).toHaveBeenCalledWith({ text: "transcribed text", isFinal: true });
  });

  it("should handle transcription error", async () => {
    const audioData = new Float32Array([0.1, 0.2, 0.3]);
    const onResult = vi.fn();
    const onStatus = vi.fn();

    stt.preloadModel("Xenova/whisper-tiny.en");
    stt.transcribeBuffer(audioData, onResult, onStatus);

    // Simulate ERROR message from worker
    mockWorkerInstance.onmessage({
      data: {
        type: "ERROR",
        data: "whisper execution failed",
      },
    });

    expect(onStatus).toHaveBeenCalledWith("Error: whisper execution failed");
  });
});
