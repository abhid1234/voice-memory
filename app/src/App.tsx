import { useState, useEffect, useRef, useMemo } from 'react'
import './App.css'
import { stt } from './lib/stt'
import { embed } from './lib/embeddings'
import { saveMemo, getAllMemos, deleteMemo, wipeAllMemos } from './lib/storage'
import type { VoiceMemo } from './lib/storage'
import { retrieve } from './lib/rag'
import { getInference } from './lib/inference'
import { speak } from './lib/tts'
import ModelDownloadGate from './components/ModelDownloadGate'
import Demo from './pages/Demo'
import { playRecordStartSound, playRecordStopSound, playSuccessSound, playDeleteSound, playUndoSound } from './lib/synth'
import { computeWordDiff } from './lib/diff'

// Inline SVG Icon Components
const MicIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const MemoriesIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2" fill="currentColor" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

const TimelineIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const SearchIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" x2="16.65" y1="21" y2="16.65" />
  </svg>
);

const VaultIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const DemoIcon = () => (
  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.25-2.5 3.5-2.5 3.5s2.25-1 3.5-2.5M15 9l-9 9M9 15l-3 3M17 3c1.66 0 3 1.34 3 3v7h-7V6c0-1.66 1.34-3 3-3z" />
  </svg>
);

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '22px', height: '22px' }}>
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '22px', height: '22px' }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const LogoIcon = ({ className = 'app-logo', size = 24 }: { className?: string, size?: number }) => (
  <svg 
    className={className} 
    style={{ width: `${size}px`, height: `${size}px`, display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }} 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Soft glowing ambient circle */}
    <circle cx="16" cy="16" r="14" fill="var(--accent-light)" opacity="0.6" />
    
    {/* Outer ring */}
    <circle cx="16" cy="16" r="13" stroke="var(--accent-color)" strokeWidth="1.5" strokeOpacity="0.3" />
    
    {/* Dual helix overlapping soundwaves */}
    <path 
      d="M 6,16 Q 9,9 11,16 T 16,16 T 21,16 T 26,16" 
      stroke="var(--accent-color)" 
      strokeWidth="2.2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
    <path 
      d="M 6,16 Q 9,23 11,16 T 16,16 T 21,16 T 26,16" 
      stroke="var(--accent-bright)" 
      strokeWidth="1.2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      opacity="0.45" 
    />
  </svg>
);
const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '22px', height: '22px' }}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const SparklesIcon = () => (
  <svg style={{ width: '14px', height: '14px', marginRight: '4px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
  </svg>
);

const ListIcon = () => (
  <svg style={{ width: '14px', height: '14px', marginRight: '4px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth="3" />
    <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth="3" />
    <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth="3" />
  </svg>
);

const MailIcon = () => (
  <svg style={{ width: '14px', height: '14px', marginRight: '4px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const MessageSquareIcon = () => (
  <svg style={{ width: '14px', height: '14px', marginRight: '4px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const EditIcon = () => (
  <svg style={{ width: '14px', height: '14px', marginRight: '4px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const FileTextIcon = () => (
  <svg style={{ width: '14px', height: '14px', marginRight: '4px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

function App() {
  const isDemoMode = window.location.hostname.includes('voicememory') || window.location.search.includes('demo')
  const [activeTab, setActiveTab] = useState<'dictation' | 'memories' | 'timeline' | 'query' | 'vault' | 'demo'>(isDemoMode ? 'demo' : 'dictation')
  const [isRecording, setIsRecording] = useState(false)
  const [isTogglingRecord, setIsTogglingRecord] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [history, setHistory] = useState<VoiceMemo[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
  // Query state
  const [query, setQuery] = useState('')
  const [isAnswering, setIsAnswering] = useState(false)
  const [answer, setAnswer] = useState('')
  const [citations, setCitations] = useState<VoiceMemo[]>([])
  const [modelState, setModelState] = useState<string>('checking')

  // Wispr Flow dictation states
  const [dictationStyle, setDictationStyle] = useState<'cleaned' | 'bullets' | 'email' | 'slack' | 'custom' | 'raw'>('cleaned')
  const [dictionaryTags, setDictionaryTags] = useState<string[]>(['LiteRT', 'LoRA', 'Vercel', 'Abhi'])
  const [tagInput, setTagInput] = useState('')
  const [customInstruction, setCustomInstruction] = useState('Translate to Spanish')
  const [polishedResult, setPolishedResult] = useState('')
  const [editableDraft, setEditableDraft] = useState('')
  const [draftInsights, setDraftInsights] = useState('')
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isPolishing, setIsPolishing] = useState(false)
  const [lastAudioBlob, setLastAudioBlob] = useState<Blob | undefined>(undefined)
  const [statusText, setStatusText] = useState('Ready to transcribe')
  const [audioDuration, setAudioDuration] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  
  // Diagnostic model progress states
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null)

  // Premium themes and visualization refs
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });
  const [selectedModel, setSelectedModel] = useState(() => stt.getCurrentModel());

  const allUniqueTags = useMemo(() => {
    return Array.from(new Set(history.flatMap(memo => memo.tags || [])));
  }, [history]);

  const draftWordCount = useMemo(() => {
    return editableDraft.split(/\s+/).filter(Boolean).length;
  }, [editableDraft]);

  const phaseRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Export Drawer Modal State
  const [isExportDrawerOpen, setIsExportDrawerOpen] = useState(false);

  // Search & Filter state for Timeline cards
  const [timelineSearch, setTimelineSearch] = useState('');
  const [timelineFilterAudioOnly, setTimelineFilterAudioOnly] = useState(false);

  // PWA Installation state hooks
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(() => {
    return localStorage.getItem('hideInstallBanner') !== 'true';
  });

  // Diff viewer state
  const [showDiff, setShowDiff] = useState(false);

  // Undo delete state
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [undoMemo, setUndoMemo] = useState<VoiceMemo | null>(null);
  const undoTimeoutRef = useRef<number | null>(null);

  // Cleanup undo timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  // Backup & Restore file input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Tag filter state
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

  // Engine Doctor Modal state
  const [isDoctorOpen, setIsDoctorOpen] = useState(false);
  const [doctorQuota, setDoctorQuota] = useState('Estimating...');
  const [doctorCacheSize, setDoctorCacheSize] = useState('Estimating...');

  // Accent selector state
  const [accentTheme, setAccentTheme] = useState<'emerald' | 'violet' | 'ocean' | 'amber'>(() => {
    return (localStorage.getItem('accentTheme') as 'emerald' | 'violet' | 'ocean' | 'amber') || 'emerald';
  });

  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);
  const fileImportInputRef = useRef<HTMLInputElement | null>(null);

  // Spotlight tour state
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

  // Refs to avoid stale closures in STT callbacks
  const dictationStyleRef = useRef(dictationStyle);
  const dictionaryTagsRef = useRef(dictionaryTags);
  const customInstructionRef = useRef(customInstruction);

  useEffect(() => {
    dictationStyleRef.current = dictationStyle;
  }, [dictationStyle]);

  useEffect(() => {
    dictionaryTagsRef.current = dictionaryTags;
  }, [dictionaryTags]);

  useEffect(() => {
    customInstructionRef.current = customInstruction;
  }, [customInstruction]);

  useEffect(() => {
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (navigator as Navigator & { standalone?: boolean }).standalone 
      || document.referrer.includes('android-app://');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsStandalone(!!checkStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsStandalone(true);
    }
  };

  const handleDismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('hideInstallBanner', 'true');
  };

  // Theme Sync Hook
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Accent Theme Sync Hook
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accentTheme);
    localStorage.setItem('accentTheme', accentTheme);
  }, [accentTheme]);

  // Drag & drop / File Import handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processImportedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processImportedFile(e.target.files[0]);
    }
  };

  const processImportedFile = async (file: File) => {
    setStatusText(`Loading file: ${file.name}...`);
    let audioCtx: AudioContext | null = null;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioContextClass = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioContextClass({ sampleRate: 16000 });
      
      setStatusText(`Decoding audio data...`);
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const float32Data = audioBuffer.getChannelData(0);
      
      setLastAudioBlob(file);
      setStatusText('Transcribing imported audio on-device...');
      
      await stt.transcribeBuffer(
        float32Data,
        (result) => {
          let text = result.text || '';
          text = text.replace(/\[BLANK_AUDIO\]/gi, '').trim();
          setCurrentTranscript(text);
          if (text) {
            triggerPolishing(
              text,
              dictationStyleRef.current,
              dictionaryTagsRef.current,
              customInstructionRef.current
            );
          } else {
            setStatusText('No speech detected in imported audio');
          }
        },
        (status) => {
          setStatusText(status);
        },
        (file, progress) => {
          setDownloadingFile(file);
          setDownloadProgress(progress);
          if (progress >= 100) {
            setTimeout(() => {
              setDownloadProgress(null);
              setDownloadingFile(null);
            }, 1200);
          }
        }
      );
    } catch (err) {
      console.error('Failed to import audio file:', err);
      setStatusText(`Error importing audio: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (audioCtx) {
        audioCtx.close().catch(e => console.error('Error closing AudioContext after import decode:', e));
      }
    }
  };

  // Onboarding spotlight tour hooks
  useEffect(() => {
    const isCompleted = localStorage.getItem('onboardingTourCompleted');
    // Never run the onboarding tour on the public zero-permission demo (?demo).
    if (!isCompleted && history.length === 0 && !isDemoMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTourStep(0);
    }
  }, [history, isDemoMode]);

  useEffect(() => {
    if (tourStep === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSpotlightRect(null);
      return;
    }

    const step = tourSteps[tourStep];
    if (!step || !step.targetId) {
      setSpotlightRect(null);
      return;
    }

    let targetId = step.targetId;
    if (targetId === 'tour-header-nav' && window.innerWidth <= 768) {
      targetId = 'tour-mobile-nav';
    }

    // Scroll target into view once when step starts (avoiding resize/scroll listener recursion)
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    let ticking = false;
    const updateRect = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          let currentTargetId = step.targetId;
          if (currentTargetId === 'tour-header-nav' && window.innerWidth <= 768) {
            currentTargetId = 'tour-mobile-nav';
          }
          const el = document.getElementById(currentTargetId);
          setSpotlightRect(el ? el.getBoundingClientRect() : null);
          ticking = false;
        });
        ticking = true;
      }
    };

    const timer = setTimeout(updateRect, 100);
    
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
    };
  }, [tourStep, activeTab]);

  useEffect(() => {
    if (tourStep !== null) {
      if (tourStep >= 1 && tourStep <= 3) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setActiveTab('dictation');
      }
    }
  }, [tourStep]);

  // Cancel tour if user navigates away from the required tab
  useEffect(() => {
    if (tourStep !== null && tourStep >= 1 && tourStep <= 3 && activeTab !== 'dictation') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTourStep(null);
    }
  }, [activeTab, tourStep]);

  // Mic Visualizer reference
  const recordWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadHistory()
  }, [])

  // Auto-polish whenever style, dictionary, or custom instructions change in flow mode
  useEffect(() => {
    if (currentTranscript) {
      triggerPolishing(currentTranscript, dictationStyle, dictionaryTags, customInstruction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictationStyle, dictionaryTags, customInstruction]);

  // Keep editableDraft in sync with the polishedResult or raw transcript
  useEffect(() => {
    if (!isPolishing && !isRecording) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditableDraft(polishedResult || currentTranscript);
    }
  }, [polishedResult, currentTranscript, isPolishing, isRecording]);

  // requestAnimationFrame loop for dynamic voice level visualizer and waveform drawing
  useEffect(() => {
    let animationFrameId: number;

    const updateVolumeVisualizer = () => {
      const analyser = stt.getAnalyser();
      if (analyser && recordWrapperRef.current) {
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        let sum = 0;
        for (let i = 0; i < array.length; i++) {
          sum += array[i];
        }
        const average = sum / array.length;
        // Normalize: average frequency volume maps scale from 1.0 to 1.45, opacity from 0.15 to 0.75
        const volumeScale = 1 + (average / 128) * 0.45;
        const rippleOpacity = 0.15 + (average / 128) * 0.6;
        
        recordWrapperRef.current.style.setProperty('--volume-ripple-scale', `${volumeScale}`);
        recordWrapperRef.current.style.setProperty('--volume-ripple-opacity', `${rippleOpacity}`);

        // Draw fluid wave on canvas
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const rect = canvas.getBoundingClientRect();
            if (canvas.width !== rect.width || canvas.height !== rect.height) {
              canvas.width = rect.width;
              canvas.height = rect.height;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const amplitude = (average / 255) * (canvas.height * 0.45);
            phaseRef.current = (phaseRef.current || 0) + 0.12;

            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const waveColors = isDark ? [
              'rgba(138, 207, 162, 0.45)', // bright sage mint
              'rgba(92, 148, 114, 0.25)',
              'rgba(92, 148, 114, 0.12)'
            ] : [
              'rgba(78, 126, 96, 0.4)',
              'rgba(92, 148, 114, 0.25)',
              'rgba(53, 86, 65, 0.15)'
            ];

            for (let w = 0; w < 3; w++) {
              ctx.beginPath();
              ctx.strokeStyle = waveColors[w];
              ctx.lineWidth = w === 0 ? 2.5 : 1.5;
              
              const wavePhase = phaseRef.current + w * Math.PI / 3;
              const waveFrequency = 0.015 + w * 0.005;

              for (let x = 0; x < canvas.width; x++) {
                const envelope = Math.sin((x / canvas.width) * Math.PI);
                const y = (canvas.height / 2) + Math.sin(x * waveFrequency + wavePhase) * amplitude * envelope;
                if (x === 0) {
                  ctx.moveTo(x, y);
                } else {
                  ctx.lineTo(x, y);
                }
              }
              ctx.stroke();
            }
          }
        }
      }
      if (isRecording) {
        animationFrameId = requestAnimationFrame(updateVolumeVisualizer);
      }
    };

    if (isRecording) {
      updateVolumeVisualizer();
    } else {
      if (recordWrapperRef.current) {
        recordWrapperRef.current.style.setProperty('--volume-ripple-scale', '1');
        recordWrapperRef.current.style.setProperty('--volume-ripple-opacity', '0.15');
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isRecording]);

  const triggerPolishing = async (text: string, style: string, dict: string[], customInst?: string) => {
    setIsPolishing(true);
    setStatusText('AI is polishing the transcription...');
    try {
      const polished = await getInference().polishTranscript(text, style, dict, customInst);
      setPolishedResult(polished);
      setStatusText('Polishing complete');
      triggerInsights(polished);
    } catch (err) {
      console.error('Polishing error:', err);
      setStatusText('Polishing failed. Using raw transcript.');
    } finally {
      setIsPolishing(false);
    }
  };

  const triggerInsights = async (text: string) => {
    if (!text.trim()) {
      setDraftInsights('');
      return;
    }
    setIsGeneratingInsights(true);
    try {
      const insights = await getInference().generateInsights(text);
      setDraftInsights(insights);
    } catch (err) {
      console.error('Insights generation error:', err);
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const classifyTags = (text: string): string[] => {
    const tags: string[] = [];
    const lowerText = text.toLowerCase();
    const categories = [
      { name: 'Work', keywords: ['meeting', 'call', 'sync', 'project', 'launch', 'deadline', 'task', 'milestone', 'action item', 'team', 'client', 'presentation', 'manager', 'schedule'] },
      { name: 'Personal', keywords: ['buy', 'groceries', 'home', 'family', 'doctor', 'gym', 'health', 'workout', 'dinner', 'gift', 'weekend', 'vacation', 'recipe'] },
      { name: 'Idea', keywords: ['idea', 'concept', 'brainstorm', 'maybe we could', 'think about', 'creative', 'design', 'write', 'draft', 'innovate', 'thought'] },
      { name: 'Tech', keywords: ['code', 'bug', 'git', 'pr', 'deploy', 'build', 'api', 'database', 'webgpu', 'whisper', 'gemma', 'model', 'react', 'typescript', 'javascript', 'html', 'css', 'vercel'] }
    ];
    categories.forEach(cat => {
      if (cat.keywords.some(kw => lowerText.includes(kw))) {
        tags.push(cat.name);
      }
    });
    return tags;
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleExportBackup = async () => {
    setStatusText('Generating local database backup...');
    try {
      const memos = await getAllMemos();
      const serialized = await Promise.all(memos.map(async memo => {
        let audioBase64 = '';
        if (memo.audioBlob) {
          audioBase64 = await blobToBase64(memo.audioBlob);
        }
        return {
          timestamp: memo.timestamp,
          transcript: memo.transcript,
          rawTranscript: memo.rawTranscript,
          tags: memo.tags,
          audioBase64
        };
      }));
      const blob = new Blob([JSON.stringify(serialized, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `VoiceMemory_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      playSuccessSound();
      setStatusText('Backup exported successfully');
    } catch (err) {
      console.error('Backup export failed:', err);
      setStatusText('Backup export failed');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusText('Restoring local backup...');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('Invalid backup format');
      
      for (const item of parsed) {
        let audioBlob: Blob | undefined = undefined;
        if (item.audioBase64) {
          const res = await fetch(item.audioBase64);
          audioBlob = await res.blob();
        }
        await saveMemo({
          timestamp: item.timestamp,
          transcript: item.transcript,
          rawTranscript: item.rawTranscript,
          tags: item.tags || [],
          audioBlob
        });
      }
      playSuccessSound();
      setStatusText('Backup restored successfully');
      loadHistory();
    } catch (err) {
      console.error('Backup restore failed:', err);
      setStatusText('Backup restore failed: invalid file');
    }
  };

  const fetchStorageMetrics = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const usageMB = Math.round((estimate.usage || 0) / (1024 * 1024));
        const quotaMB = Math.round((estimate.quota || 0) / (1024 * 1024));
        const pct = Math.round((estimate.usage || 0) / (estimate.quota || 1) * 100);
        setDoctorQuota(`${usageMB} MB used of ${quotaMB} MB quota (${pct}%)`);
      } catch {
        setDoctorQuota('Error loading storage estimation');
      }
    } else {
      setDoctorQuota('Storage Estimate API unsupported');
    }

    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        let totalSize = 0;
        for (const key of keys) {
          const cache = await caches.open(key);
          const requests = await cache.keys();
          for (const req of requests) {
            const res = await cache.match(req);
            if (res) {
              const contentLength = res.headers.get('content-length');
              if (contentLength) {
                totalSize += parseInt(contentLength, 10);
              } else {
                const blob = await res.blob();
                totalSize += blob.size;
              }
            }
          }
        }
        const cacheMB = (totalSize / (1024 * 1024)).toFixed(2);
        setDoctorCacheSize(`${cacheMB} MB across ${keys.length} caches (${keys.join(', ') || 'none'})`);
      } catch {
        setDoctorCacheSize('Error calculating cache size');
      }
    } else {
      setDoctorCacheSize('Cache Storage API unsupported');
    }
  };

  const openDoctor = async () => {
    setIsDoctorOpen(true);
    fetchStorageMetrics();
  };

  const handleWipeDatabase = async () => {
    if (!confirm('CRITICAL WARNING: Are you sure you want to delete all saved memories from your local database? This action is permanent and cannot be undone.')) return;
    setStatusText('Wiping local database...');
    try {
      await wipeAllMemos();
      playDeleteSound();
      setStatusText('Local database wiped successfully');
      loadHistory();
    } catch (err) {
      console.error('Database wipe failed:', err);
      setStatusText('Database wipe failed');
    }
  };

  const clearAppCaches = async () => {
    if (!confirm('Are you sure you want to delete all cached models? They will have to be redownloaded next time you record.')) return;
    setStatusText('Clearing local caches...');
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
        playSuccessSound();
        setStatusText('Caches cleared successfully. SW restart recommended.');
        openDoctor();
      }
    } catch (err) {
      console.error('Failed to clear cache:', err);
      setStatusText('Failed to clear cache');
    }
  };

  const handleDeleteMemo = async (id: number) => {
    const memoToDelete = history.find(m => m.id === id);
    if (!memoToDelete) return;

    // Optimistic UI update
    setHistory(prev => prev.filter(m => m.id !== id));
    setUndoMemo(memoToDelete);
    setShowUndoToast(true);
    playDeleteSound();

    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    undoTimeoutRef.current = window.setTimeout(async () => {
      if (memoToDelete.id !== undefined) {
        await deleteMemo(memoToDelete.id);
      }
      setShowUndoToast(false);
      setUndoMemo(null);
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    if (undoMemo) {
      setHistory(prev => [...prev, undoMemo].sort((a, b) => b.timestamp - a.timestamp));
      playUndoSound();
      setStatusText('Memo restore cancelled deletion');
    }
    setShowUndoToast(false);
    setUndoMemo(null);
  };

  async function loadHistory() {
    const memos = await getAllMemos()
    setHistory(memos.sort((a, b) => b.timestamp - a.timestamp))
  }

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const cleaned = tagInput.trim().replace(/,$/, '');
      if (cleaned && !dictionaryTags.includes(cleaned)) {
        setDictionaryTags([...dictionaryTags, cleaned]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setDictionaryTags(dictionaryTags.filter(t => t !== tagToRemove));
  };

  // Timer for audio duration
  useEffect(() => {
    if (!isRecording) return;
    const startTime = Date.now();
    const interval = setInterval(() => {
      setAudioDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => {
      clearInterval(interval);
      Promise.resolve().then(() => setAudioDuration(0));
    };
  }, [isRecording]);

  const handleRecordToggle = async () => {
    if (isTogglingRecord) return;
    setIsTogglingRecord(true);
    try {
      if (isRecording) {
        playRecordStopSound();
        setStatusText('Stopping recorder...');
        const audioBlob = await stt.stop()
        setIsRecording(false)
        setLastAudioBlob(audioBlob)
        if (audioBlob) {
          setStatusText('Transcribing audio on-device...');
        } else {
          setStatusText('Recording stopped (no audio captured)');
        }
      } else {
        playRecordStartSound();
        window.speechSynthesis.cancel()
        setIsSpeaking(false)
        
        setCurrentTranscript('')
        setPolishedResult('')
        setLastAudioBlob(undefined)
        setIsRecording(true)
        setStatusText('Recording... Speak clearly.');
        
        await stt.start(
          (result) => {
            let text = result.text || '';
            // Remove Whisper artifacts like [BLANK_AUDIO]
            text = text.replace(/\[BLANK_AUDIO\]/gi, '').trim();
            setCurrentTranscript(text);
            if (text) {
              triggerPolishing(
                text,
                dictationStyleRef.current,
                dictionaryTagsRef.current,
                customInstructionRef.current
              );
            } else {
              setStatusText('No speech detected');
            }
          },
          (status) => {
            setStatusText(status);
          },
          (file, progress) => {
            setDownloadingFile(file);
            setDownloadProgress(progress);
            if (progress >= 100) {
              setTimeout(() => {
                setDownloadProgress(null);
                setDownloadingFile(null);
              }, 1200);
            }
          }
        )
      }
    } catch (err) {
      console.error('Error toggling record:', err);
      setStatusText(`Error toggling record: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsTogglingRecord(false);
    }
  }

  const handleLoadMemoFromHistory = (memo: VoiceMemo) => {
    setPolishedResult(memo.transcript);
    setCurrentTranscript(memo.rawTranscript || memo.transcript);
    setEditableDraft(memo.transcript);
    setLastAudioBlob(memo.audioBlob);
    setActiveTab('dictation');
    setStatusText('Loaded past memory into editor sheet');
    triggerInsights(memo.transcript);
  };

  const handleSavePolishedMemo = async () => {
    if (!editableDraft.trim()) return;

    setStatusText('Generating RAG embedding...');
    let embedding: Float32Array | undefined;
    try {
      embedding = await embed(editableDraft.trim());
    } catch (err) {
      console.error('Failed to generate embedding:', err);
    }

    await saveMemo({
      timestamp: Date.now(),
      transcript: editableDraft.trim(),
      rawTranscript: currentTranscript.trim() || undefined,
      audioBlob: lastAudioBlob,
      tags: classifyTags(editableDraft),
      embedding
    });
    
    playSuccessSound();
    // Reset states
    setCurrentTranscript('');
    setPolishedResult('');
    setEditableDraft('');
    setDraftInsights('');
    setLastAudioBlob(undefined);
    setStatusText('Memo saved to timeline');
    loadHistory();
  };

  // Cancel speech synthesis whenever tab changes
  useEffect(() => {
    window.speechSynthesis.cancel();
    Promise.resolve().then(() => setIsSpeaking(false));
  }, [activeTab]);

  // Clean up synthesis on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleSpeak = () => {
    if (!editableDraft) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(editableDraft);
      utterance.onend = () => {
        setIsSpeaking(false);
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
      };
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!editableDraft) return;

    try {
      await navigator.clipboard.writeText(editableDraft);
      playSuccessSound();
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const handleQuery = async () => {
    if (!query.trim() || isAnswering) return
    setIsAnswering(true)
    setAnswer('Searching memories…')
    setCitations([])
    try {
      const queryVec = await embed(query)
      const memos = (await getAllMemos()).filter((m) => m.embedding?.length)
      const { context, citations } = retrieve(queryVec, memos, 5)
      setCitations(citations)
      
      if (modelState === 'ready' && getInference().isReady()) {
        setAnswer('')
        let acc = ''
        const final = await getInference().generateResponse(query, context, (token) => {
          acc += token
          setAnswer(acc)
        })
        setAnswer(final)
        speak(final)
      } else {
        setAnswer('Semantic search complete! Matching memories have been cited below. (To get a synthesized AI response, activate the offline AI engine below.)')
      }
    } catch (error) {
      console.error('Query failed:', error)
      setAnswer('Sorry, I hit an error answering from your memories.')
    } finally {
      setIsAnswering(false)
    }
  }

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="app-container">
      {/* Persistent Site Header */}
      <header className="site-header">
        <div className="header-left">
          <button 
            className="mobile-menu-btn" 
            onClick={() => setIsSidebarOpen(true)}
            title="Open Menu"
          >
            <MenuIcon />
          </button>
          <div className="header-logo-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogoIcon className="mini-logo" size={24} />
            <span className="site-title" style={{ fontWeight: 700, fontSize: 'var(--fs-lg)', color: 'var(--text-main)' }}>VoiceMemory</span>
          </div>
        </div>
        
        <div className="header-right">
          <button 
            className="theme-toggle-btn-icon"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title="Toggle Theme"
            style={{ fontSize: 'var(--fs-lg)' }}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button 
            className="settings-gear-btn" 
            onClick={openDoctor}
            title="Engine Settings"
          >
            <SettingsIcon />
          </button>
          <div className="header-profile-circle">A</div>
        </div>
      </header>

      {/* App Sidebar (Persistent on Desktop, Slide-out on Mobile) */}
      <aside className={`app-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogoIcon className="sidebar-logo" size={28} />
            <span className="sidebar-title" style={{ fontWeight: 700, fontSize: 'var(--fs-xl)', fontFamily: 'var(--font-display)', color: 'var(--text-main)' }}>VoiceMemory</span>
          </div>
          <button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)} aria-label="Close Sidebar">✕</button>
        </div>
        
        <nav className="sidebar-nav" id="tour-header-nav">
          <button 
            className={`sidebar-nav-link ${activeTab === 'dictation' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dictation'); setIsSidebarOpen(false); }}
          >
            <MicIcon />
            <span>Dictation</span>
          </button>
          <button 
            className={`sidebar-nav-link ${activeTab === 'memories' ? 'active' : ''}`}
            onClick={() => { setActiveTab('memories'); setIsSidebarOpen(false); }}
          >
            <MemoriesIcon />
            <span>Memories</span>
          </button>
          <button 
            className={`sidebar-nav-link ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => { setActiveTab('timeline'); setIsSidebarOpen(false); }}
          >
            <TimelineIcon />
            <span>Timeline</span>
          </button>
          <button 
            className={`sidebar-nav-link ${activeTab === 'query' ? 'active' : ''}`}
            onClick={() => { setActiveTab('query'); setIsSidebarOpen(false); }}
          >
            <SearchIcon />
            <span>Search</span>
          </button>
          <button 
            className={`sidebar-nav-link ${activeTab === 'vault' ? 'active' : ''}`}
            onClick={() => { setActiveTab('vault'); setIsSidebarOpen(false); }}
          >
            <VaultIcon />
            <span>Vault</span>
          </button>
          {isDemoMode && (
            <button 
              className={`sidebar-nav-link ${activeTab === 'demo' ? 'active' : ''}`}
              onClick={() => { setActiveTab('demo'); setIsSidebarOpen(false); }}
            >
              <DemoIcon />
              <span>Demo Portal</span>
            </button>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="cloud-sync-card">
            <div className="cloud-sync-header">
              <svg className="cloud-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>On-device</span>
            </div>
            <div className="cloud-sync-subtext">Private — nothing synced</div>
          </div>
          
          <div className="sidebar-footer-info" style={{ padding: '0.5rem', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
            <div className="engine-status" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
              <span className="status-dot online" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-bright)', display: 'inline-block' }}></span>
              <span>Local AI Engine Active</span>
            </div>
            <div className="db-durability">
              <span>Offline Persistence: 100%</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className="workspace-container">
        
        {activeTab === 'dictation' && (
          <div className="dictation-workspace">
            
            {/* Center Column: Interactive Controls + active Editorial Sheet */}
            <div className="dictation-center-column">
              {/* Onboarding Introduction Banner */}
              <div className="workspace-intro-card">
                <div className="workspace-intro-header">
                  <h3 className="workspace-intro-title">Voice Memory Journal</h3>
                  <span className="workspace-intro-badge">On-Device AI</span>
                </div>
                <p className="workspace-intro-description">
                  An offline-first, private voice dictation and semantic memory explorer. 
                  Your audio and transcribed thoughts are processed entirely on-device and never leave your machine.
                </p>
                <div className="workspace-intro-features">
                  <div className="workspace-intro-feature-item">
                    <span className="workspace-intro-feature-icon">🎙️</span>
                    <div className="workspace-intro-feature-text">
                      <strong>On-Device Whisper STT</strong>
                      <span>High-accuracy transcription using OpenAI's Whisper running locally in a Web Worker.</span>
                    </div>
                  </div>
                  <div className="workspace-intro-feature-item">
                    <span className="workspace-intro-feature-icon">🧠</span>
                    <div className="workspace-intro-feature-text">
                      <strong>Local Gemma RAG</strong>
                      <span>Query your saved thoughts and get intelligent synthesis using on-device Gemma 2B.</span>
                    </div>
                  </div>
                  <div className="workspace-intro-feature-item">
                    <span className="workspace-intro-feature-icon">🌌</span>
                    <div className="workspace-intro-feature-text">
                      <strong>Constellation Mapping</strong>
                      <span>Explore semantic connections between your memories visually on an interactive radar map. Closer stars represent memories with similar concepts, tags, or topics.</span>
                    </div>
                  </div>
                </div>
                <div className="workspace-intro-steps">
                  <h4 className="workspace-intro-steps-title">Quick Start Guide</h4>
                  <ul className="workspace-intro-steps-list">
                    <li className="workspace-intro-step-item">
                      <span className="workspace-intro-step-number">1</span>
                      <span>Select AI model below</span>
                    </li>
                    <li className="workspace-intro-step-item">
                      <span className="workspace-intro-step-number">2</span>
                      <span>Click Start Dictation & speak</span>
                    </li>
                    <li className="workspace-intro-step-item">
                      <span className="workspace-intro-step-number">3</span>
                      <span>Save and explore memories</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* AI Engine Model Card */}
              <div className="top-settings-grid mobile-hidden" style={{ marginBottom: '1.2rem' }}>
                <div className="section-card bottom-grid-card">
                  <h4 className="section-title">
                    <span>AI Engine Model</span>
                    <span className="whisper-v3-badge">Whisper v3</span>
                  </h4>
                  <div className="model-segmented-control">
                    {(['Xenova/whisper-tiny.en', 'Xenova/whisper-base.en', 'Xenova/whisper-small.en'] as const).map((model) => (
                      <button
                        key={model}
                        className={`model-segment-btn ${selectedModel === model ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedModel(model);
                          stt.preloadModel(model, setStatusText, (file, prog) => {
                            setDownloadProgress(prog);
                            setDownloadingFile(file);
                          });
                          setStatusText(`Switched AI Model to ${model}`);
                        }}
                      >
                        {model === 'Xenova/whisper-tiny.en' && 'Speed'}
                        {model === 'Xenova/whisper-base.en' && 'Balanced'}
                        {model === 'Xenova/whisper-small.en' && 'Accuracy'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div 
                className={`section-card voice-controls-card ${isDragging ? 'dragging-over' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{ position: 'relative' }}
              >
                <h4 className="section-title">Voice Controls</h4>
                
                {isDragging && (
                  <div className="drag-drop-overlay">
                    <span className="drag-drop-icon">📥</span>
                    <span className="drag-drop-text">Drop audio to transcribe</span>
                    <span className="drag-drop-subtext">Supports .mp3, .wav, .m4a</span>
                  </div>
                )}
                
                {downloadProgress !== null && downloadProgress < 100 && (
                  <div className="download-progress-container">
                    <div className="download-progress-label">
                      <span>Loading AI Engine: {downloadingFile || 'Model file'}</span>
                      <span>{downloadProgress}%</span>
                    </div>
                    <div className="download-progress-track">
                      <div className="download-progress-bar" style={{ width: `${downloadProgress}%` }}></div>
                    </div>
                  </div>
                )}

                {/* Tactical Pulsating Button with Speech Level Concentric Circles */}
                <div className="record-wrapper" id="tour-record-btn" ref={recordWrapperRef}>
                  <canvas className="waveform-canvas" ref={canvasRef} />
                  <div className="record-button-container">
                    {isRecording && (
                      <>
                        <div className="volume-ripple ripple-1"></div>
                        <div className="volume-ripple ripple-2"></div>
                        <div className="volume-ripple ripple-3"></div>
                      </>
                    )}
                    <button 
                      className={`editorial-record-btn ${isRecording ? 'recording' : ''}`} 
                      onClick={handleRecordToggle}
                      disabled={isTogglingRecord}
                      aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
                      aria-pressed={isRecording}
                    >
                      <span className="icon-mic" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg style={{ width: '24px', height: '24px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                          <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                          <line x1="12" x2="12" y1="19" y2="22" />
                        </svg>
                      </span>
                      <span className="btn-label">{isRecording ? 'Tap to Stop' : 'Start Dictation'}</span>
                    </button>
                  </div>
                  {isRecording && (
                    <div className="timer-badge">
                      <span className="live-dot"></span>
                      {formatTime(audioDuration)}
                    </div>
                  )}
                </div>

                <div className="status-indicator">
                  <span className="status-label">Status:</span>
                  <span className="status-value">{statusText}</span>
                </div>

                <div className="manual-import-row" style={{ marginTop: '0.8rem', textAlign: 'center', fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                  <span>Or drag audio here or </span>
                  <button 
                    type="button" 
                    className="manual-import-btn"
                    onClick={() => fileImportInputRef.current?.click()}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-color)',
                      textDecoration: 'underline',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    browse files
                  </button>
                  <input 
                    type="file" 
                    accept=".mp3,.wav,.m4a,audio/*"
                    ref={fileImportInputRef}
                    onChange={handleFileImportChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              {/* Active Editorial Sheet */}
              <div className="editorial-sheet" id="tour-editor-sheet">
                <div className="sheet-header">
                  <div className="sheet-title-group">
                    <span className="doc-badge">DRAFT</span>
                    <h3 className="sheet-title">AI Voice Draft</h3>
                  </div>
                  
                  <div className="sheet-actions">
                    <button 
                      className={`sheet-action-btn diff-toggle ${showDiff ? 'active' : ''}`}
                      onClick={() => setShowDiff(!showDiff)}
                      disabled={!currentTranscript && !polishedResult}
                    >
                      <svg style={{ width: '14px', height: '14px', marginRight: '6px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="9" y1="15" x2="15" y2="15"></line>
                        <line x1="9" y1="19" x2="15" y2="19"></line>
                        <line x1="9" y1="11" x2="11" y2="11"></line>
                      </svg>
                      {showDiff ? 'Hide Changes' : 'Show Changes'}
                    </button>
                    <button 
                      className={`sheet-action-btn speak ${isSpeaking ? 'speaking' : ''}`}
                      onClick={handleSpeak}
                      disabled={!currentTranscript && !polishedResult}
                    >
                      <svg style={{ width: '14px', height: '14px', marginRight: '6px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                      </svg>
                      {isSpeaking ? 'Stop Listening' : 'Listen to Draft'}
                    </button>
                    <button 
                      className={`sheet-action-btn copy ${isCopied ? 'copied' : ''}`}
                      onClick={handleCopyToClipboard}
                      disabled={!currentTranscript && !polishedResult}
                    >
                      <svg style={{ width: '14px', height: '14px', marginRight: '6px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                      {isCopied ? 'Copied' : 'Copy Text'}
                    </button>
                    <button 
                      className="sheet-action-btn export"
                      onClick={() => setIsExportDrawerOpen(true)}
                      disabled={!currentTranscript && !polishedResult}
                    >
                      <svg style={{ width: '14px', height: '14px', marginRight: '6px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                        <polyline points="16 6 12 2 8 6"></polyline>
                        <line x1="12" y1="2" x2="12" y2="15"></line>
                      </svg>
                      Export...
                    </button>
                    <button 
                      className="sheet-action-btn save"
                      onClick={handleSavePolishedMemo}
                      disabled={!currentTranscript && !polishedResult}
                    >
                      <svg style={{ width: '14px', height: '14px', marginRight: '6px', verticalAlign: 'middle' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                      </svg>
                      Save to Timeline
                    </button>
                  </div>
                </div>

                <div className="sheet-content">
                  {(!currentTranscript && !polishedResult && !isPolishing) ? (
                    <div className="sheet-placeholder">
                      <p>Your spoken draft will appear here...</p>
                      <span className="placeholder-subtext">Click the voice button and start dictating. The AI will instantly rewrite, refine, and polish your words.</span>
                    </div>
                  ) : (
                    <>
                      {/* Main Polished Sheet Text - Directly Editable */}
                      {isPolishing ? (
                        <div className="sheet-loading-state">
                          <span className="loading-spinner"></span>
                          <p>Gemma is refining your draft...</p>
                        </div>
                      ) : showDiff ? (
                        <div className="sheet-diff-container">
                          {computeWordDiff(currentTranscript, editableDraft).map((token, idx) => {
                            if (token.type === 'added') {
                              return <ins key={idx} className="diff-ins">{token.value} </ins>;
                            } else if (token.type === 'removed') {
                              return <del key={idx} className="diff-del">{token.value} </del>;
                            } else {
                              return <span key={idx}>{token.value} </span>;
                            }
                          })}
                        </div>
                      ) : (
                        <textarea 
                          className="sheet-polished-editor"
                          value={editableDraft}
                          onChange={(e) => setEditableDraft(e.target.value)}
                          placeholder="Your draft will appear here. Feel free to edit directly..."
                        />
                      )}

                      {/* AI Insights Panel */}
                      {editableDraft && !isPolishing && (
                        <div className="sheet-insights-container">
                          <h5 className="insights-title">✨ Local AI Insights</h5>
                          {isGeneratingInsights ? (
                            <div className="insights-loading">
                              <span className="loading-spinner-small"></span>
                              <span>Analyzing key action items...</span>
                            </div>
                          ) : (
                            <div className="insights-content">
                              {draftInsights ? (
                                <div 
                                  className="insights-markdown" 
                                  dangerouslySetInnerHTML={{ 
                                    __html: escapeHtml(draftInsights)
                                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                      .replace(/\n/g, '<br/>') 
                                  }} 
                                />
                              ) : (
                                <span className="insights-empty">No insights generated yet.</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Raw Whisper Output Accordion */}
                      {currentTranscript && (
                        <div className="sheet-raw-expansion">
                          <details>
                            <summary>Show Raw Whisper Transcription</summary>
                            <div className="raw-expanded-text">{currentTranscript}</div>
                          </details>
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                <div className="sheet-footer">
                  <span className="footer-meta">Casing corrections: {dictionaryTags.length} loaded</span>
                  <span className="footer-meta">Words: {draftWordCount}</span>
                </div>
              </div>



            </div>

            {/* Right Column: User Profile + Format Style + Vocabulary + Settings */}
            <div className="dictation-right-column">
              {/* User Profile Card */}
              <div className="user-profile-card mobile-hidden">
                <div className="profile-header">
                  <div className="profile-avatar">A</div>
                  <div className="profile-meta">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="profile-name">You</span>
                      <span className="profile-badge">On-device</span>
                    </div>
                    <span className="profile-status">
                      <span className="live-dot" style={{ backgroundColor: 'var(--accent-bright)' }}></span>
                      Private — on-device only
                    </span>
                  </div>
                </div>
                <div className="profile-stats">
                  <div className="profile-stat-item">
                    <span className="stat-label">Memories</span>
                    <span className="stat-value">{history.length}</span>
                  </div>
                  <div className="profile-stat-item">
                    <span className="stat-label">Storage</span>
                    <span className="stat-value">100% Offline</span>
                  </div>
                </div>
              </div>

              {/* Writing Format Style Card */}
              <div className="section-card">
                <h4 className="section-title">Writing Format Style</h4>
                <div className="style-vertical-list" id="tour-style-select">
                  {(['cleaned', 'bullets', 'email', 'slack', 'custom', 'raw'] as const).map((style) => (
                    <button
                      key={style}
                      className={`style-list-btn ${dictationStyle === style ? 'active' : ''}`}
                      onClick={() => setDictationStyle(style)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%' }}>
                        {style === 'cleaned' && <SparklesIcon />}
                        {style === 'bullets' && <ListIcon />}
                        {style === 'email' && <MailIcon />}
                        {style === 'slack' && <MessageSquareIcon />}
                        {style === 'custom' && <EditIcon />}
                        {style === 'raw' && <FileTextIcon />}
                        <span className="style-btn-title">
                          {style === 'cleaned' && 'Cleaned Transcript'}
                          {style === 'bullets' && 'Action Bullets'}
                          {style === 'email' && 'Executive Summary'}
                          {style === 'slack' && 'Slack Message'}
                          {style === 'custom' && 'Custom Instruction'}
                          {style === 'raw' && 'Raw Text'}
                        </span>
                      </div>
                      <span className="style-btn-desc">
                        {style === 'cleaned' && 'Remove filler words and stutters smoothly'}
                        {style === 'bullets' && 'Key takeaways and items in bullet lists'}
                        {style === 'email' && 'Professional email executive summary'}
                        {style === 'slack' && 'Brief conversational message summary'}
                        {style === 'custom' && 'Format using your own custom rules'}
                        {style === 'raw' && 'Original transcription text unmodified'}
                      </span>
                    </button>
                  ))}
                </div>

                {dictationStyle === 'custom' && (
                  <div className="custom-instruction-group" style={{ marginTop: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label className="input-label">Custom AI Instruction:</label>
                    <input 
                      type="text" 
                      className="dictionary-input"
                      placeholder="e.g. Translate to Spanish, make it a poem" 
                      value={customInstruction}
                      onChange={(e) => setCustomInstruction(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Personal Vocabulary Card */}
              <div className="section-card">
                <h4 className="section-title">Personal Vocabulary</h4>
                <div className="dictionary-editor-group">
                  <label className="input-label">Keywords parsed phonetically:</label>
                  
                  <div className="vocabulary-tags-container">
                    {dictionaryTags.map(tag => (
                      <span key={tag} className="vocabulary-tag">
                        {tag}
                        <button 
                          type="button" 
                          className="vocabulary-tag-remove"
                          onClick={() => handleRemoveTag(tag)}
                          title="Remove keyword"
                        >
                          ✕
                        </button>
                      </span>
                    ))}

                    <div className="inline-vocab-form">
                      <input 
                        type="text" 
                        className="inline-vocab-input"
                        placeholder="Add term..." 
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleAddTag}
                      />
                      <button 
                        type="button" 
                        className="inline-vocab-add-btn"
                        onClick={() => {
                          const cleaned = tagInput.trim().replace(/,$/, '');
                          if (cleaned && !dictionaryTags.includes(cleaned)) {
                            setDictionaryTags([...dictionaryTags, cleaned]);
                          }
                          setTagInput('');
                        }}
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Engine Settings */}
              <div className="section-card desktop-hidden">
                <h4 className="section-title">AI Engine Settings</h4>
                <div className="dictionary-editor-group">
                  <label className="input-label">Whisper Model Weight:</label>
                  <select 
                    className="model-select-dropdown"
                    value={selectedModel}
                    onChange={(e) => {
                      const selected = e.target.value;
                      setSelectedModel(selected);
                      stt.preloadModel(selected, setStatusText, (file, prog) => {
                        setDownloadProgress(prog);
                        setDownloadingFile(file);
                      });
                      setStatusText(`Switched AI Model to ${selected}`);
                    }}
                  >
                    <option value="Xenova/whisper-tiny.en">Tiny.en (~75MB - Ultra-fast)</option>
                    <option value="Xenova/whisper-base.en">Base.en (~290MB - Balanced)</option>
                    <option value="Xenova/whisper-small.en">Small.en (~460MB - High Accuracy)</option>
                  </select>
                  <p className="model-helper-text" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: '0.4rem', lineHeight: '1.4' }}>
                    Larger models are more accurate but take longer to download and require more RAM.
                  </p>
                  
                  <label className="input-label" style={{ marginTop: '1rem', display: 'block' }}>Accent Color Theme:</label>
                  <div className="accent-theme-picker" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', marginBottom: '1rem' }}>
                    {(['emerald', 'violet', 'ocean', 'amber'] as const).map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`accent-theme-btn ${color} ${accentTheme === color ? 'active' : ''}`}
                        onClick={() => setAccentTheme(color)}
                      >
                        <span className="color-dot"></span>
                        {color}
                      </button>
                    ))}
                  </div>
                  
                  <div className="settings-action-row" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button 
                      type="button"
                      className="sheet-action-btn"
                      style={{ fontSize: 'var(--fs-sm)', padding: '0.5rem 0.8rem', background: 'var(--sage-bg-hover)', border: '1px solid var(--sage-border)', color: 'var(--text-main)', cursor: 'pointer', borderRadius: '8px' }}
                      onClick={openDoctor}
                    >
                      🩺 Engine Doctor
                    </button>
                    <button 
                      type="button"
                      className="sheet-action-btn"
                      style={{ fontSize: 'var(--fs-sm)', padding: '0.5rem 0.8rem', background: 'var(--sage-bg-hover)', border: '1px solid var(--sage-border)', color: 'var(--text-main)', cursor: 'pointer', borderRadius: '8px' }}
                      onClick={handleExportBackup}
                    >
                      📤 Export Backup
                    </button>
                    <button 
                      type="button"
                      className="sheet-action-btn"
                      style={{ fontSize: 'var(--fs-sm)', padding: '0.5rem 0.8rem', background: 'var(--sage-bg-hover)', border: '1px solid var(--sage-border)', color: 'var(--text-main)', cursor: 'pointer', borderRadius: '8px' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      📥 Import Backup
                    </button>
                    <input 
                      type="file" 
                      accept=".json" 
                      ref={fileInputRef} 
                      onChange={handleImportBackup} 
                      style={{ display: 'none' }} 
                    />
                  </div>
                </div>
              </div>

              {/* On-Device Processing Card */}
              <div className="section-card on-device-processing-card mobile-hidden" style={{ marginTop: '1.2rem' }}>
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                  <div style={{ color: 'var(--accent-bright)' }}>
                    <ShieldIcon />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 0.2rem 0', fontSize: 'var(--fs-base)', fontWeight: 600 }}>On-Device Processing</h4>
                    <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      Audio never leaves this machine unless explicitly synced.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'memories' && (
          <main className="memories-workspace" style={{ animation: 'fadeIn 0.3s ease-out', textAlign: 'left' }}>
            <h2 className="workspace-heading">Memory Constellation Map</h2>
            <p className="workspace-subheading">A semantic representation of your saved memories. Closer memories share conceptual similarities and tags.</p>

            <div className="map-intro-card">
              <div className="map-intro-grid">
                <div className="map-intro-item">
                  <span className="map-intro-icon">🌌</span>
                  <div className="map-intro-text">
                    <strong>Semantic Distance</strong>
                    <span>Every memory you save is plotted as a star. The closer two stars are, the more conceptually similar they are, regardless of when they were saved.</span>
                  </div>
                </div>
                <div className="map-intro-item">
                  <span className="map-intro-icon">🎯</span>
                  <div className="map-intro-text">
                    <strong>Concentric Orbits</strong>
                    <span>The map is divided into semantic zones (Inner, Mid, and Outer orbits) relative to your central themes, showing conceptual levels.</span>
                  </div>
                </div>
                <div className="map-intro-item">
                  <span className="map-intro-icon">✨</span>
                  <div className="map-intro-text">
                    <strong>Interactive Exploration</strong>
                    <span>Hover over any star to preview the memory snippet. Click on a star to load its details into the workspace for playback or editing.</span>
                  </div>
                </div>
              </div>
            </div>
            
            {history.length > 0 ? (
              <div className="galaxy-map-card">
                <GalaxyMap 
                  history={history} 
                  citations={[]} 
                  onLoadMemo={handleLoadMemoFromHistory} 
                />
              </div>
            ) : (
              <div className="section-card empty-state-card">
                <span style={{ fontSize: 'var(--fs-3xl)', display: 'block', marginBottom: '1rem' }}>🌌</span>
                <h3 style={{ fontSize: 'var(--fs-lg)', color: 'var(--text-main)' }}>No Star Constellation Yet</h3>
                <p style={{ maxWidth: '400px', margin: '0.5rem auto 0 auto', fontSize: 'var(--fs-base)', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Transcribe and save voice memories to build your interactive personal memory universe.
                </p>
              </div>
            )}
          </main>
        )}

        {activeTab === 'query' && (
          <main className="query-workspace">
            <div className="query-card">
              <h2 className="workspace-heading">Search Memories</h2>
              <p className="workspace-subheading">Ask questions about everything you have ever dictated. Retrieval and synthesis runs locally.</p>
              
              <div className="query-input-wrapper">
                <input 
                  type="text" 
                  className="query-large-input"
                  placeholder="e.g. What did I dictate about the Q3 launch plan?" 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                />
                <button className="query-submit-btn" onClick={handleQuery} disabled={isAnswering}>
                  {isAnswering ? '...' : 'Search'}
                </button>
              </div>

              <div className="answer-workspace">
                {answer && (
                  <div className="editorial-answer">
                    <h4 className="answer-heading">AI Response</h4>
                    <p className="answer-body">{answer}</p>
                    
                    {citations.length > 0 && (
                      <div className="answer-sources">
                        <h5 className="sources-heading">Cited Memories</h5>
                        <div className="sources-grid">
                          {citations.map((cite, i) => (
                            <div key={i} className="source-item">
                              <span className="source-index">Source [{i + 1}]</span>
                              <p className="source-text">"{cite.transcript}"</p>
                              <span className="source-date">{new Date(cite.timestamp).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <ModelDownloadGate inline onStateChange={setModelState} />
            </div>
          </main>
        )}

        {activeTab === 'timeline' && (
          <section className="timeline-workspace">
            <h2 className="workspace-heading">Memory Timeline</h2>
            <p className="workspace-subheading">A chronological list of all saved audio files and text transcriptions stored locally.</p>
            
            {history.length > 0 && (
              <>
                <div className="timeline-filters-bar">
                  <input 
                    type="text" 
                    className="timeline-search-input" 
                    placeholder="Search past memos..."
                    value={timelineSearch}
                    onChange={(e) => setTimelineSearch(e.target.value)}
                  />
                  <label className="timeline-filter-checkbox-label" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input 
                      type="checkbox"
                      checked={timelineFilterAudioOnly}
                      onChange={(e) => setTimelineFilterAudioOnly(e.target.checked)}
                      style={{ marginRight: '6px' }}
                    />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--fs-base)' }}>
                      <svg style={{ width: '14px', height: '14px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                        <line x1="12" x2="12" y1="19" y2="22" />
                      </svg>
                      Has Audio Playback
                    </span>
                  </label>
                </div>
                
                {/* Horizontal Category Tag Filter Pills */}
                {allUniqueTags.length > 0 && (
                  <div className="timeline-tags-filter-bar" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
                    <button
                      className={`tag-filter-chip ${selectedTagFilter === null ? 'active' : ''}`}
                      onClick={() => setSelectedTagFilter(null)}
                      aria-pressed={selectedTagFilter === null}
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '20px',
                        fontSize: 'var(--fs-base)',
                        border: '1px solid var(--sage-border)',
                        background: selectedTagFilter === null ? 'var(--sage-accent)' : 'transparent',
                        color: selectedTagFilter === null ? '#fff' : 'var(--text-main)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <svg style={{ width: '12px', height: '12px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                        <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="2.5"></line>
                      </svg>
                      All Tags
                    </button>
                    {allUniqueTags.map(tag => (
                      <button
                        key={tag}
                        className={`tag-filter-chip ${selectedTagFilter === tag ? 'active' : ''}`}
                        onClick={() => setSelectedTagFilter(tag)}
                        aria-pressed={selectedTagFilter === tag}
                        style={{
                          padding: '0.4rem 0.8rem',
                          borderRadius: '20px',
                          fontSize: 'var(--fs-base)',
                          border: '1px solid var(--sage-border)',
                          background: selectedTagFilter === tag ? 'var(--sage-accent)' : 'transparent',
                          color: selectedTagFilter === tag ? '#fff' : 'var(--text-main)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <svg style={{ width: '12px', height: '12px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                          <line x1="7" y1="7" x2="7.01" y2="7" strokeWidth="2.5"></line>
                        </svg>
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            
            <div className="timeline-grid">
              {history.length === 0 ? (
                <div className="timeline-empty-card">
                  <p>Your timeline is empty.</p>
                  <span>Memos saved during dictation will appear here.</span>
                </div>
              ) : (() => {
                const filteredHistory = history.filter((memo) => {
                  const matchesSearch = memo.transcript.toLowerCase().includes(timelineSearch.toLowerCase());
                  const matchesAudio = !timelineFilterAudioOnly || (memo.audioBlob && memo.audioBlob.size > 0);
                  const matchesTag = !selectedTagFilter || (memo.tags && memo.tags.includes(selectedTagFilter));
                  return matchesSearch && matchesAudio && matchesTag;
                });

                if (filteredHistory.length === 0) {
                  return (
                    <div className="timeline-empty-card">
                      <p>No matching memos found.</p>
                      <span>Try refining your search text or removing the audio filter.</span>
                    </div>
                  );
                }

                return filteredHistory.map((memo) => (
                  <TimelineCard 
                    key={memo.id} 
                    memo={memo} 
                    onLoad={handleLoadMemoFromHistory} 
                    onDelete={handleDeleteMemo}
                  />
                ));
              })()}
            </div>
          </section>
        )}

        {activeTab === 'vault' && (
          <main className="vault-workspace">
            <h2 className="workspace-heading">Privacy Vault</h2>
            <p className="workspace-subheading">Manage your offline-first personal storage, cache systems, and local security configurations.</p>
            
            <div className="vault-grid">
              <div className="section-card vault-status-card">
                <div className="vault-status-header">
                  <span className="vault-icon">🛡️</span>
                  <div>
                    <h3>Security Clearance</h3>
                    <p className="status-secured">100% Local & Encrypted</p>
                  </div>
                </div>
                
                <div className="vault-features-list">
                  <div className="vault-feature-item">
                    <span className="feature-icon">🔒</span>
                    <div className="feature-info">
                      <strong>Zero Server Disclosures</strong>
                      <p>No audio files, transcriptions, or personal embeddings ever leave your browser sandbox. All processing is executed locally.</p>
                    </div>
                  </div>
                  <div className="vault-feature-item">
                    <span className="feature-icon">⚙️</span>
                    <div className="feature-info">
                      <strong>WebGPU Accelerated AI</strong>
                      <p>Whisper and Gemma run on your local graphics hardware using optimized ONNX runtimes without network overhead.</p>
                    </div>
                  </div>
                  <div className="vault-feature-item">
                    <span className="feature-icon">💾</span>
                    <div className="feature-info">
                      <strong>Self-Hosted Persistence</strong>
                      <p>Your database resides in IndexedDB, sandboxed securely. Install the PWA to bypass browser cache purge cycles.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="section-card vault-metrics-card">
                <h4 className="section-title" style={{ marginBottom: '1.25rem' }}>Storage Diagnostics</h4>
                
                <div className="vault-metric-row">
                  <span>IndexedDB Usage</span>
                  <strong>{doctorQuota}</strong>
                </div>
                <div className="vault-metric-row">
                  <span>AI Model Cache</span>
                  <strong>{doctorCacheSize}</strong>
                </div>
                <div className="vault-metric-row">
                  <span>Saved Memories Count</span>
                  <strong>{history.length}</strong>
                </div>
                <div className="vault-metric-row">
                  <span>Security Checklist</span>
                  <strong style={{ color: 'var(--accent-bright)' }}>✅ Secure Sandbox</strong>
                </div>
                
                <div className="vault-actions-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '2rem' }}>
                  <button className="vault-action-btn primary" onClick={openDoctor}>
                    🩺 Run Diagnostics
                  </button>
                  <button className="vault-action-btn secondary" onClick={handleExportBackup}>
                    📤 Export Backup
                  </button>
                  <button className="vault-action-btn secondary" onClick={() => fileInputRef.current?.click()}>
                    📥 Import Backup
                  </button>
                  <input 
                    type="file" 
                    accept=".json" 
                    ref={fileInputRef} 
                    onChange={handleImportBackup} 
                    style={{ display: 'none' }} 
                  />
                  <button className="vault-action-btn danger" onClick={handleWipeDatabase}>
                    🗑️ Wipe Local Database
                  </button>
                </div>
              </div>
            </div>
          </main>
        )}

        {activeTab === 'demo' && (
          <div className="demo-workspace-wrapper">
            <Demo />
          </div>
        )}

      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-nav-bar" id="tour-mobile-nav">
        <button 
          className={`mobile-nav-btn ${activeTab === 'dictation' ? 'active' : ''}`}
          onClick={() => setActiveTab('dictation')}
        >
          <MicIcon />
          <span>Dictate</span>
          <span className="active-dot"></span>
        </button>
        <button 
          className={`mobile-nav-btn ${activeTab === 'memories' ? 'active' : ''}`}
          onClick={() => setActiveTab('memories')}
        >
          <MemoriesIcon />
          <span>Memories</span>
          <span className="active-dot"></span>
        </button>
        <button 
          className={`mobile-nav-btn ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          <TimelineIcon />
          <span>Timeline</span>
          <span className="active-dot"></span>
        </button>
        <button 
          className={`mobile-nav-btn ${activeTab === 'query' ? 'active' : ''}`}
          onClick={() => setActiveTab('query')}
        >
          <SearchIcon />
          <span>Search</span>
          <span className="active-dot"></span>
        </button>
        <button 
          className={`mobile-nav-btn ${activeTab === 'vault' ? 'active' : ''}`}
          onClick={() => setActiveTab('vault')}
        >
          <VaultIcon />
          <span>Vault</span>
          <span className="active-dot"></span>
        </button>
      </nav>

      {isExportDrawerOpen && (
        <div className="export-modal-overlay" onClick={() => setIsExportDrawerOpen(false)}>
          <div className="export-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="export-modal-header">
              <h3 className="export-modal-title">Export Draft</h3>
              <button className="export-modal-close" onClick={() => setIsExportDrawerOpen(false)} aria-label="Close Export Drawer">✕</button>
            </div>
            
            <div className="export-options-grid">
              <button className="export-option-card" onClick={() => {
                const blob = new Blob([editableDraft], { type: 'text/markdown;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `VoiceMemory-Draft-${Date.now()}.md`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                playSuccessSound();
                setStatusText('Downloaded Markdown file');
                setIsExportDrawerOpen(false);
              }}>
                <span className="export-icon">📥</span>
                <span className="export-label">Download Markdown (.md)</span>
              </button>

              <button className="export-option-card" onClick={() => {
                const blob = new Blob([editableDraft], { type: 'text/plain;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `VoiceMemory-Draft-${Date.now()}.txt`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                playSuccessSound();
                setStatusText('Downloaded Plain Text file');
                setIsExportDrawerOpen(false);
              }}>
                <span className="export-icon">📄</span>
                <span className="export-label">Download Plain Text (.txt)</span>
              </button>

              <button className="export-option-card" onClick={async () => {
                const paragraphs = editableDraft
                  .split('\n\n')
                  .map(p => {
                    if (p.trim().startsWith('- ') || p.trim().startsWith('* ')) {
                      const items = p.split('\n').map(li => `<li>${li.replace(/^[-*]\s+/, '')}</li>`).join('');
                      return `<ul>${items}</ul>`;
                    }
                    return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
                  })
                  .join('');
                
                try {
                  const blob = new Blob([paragraphs], { type: 'text/html' });
                  await navigator.clipboard.write([
                    new ClipboardItem({
                      'text/html': blob,
                      'text/plain': new Blob([editableDraft], { type: 'text/plain' })
                    })
                  ]);
                  playSuccessSound();
                  setStatusText('Copied Rich HTML to Clipboard');
                } catch {
                  await navigator.clipboard.writeText(paragraphs);
                  playSuccessSound();
                  setStatusText('Copied Raw HTML to Clipboard');
                }
                setIsExportDrawerOpen(false);
              }}>
                <span className="export-icon">🌐</span>
                <span className="export-label">Copy as Rich HTML</span>
              </button>

              <a 
                className="export-option-card mailto-link-btn" 
                href={`mailto:?subject=VoiceMemory%20Draft&body=${encodeURIComponent(editableDraft)}`}
                onClick={() => {
                  playSuccessSound();
                  setIsExportDrawerOpen(false);
                }}
              >
                <span className="export-icon">✉️</span>
                <span className="export-label">Share via Email Client</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {showInstallBanner && (deferredPrompt || (isIOS && !isStandalone)) && (
        <div className="pwa-install-banner">
          <div className="pwa-install-container">
            <div className="pwa-install-info">
              <span className="pwa-install-badge">INSTALL APP</span>
              <h5 className="pwa-install-title">Install VoiceMemory PWA</h5>
              <p className="pwa-install-desc">Gain offline database persistence & bypass browser safari purge rules.</p>
            </div>
            <div className="pwa-install-actions">
              {isIOS ? (
                <div className="pwa-ios-guidance">
                  Tap <span className="guidance-highlight">Share</span> and then <span className="guidance-highlight">Add to Home Screen</span>
                </div>
              ) : (
                <button className="pwa-install-confirm-btn" onClick={handleInstallApp}>
                  Install Now
                </button>
              )}
              <button className="pwa-install-close-btn" onClick={handleDismissInstallBanner} aria-label="Dismiss Install Banner">✕</button>
            </div>
          </div>
        </div>
      )}

      {showUndoToast && undoMemo && (
        <div className="undo-toast-container">
          <span className="undo-toast-text">🗑️ Memory deleted</span>
          <button className="undo-toast-btn" onClick={handleUndoDelete}>
            Undo
          </button>
        </div>
      )}

      {isDoctorOpen && (
        <div className="doctor-modal-overlay" onClick={() => setIsDoctorOpen(false)}>
          <div className="doctor-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="doctor-modal-header">
              <h3 className="doctor-modal-title">🩺 Offline Engine Doctor</h3>
              <button className="doctor-modal-close" onClick={() => setIsDoctorOpen(false)} aria-label="Close Engine Doctor">✕</button>
            </div>
            <div className="doctor-metrics-grid">
              <div className="doctor-metric-card">
                <span className="metric-icon">🚀</span>
                <div className="metric-info">
                  <strong>WebGPU Acceleration</strong>
                  <p>{'gpu' in navigator ? '✅ Available (Accelerated local inference)' : '⚠️ Unsupported (Slower WASM/CPU fallback)'}</p>
                </div>
              </div>
              <div className="doctor-metric-card">
                <span className="metric-icon">💾</span>
                <div className="metric-info">
                  <strong>IndexedDB Space</strong>
                  <p>{doctorQuota}</p>
                </div>
              </div>
              <div className="doctor-metric-card">
                <span className="metric-icon">📦</span>
                <div className="metric-info">
                  <strong>Model Cache Storage</strong>
                  <p>{doctorCacheSize}</p>
                </div>
              </div>
            </div>
            <div className="doctor-actions-row">
              <button className="doctor-clear-btn" onClick={clearAppCaches}>
                🗑️ Clear Model Cache
              </button>
              <button className="doctor-close-btn" onClick={() => setIsDoctorOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {tourStep !== null && (
        <div 
          className="spotlight-tour-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 999,
            pointerEvents: 'none'
          }}
        >
          {spotlightRect && (
            <div 
              className="spotlight-mask"
              style={{
                position: 'fixed',
                top: spotlightRect.top - 8,
                left: spotlightRect.left - 8,
                width: spotlightRect.width + 16,
                height: spotlightRect.height + 16,
                borderRadius: tourSteps[tourStep].targetId === 'tour-record-btn' ? '50%' : '14px',
                boxShadow: '0 0 0 9999px rgba(18, 18, 16, 0.75)',
                pointerEvents: 'none',
                transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
              }}
            />
          )}

          {!spotlightRect && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(18, 18, 16, 0.75)',
                pointerEvents: 'none'
              }}
            />
          )}

          <div 
            className="tour-tooltip-card"
            style={{
              position: 'fixed',
              ...(() => {
                if (!spotlightRect) {
                  return {
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '320px'
                  };
                }
                const placeAbove = spotlightRect.bottom > window.innerHeight - 240 && spotlightRect.top > 260;
                const topVal = placeAbove 
                  ? `${spotlightRect.top - 16}px` 
                  : `${spotlightRect.bottom + 16}px`;
                const leftVal = `${Math.max(16, Math.min(window.innerWidth - 336, spotlightRect.left + spotlightRect.width / 2 - 160))}px`;
                return {
                  top: topVal,
                  left: leftVal,
                  transform: placeAbove ? 'translateY(-100%)' : 'none',
                  width: '320px',
                  transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
                };
              })(),
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              color: 'var(--text-main)',
              fontFamily: 'var(--font-sans)',
              zIndex: 1001,
              pointerEvents: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 600 }}>
                {tourSteps[tourStep].title}
              </h4>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                {tourStep + 1} / {tourSteps.length}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--fs-base)', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              {tourSteps[tourStep].content}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <button 
                type="button" 
                onClick={() => {
                  localStorage.setItem('onboardingTourCompleted', 'true');
                  setTourStep(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 'var(--fs-base)'
                }}
              >
                Skip Tour
              </button>
              <button 
                type="button" 
                onClick={() => {
                  if (tourStep < tourSteps.length - 1) {
                    setTourStep(tourStep + 1);
                  } else {
                    localStorage.setItem('onboardingTourCompleted', 'true');
                    setTourStep(null);
                  }
                }}
                style={{
                  background: 'var(--accent-color)',
                  color: '#fff',
                  border: 'none',
                  padding: '0.4rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: 'var(--fs-base)',
                  fontWeight: 600
                }}
              >
                {tourStep === tourSteps.length - 1 ? 'Finish' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineAudioPlayer({ audioBlob }: { audioBlob: Blob }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!audioBlob) return;
    
    let ctx: AudioContext | null = null;
    const decodeAudio = async () => {
      try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const AudioContextClass = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        ctx = new AudioContextClass();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        setAudioBuffer(decoded);
        setDuration(decoded.duration);
      } catch (err) {
        console.error('Error decoding audio blob:', err);
      } finally {
        if (ctx) {
          ctx.close().catch(e => console.error('Error closing decode AudioContext:', e));
        }
      }
    };
    
    decodeAudio();
  }, [audioBlob]);

  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      cancelAnimationFrame(animationFrameRef.current);
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
        } catch {
          // ignore if already stopped
        }
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(e => console.error('Error closing AudioContext on unmount:', e));
      }
    };
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      cancelAnimationFrame(animationFrameRef.current);
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (audioContextRef.current) {
        pausedAtRef.current = audioContextRef.current.currentTime - startTimeRef.current;
        audioContextRef.current.close().catch(e => console.error('Error closing AudioContext on pause:', e));
        audioContextRef.current = null;
      }
    } else {
      if (!audioBuffer) return;
      const ctx = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = ctx;
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      const offset = pausedAtRef.current;
      source.start(0, offset);
      startTimeRef.current = ctx.currentTime - offset;
      sourceNodeRef.current = source;
      isPlayingRef.current = true;
      setIsPlaying(true);
      source.onended = () => {
        if (isPlayingRef.current) {
          isPlayingRef.current = false;
          setIsPlaying(false);
          pausedAtRef.current = 0; // reset playback to start
          if (audioContextRef.current) {
            audioContextRef.current.close().catch(e => console.error('Error closing AudioContext on end:', e));
            audioContextRef.current = null;
          }
        }
      };
      const update = () => {
        if (isPlayingRef.current) {
          setCurrentTime(ctx.currentTime - startTimeRef.current);
          animationFrameRef.current = requestAnimationFrame(update);
        }
      };
      update();
    }
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="custom-waveform-player">
      <button className="custom-player-play-btn" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isPlaying ? (
          <svg style={{ width: '12px', height: '12px' }} viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        ) : (
          <svg style={{ width: '12px', height: '12px' }} viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        )}
      </button>
      <div className="custom-player-waveform-container">
        <canvas 
          ref={canvasRef} 
          className="custom-player-canvas" 
          style={{ width: '200px', height: '32px', cursor: 'pointer' }}
        />
      </div>
      <div className="custom-player-time">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>
  );
}

function TimelineCard({ memo, onLoad, onDelete }: { memo: VoiceMemo; onLoad: (m: VoiceMemo) => void; onDelete: (id: number) => void; }) {
  return (
    <div className="timeline-card-item">
      <div className="timeline-item-header">
        <span className="timeline-item-time">
          {new Date(memo.timestamp).toLocaleString(undefined, { 
            dateStyle: 'medium', 
            timeStyle: 'short' 
          })}
        </span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {memo.tags && memo.tags.map(tag => (
            <span key={tag} className="timeline-item-tag-pill">
              #{tag}
            </span>
          ))}
          {memo.audioBlob && memo.audioBlob.size > 0 && (
            <span className="timeline-item-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <svg style={{ width: '10px', height: '10px', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5 }} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
              Audio
            </span>
          )}
        </div>
      </div>
      
      <p className="timeline-item-text">{memo.transcript}</p>
      
      <div className="timeline-card-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
        <div>
          {memo.audioBlob && memo.audioBlob.size > 0 ? (
            <TimelineAudioPlayer audioBlob={memo.audioBlob} />
          ) : (
            <span className="no-audio-text" style={{ fontSize: 'var(--fs-base)', color: 'var(--text-muted)' }}>
              📄 Text-only memory
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button 
            className="timeline-card-btn load" 
            onClick={() => onLoad(memo)}
            title="Load into Editor"
            style={{
              background: 'var(--sage-bg-hover)',
              border: '1px solid var(--sage-border)',
              color: 'var(--text-main)',
              padding: '0.4rem 0.8rem',
              borderRadius: '8px',
              fontSize: 'var(--fs-sm)',
              cursor: 'pointer',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <svg style={{ width: '12px', height: '12px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
            </svg>
            Load
          </button>
          <button 
            className="timeline-card-btn delete" 
            onClick={() => memo.id !== undefined && onDelete(memo.id)}
            title="Delete memory"
            style={{
              background: 'rgba(220, 53, 69, 0.08)',
              border: '1px solid rgba(220, 53, 69, 0.15)',
              color: '#dc3545',
              padding: '0.4rem 0.8rem',
              borderRadius: '8px',
              fontSize: 'var(--fs-sm)',
              cursor: 'pointer',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <svg style={{ width: '12px', height: '12px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

const tourSteps = [
  {
    targetId: '', // Welcome step (center of screen)
    title: 'Welcome to VoiceMemory! 🌌',
    content: 'Your secure, offline-first personal memory assistant. Let’s take a 1-minute tour to see how it works.'
  },
  {
    targetId: 'tour-record-btn',
    title: 'Voice Capture Hub 🎙️',
    content: 'Click here or drag-and-drop an audio file anywhere on the card to transcribe your voice on-device.'
  },
  {
    targetId: 'tour-style-select',
    title: 'AI Formatting Presets 📋',
    content: 'Select the style you want: clean text, bullet points, emails, or custom instructions processed locally.'
  },
  {
    targetId: 'tour-editor-sheet',
    title: 'AI Editorial Sheet 📝',
    content: 'View real-time diffs, listen to draft audio, copy HTML, or save your memories directly to the timeline database.'
  },
  {
    targetId: 'tour-header-nav',
    title: 'Navigation & Local Search 🔍',
    content: 'Switch between dictation, semantic galaxy search, and history timeline. Complete control, 100% offline.'
  }
];

function GalaxyMap({ 
  history, 
  citations, 
  onLoadMemo 
}: { 
  history: VoiceMemo[]; 
  citations: VoiceMemo[]; 
  onLoadMemo: (memo: VoiceMemo) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredMemo, setHoveredMemo] = useState<{ memo: VoiceMemo; x: number; y: number } | null>(null);
  const animationFrameRef = useRef<number>(0);
  const mousePosRef = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Generate fixed background star coordinates for visual depth using a pure seed-based generator
  const backgroundStars = useMemo(() => {
    const starsList = [];
    let seed = 123.45;
    const nextRandom = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 45; i++) {
      starsList.push({
        x: nextRandom(),
        y: nextRandom(),
        size: nextRandom() * 1.5 + 0.3,
        opacity: nextRandom() * 0.4 + 0.1,
      });
    }
    return starsList;
  }, []);

  interface GalaxyStar {
    memo: VoiceMemo;
    angle: number;
    distanceFactor: number;
    speedFactor: number;
    size: number;
  }

  const stars = useMemo<GalaxyStar[]>(() => {
    const total = history.length;
    return history.map((memo, idx) => {
      const angle = (idx / (total || 1)) * Math.PI * 2 + Math.sin(idx * 791.3) * 0.5;
      const distanceFactor = 0.2 + 0.6 * (Math.abs(Math.sin(idx * 432.1)));
      const speedFactor = 0.5 + 0.5 * Math.sin(idx * 123.45);
      return {
        memo,
        angle,
        distanceFactor,
        speedFactor,
        size: 5 + (memo.transcript.length % 6),
      };
    });
  }, [history]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [history]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let localAngle = 0;
    
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxOrbit = Math.min(width, height) * 0.45;
      
      localAngle += 0.001;
      
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      
      // Resolve theme colors dynamically for canvas operations
      const rootStyles = window.getComputedStyle(document.documentElement);
      const accentColor = rootStyles.getPropertyValue('--accent-color').trim() || '#4edea3';
      const accentLight = rootStyles.getPropertyValue('--accent-light').trim() || 'rgba(78, 222, 163, 0.1)';
      const accentBright = rootStyles.getPropertyValue('--accent-bright').trim() || '#6ffbbe';

      // 1. Draw space/nebula radial background gradient
      const bgGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) / 2);
      if (isDark) {
        bgGrad.addColorStop(0, accentLight);
        bgGrad.addColorStop(0.5, 'rgba(15, 17, 23, 0.98)');
        bgGrad.addColorStop(1, 'rgba(10, 11, 14, 1)');
      } else {
        bgGrad.addColorStop(0, accentLight);
        bgGrad.addColorStop(0.6, 'rgba(250, 249, 246, 0.98)');
        bgGrad.addColorStop(1, 'rgba(244, 242, 238, 1)');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Draw background starfield
      backgroundStars.forEach((star) => {
        ctx.beginPath();
        const opacity = star.opacity * (isDark ? 0.75 : 0.45);
        ctx.fillStyle = isDark 
          ? `rgba(255, 255, 255, ${opacity})` 
          : `rgba(0, 0, 0, ${opacity})`;
        ctx.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. Draw Concentric Radar/Orbit Rings
      ctx.strokeStyle = isDark ? 'rgba(232, 230, 225, 0.05)' : 'rgba(35, 34, 31, 0.05)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4, 6]);
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxOrbit * (r / 3), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]); // Reset line dash

      // 4. Draw coordinate axes
      ctx.strokeStyle = isDark ? 'rgba(232, 230, 225, 0.02)' : 'rgba(35, 34, 31, 0.02)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(centerX - maxOrbit, centerY);
      ctx.lineTo(centerX + maxOrbit, centerY);
      ctx.moveTo(centerX, centerY - maxOrbit);
      ctx.lineTo(centerX, centerY + maxOrbit);
      ctx.stroke();

      // 5. Draw Orbit Labels
      ctx.font = '9px var(--font-mono)';
      ctx.fillStyle = isDark ? 'rgba(232, 230, 225, 0.25)' : 'rgba(35, 34, 31, 0.25)';
      ctx.textAlign = 'left';
      ctx.fillText('INNER ORBIT', centerX + 10, centerY - maxOrbit * 0.33 + 3);
      ctx.fillText('MID ORBIT', centerX + 10, centerY - maxOrbit * 0.66 + 3);
      ctx.fillText('OUTER ORBIT', centerX + 10, centerY - maxOrbit + 3);

      const starsWithCoords = stars.map((star) => {
        const angle = star.angle + localAngle * star.speedFactor;
        const dist = star.distanceFactor * maxOrbit;
        const x = centerX + Math.cos(angle) * dist;
        const y = centerY + Math.sin(angle) * dist;
        return {
          ...star,
          x,
          y
        };
      });

      // 6. Draw tag-sharing connection lines
      for (let i = 0; i < starsWithCoords.length; i++) {
        for (let j = i + 1; j < starsWithCoords.length; j++) {
          const starA = starsWithCoords[i];
          const starB = starsWithCoords[j];
          
          const tagsA = starA.memo.tags || [];
          const tagsB = starB.memo.tags || [];
          const hasSharedTag = tagsA.some((t: string) => tagsB.includes(t));
          
          if (hasSharedTag) {
            ctx.save();
            ctx.lineWidth = 0.8;
            const grad = ctx.createLinearGradient(starA.x, starA.y, starB.x, starB.y);
            grad.addColorStop(0, accentColor);
            grad.addColorStop(1, accentBright);
            ctx.strokeStyle = grad;
            ctx.globalAlpha = 0.18;
            ctx.beginPath();
            ctx.moveTo(starA.x, starA.y);
            ctx.lineTo(starB.x, starB.y);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      let newHover: typeof hoveredMemo = null;
      const mouse = mousePosRef.current;
      
      starsWithCoords.forEach((star) => {
        const isCited = citations.some(c => c.id === star.memo.id);
        const distanceToMouse = Math.hypot(star.x - mouse.x, star.y - mouse.y);
        const isMouseOver = distanceToMouse < star.size + 6;

        if (isMouseOver) {
          newHover = { memo: star.memo, x: star.x, y: star.y };
        }

        // 7. Draw radial glowing aura under active/hovered/cited stars
        ctx.save();
        ctx.beginPath();
        const glowGrad = ctx.createRadialGradient(star.x, star.y, star.size, star.x, star.y, star.size * 3.5);
        glowGrad.addColorStop(0, accentColor);
        glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGrad;
        
        ctx.globalAlpha = isCited ? 0.45 : (isMouseOver ? 0.35 : 0.15);
        ctx.arc(star.x, star.y, star.size * 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 8. Pulsing outer orbit circle for cited stars
        if (isCited) {
          ctx.save();
          ctx.beginPath();
          const pulse = 8 + Math.sin(Date.now() * 0.005) * 3;
          ctx.strokeStyle = accentBright;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.005) * 0.2;
          ctx.arc(star.x, star.y, star.size + pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // 9. Draw actual star core
        ctx.beginPath();
        let starColor = isDark ? 'rgba(232, 230, 225, 0.85)' : 'rgba(35, 34, 31, 0.85)';
        if (isCited) {
          starColor = accentBright;
        } else if (isMouseOver) {
          starColor = accentColor;
        }
        
        ctx.fillStyle = starColor;
        ctx.arc(star.x, star.y, star.size + (isMouseOver ? 1.5 : 0), 0, Math.PI * 2);
        ctx.fill();

        // 10. Star labels (monospace tags)
        if (star.memo.tags && star.memo.tags.length > 0) {
          ctx.font = '9px var(--font-mono)';
          ctx.fillStyle = isDark ? 'rgba(232, 230, 225, 0.5)' : 'rgba(35, 34, 31, 0.5)';
          ctx.textAlign = 'center';
          ctx.fillText(`#${star.memo.tags[0]}`, star.x, star.y - star.size - 5);
        }
      });

      setHoveredMemo(newHover);
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [stars, citations, backgroundStars]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mousePosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseLeave = () => {
    mousePosRef.current = { x: -1000, y: -1000 };
    setHoveredMemo(null);
  };

  const handleClick = () => {
    if (hoveredMemo) {
      onLoadMemo(hoveredMemo.memo);
    }
  };

  return (
    <div 
      className="galaxy-map-container" 
      ref={containerRef} 
      style={{ position: 'relative', width: '100%', height: '350px', background: 'var(--bg-color)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginTop: '1.5rem', cursor: hoveredMemo ? 'pointer' : 'default' }}
    >
      <canvas 
        ref={canvasRef} 
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      <div 
        className="galaxy-map-hud" 
        style={{ 
          position: 'absolute', 
          top: '12px', 
          left: '15px', 
          pointerEvents: 'none', 
          fontFamily: 'var(--font-mono)', 
          fontSize: '0.6875rem', 
          color: 'var(--text-muted)', 
          textTransform: 'uppercase', 
          letterSpacing: '0.08em',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}
      >
        <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>📡 SEMANTIC RADAR / CONCEPT CONSTELS</span>
        <span style={{ fontSize: '10px', opacity: 0.8 }}>GRID RESOLUTION: {history.length} STARS / ACTIVE</span>
      </div>
      
      {hoveredMemo && (
        <div 
          className="galaxy-map-tooltip" 
          style={{
            position: 'absolute',
            left: `${hoveredMemo.x + 12}px`,
            top: `${hoveredMemo.y - 12}px`,
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '10px',
            padding: '0.7rem 0.9rem',
            width: '240px',
            boxShadow: 'var(--shadow-md)',
            pointerEvents: 'none',
            zIndex: 10,
            transform: 'translate(0, -50%)',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
            <span>{new Date(hoveredMemo.memo.timestamp).toLocaleDateString()}</span>
            {hoveredMemo.memo.tags && hoveredMemo.memo.tags.length > 0 && (
              <span style={{ color: 'var(--accent-bright)' }}>#{hoveredMemo.memo.tags.join(', #')}</span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 'var(--fs-base)', color: 'var(--text-main)', lineBreak: 'anywhere', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.4' }}>
            {hoveredMemo.memo.transcript}
          </p>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-color)', marginTop: '0.5rem', fontWeight: 'bold' }}>
            🖱️ Click to load memory into editor
          </div>
        </div>
      )}
    </div>
  );
}

export default App;


