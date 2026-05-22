import { useState, useEffect, useCallback } from "react";
import "./App.css";
import { stt } from "./lib/stt";
import { embed } from "./lib/embeddings";
import { saveMemo, getAllMemos } from "./lib/storage";
import type { VoiceMemo } from "./lib/storage";
import { retrieve } from "./lib/rag";
import { getInference } from "./lib/inference";
import { speak } from "./lib/tts";
import ModelDownloadGate from "./components/ModelDownloadGate";
import Demo from "./pages/Demo";

function App() {
  const isDemoMode =
    window.location.hostname.includes("voicememory") ||
    window.location.search.includes("demo");
  const [activeTab, setActiveTab] = useState<
    "record" | "query" | "timeline" | "demo"
  >(isDemoMode ? "demo" : "record");
  const [isRecording, setIsRecording] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [history, setHistory] = useState<VoiceMemo[]>([]);

  // Query state
  const [query, setQuery] = useState("");
  const [isAnswering, setIsAnswering] = useState(false);
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<VoiceMemo[]>([]);

  const loadHistory = useCallback(async () => {
    const memos = await getAllMemos();
    setHistory(memos.sort((a, b) => b.timestamp - a.timestamp));
  }, []);

  useEffect(() => {
    // One-time load of saved memos from IndexedDB on mount. setHistory fires after
    // an await (not synchronously), so it isn't the cascading-render this rule guards.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory();
  }, [loadHistory]);

  const handleRecordToggle = async () => {
    if (isRecording) {
      const { transcript, audioBlob } = await stt.stop();
      setIsRecording(false);
      setCurrentTranscript(transcript);

      if (transcript) {
        const embedding = await embed(transcript);
        await saveMemo({
          timestamp: Date.now(),
          transcript,
          embedding,
          audioBlob,
        });
        loadHistory();
      }
    } else {
      setCurrentTranscript("");
      setIsRecording(true);
      await stt.start((result) => {
        setCurrentTranscript(result.text);
      });
    }
  };

  const handleQuery = async () => {
    if (!query.trim() || isAnswering) return;
    setIsAnswering(true);
    setAnswer("Searching memories…");
    setCitations([]);
    try {
      const queryVec = await embed(query);
      const memos = (await getAllMemos()).filter((m) => m.embedding?.length);
      const { context, citations } = retrieve(queryVec, memos, 5);
      setCitations(citations);
      setAnswer("");
      let acc = "";
      const final = await getInference().generateResponse(
        query,
        context,
        (token) => {
          acc += token;
          setAnswer(acc);
        },
      );
      setAnswer(final);
      speak(final);
    } catch (error) {
      console.error("Query failed:", error);
      setAnswer("Sorry, I hit an error answering from your memories.");
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <img src="/pwa-512x512.png" className="logo" alt="VoiceMemory logo" />
        <h1>VoiceMemory</h1>
        <p className="tagline">Your personal on-device AI memory</p>
      </header>

      {activeTab === "record" && (
        <main className="card">
          <button
            className={`record-btn ${isRecording ? "recording" : ""}`}
            onClick={handleRecordToggle}
          >
            {isRecording ? "Stop" : "Record"}
          </button>

          <div className="transcript-preview">
            <p className="status-text">
              {isRecording ? "Listening..." : "Tap to capture a memo"}
            </p>
            {currentTranscript && (
              <div className="live-transcript">{currentTranscript}</div>
            )}
          </div>
        </main>
      )}

      {activeTab === "query" && (
        <ModelDownloadGate>
          <main className="card query-view">
            <div className="query-input-group">
              <input
                type="text"
                placeholder="Ask about your memories..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuery()}
              />
              <button onClick={handleQuery} disabled={isAnswering}>
                {isAnswering ? "..." : "→"}
              </button>
            </div>

            <div className="answer-area">
              {answer && (
                <div className="ai-response">
                  <p>{answer}</p>
                  {citations.length > 0 && (
                    <div className="citations">
                      <h4>Sources:</h4>
                      <ul>
                        {citations.map((cite, i) => (
                          <li key={i}>
                            "{cite.transcript.substring(0, 50)}..."
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </ModelDownloadGate>
      )}

      {activeTab === "demo" && <Demo />}

      {(activeTab === "record" || activeTab === "timeline") && (
        <section className="timeline">
          <h2>Recent Memories</h2>
          <div className="memo-list">
            {history.length === 0 ? (
              <p className="empty-state">No memories captured yet.</p>
            ) : (
              history
                .slice(0, activeTab === "timeline" ? undefined : 3)
                .map((memo) => (
                  <div key={memo.id} className="memo-item">
                    <span className="memo-date">
                      {new Date(memo.timestamp).toLocaleTimeString()}
                    </span>
                    <p className="memo-text">{memo.transcript}</p>
                    {memo.audioBlob && (
                      <audio
                        className="memo-audio"
                        controls
                        src={URL.createObjectURL(memo.audioBlob)}
                      />
                    )}
                  </div>
                ))
            )}
          </div>
        </section>
      )}

      <nav className="nav-bar">
        <button
          className={`nav-item ${activeTab === "record" ? "active" : ""}`}
          onClick={() => setActiveTab("record")}
        >
          <div className="nav-icon">🎙️</div>
          <span>Record</span>
        </button>
        <button
          className={`nav-item ${activeTab === "query" ? "active" : ""}`}
          onClick={() => setActiveTab("query")}
        >
          <div className="nav-icon">🔍</div>
          <span>Query</span>
        </button>
        <button
          className={`nav-item ${activeTab === "timeline" ? "active" : ""}`}
          onClick={() => setActiveTab("timeline")}
        >
          <div className="nav-icon">📜</div>
          <span>Timeline</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
