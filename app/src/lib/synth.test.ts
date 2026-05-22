import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  playRecordStartSound,
  playRecordStopSound,
  playSuccessSound,
  playDeleteSound,
  playUndoSound,
} from "./synth";

class MockOscillator {
  type = "";
  frequency = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockGain {
  gain = {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
}

class MockAudioContext {
  currentTime = 10;
  state = "suspended";
  destination = {};
  resume = vi.fn().mockImplementation(async () => {
    this.state = "running";
  });
  createOscillator = vi.fn().mockImplementation(() => new MockOscillator());
  createGain = vi.fn().mockImplementation(() => new MockGain());
}

describe("synth audio feedback helper", () => {
  let originalAudioContext: any;
  let originalVibrate: any;

  beforeEach(() => {
    originalAudioContext = (window as any).AudioContext;
    (window as any).AudioContext = MockAudioContext;

    originalVibrate = navigator.vibrate;
    navigator.vibrate = vi.fn();
  });

  afterEach(() => {
    (window as any).AudioContext = originalAudioContext;
    navigator.vibrate = originalVibrate;
  });

  it("playRecordStartSound should schedule oscillators and trigger vibration", () => {
    playRecordStartSound();
    expect(navigator.vibrate).toHaveBeenCalledWith(15);
  });

  it("playRecordStopSound should schedule oscillators and trigger vibration pattern", () => {
    playRecordStopSound();
    expect(navigator.vibrate).toHaveBeenCalledWith([10, 30, 10]);
  });

  it("playSuccessSound should schedule oscillator and trigger vibration", () => {
    playSuccessSound();
    expect(navigator.vibrate).toHaveBeenCalledWith(20);
  });

  it("playDeleteSound should schedule oscillator and trigger vibration", () => {
    playDeleteSound();
    expect(navigator.vibrate).toHaveBeenCalledWith(40);
  });

  it("playUndoSound should schedule oscillators and trigger vibration pattern", () => {
    playUndoSound();
    expect(navigator.vibrate).toHaveBeenCalledWith([15, 20]);
  });
});
