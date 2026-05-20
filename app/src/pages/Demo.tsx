import { useState } from 'react'
import { inference } from '../lib/inference'
import syntheticData from '../../../public-demo/synthetic_memory.json'

function Demo() {
  const [answer, setAnswer] = useState('')
  const [isThinking, setIsThinking] = useState(false)

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
      const relevant = syntheticData.filter(m => 
        queryTerms.some(t => m.transcript.toLowerCase().includes(t))
      );
      
      const context = relevant.map((m, i) => `[${i+1}] ${m.transcript}`).join('\n\n');
      
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
        {answer && (
          <div className="ai-response">
            <p>{answer}</p>
          </div>
        )}
      </div>

      <div className="install-prompt">
        <button className="record-btn" style={{fontSize: '1rem', padding: '1rem 2rem'}}>
          Install for yourself
        </button>
        <p className="status-text">Only the full app requires mic permissions.</p>
      </div>
    </div>
  )
}

export default Demo
