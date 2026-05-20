import { useState, useEffect } from 'react'
import './App.css'
import { stt } from './lib/stt'
import { saveMemo, getAllMemos } from './lib/storage'
import type { VoiceMemo } from './lib/storage'
import { retrieveRelevantContext } from './lib/rag'
import { inference } from './lib/inference'
import Demo from './pages/Demo'

function App() {
  const isDemoMode = window.location.hostname.includes('voicememory') || window.location.search.includes('demo')
  const [activeTab, setActiveTab] = useState<'record' | 'query' | 'timeline' | 'demo'>(isDemoMode ? 'demo' : 'record')
  const [isRecording, setIsRecording] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [history, setHistory] = useState<VoiceMemo[]>([])
  
  // Query state
  const [query, setQuery] = useState('')
  const [isAnswering, setIsAnswering] = useState(false)
  const [answer, setAnswer] = useState('')
  const [citations, setCitations] = useState<VoiceMemo[]>([])

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    const memos = await getAllMemos()
    setHistory(memos.sort((a, b) => b.timestamp - a.timestamp))
  }

  const handleRecordToggle = async () => {
    if (isRecording) {
      const audioBlob = await stt.stop()
      setIsRecording(false)
      
      if (currentTranscript.trim()) {
        await saveMemo({
          timestamp: Date.now(),
          transcript: currentTranscript.trim(),
          audioBlob
        })
        loadHistory()
      }
    } else {
      setCurrentTranscript('')
      setIsRecording(true)
      await stt.start((result) => {
        setCurrentTranscript(result.text)
      })
    }
  }

  const handleQuery = async () => {
    if (!query.trim() || isAnswering) return
    
    setIsAnswering(true)
    setAnswer('Searching memories...')
    
    try {
      const { context, citations } = await retrieveRelevantContext(query)
      setCitations(citations)
      
      setAnswer('Thinking...')
      const aiResponse = await inference.generateResponse(query, context)
      setAnswer(aiResponse)
    } catch (error) {
      console.error('Query failed:', error)
      setAnswer('Sorry, I encountered an error while searching your memories.')
    } finally {
      setIsAnswering(false)
    }
  }

  return (
    <div className="app-container">
      <header>
        <img src="/pwa-512x512.png" className="logo" alt="VoiceMemory logo" />
        <h1>VoiceMemory</h1>
        <p className="tagline">Your personal on-device AI memory</p>
      </header>

      {activeTab === 'record' && (
        <main className="card">
          <button 
            className={`record-btn ${isRecording ? 'recording' : ''}`} 
            onClick={handleRecordToggle}
          >
            {isRecording ? 'Stop' : 'Record'}
          </button>
          
          <div className="transcript-preview">
            <p className="status-text">
              {isRecording ? 'Listening...' : 'Tap to capture a memo'}
            </p>
            {currentTranscript && (
              <div className="live-transcript">
                {currentTranscript}
              </div>
            )}
          </div>
        </main>
      )}

      {activeTab === 'query' && (
        <main className="card query-view">
          <div className="query-input-group">
            <input 
              type="text" 
              placeholder="Ask about your memories..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
            />
            <button onClick={handleQuery} disabled={isAnswering}>
              {isAnswering ? '...' : '→'}
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
                        <li key={i}>"{cite.transcript.substring(0, 50)}..."</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      )}

      {activeTab === 'demo' && <Demo />}

      {(activeTab === 'record' || activeTab === 'timeline') && (
        <section className="timeline">
          <h2>Recent Memories</h2>
          <div className="memo-list">
            {history.length === 0 ? (
              <p className="empty-state">No memories captured yet.</p>
            ) : (
              history.slice(0, activeTab === 'timeline' ? undefined : 3).map((memo) => (
                <div key={memo.id} className="memo-item">
                  <span className="memo-date">
                    {new Date(memo.timestamp).toLocaleTimeString()}
                  </span>
                  <p className="memo-text">{memo.transcript}</p>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      <nav className="nav-bar">
        <button 
          className={`nav-item ${activeTab === 'record' ? 'active' : ''}`}
          onClick={() => setActiveTab('record')}
        >
          <div className="nav-icon">🎙️</div>
          <span>Record</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'query' ? 'active' : ''}`}
          onClick={() => setActiveTab('query')}
        >
          <div className="nav-icon">🔍</div>
          <span>Query</span>
        </button>
        <button 
          className={`nav-item ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          <div className="nav-icon">📜</div>
          <span>Timeline</span>
        </button>
      </nav>
    </div>
  )
}

export default App
