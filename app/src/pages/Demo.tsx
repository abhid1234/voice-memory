import { useState, useEffect } from "react";
import { getInference } from "../lib/inference";
import { stt } from "../lib/stt";
import questions from "../data/demo-questions.json";
import memory from "../data/synthetic-memory.json";
import { embed } from "../lib/embeddings";
import { retrieve } from "../lib/rag";
import { speak } from "../lib/tts";
import type { VoiceMemo } from "../lib/storage";

// Adapt the static JSON (number[] embeddings) into the VoiceMemo shape rag.retrieve expects.
const MEMOS: VoiceMemo[] = memory.map((m) => ({
  timestamp: m.timestamp,
  transcript: m.transcript,
  embedding: new Float32Array(m.embedding),
}));

function Demo() {
  const [activeMode, setActiveMode] = useState<"memory" | "dictation">("dictation");

  // Memory RAG states
  const [answer, setAnswer] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  // General recording states
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [status, setStatus] = useState("");

  // Wispr Flow dictation states
  const [dictationStyle, setDictationStyle] = useState<"cleaned" | "bullets" | "email" | "slack" | "raw">("cleaned");
  const [dictionaryText, setDictionaryText] = useState("LiteRT, LoRA, Vercel, Abhi");
  const [polishedResult, setPolishedResult] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);

  const triggerPolishing = async (text: string, style: string, dict: string) => {
    setIsPolishing(true);
    setStatus("Polishing text...");
    try {
      const parsedDict = dict
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const polished = await getInference().polishTranscript(text, style, parsedDict);
      setPolishedResult(polished);
      setStatus("AI Polishing complete");
    } catch (err) {
      setStatus(`Polishing error: ${err}`);
    } finally {
      setIsPolishing(false);
    }
  };

  // Re-run polish whenever style or dictionary changes
  useEffect(() => {
    if (transcription && activeMode === "dictation") {
      const timer = setTimeout(() => {
        triggerPolishing(transcription, dictationStyle, dictionaryText);
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictationStyle, dictionaryText]);

  // Zero-permission: instant precomputed answer + speak. No mic, no model, no download.
  const handlePrecomputed = (q: (typeof questions)[number]) => {
    setActiveQuestionId(q.id);
    setAnswer(q.answer);
    speak(q.answer);
  };

  // Optional live: real on-device RAG + Gemma 2B (needs WebGPU + one-time model download).
  const handleLive = async (q: (typeof questions)[number]) => {
    if (isThinking) return;
    setActiveQuestionId(q.id);
    setIsThinking(true);
    setAnswer("Thinking on-device…");
    try {
      const queryVec = await embed(q.question);
      const { context } = retrieve(queryVec, MEMOS, 5);
      const llm = getInference();
      llm.init("E2B");
      let acc = "";
      const final = await llm.generateResponse(q.question, context, (token) => {
        acc += token;
        setAnswer(acc);
      });
      setAnswer(final);
      speak(final);
    } catch {
      setAnswer("Live mode needs a WebGPU browser and a one-time model download. The instant answers above work everywhere.");
    } finally {
      setIsThinking(false);
    }
  };

  // Process custom voice query
  const handleVoiceQuery = async (queryText: string) => {
    setIsThinking(true);
    setAnswer("Thinking (on-device)...");
    try {
      let context = "";
      try {
        const queryVec = await embed(queryText);
        const { context: retrievedContext } = retrieve(queryVec, MEMOS, 5);
        context = retrievedContext;
      } catch {
        // Fallback to keyword-based RAG if embedding/retrieve fails
        const queryTerms = queryText
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length > 2);
        const relevant = memory.filter((m) =>
          queryTerms.some((t: string) => m.transcript.toLowerCase().includes(t)),
        );
        context = relevant.map((m, i: number) => `[${i + 1}] ${m.transcript}`).join("\n\n");
      }

      const llm = getInference();
      llm.init("E2B");
      let acc = "";
      const final = await llm.generateResponse(queryText, context, (token) => {
        acc += token;
        setAnswer(acc);
      });
      setAnswer(final);
      speak(final);
    } catch (err) {
      setAnswer("Inference error. Please ensure WebGPU is supported and Gemma model is initialized.");
      console.error(err);
    } finally {
      setIsThinking(false);
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      await stt.stop();
      setIsRecording(false);

      if (activeMode === "dictation") {
        setTimeout(() => {
          setTranscription((prev) => {
            if (prev) {
              triggerPolishing(prev, dictationStyle, dictionaryText);
            }
            return prev;
          });
        }, 150);
      } else {
        setTimeout(() => {
          setTranscription((prev) => {
            if (prev) {
              handleVoiceQuery(prev);
            }
            return prev;
          });
        }, 150);
      }
    } else {
      setTranscription("");
      setPolishedResult("");
      setAnswer("");
      setStatus("Starting...");
      setIsRecording(true);
      try {
        await stt.start(
          (result) => {
            setTranscription(result.text);
          },
          (s) => setStatus(s),
        );
      } catch (err) {
        setStatus(`Error: ${err}`);
        setIsRecording(false);
      }
    }
  };

  const handleCopyToClipboard = async () => {
    const textToCopy = dictationStyle === "raw" ? transcription : polishedResult;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard", err);
    }
  };

  return (
    <div className="demo-page card">
      <h2>Try VoiceMemory</h2>

      {/* Mode selection tabs */}
      <div className="mode-tabs">
        <button
          className={`mode-tab ${activeMode === "dictation" ? "active" : ""}`}
          onClick={() => {
            setActiveMode("dictation");
            setStatus("");
          }}
        >
          🎙️ AI Dictation
        </button>
        <button
          className={`mode-tab ${activeMode === "memory" ? "active" : ""}`}
          onClick={() => {
            setActiveMode("memory");
            setStatus("");
          }}
        >
          🧠 Query Memory
        </button>
      </div>

      {activeMode === "memory" ? (
        <>
          <p className="status-text">
            No permissions needed. These are sample questions over a synthetic memory of AI-industry conversations. Tap one to hear the answer.
          </p>

          <div className="sample-queries">
            {questions.map((q) => (
              <div key={q.id} className="sample-q-row">
                <button className="sample-q-btn" onClick={() => handlePrecomputed(q)} disabled={isThinking}>
                  ▶ {q.question}
                </button>
                <button
                  className="sample-q-live"
                  onClick={() => handleLive(q)}
                  disabled={isThinking}
                  title="Run the real model on-device (needs WebGPU + a one-time download)"
                >
                  ⚡ live
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="dictation-settings">
          <p className="status-text">Dictate raw speech, auto-format text with AI, and copy instantly.</p>

          {/* Style pills */}
          <div className="style-selector">
            {(["cleaned", "bullets", "email", "slack", "raw"] as const).map((style) => (
              <button
                key={style}
                className={`style-pill ${dictationStyle === style ? "active" : ""}`}
                onClick={() => setDictationStyle(style)}
              >
                {style === "cleaned" && "✨ Cleaned"}
                {style === "bullets" && "📋 Bullets"}
                {style === "email" && "✉️ Email"}
                {style === "slack" && "💬 Slack"}
                {style === "raw" && "📄 Raw"}
              </button>
            ))}
          </div>

          {/* Personal Dictionary Editor */}
          <div className="dictionary-field">
            <label>Vocabulary dictionary (comma-separated):</label>
            <input
              type="text"
              placeholder="e.g. LiteRT, LoRA, Vercel"
              value={dictionaryText}
              onChange={(e) => setDictionaryText(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="answer-area">
        {status && <div className="debug-status">Status: {status}</div>}

        {activeMode === "dictation" ? (
          <div className="dictation-results">
            {transcription && (
              <div className="transcription-preview mini">
                <strong>Raw Transcript:</strong>
                <p>{transcription}</p>
              </div>
            )}

            {(polishedResult || isPolishing) && (
              <div className="transcription-preview polished">
                <div className="polished-header">
                  <strong>Polished Output ({dictationStyle}):</strong>
                  <button
                    className={`copy-btn ${isCopied ? "copied" : ""}`}
                    onClick={handleCopyToClipboard}
                    disabled={isPolishing}
                  >
                    {isCopied ? "✓ Copied" : "📋 Copy"}
                  </button>
                </div>
                {isPolishing ? (
                  <p className="loading-text">Generating polished draft...</p>
                ) : (
                  <pre className="polished-text">{polishedResult}</pre>
                )}
              </div>
            )}
          </div>
        ) : (
          answer && (
            <div className="ai-response">
              <p>{answer}</p>
              {activeQuestionId && <span className="demo-hint">▶ instant · ⚡ live runs Gemma 2B on your device</span>}
            </div>
          )
        )}
      </div>

      <div className="voice-controls">
        <button className={`record-btn ${isRecording ? "recording" : ""}`} onClick={handleToggleRecording} disabled={isThinking}>
          {isRecording ? "⏹ Stop Recording" : activeMode === "dictation" ? "🎤 Dictate with AI" : "🎤 Ask a Voice Query"}
        </button>
      </div>

      <div className="install-prompt">
        <button className="record-btn secondary" style={{ fontSize: "1rem", padding: "1rem 2rem" }}>
          Install for yourself
        </button>
        <p className="status-text">Only the full app asks for microphone access.</p>
      </div>
    </div>
  );
}

export default Demo;
