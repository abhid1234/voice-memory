import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import ModelDownloadGate from "./ModelDownloadGate";
import * as modelStore from "../lib/model-store";

vi.mock("../lib/model-store", () => ({
  isWebGPUAvailable: vi.fn(),
  isModelCached: vi.fn(),
  downloadModel: vi.fn(),
}));

const mockInit = vi.fn().mockResolvedValue(undefined);
vi.mock("../lib/inference", () => ({
  getInference: vi.fn(() => ({
    init: mockInit,
  })),
}));

describe("ModelDownloadGate", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("renders checking state initially", async () => {
    let resolveWebGPU: (val: boolean) => void = () => {};
    const webGPUPromise = new Promise<boolean>((resolve) => {
      resolveWebGPU = resolve;
    });
    vi.mocked(modelStore.isWebGPUAvailable).mockReturnValue(webGPUPromise);

    await act(async () => {
      const root = createRoot(container);
      root.render(<ModelDownloadGate><span>Content</span></ModelDownloadGate>);
    });

    expect(container.textContent).toContain("Checking Device");
    
    // Resolve WebGPU check
    await act(async () => {
      resolveWebGPU(true);
    });
  });

  it("renders no-webgpu state when WebGPU is missing", async () => {
    vi.mocked(modelStore.isWebGPUAvailable).mockResolvedValue(false);

    await act(async () => {
      const root = createRoot(container);
      root.render(<ModelDownloadGate><span>Content</span></ModelDownloadGate>);
    });

    expect(container.textContent).toContain("WebGPU Required");
  });

  it("renders needs-download state when model is not cached", async () => {
    vi.mocked(modelStore.isWebGPUAvailable).mockResolvedValue(true);
    vi.mocked(modelStore.isModelCached).mockResolvedValue(false);

    await act(async () => {
      const root = createRoot(container);
      root.render(<ModelDownloadGate><span>Content</span></ModelDownloadGate>);
    });

    expect(container.textContent).toContain("Activate Offline Search Engine");
    
    const downloadButton = container.querySelector("button.gate-btn");
    expect(downloadButton).not.toBeNull();
    expect(downloadButton?.textContent).toContain("Download local AI model");
  });

  it("calls downloadModel and shows downloading progress when clicked", async () => {
    vi.mocked(modelStore.isWebGPUAvailable).mockResolvedValue(true);
    vi.mocked(modelStore.isModelCached).mockResolvedValue(false);

    let progressCb: any = null;
    let resolveDownload: (() => void) | null = null;
    vi.mocked(modelStore.downloadModel).mockImplementation(async (_variant, onProgress) => {
      progressCb = onProgress;
      return new Promise<void>((resolve) => {
        resolveDownload = resolve;
      });
    });

    await act(async () => {
      const root = createRoot(container);
      root.render(<ModelDownloadGate><span>Content</span></ModelDownloadGate>);
    });

    const downloadButton = container.querySelector("button.gate-btn") as HTMLButtonElement;
    
    await act(async () => {
      downloadButton.click();
    });

    expect(container.textContent).toContain("Downloading Model");
    expect(modelStore.downloadModel).toHaveBeenCalledWith("E2B", expect.any(Function));

    // Simulate progress update
    await act(async () => {
      progressCb?.({ loadedBytes: 50, totalBytes: 100 });
    });

    expect(container.textContent).toContain("50%");

    // Complete download
    await act(async () => {
      resolveDownload?.();
    });
  });

  it("reverts to needs-download state if downloadModel fails", async () => {
    vi.mocked(modelStore.isWebGPUAvailable).mockResolvedValue(true);
    vi.mocked(modelStore.isModelCached).mockResolvedValue(false);
    vi.mocked(modelStore.downloadModel).mockRejectedValue(new Error("Download failed"));

    await act(async () => {
      const root = createRoot(container);
      root.render(<ModelDownloadGate><span>Content</span></ModelDownloadGate>);
    });

    const downloadButton = container.querySelector("button.gate-btn") as HTMLButtonElement;
    await act(async () => {
      downloadButton.click();
    });

    expect(container.textContent).toContain("Activate Offline Search Engine");
  });

  it("renders children when model is cached and init succeeds", async () => {
    vi.mocked(modelStore.isWebGPUAvailable).mockResolvedValue(true);
    vi.mocked(modelStore.isModelCached).mockResolvedValue(true);
    mockInit.mockResolvedValue(undefined);

    await act(async () => {
      const root = createRoot(container);
      root.render(<ModelDownloadGate><span>Hello Ready!</span></ModelDownloadGate>);
    });

    expect(container.textContent).toBe("Hello Ready!");
  });

  it("renders load-error state when init fails and allows retry", async () => {
    vi.mocked(modelStore.isWebGPUAvailable).mockResolvedValue(true);
    vi.mocked(modelStore.isModelCached).mockResolvedValue(true);
    mockInit.mockRejectedValue(new Error("Init failed"));

    await act(async () => {
      const root = createRoot(container);
      root.render(<ModelDownloadGate><span>Hello Ready!</span></ModelDownloadGate>);
    });

    expect(container.textContent).toContain("Initialization Failed");

    // Click retry
    mockInit.mockResolvedValue(undefined);
    const retryButton = container.querySelector("button.gate-btn") as HTMLButtonElement;
    expect(retryButton.textContent).toContain("Retry Load");

    await act(async () => {
      retryButton.click();
    });

    expect(container.textContent).toBe("Hello Ready!");
  });
});
