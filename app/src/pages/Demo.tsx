import { useState } from 'react'
import { inference } from '../lib/inference'
import syntheticData from '../data/synthetic_memory.json'
import { stt } from '../lib/stt'

function Demo() {
  const [answer, setAnswer] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [status, setStatus] = useState('');

  const handleToggleRecording = async () => {
    if (isRecording) {
      await stt.stop();
      setIsRecording(false);
    } else {
      setTranscription('');
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
      // For the demo, we override the retrieval to use synthetic data
      const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      const relevant = syntheticData.filter((m: any) => 
        queryTerms.some((t: string) => m.transcript.toLowerCase().includes(t))
      );
      
      const context = relevant.map((m: any, i: number) => `[${i+1}] ${m.transcript}`).join('\n\n');
      
      setAnswer('Thinking (on-device)...')
      const aiResponse = await inference.generateResponse(query, context);
      setAnswer(aiResponse);
      
      // Text-to-Speech playback
      const utterance = new SpeechSynthesisUtterance(aiResponse);
      window.speechSynthesis.speak(utterance);
      
    } catch (e) {
      setAnswer('Demo error. Please check console.')
    } finally {
      setIsThinking(false)
    }
  }

  return (
    <div className="demo-page card">
      <h2>Try VoiceMemory</h2>
      <p className="status-text">No permissions needed. Tapping below queries a synthetic memory of Abhi's industry conversations.</p>
      
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

      <div className="answer-area">
        {status && <div className="debug-status">Status: {status}</div>}
        {transcription && (
          <div className="transcription-preview">
            <strong>Transcribed:</strong> {transcription}
          </div>
        )}
        {answer && (
          <div className="ai-response">
            <p>{answer}</p>
          </div>
        )}
      </div>

      <div className="voice-controls">
        <button 
          className={`record-btn ${isRecording ? 'recording' : ''}`}
          onClick={handleToggleRecording}
        >
          {isRecording ? '⏹ Stop Recording' : '🎤 Start Voice Query'}
        </button>
      </div>

      <div className="install-prompt">
        <button className="record-btn secondary" style={{fontSize: '1rem', padding: '1rem 2rem'}}>
          Install for yourself
        </button>
        <p className="status-text">Only the full app requires mic permissions.</p>
      </div>
    </div>
  )
}

export default Demo
