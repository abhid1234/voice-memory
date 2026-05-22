import { useState, useEffect } from 'react'
import { inference } from '../lib/inference'
import syntheticData from '../data/synthetic_memory.json'
import { stt } from '../lib/stt'

interface SyntheticMemory {
  id: string;
  timestamp: number;
  transcript: string;
}

function Demo() {
  const [activeMode, setActiveMode] = useState<'memory' | 'dictation'>('dictation')
  
  // Memory RAG states
  const [answer, setAnswer] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  
  // General recording states
  const [isRecording, setIsRecording] = useState(false)
  const [transcription, setTranscription] = useState('')
  const [status, setStatus] = useState('')

  // Wispr Flow dictation states
  const [dictationStyle, setDictationStyle] = useState<'cleaned' | 'bullets' | 'email' | 'slack' | 'raw'>('cleaned')
  const [dictionaryText, setDictionaryText] = useState('LiteRT, LoRA, Vercel, Abhi')
  const [polishedResult, setPolishedResult] = useState('')
  const [isCopied, setIsCopied] = useState(false)
  const [isPolishing, setIsPolishing] = useState(false)

  const triggerPolishing = async (text: string, style: string, dict: string) => {
    setIsPolishing(true);
    setStatus('Polishing text...');
    try {
      const parsedDict = dict.split(',').map(s => s.trim()).filter(Boolean);
      const polished = await inference.polishTranscript(text, style, parsedDict);
      setPolishedResult(polished);
      setStatus('AI Polishing complete');
    } catch (err) {
      setStatus(`Polishing error: ${err}`);
    } finally {
      setIsPolishing(false);
    }
  };

  // Re-run polish whenever style or dictionary changes
  useEffect(() => {
    if (transcription && activeMode === 'dictation') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      triggerPolishing(transcription, dictationStyle, dictionaryText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictationStyle, dictionaryText]);

  const handleToggleRecording = async () => {
    if (isRecording) {
      await stt.stop();
      setIsRecording(false);
      
      if (activeMode === 'dictation') {
        setTimeout(() => {
          setTranscription(prev => {
            if (prev) {
              triggerPolishing(prev, dictationStyle, dictionaryText);
            }
            return prev;
          });
        }, 150);
      } else {
        setTimeout(() => {
          setTranscription(prev => {
            if (prev) {
              handleSampleQuery(prev);
            }
            return prev;
          });
        }, 150);
      }
    } else {
      setTranscription('');
      setPolishedResult('');
      setAnswer('');
      setStatus('Starting...');
      setIsRecording(true);
      try {
        await stt.start((result) => {
          setTranscription(result.text);
        }, (s) => setStatus(s));
      } catch (err) {
        setStatus(`Error: ${err}`);
        setIsRecording(false);
      }
    }
  };

  const sampleQuestions = [
    "What did Sam say about model scaling?",
    "Who's blocking the Q3 launch?",
    "Summarize this week's LiteRT discussions"
  ]

  const handleSampleQuery = async (query: string) => {
    setIsThinking(true)
    setAnswer('Searching synthetic memory...')
    
    try {
      const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      const relevant = (syntheticData as SyntheticMemory[]).filter((m: SyntheticMemory) => 
        queryTerms.some((t: string) => m.transcript.toLowerCase().includes(t))
      );
      
      const context = relevant.map((m: SyntheticMemory, i: number) => `[${i+1}] ${m.transcript}`).join('\n\n');
      
      setAnswer('Thinking (on-device)...')
      const aiResponse = await inference.generateResponse(query, context);
      setAnswer(aiResponse);
      
      // Text-to-Speech playback
      const utterance = new SpeechSynthesisUtterance(aiResponse);
      window.speechSynthesis.speak(utterance);
      
    } catch {
      setAnswer('Demo error. Please check console.')
    } finally {
      setIsThinking(false)
    }
  }

  const handleCopyToClipboard = async () => {
    const textToCopy = dictationStyle === 'raw' ? transcription : polishedResult;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  return (
    <div className="demo-page card">
      <h2>Try VoiceMemory</h2>
      
      {/* Mode selection tabs */}
      <div className="mode-tabs">
        <button 
          className={`mode-tab ${activeMode === 'dictation' ? 'active' : ''}`}
          onClick={() => {
            setActiveMode('dictation');
            setStatus('');
          }}
        >
          🎙️ AI Dictation
        </button>
        <button 
          className={`mode-tab ${activeMode === 'memory' ? 'active' : ''}`}
          onClick={() => {
            setActiveMode('memory');
            setStatus('');
          }}
        >
          🧠 Query Memory
        </button>
      </div>

      {activeMode === 'memory' ? (
        <>
          <p className="status-text">Queries a synthetic memory of Abhi's industry conversations on-device.</p>
          <div className="sample-queries">
            {sampleQuestions.map((q, i) => (
              <button 
                key={i} 
                className="sample-q-btn"
                onClick={() => handleSampleQuery(q)}
                disabled={isThinking}
              >
                ▶ {q}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="dictation-settings">
          <p className="status-text">Dictate raw speech, auto-format text with AI, and copy instantly.</p>
          
          {/* Style pills */}
          <div className="style-selector">
            {(['cleaned', 'bullets', 'email', 'slack', 'raw'] as const).map((style) => (
              <button
                key={style}
                className={`style-pill ${dictationStyle === style ? 'active' : ''}`}
                onClick={() => setDictationStyle(style)}
              >
                {style === 'cleaned' && '✨ Cleaned'}
                {style === 'bullets' && '📋 Bullets'}
                {style === 'email' && '✉️ Email'}
                {style === 'slack' && '💬 Slack'}
                {style === 'raw' && '📄 Raw'}
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
        
        {activeMode === 'dictation' ? (
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
                    className={`copy-btn ${isCopied ? 'copied' : ''}`} 
                    onClick={handleCopyToClipboard}
                    disabled={isPolishing}
                  >
                    {isCopied ? '✓ Copied' : '📋 Copy'}
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
            </div>
          )
        )}
      </div>

      <div className="voice-controls">
        <button 
          className={`record-btn ${isRecording ? 'recording' : ''}`}
          onClick={handleToggleRecording}
        >
          {isRecording 
            ? '⏹ Stop Recording' 
            : activeMode === 'dictation' 
              ? '🎤 Dictate with AI' 
              : '🎤 Ask a Voice Query'
          }
        </button>
      </div>

      <div className="install-prompt">
        <button className="record-btn secondary" style={{fontSize: '0.9rem', padding: '0.8rem 1.5rem'}}>
          Install full app
        </button>
        <p className="status-text">Dictation modes run entirely client-side inside your browser.</p>
      </div>
    </div>
  )
}

export default Demo
