"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  MessageSquare, 
  Compass, 
  Plus, 
  Send, 
  Sparkles, 
  Brain, 
  Heart, 
  Activity, 
  ChevronRight, 
  Settings, 
  LogOut, 
  Menu, 
  HelpCircle, 
  Dna,
  User,
  Sliders,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  Tag,
  Trash2,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, useClerk, UserButton } from '@clerk/nextjs';
import { BackgroundPaths } from '@/components/background-paths';
import dynamic from 'next/dynamic';

const ThreeDModel = dynamic(
  () => import('@/components/three-d-model').then((mod) => mod.ThreeDModel),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 w-full h-full flex items-center justify-center bg-[#1b1b1b] min-h-[350px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#b4b4b4] font-semibold tracking-wider uppercase animate-pulse">Initializing WebGL Engine...</p>
        </div>
      </div>
    )
  }
);
import { SparklesCore } from '@/components/ui/sparkles';
import FlowArt, { FlowSection } from '@/components/ui/story-scroll';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  suggestModel?: 'heart' | 'brain' | 'lungs' | 'kidneys';
  suggestLabel?: string;
}

export default function Page() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | '3d'>('chat');
  const [selectedModel, setSelectedModel] = useState<'heart' | 'brain' | 'lungs' | 'kidneys'>('heart');
  const [activeStructure, setActiveStructure] = useState<string>('Left Ventricle');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isGeneratingLabels, setIsGeneratingLabels] = useState(false);
  const [showHUD, setShowHUD] = useState(true);
  
  // Clerk Authentication State
  const { isSignedIn, user, isLoaded } = useUser();
  const { openSignIn } = useClerk();

  // Force exit dashboard if user signs out
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setShowDashboard(false);
    }
  }, [isSignedIn, isLoaded]);

  const handleLaunchClick = (activeTabAfterLogin: 'chat' | '3d' = 'chat') => {
    if (isSignedIn) {
      setActiveTab(activeTabAfterLogin);
      setShowDashboard(true);
    } else {
      openSignIn({ fallbackRedirectUrl: '/' });
    }
  };
  
  // Neural4D Integration State
  const [isGenerating3D, setIsGenerating3D] = useState(false);
  const [neural4dPrompt, setNeural4dPrompt] = useState<string | null>(null);
  const [neural4dModelUrl, setNeural4dModelUrl] = useState<string | null>(null);
  const [neural4dImageUrl, setNeural4dImageUrl] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState<string | null>(null);
  const [pollProgress, setPollProgress] = useState(0); // 0-100 for progress bar
  const [dynamicLabels, setDynamicLabels] = useState<any>(null);
  
  // SQLite persistent session states
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');

  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: "Hello! I am your MedVis Medical AI. I can explain complex anatomical concepts, detailed physiological processes, and interactive clinical systems.\n\nType a question below or choose a starter module to begin, and visualize anatomical models instantly in real-time.",
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load sessions and generated models from SQLite/localStorage on mount
  const [generatedModels, setGeneratedModels] = useState<any[]>([]);

  useEffect(() => {
    const initData = async () => {
      if (!isLoaded) return;
      const accountId = user?.id || 'anon';
      const sessionKey = `medvis_sessions_${accountId}`;

      // ── 1. Load Sessions (Isolated per account) ──
      try {
        let localSessions: any[] = [];
        try {
          const s = localStorage.getItem(sessionKey);
          localSessions = s ? JSON.parse(s) : [];
        } catch (_) {}

        let finalSessions = localSessions;
        if (finalSessions.length === 0) {
          finalSessions = [{
            id: `session_default_${Date.now()}`,
            title: 'MedVis AI Clinical Sandbox',
            model_type: 'general',
            created_at: new Date().toISOString()
          }];
        }

        setSessions(finalSessions);
        try {
          localStorage.setItem(sessionKey, JSON.stringify(finalSessions));
        } catch (_) {}

        // Determine active session
        const activeId = finalSessions[0]?.id;
        if (activeId) setCurrentSessionId(activeId);

        // ── 2. Load Messages for Active Session (Isolated per account) ──
        if (activeId) {
          let localMsgs: any[] = [];
          try {
            const m = localStorage.getItem(`medvis_messages_${accountId}_${activeId}`);
            localMsgs = m ? JSON.parse(m) : [];
          } catch (_) {}

          if (localMsgs.length > 0) {
            setMessages(localMsgs);
          } else {
            const welcomeMsg = {
              id: 'msg_welcome_' + Date.now(),
              sender: 'ai' as const,
              text: "Hello! I am your MedVis Medical AI. I can explain complex anatomical concepts, detailed physiological processes, and interactive clinical systems.\n\nType a question below or choose a starter module to begin, and visualize anatomical models instantly in real-time.",
            };
            setMessages([welcomeMsg]);
            try {
              localStorage.setItem(`medvis_messages_${accountId}_${activeId}`, JSON.stringify([welcomeMsg]));
            } catch (_) {}
          }
        }
      } catch (err) {
        console.error('Failed to initialize session data:', err);
      }

      // ── 3. Load Global Generated Models (Strictly from Cloudflare R2) ──
      try {
        const res = await fetch(`/api/models?t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        
        if (data.models && data.models.length > 0) {
          setGeneratedModels(data.models);
        } else {
          setGeneratedModels([]);
        }
      } catch (err) {
        console.error('Failed to load global R2 generated models:', err);
      }
    };

    initData();
  }, [user?.id, isLoaded]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Persistent SQLite & LocalStorage Session Handlers
  const handleSelectSession = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setActiveTab('chat');
    setIsThinking(false);

    // Check if we have local messages first for instant response
    let localMsgs: any[] = [];
    try {
      const m = localStorage.getItem(`medvis_messages_${sessionId}`);
      localMsgs = m ? JSON.parse(m) : [];
    } catch (_) {}
    if (localMsgs.length > 0) {
      setMessages(localMsgs);
    }

    try {
      const msgRes = await fetch(`/api/sessions/messages?sessionId=${sessionId}`);
      const msgData = await msgRes.json();
      if (msgData.messages && msgData.messages.length > 0) {
        if (!(msgData.messages.length === 1 && msgData.messages[0].id.startsWith('msg_welcome') && localMsgs.length > 0)) {
          const parsed = msgData.messages.map((m: any) => ({
            id: m.id,
            sender: m.sender,
            text: m.text,
            suggestModel: m.suggest_model || undefined,
            suggestLabel: m.suggest_label || undefined
          }));
          setMessages(parsed);
          try {
            localStorage.setItem(`medvis_messages_${sessionId}`, JSON.stringify(parsed));
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error('Failed to load messages for session:', err);
    }
  };

  const handleNewSession = async (title: string = 'New Medical Chat Session', modelType: string = 'general') => {
    const newSessionId = 'session_' + Date.now();
    const newSession = {
      id: newSessionId,
      title,
      model_type: modelType,
      created_at: new Date().toISOString()
    };

    // Update session list state immediately
    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    setCurrentSessionId(newSessionId);
    try {
      localStorage.setItem('medvis_sessions', JSON.stringify(updatedSessions));
    } catch (_) {}

    // Add initial welcome message
    const initialText = "Hello! I am your MedVis Medical AI. I can explain complex anatomical concepts, detailed physiological processes, and interactive clinical systems.\n\nType a question below or choose a starter module to begin, and visualize anatomical models instantly in real-time.";
    const initialMsgId = 'msg_welcome_' + Date.now();
    const welcomeMsg = {
      id: initialMsgId,
      sender: 'ai' as const,
      text: initialText
    };

    setMessages([welcomeMsg]);
    try {
      localStorage.setItem(`medvis_messages_${newSessionId}`, JSON.stringify([welcomeMsg]));
    } catch (_) {}
    setActiveTab('chat');

    // Post to API asynchronously
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newSessionId, title, modelType }),
      });
      
      await fetch('/api/sessions/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: initialMsgId,
          sessionId: newSessionId,
          sender: 'ai',
          text: initialText,
          suggestModel: null,
          suggestLabel: null
        })
      });
    } catch (err) {
      console.error('Failed to save session to API:', err);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid selecting the deleted session
    
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(updatedSessions);
    try {
      localStorage.setItem('medvis_sessions', JSON.stringify(updatedSessions));
      localStorage.removeItem(`medvis_messages_${sessionId}`);
    } catch (_) {}

    // If we deleted the currently active session, switch to another one
    if (currentSessionId === sessionId) {
      if (updatedSessions.length > 0) {
        handleSelectSession(updatedSessions[0].id);
      } else {
        // If zero sessions left, create a fresh one!
        handleNewSession('MedVis AI Clinical Sandbox', 'general');
      }
    }

    try {
      await fetch(`/api/sessions?id=${sessionId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Failed to delete persistent session from API:', err);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim()) return;

    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText('');
    setIsThinking(true);

    const accountId = user?.id || 'anon';
    // Save to local storage
    try {
      localStorage.setItem(`medvis_messages_${accountId}_${currentSessionId}`, JSON.stringify(updatedMessages));
    } catch (_) {}

    // Post user message to API asynchronously
    fetch('/api/sessions/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: userMsg.id,
        sessionId: currentSessionId,
        sender: 'user',
        text: query,
        suggestModel: null,
        suggestLabel: null
      })
    }).catch(console.error);

    // Dynamically rename the session based on the first user message
    const currentSession = sessions.find(s => s.id === currentSessionId);
    if (currentSession && (currentSession.title.startsWith('New Medical Chat Session') || currentSession.title.startsWith('MedVis AI Clinical Sandbox'))) {
      const newTitle = query.length > 30 ? query.substring(0, 30) + '...' : query;
      const updatedSess = sessions.map(s => s.id === currentSessionId ? { ...s, title: newTitle } : s);
      setSessions(updatedSess);
      try {
        localStorage.setItem(`medvis_sessions_${accountId}`, JSON.stringify(updatedSess));
      } catch (_) {}

      fetch('/api/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentSessionId, title: newTitle })
      }).catch(console.error);
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sessionId: currentSessionId,
          messages: updatedMessages 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Grok AI');
      }

      const data = await response.json();
      const aiResponseText = data.choices?.[0]?.message?.content || 'Sorry, I was unable to process that response. Please try again.';

      // Determine model suggestion — user query has absolute priority over AI response
      let modelSuggestion: 'heart' | 'brain' | 'lungs' | 'kidneys' | undefined;
      let labelSuggestion = "";

      function detectModelClient(text: string): { model: 'heart' | 'brain' | 'lungs' | 'kidneys'; label: string } | null {
        const t = text.toLowerCase();
        if (t.includes('urinary') || t.includes('kidney') || t.includes('renal') || t.includes('nephron') || t.includes('bladder') || t.includes('urethra') || t.includes('ureter') || t.includes('glomerulus') || t.includes('glomeruli')) {
          return { model: 'kidneys', label: 'Urinary System' };
        }
        if (t.includes('lung') || t.includes('respir') || t.includes('breath') || t.includes('oxygen') || t.includes('pulmonary') || t.includes('alveoli') || t.includes('trachea') || t.includes('bronch')) {
          return { model: 'lungs', label: 'Pulmonary System' };
        }
        if (t.includes('brain') || t.includes('cerebral') || t.includes('synap') || t.includes('neural') || t.includes('cerebellum') || t.includes('neuron') || t.includes('nervous system') || t.includes('cortex')) {
          return { model: 'brain', label: 'Nervous System' };
        }
        if (t.includes('heart') || t.includes('cardio') || t.includes('circulation') || t.includes('coronary') || t.includes('myocardium') || t.includes('aorta') || t.includes('ventricle') || t.includes('atrium')) {
          return { model: 'heart', label: 'Cardiovascular System' };
        }
        // General system/organ extraction
        const systemMatch = text.match(/\b([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+system\b/i);
        if (systemMatch) {
          const sysName = systemMatch[1].trim();
          const label = sysName.charAt(0).toUpperCase() + sysName.slice(1).toLowerCase() + ' System';
          return { model: 'kidneys', label };
        }
        const organMatch = text.match(/\b(liver|stomach|intestine|pancreas|spleen|gallbladder|thyroid|prostate|uterus|ovaries|bone|muscle|skin|skeletal|lymph|immune|digestive|endocrine|reproductive|musculoskeletal)\b/i);
        if (organMatch) {
          const organ = organMatch[1].charAt(0).toUpperCase() + organMatch[1].slice(1).toLowerCase();
          return { model: 'kidneys', label: `${organ} System` };
        }
        return null;
      }

      // 1. User query is the source of truth
      const queryDetect = detectModelClient(query);
      if (queryDetect) {
        modelSuggestion = queryDetect.model;
        labelSuggestion = queryDetect.label;
      }

      // 2. Only use AI response as fallback if query gave nothing
      if (!modelSuggestion && aiResponseText && !aiResponseText.includes('⚠️')) {
        const responseDetect = detectModelClient(aiResponseText);
        if (responseDetect) {
          modelSuggestion = responseDetect.model;
          labelSuggestion = responseDetect.label;
        }
      }

      const newAiMsg = {
        id: data.aiMsgId || (Date.now() + 1).toString(),
        sender: 'ai' as const,
        text: aiResponseText,
        suggestModel: modelSuggestion || data.suggestModel,
        suggestLabel: labelSuggestion || data.suggestLabel,
      };

      setMessages(prev => {
        const nextMsgs = [...prev, newAiMsg];
        try {
          const accountId = user?.id || 'anon';
          localStorage.setItem(`medvis_messages_${accountId}_${currentSessionId}`, JSON.stringify(nextMsgs));
        } catch (_) {}
        return nextMsgs;
      });

      // Post AI message to API asynchronously
      fetch('/api/sessions/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newAiMsg.id,
          sessionId: currentSessionId,
          sender: 'ai',
          text: newAiMsg.text,
          suggestModel: newAiMsg.suggestModel || null,
          suggestLabel: newAiMsg.suggestLabel || null
        })
      }).catch(console.error);

    } catch (error) {
      console.error('Error fetching Grok AI response:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: "### ⚠️ MedVis Telemetry Error\n\nI was unable to establish a secure connection to the MedVis reasoning cluster. Please check the network bridge or verify the engine status.",
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleLaunch3D = async (rawModel: string, label: string) => {
    const model = (['heart', 'brain', 'lungs', 'kidneys'].includes(rawModel) 
      ? rawModel 
      : 'kidneys') as 'heart' | 'brain' | 'lungs' | 'kidneys';
    setSelectedModel(model);
    setCustomLabel(label);
    setActiveStructure("External Organ Surface");
    setActiveTab('3d');

    // Reset Neural4D state and show generating UI
    setIsGenerating3D(true);
    setNeural4dPrompt(null);
    setNeural4dModelUrl(null);
    setNeural4dImageUrl(null);
    setPollProgress(0);
    
    try {
      await new Promise(r => setTimeout(r, 400));

      const res = await fetch('/api/generate-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: label, messages: messages })
      });
      const data = await res.json();
      
      if (!data.success) {
        console.error('[3D] generate-3d POST failed:', data.error);
        return;
      }

      // Show the Grok-engineered prompt in the UI immediately
      if (data.promptUsed) setNeural4dPrompt(data.promptUsed);

      if (data.source === 'procedural' && !data.uuid) {
        // Neural4D key missing/invalid — no UUID returned, show procedural fallback
        console.log('[3D] Using procedural fallback (Neural4D unavailable)');
        setNeural4dModelUrl('fallback');
        
        // ── Save procedural model to local state ──
        const recordId = data.modelRecord?.id || ('model_' + Date.now());
        const newModelItem = {
          id: recordId,
          topic: label,
          prompt: data.promptUsed || `3D procedural simulation of ${label}`,
          model_url: 'fallback',
          image_url: null,
          created_at: new Date().toISOString()
        };
        setGeneratedModels(prev => [newModelItem, ...prev]);
        return;
      }

      if (data.uuid) {
        // ── Poll Neural4D retrieveModel until codeStatus === 0 ──
        // Neural4D takes ~90s. Poll every 5s for up to 10 minutes (120 attempts).
        let complete = false;
        let attempts = 0;
        const maxAttempts = 120;
        const delayMs = 5000;

        console.log(`[Neural4D] Polling UUID: ${data.uuid}`);

        while (!complete && attempts < maxAttempts) {
          attempts++;
          await new Promise(resolve => setTimeout(resolve, delayMs));

          try {
            const pollRes = await fetch(`/api/generate-3d?uuid=${data.uuid}`);
            if (!pollRes.ok) {
              console.error('[Neural4D] Poll HTTP error:', pollRes.status);
              continue;
            }

            const pollData = await pollRes.json();
            console.log(`[Neural4D] Poll ${attempts}/${maxAttempts}: codeStatus=${pollData.codeStatus}`);
            // Update progress bar (0→95% during generation, 100% on complete)
            setPollProgress(Math.min(95, Math.round((attempts / maxAttempts) * 100)));

            if (pollData.codeStatus === 0) {
              // ✅ Complete — load the model directly from Neural4D S3 (has CORS: *)
              complete = true;
              const loadUrl = pollData.modelUrl || pollData.proxyUrl;
              const generatedImgUrl = pollData.imageUrl || null;
              const generatedLabels = pollData.modelRecord?.dynamicLabels || null;
              
              if (loadUrl) {
                console.log('[Neural4D] ✅ Model ready! Loading:', loadUrl, 'Image:', generatedImgUrl);
                setPollProgress(100);
                setNeural4dModelUrl(loadUrl);
                setNeural4dImageUrl(generatedImgUrl);
                if (generatedLabels) {
                  setDynamicLabels(generatedLabels);
                  if (generatedLabels.structures?.[0]) {
                    setActiveStructure(generatedLabels.structures[0]);
                  }
                }

                // ── Save to Database & LocalStorage ──
                const newModelId = 'model_' + Date.now();
                const promptUsed = pollData.prompts || data.promptUsed || `3D model of ${label}`;
                
                const savedModelItem = pollData.modelRecord || {
                  id: newModelId,
                  topic: label,
                  prompt: promptUsed,
                  model_url: loadUrl,
                  image_url: generatedImgUrl,
                  created_at: new Date().toISOString(),
                  dynamicLabels: generatedLabels
                };
                
                setGeneratedModels(prev => [savedModelItem, ...prev]);

                // POST to API directly (R2 Global Storage)
                fetch('/api/models', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id: newModelId,
                    topic: label,
                    prompt: promptUsed,
                    modelUrl: loadUrl,
                    imageUrl: generatedImgUrl
                  })
                }).then(res => res.json())
                  .then(saveRes => {
                    console.log('[3D] Model saved in DB:', saveRes);
                  })
                  .catch(err => {
                    console.error('[3D] Failed to save model in API:', err);
                  });
              } else {
                console.error('[Neural4D] codeStatus=0 but no modelUrl returned');
              }
            } else if (pollData.codeStatus === -1 || pollData.codeStatus === -2 || pollData.codeStatus === -3) {
              complete = true;
              console.error(`[Neural4D] Generation failed or token expired (codeStatus: ${pollData.codeStatus}). Triggering procedural fallback.`);
              setNeural4dModelUrl('fallback');
              
              // ── Register procedural card locally ──
              const recordId = 'model_' + Date.now();
              const newModelItem = {
                id: recordId,
                topic: label,
                prompt: data.promptUsed || `3D procedural simulation of ${label}`,
                model_url: 'fallback',
                image_url: null,
                created_at: new Date().toISOString()
              };
              setGeneratedModels(prev => [newModelItem, ...prev]);
            }
          } catch (err) {
            console.error('[Neural4D] Poll error:', err);
            complete = true;
            setNeural4dModelUrl('fallback');
            
            const recordId = 'model_' + Date.now();
            const newModelItem = {
              id: recordId,
              topic: label,
              prompt: data.promptUsed || `3D procedural simulation of ${label}`,
              model_url: 'fallback',
              image_url: null,
              created_at: new Date().toISOString()
            };
            setGeneratedModels(prev => [newModelItem, ...prev]);
          }
        }

        if (!complete) {
          console.warn('[Neural4D] Timed out after 3 minutes');
        }
      }
    } catch (e) {
      console.error('[3D] handleLaunch3D error:', e);
    } finally {
      setIsGenerating3D(false);
    }
  };

  const handleLoadSavedModel = async (model: any) => {
    const rawModel = (['heart', 'brain', 'lungs', 'kidneys'].includes(model.topic.toLowerCase())
      ? model.topic.toLowerCase()
      : 'kidneys') as 'heart' | 'brain' | 'lungs' | 'kidneys';
    
    setSelectedModel(rawModel);
    setCustomLabel(model.topic);
    setNeural4dPrompt(model.prompt);
    setNeural4dModelUrl(model.model_url);
    setNeural4dImageUrl(model.image_url || null);
    
    // Fallback in case old models don't have dynamic labels
    if (!model.dynamicLabels) {
      setDynamicLabels(null);
      setActiveTab('3d');
      setIsGenerating3D(false);
      setIsGeneratingLabels(true);
      
      try {
        console.log('[Frontend] Model missing dynamic labels, generating on the fly...');
        const res = await fetch('/api/generate-labels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId: model.id, topic: model.topic, prompt: model.prompt })
        });
        const data = await res.json();
        if (data.success && data.dynamicLabels) {
          setDynamicLabels(data.dynamicLabels);
          if (data.dynamicLabels.structures?.[0]) {
            setActiveStructure(data.dynamicLabels.structures[0]);
          }
          // Update local memory securely so it persists instantly
          model.dynamicLabels = data.dynamicLabels;
          setSessions(prev => prev.map(s => s.id === model.id ? { ...s, dynamicLabels: data.dynamicLabels } : s));
        }
      } catch (err) {
        console.error('[Frontend] Failed to backfill dynamic labels:', err);
      } finally {
        setIsGeneratingLabels(false);
      }
    } else {
      setDynamicLabels(model.dynamicLabels);
      if (model.dynamicLabels?.structures?.[0]) {
        setActiveStructure(model.dynamicLabels.structures[0]);
      } else {
        setActiveStructure("External Organ Surface");
      }
      setActiveTab('3d');
      setIsGenerating3D(false);
    }
  };

  const handleDeleteSavedModel = async (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Update local state
    setGeneratedModels(prev => prev.filter(m => m.id !== modelId));
    
    // Local storage caching removed. Handled exclusively by R2 database.
    
    // Delete from API
    try {
      await fetch(`/api/models?id=${modelId}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Failed to delete model from database:', err);
    }
  };


  // Anatomical details database
  const getAnatomicalDetails = () => {
    if (neural4dModelUrl || isGenerating3D) {
      const displayName = customLabel || (selectedModel.charAt(0).toUpperCase() + selectedModel.slice(1) + " System");
      
      // Inject dynamically engineered Grok Labels if available in state
      if (dynamicLabels && dynamicLabels.structures && dynamicLabels.info) {
        return {
          title: displayName,
          subtitle: `Neural4D Model Generation`,
          structures: dynamicLabels.structures,
          info: dynamicLabels.info
        };
      }

      return {
        title: displayName,
        subtitle: `Neural4D Model Generation`,
        structures: [
          "External Organ Surface", 
          "Veins & Blood Streams", 
          "Natural Organ Coloration", 
          "Internal Cavity & Cross-section"
        ],
        info: {
          "External Organ Surface": `High-fidelity outer membrane of the ${displayName} generated with medically accurate PBR textures.`,
          "Veins & Blood Streams": `Intricate networks of arteries, veins, and capillary structures modeled precisely across the ${displayName} surface.`,
          "Natural Organ Coloration": `Fully organic, lifelike biological shaders and natural organ pigment colors synthesized dynamically.`,
          "Internal Cavity & Cross-section": `3D visualization showing both the interior chambers/cavities and the exterior shape of the ${displayName}.`
        }
      };
    }

    if (selectedModel === 'heart') {
      return {
        title: "Cardiovascular System",
        subtitle: "Interactive 3D Heart Simulation",
        structures: ["Left Ventricle", "Aorta Root", "Vena Cava", "Myocardium Walls"],
        info: {
          "Left Ventricle": "The thickest muscular chamber of the heart. Responsible for pumping oxygenated blood throughout the systemic circulation of the body under high pressure.",
          "Aorta Root": "The main arterial vessel originating directly from the left ventricle. It curves upwards, distributing oxygenated blood through major systemic branches.",
          "Vena Cava": "Large venous pathways returning deoxygenated blood from the upper (superior) and lower (inferior) body regions back into the right atrium.",
          "Myocardium Walls": "The contractile heart muscle tissue layers. Undergoes rhythmic depolarization to generate synchronous cardiac pulse beats."
        }
      };
    } else if (selectedModel === 'brain') {
      return {
        title: "Nervous System",
        subtitle: "Interactive 3D Cerebral Brain",
        structures: ["Cerebral Cortex", "Cerebellum", "Brainstem Loop", "Neural Synapses"],
        info: {
          "Cerebral Cortex": "The outermost folded layers of neural tissue. Handles advanced planning, memory encoding, sensory processing, and voluntary motor output.",
          "Cerebellum": "Positioned underneath the posterior cerebral hemispheres. Coordinates smooth, precise voluntary motor movements and body equilibrium balance.",
          "Brainstem Loop": "Critical pathway connecting the cerebrum to the spinal cord. Directly regulates cardiac rate, respiratory rate, and autonomic reflexes.",
          "Neural Synapses": "Point-to-point connections where chemical neurotransmitters bridge electric nerve impulses across neural cell pathways."
        }
      };
    } else if (selectedModel === 'kidneys') {
      return {
        title: "Renal System",
        subtitle: "Interactive 3D Filtering Kidneys",
        structures: ["Renal Cortex", "Renal Medulla", "Ureter Tube", "Renal Pelvis"],
        info: {
          "Renal Cortex": "The outer region of the kidney containing millions of nephrons and glomeruli where initial blood ultrafiltration occurs.",
          "Renal Medulla": "The inner region composed of renal pyramids. It concentrates urine through the Loop of Henle by reabsorbing water and essential salts.",
          "Ureter Tube": "The muscular ducts that actively propel concentrated urine from the kidneys down into the urinary bladder via peristalsis.",
          "Renal Pelvis": "The funnel-like dilated part of the ureter in the kidney. It acts as a funnel for urine flowing to the ureter."
        }
      };
    } else {
      return {
        title: "Pulmonary System",
        subtitle: "Interactive 3D Breathing Lungs",
        structures: ["Pulmonary Lobes", "Trachea Conduit", "Bronchial Tree", "Alveoli Capillaries"],
        info: {
          "Pulmonary Lobes": "The soft, elastic respiratory lobes where inhalation expands tissue volume to capture fresh air, and exhalation collapses it to expel CO2.",
          "Trachea Conduit": "The windpipe tube lined with cartilaginous rings. Serves as the primary airway channel guiding inhaled air directly into the thoracic cavity.",
          "Bronchial Tree": "Complex sub-branching airways dividing the trachea into left and right lungs, tapering down to microscopic respiratory bronchioles.",
          "Alveoli Capillaries": "Microscopic air sacs surrounded by blood capillaries. Serves as the ultra-thin barrier enabling rapid passive oxygen-carbon dioxide gas exchange."
        }
      };
    }
  };

  const anatomicalData = getAnatomicalDetails();


  return (
    <div className="w-full text-foreground relative">
      <BackgroundPaths />

      {/* LANDING PAGE VIEW */}
      {!showDashboard ? (
        <>
          {/* Navigation */}
          <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
            <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-foreground rounded flex items-center justify-center">
                  <Activity className="w-4 h-4 text-background" />
                </div>
                <span className="text-lg font-semibold tracking-tight">Medvis</span>
              </div>
              <div className="hidden md:flex items-center gap-12 text-sm">
                <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </a>
                <a href="#how" className="text-muted-foreground hover:text-foreground transition-colors">
                  How it works
                </a>
              </div>
              
              {isSignedIn ? (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-1 py-1 pr-3 rounded-full border border-border bg-[#171717]/60 backdrop-blur-sm shadow-sm">
                    <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: "w-7 h-7" } }} />
                    <span className="text-xs font-semibold text-foreground max-w-[120px] truncate">{user?.firstName}</span>
                  </div>
                  <button 
                    onClick={() => handleLaunchClick('chat')}
                    className="px-5 py-2 text-xs font-bold bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white border border-[#2f2f2f] rounded-lg transition-all active:scale-95 shadow"
                  >
                    Dashboard
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => handleLaunchClick('chat')}
                  className="px-6 py-2 text-sm font-medium bg-foreground text-background rounded hover:opacity-90 transition-opacity"
                >
                  Get Started
                </button>
              )}
            </div>
          </nav>

          {/* Hero Section */}
          <section className="relative z-10 pt-32 pb-20 px-6">
            <div className="max-w-4xl mx-auto text-center">
              <p className="text-sm text-muted-foreground mb-6 tracking-wide uppercase">Welcome to the future of medical education</p>
              <h1 className="text-6xl md:text-7xl font-bold leading-tight mb-8 tracking-tight">
                Learn Medical Science Through Interactive 3D Visualization
              </h1>
              <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
                Master complex anatomical concepts with AI-powered guidance, interactive 3D models, and personalized learning paths designed for medical professionals and students.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button 
                  onClick={() => handleLaunchClick('chat')}
                  className="px-8 py-4 bg-foreground text-background font-semibold rounded hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg"
                >
                  Launch MedVis AI
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleLaunchClick('3d')}
                  className="px-8 py-4 border border-border text-foreground font-semibold rounded hover:bg-card transition-colors shadow-sm"
                >
                  Explore 3D Models
                </button>
              </div>

              {/* Stats */}
              <div className="mt-16 grid grid-cols-3 gap-8 border-t border-border pt-12">
                <div>
                  <div className="text-3xl font-bold">2,300+</div>
                  <p className="text-sm text-muted-foreground mt-2">Medical Terms</p>
                </div>
                <div>
                  <div className="text-3xl font-bold">15K+</div>
                  <p className="text-sm text-muted-foreground mt-2">Active Learners</p>
                </div>
                <div>
                  <div className="text-3xl font-bold">98%</div>
                  <p className="text-sm text-muted-foreground mt-2">Satisfaction Rate</p>
                </div>
              </div>
            </div>
          </section>

          {/* Flow Presentation - Running from the Second Page Onward */}
          <div id="features" className="relative z-10 border-y border-border/10">
            <FlowArt aria-label="MedVis Presentation Flow">
              {/* Slide 1: Core Features */}
              <FlowSection aria-label="Core Features" className="bg-[#0a0a0a] text-[#fff]">
                <div className="absolute inset-0 bg-[#0a0a0a] -z-20" />
                <div className="flex flex-col h-full justify-between relative z-10">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">01 — Core Features</p>
                  <hr className="my-4 border-none border-t border-[#2f2f2f]/60" />
                  <div>
                    <div className="text-center mb-8">
                      <p className="text-sm text-muted-foreground mb-2 tracking-wide uppercase">Interactive Systems</p>
                      <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">Everything You Need to Excel</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-4">
                      {[
                        {
                          title: 'AI-Powered Learning',
                          description: 'Interactive chat with advanced medical AI for instant answers and deep explanations of complex concepts.',
                        },
                        {
                          title: '3D Anatomical Models',
                          description: 'Explore rotating, interactive 3D visualizations of human anatomy with detailed labeling.',
                        },
                        {
                          title: 'Structured Curriculum',
                          description: 'Comprehensive learning paths covering 2,300+ medical terms organized by body system.',
                        },
                        {
                          title: 'AI-Generated Notes',
                          description: 'Automatic summaries and study guides created from your learning sessions.',
                        },
                        {
                          title: 'Progress Tracking',
                          description: 'Detailed analytics showing your learning progress and knowledge retention over time.',
                        },
                        {
                          title: 'Exam Preparation',
                          description: 'Curated practice questions and mock exams aligned with medical licensing standards.',
                        },
                      ].map((feature, i) => (
                        <div key={i} className="p-6 border border-[#2f2f2f]/60 rounded-xl bg-[#171717]/40 hover:border-cyan-500/40 transition-all backdrop-blur-sm relative overflow-hidden group">
                          <div className="w-10 h-10 bg-cyan-950/60 border border-cyan-900/60 rounded-lg flex items-center justify-center mb-3">
                            <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                          </div>
                          <h3 className="text-md font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">{feature.title}</h3>
                          <p className="text-[#b4b4b4] text-xs leading-relaxed">{feature.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <hr className="my-4 border-none border-t border-[#2f2f2f]/60" />
                </div>
                <BackgroundPaths className="absolute inset-0" opacity={2.5} />
              </FlowSection>

              {/* Slide 2: Introduction */}
              <FlowSection aria-label="Platform Clarity" className="bg-[#070f12] text-[#fff]">
                <div className="absolute inset-0 bg-[#070f12] -z-20" />
                <div className="flex flex-col h-full justify-between relative z-10">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">02 — The Platform</p>
                  <hr className="my-4 border-none border-t border-cyan-950/40" />
                  <div>
                    <h2 className="text-[clamp(2.5rem,7vw,7rem)] font-extrabold leading-[0.9] uppercase tracking-tight text-white mb-6">
                      Anatomical
                      <br />
                      Precision
                      <br />
                      Unleashed
                    </h2>
                    <p className="max-w-[50ch] text-[clamp(1rem,1.8vw,1.5rem)] font-normal leading-relaxed text-cyan-100/70">
                      We believe medical education deserves ultimate visual precision. No over-simplified diagrams — just rich, interactive anatomical simulations mapped to peer-reviewed data.
                    </p>
                  </div>
                  <hr className="my-4 border-none border-t border-cyan-950/40" />
                  <div className="flex items-center gap-2 text-xs font-semibold text-cyan-500/70 uppercase tracking-wider">
                    <Activity className="w-4 h-4 text-cyan-500 animate-pulse" />
                    SCROLL DOWN TO REVEAL DEEPER SYSTEMS
                  </div>
                </div>
                <BackgroundPaths className="absolute inset-0" opacity={2.5} />
              </FlowSection>

              {/* Slide 3: AI Core */}
              <FlowSection aria-label="MedVis AI Mission" className="bg-[#07161c] text-[#fff]">
                <div className="absolute inset-0 bg-[#07161c] -z-20" />
                <div className="flex flex-col h-full justify-between relative z-10">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">03 — Neural Core</p>
                  <hr className="my-4 border-none border-t border-cyan-900/40" />
                  <div>
                    <h2 className="text-[clamp(2.5rem,7vw,7rem)] font-extrabold leading-[0.9] uppercase tracking-tight text-white mb-6">
                      Conversational
                      <br />
                      Anatomy
                      <br />
                      Engine
                    </h2>
                    <p className="max-w-[50ch] text-[clamp(1rem,1.8vw,1.5rem)] font-normal leading-relaxed text-cyan-100/80 mb-8">
                      A unique integration of natural language processing and WebGL. Explore physical structures organically through real-time dialogue and telemetry mappings.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-4">
                    <div className="p-5 border border-cyan-800/40 bg-cyan-950/40 rounded-xl backdrop-blur-sm">
                      <Sparkles className="w-5 h-5 text-cyan-400 mb-2" />
                      <p className="text-sm font-bold uppercase tracking-wider text-white mb-1">Interactive Highlight</p>
                      <p className="text-xs text-cyan-200/60 leading-relaxed">
                        Medical terms mentioned in chat instantly illuminate the corresponding 3D node.
                      </p>
                    </div>
                    <div className="p-5 border border-cyan-800/40 bg-cyan-950/40 rounded-xl backdrop-blur-sm">
                      <Brain className="w-5 h-5 text-cyan-400 mb-2" />
                      <p className="text-sm font-bold uppercase tracking-wider text-white mb-1">Intelligent Context</p>
                      <p className="text-xs text-cyan-200/60 leading-relaxed">
                        Ask about complex arterial loops, tissue elasticity, or physiological cycles.
                      </p>
                    </div>
                    <div className="p-5 border border-cyan-800/40 bg-cyan-950/40 rounded-xl backdrop-blur-sm">
                      <Sliders className="w-5 h-5 text-cyan-400 mb-2" />
                      <p className="text-sm font-bold uppercase tracking-wider text-white mb-1">Dynamic Telemetry</p>
                      <p className="text-xs text-cyan-200/60 leading-relaxed">
                        Examine active vital notes and control interactive models dynamically.
                      </p>
                    </div>
                  </div>
                  <hr className="my-4 border-none border-t border-cyan-900/40" />
                </div>
                <BackgroundPaths className="absolute inset-0" opacity={2.5} />
              </FlowSection>

              {/* Slide 4: The Process */}
              <FlowSection aria-label="Platform Process" className="bg-[#0b1626] text-[#fff]">
                <div className="absolute inset-0 bg-[#0b1626] -z-20" />
                <div className="flex flex-col h-full justify-between relative z-10">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">04 — How It Works</p>
                  <hr className="my-4 border-none border-t border-slate-700/40" />
                  <div>
                    <h2 className="text-[clamp(2.5rem,7vw,7rem)] font-extrabold leading-[0.9] uppercase tracking-tight text-white mb-6">
                      Ask.
                      <br />
                      Orbit.
                      <br />
                      Master.
                    </h2>
                    <p className="max-w-[50ch] text-[clamp(1rem,1.8vw,1.5rem)] font-normal leading-relaxed text-slate-300 mb-8">
                      Three intuitive steps. Zero clutter. Master intricate medical science the moment you enter the lab.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-4">
                    <div className="p-5 border border-slate-700/40 bg-slate-800/40 rounded-xl backdrop-blur-sm">
                      <p className="text-3xl font-extrabold text-cyan-400/80 mb-2">01</p>
                      <p className="text-sm font-bold uppercase tracking-wider text-white mb-1">Ask naturally</p>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Prompt our clinical AI assistant with specific anatomical questions or tissue loops.
                      </p>
                    </div>
                    <div className="p-5 border border-slate-700/40 bg-slate-800/40 rounded-xl backdrop-blur-sm">
                      <p className="text-3xl font-extrabold text-cyan-400/80 mb-2">02</p>
                      <p className="text-sm font-bold uppercase tracking-wider text-white mb-1">Orbit & highlighting</p>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Interact directly with high-fidelity models, rotate viewports, and expand nodes.
                      </p>
                    </div>
                    <div className="p-5 border border-slate-700/40 bg-slate-800/40 rounded-xl backdrop-blur-sm">
                      <p className="text-3xl font-extrabold text-cyan-400/80 mb-2">03</p>
                      <p className="text-sm font-bold uppercase tracking-wider text-white mb-1">Synthesize notes</p>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Auto-generate clean summary cards and physiological schemas for offline study.
                      </p>
                    </div>
                  </div>
                  <hr className="my-4 border-none border-t border-slate-700/40" />
                </div>
                <BackgroundPaths className="absolute inset-0" opacity={2.5} />
              </FlowSection>

              {/* Slide 5: Core Metrics */}
              <FlowSection aria-label="MedVis Vision" className="bg-[#13111f] text-[#fff]">
                <div className="absolute inset-0 bg-[#13111f] -z-20" />
                <div className="flex flex-col h-full justify-between relative z-10">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">05 — Core Metrics</p>
                  <hr className="my-4 border-none border-t border-purple-950/40" />
                  <div>
                    <h2 className="text-[clamp(2.5rem,7vw,7rem)] font-extrabold leading-[0.9] uppercase tracking-tight text-white mb-6">
                      The Future
                      <br />
                      Of Learning
                    </h2>
                    <p className="max-w-[50ch] text-[clamp(1rem,1.8vw,1.5rem)] font-normal leading-relaxed text-[#b4b4b4] mb-8">
                      We&apos;re not just building a static database. We are engineering a revolutionary standard for digital clinical comprehension.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-4">
                    <div className="p-5 border border-purple-900/40 bg-purple-950/30 rounded-xl backdrop-blur-sm">
                      <p className="text-4xl font-extrabold text-cyan-400">2,300+</p>
                      <p className="text-xs text-[#b4b4b4] mt-2 leading-relaxed">
                        Active interactive medical nodes and anatomical catalog listings.
                      </p>
                    </div>
                    <div className="p-5 border border-purple-900/40 bg-purple-950/30 rounded-xl backdrop-blur-sm">
                      <p className="text-4xl font-extrabold text-cyan-400">15K+</p>
                      <p className="text-xs text-[#b4b4b4] mt-2 leading-relaxed">
                        Active learners, medical students, and clinical practitioners worldwide.
                      </p>
                    </div>
                    <div className="p-5 border border-purple-900/40 bg-purple-950/30 rounded-xl backdrop-blur-sm">
                      <p className="text-4xl font-extrabold text-cyan-400">98%</p>
                      <p className="text-xs text-[#b4b4b4] mt-2 leading-relaxed">
                        Comprehension and classroom test-prep retention rate increase.
                      </p>
                    </div>
                  </div>
                  <hr className="my-4 border-none border-t border-purple-950/40" />
                </div>
                <BackgroundPaths className="absolute inset-0" opacity={2.5} />
              </FlowSection>

              {/* Slide 6: Call to Action */}
              <FlowSection aria-label="Explore MedVis" className="bg-[#070707] text-[#fff]">
                <div className="absolute inset-0 bg-[#070707] -z-20" />
                <div className="flex flex-col h-full justify-between relative z-10">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">06 — Deep Exploration</p>
                  <hr className="my-4 border-none border-t border-[#2f2f2f]" />
                  <div className="my-auto text-center max-w-2xl mx-auto py-12">
                    <h2 className="text-[clamp(2.5rem,6vw,6rem)] font-extrabold leading-[0.95] uppercase tracking-tight text-white mb-6">
                      Ready to
                      <br />
                      Begin?
                    </h2>
                    <p className="text-base sm:text-lg text-[#b4b4b4] mb-8 leading-relaxed">
                      Take complete control of your clinical educational path. Launch the 3D medical simulator and experience natural interactive learning.
                    </p>
                    <button 
                      onClick={() => handleLaunchClick('chat')}
                      className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold rounded-xl shadow-lg shadow-cyan-950/40 hover:shadow-cyan-400/20 hover:scale-[1.02] active:scale-[0.98] transition-all inline-flex items-center gap-2"
                    >
                      Launch Simulator
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                  <hr className="my-4 border-none border-t border-[#2f2f2f]" />
                </div>
                <BackgroundPaths className="absolute inset-0" opacity={2.5} />
              </FlowSection>
            </FlowArt>
          </div>

          {/* Footer */}
          <footer className="relative z-10 border-t border-border bg-card/20 px-6 py-12">
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-border pb-8 mb-8">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-foreground rounded flex items-center justify-center font-bold text-background text-xs">M</div>
                  <span className="font-semibold text-lg tracking-tight">MedVis AI</span>
                </div>
                <div className="flex gap-8 text-sm text-muted-foreground">
                  <a href="#features" className="hover:text-foreground transition-colors">Features</a>
                  <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
                  <button onClick={() => handleLaunchClick('chat')} className="hover:text-foreground transition-colors">Launch Lab</button>
                </div>
              </div>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
                <p>© 2026 MedVis AI. Designed for advanced medical simulation and education.</p>
                <div className="flex gap-6">
                  <a href="#" className="hover:text-foreground transition-colors">LinkedIn</a>
                  <a href="#" className="hover:text-foreground transition-colors">GitHub</a>
                </div>
              </div>
            </div>
          </footer>
        </>
      ) : (
        /* PREMIUM CHATGPT-STYLE DASHBOARD */
        <div className="fixed inset-0 z-50 flex bg-[#212121] text-[#ececec] font-sans">
          
          {/* Mobile Sidebar Overlay */}
          {isSidebarOpen && (
            <div 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-sm transition-opacity"
            />
          )}

          {/* LEFT SIDEBAR (ChatGPT Style) */}
          <div className={`transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64 p-3.5 opacity-100 border-r border-[#2f2f2f]' : 'w-0 p-0 opacity-0 border-r-0 overflow-hidden'} flex-shrink-0 bg-[#171717] flex flex-col justify-between fixed md:relative inset-y-0 left-0 md:inset-y-auto md:left-auto z-40 md:z-auto shadow-2xl md:shadow-none`}>
            <div className="flex flex-col gap-1.5">
              
              {/* Sidebar Header / New Chat */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <button 
                  onClick={() => handleNewSession()}
                  className="flex-1 flex items-center gap-2 p-2 hover:bg-[#212121] rounded-lg transition-colors border border-[#2f2f2f] text-sm font-medium text-left"
                >
                  <Plus className="w-4 h-4" />
                  New Chat
                </button>
                <button 
                  onClick={() => setIsSidebarOpen(false)} 
                  title="Collapse Sidebar"
                  className="p-2 hover:bg-[#212121] border border-[#2f2f2f] rounded-lg text-[#b4b4b4] hover:text-white transition-colors"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Items */}
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => setActiveTab('chat')}
                  className={`flex items-center gap-3 w-full p-2.5 rounded-lg text-sm transition-colors text-left ${activeTab === 'chat' ? 'bg-[#212121] text-white font-medium' : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-white'}`}
                >
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  Clinical Chat Assistant
                </button>
                <button 
                  onClick={() => setActiveTab('3d')}
                  className={`flex items-center gap-3 w-full p-2.5 rounded-lg text-sm transition-colors text-left ${activeTab === '3d' ? 'bg-[#212121] text-white font-medium' : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-white'}`}
                >
                  <Compass className="w-4 h-4 text-cyan-400" />
                  3D Interactive Lab
                </button>
              </div>

              <div className="h-[1px] bg-[#2f2f2f] my-4" />

              {/* Active Conversations (SQLite) */}
              <div className="flex flex-col gap-1 overflow-y-auto max-h-[40vh] pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#3f3f3f] [&::-webkit-scrollbar-thumb]:rounded-full">
                <p className="text-[10px] font-semibold text-[#6f6f6f] px-2.5 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#6f6f6f]" />
                  Chat History (SQLite)
                </p>
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
                    className={`group/item flex items-center justify-between w-full p-2 rounded-lg text-xs transition-all text-left truncate cursor-pointer ${
                      currentSessionId === session.id 
                        ? 'bg-[#212121] text-cyan-400 font-semibold border border-cyan-950/40 shadow-inner' 
                        : 'text-[#b4b4b4] hover:bg-[#212121] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate flex-1 pr-1">
                      <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${currentSessionId === session.id ? 'text-cyan-400' : 'text-[#5f5f5f]'}`} />
                      <span className="truncate">{session.title}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      title="Delete Conversation"
                      className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-[#2f2f2f] rounded text-[#8e8e8e] hover:text-red-500 transition-all flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="h-[1px] bg-[#2f2f2f] my-3" />

              {/* Neural4D Generated Models Gallery (SQLite & LocalStorage) */}
              <div className="flex flex-col gap-1 overflow-y-auto max-h-[30vh] pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#3f3f3f] [&::-webkit-scrollbar-thumb]:rounded-full">
                <p className="text-[10px] font-semibold text-[#6f6f6f] px-2.5 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#6f6f6f]" />
                  Neural4D 3D Models ({generatedModels.length})
                </p>
                {generatedModels.length === 0 ? (
                  <p className="text-[10px] text-[#5f5f5f] px-2.5 italic">No generated models yet. Ask chat to explore organs!</p>
                ) : (
                  generatedModels.map((model) => (
                    <div
                      key={model.id}
                      onClick={() => handleLoadSavedModel(model)}
                      className="group/model flex items-center justify-between w-full p-2 rounded-lg text-xs transition-all text-left truncate cursor-pointer text-[#b4b4b4] hover:bg-[#212121] hover:text-white"
                    >
                      <div className="flex items-center gap-2.5 truncate flex-1 pr-1">
                        {model.image_url ? (
                          <img
                            src={model.image_url}
                            alt={model.topic}
                            className="w-7 h-7 rounded-md border border-[#2f2f2f] object-cover bg-neutral-900 flex-shrink-0 shadow-sm"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        )}
                        <div className="flex flex-col truncate">
                          <span className="truncate text-white font-medium text-xs leading-none mb-0.5">{model.topic}</span>
                          <span className="text-[8px] text-[#6f6f6f] truncate max-w-[120px] font-mono leading-none">
                            {model.prompt ? model.prompt.replace(/["'\n\r]/g, '') : 'Neural4D Asset'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSavedModel(model.id, e)}
                        title="Delete Saved Model"
                        className="opacity-0 group-hover/model:opacity-100 p-1 hover:bg-[#2f2f2f] rounded text-[#8e8e8e] hover:text-red-500 transition-all flex-shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="h-[1px] bg-[#2f2f2f] my-3" />

              {/* Preset Simulators */}
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-semibold text-[#6f6f6f] px-2.5 uppercase tracking-wider mb-2">Preset Simulators</p>
                {[
                  { label: "Coronary Circulation", model: "heart", text: "Explain coronary circulation in heart" },
                  { label: "Cerebral Cortex folds", model: "brain", text: "Explain folds of the cerebral cortex brain" },
                  { label: "Pulmonary Inhalation", model: "lungs", text: "Explain pulmonary breathing mechanics in lungs" },
                  { label: "Renal Filtration", model: "kidneys", text: "Explain how kidneys filter blood and produce urine" }
                ].map((item, index) => (
                  <button
                    key={index}
                    onClick={async () => {
                      await handleNewSession(item.label, item.model);
                      handleSendMessage(item.text);
                    }}
                    className="flex items-center gap-2 w-full p-2 hover:bg-[#212121] text-[#b4b4b4] hover:text-white rounded-lg text-xs transition-colors text-left truncate"
                  >
                    <Compass className="w-3.5 h-3.5 text-[#5f5f5f] flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>

            </div>

              <div className="p-3 border-t border-[#2f2f2f] bg-[#0d0d0d] flex flex-col justify-center gap-3">
                <a 
                  href="https://docs.google.com/forms/d/e/1FAIpQLSd2PGNzmBSwEKi4EbH_vwmEXasNcwZDEtmRHFDDZ-B0T9oarA/viewform?usp=publish-editor" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full p-2 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/60 text-cyan-400 hover:text-cyan-300 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_10px_rgba(6,182,212,0.15)] hover:shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                >
                  <Star className="w-3.5 h-3.5" />
                  Leave a Review
                </a>
                <div className="flex items-center gap-3">
                  <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: "w-8 h-8" } }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-white leading-snug">{isSignedIn ? user?.fullName : 'Medical Student'}</p>
                    <p className="text-xs text-[#8e8e8e] truncate leading-none mt-0.5">{isSignedIn ? user?.primaryEmailAddress?.emailAddress : 'Clinical Lab Track'}</p>
                  </div>
                </div>
              </div>

          </div>

          {/* MAIN CONTAINER */}
          <div className="flex-1 flex flex-col bg-[#212121] overflow-hidden relative">
            
            {/* Header */}
            <header className="h-14 border-b border-[#2f2f2f] flex items-center justify-between px-4 sm:px-6 bg-[#212121] z-10">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {!isSidebarOpen && (
                  <button
                    onClick={() => setIsSidebarOpen(true)}
                    title="Expand Sidebar"
                    className="p-2 mr-1 hover:bg-[#2f2f2f] border border-[#2f2f2f] rounded-lg text-[#b4b4b4] hover:text-white transition-colors flex-shrink-0"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                  </button>
                )}
                <span className="font-semibold text-white tracking-tight flex items-center gap-2 text-sm sm:text-base truncate">
                  <Activity className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span className="truncate">MedVis <span className="hidden sm:inline">Clinical Dashboard</span><span className="sm:hidden">AI</span></span>
                </span>
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-semibold tracking-wider uppercase hidden md:inline-block flex-shrink-0">
                  AI Core Active
                </span>
              </div>
              
              <div className="flex items-center gap-3 sm:gap-4 text-sm text-[#b4b4b4] flex-shrink-0">
                <button 
                  onClick={() => setShowDashboard(false)}
                  className="hover:text-white flex items-center gap-1.5 transition-colors text-xs border border-[#3f3f3f] px-2.5 py-1 sm:px-3 sm:py-1 rounded hover:bg-[#2f2f2f]"
                  title="Exit Simulator"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Exit Simulator</span>
                </button>
              </div>
            </header>

            {/* TAB CONTENT: CHAT ASSISTANT */}
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col justify-between overflow-hidden relative">
                
                {messages.length === 1 ? (
                  <div className="flex-1 flex flex-col justify-center items-center relative overflow-hidden h-full min-h-[500px]">
                    
                    {/* Sparkles Particle Background */}
                    <div className="absolute inset-0 w-full h-full bg-[#212121]">
                      <SparklesCore
                        id="tsparticles_dashboard"
                        background="transparent"
                        minSize={0.6}
                        maxSize={1.4}
                        particleDensity={120}
                        className="w-full h-full"
                        particleColor="#06b6d4" // Clinical Cyan/Teal glow
                        speed={0.8}
                      />
                      {/* Radial Mask to prevent sharp edges and blend beautifully with page dark mode */}
                      <div className="absolute inset-0 w-full h-full bg-[#212121] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_45%,transparent_20%,#212121_95%)] pointer-events-none" />
                    </div>

                    {/* Centered ChatGPT-style Workspace Content */}
                    <div className="relative z-10 max-w-2xl w-full px-6 flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-cyan-950/80 border border-cyan-800 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-cyan-950/30">
                        <Sparkles className="w-6 h-6 text-cyan-400" />
                      </div>
                      <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-2">
                        What clinical concepts would you like to explore?
                      </h2>
                      <p className="text-sm text-[#b4b4b4] mb-8 max-w-lg leading-relaxed">
                        Ask our clinical assistant about cardiovascular cycles, pulmonary mechanics, or neural pathways to visualize simulated models dynamically.
                      </p>

                      {/* Chat Input placed above suggestions, exactly like ChatGPT */}
                      <div className="w-full max-w-xl relative mb-6">
                        <textarea 
                          value={inputText}
                          onChange={(e) => {
                            setInputText(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          rows={1}
                          placeholder="Ask about cardiovascular, nervous, or pulmonary systems..."
                          className="w-full pl-5 pr-14 py-3.5 bg-[#2f2f2f]/85 hover:bg-[#343434]/95 focus:bg-[#343434] border border-[#3f3f3f] focus:border-cyan-700/60 text-[#ececec] placeholder-[#6f6f6f] text-sm rounded-xl focus:outline-none transition-all shadow-2xl backdrop-blur-md resize-none min-h-[50px] leading-relaxed [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#4f4f4f] [&::-webkit-scrollbar-thumb]:rounded-full"
                        />
                        <button 
                          onClick={() => handleSendMessage()}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 flex items-center justify-center text-cyan-400 transition-all shadow-md active:scale-95"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Suggestions below input */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
                        {[
                          { title: "Cardiac Circulation", desc: "Branching of coronary arteries & ventricular pressure loops", text: "Explain coronary circulation in heart" },
                          { title: "Cerebral Pathways", desc: "Sensory integration, motor coordination and folding cortex layers", text: "Explain folds of the cerebral cortex brain" },
                          { title: "Respiratory Systems", desc: "Bronchial conduits, gas diffusion barriers & alveolar mechanics", text: "Explain pulmonary breathing mechanics in lungs" }
                        ].map((prompt, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendMessage(prompt.text)}
                            className="p-4 rounded-xl border border-[#2f2f2f] hover:border-cyan-800 bg-[#171717]/85 hover:bg-[#171717] transition-all text-left text-xs group shadow-lg backdrop-blur-sm"
                          >
                            <p className="font-semibold text-white mb-1 group-hover:text-cyan-400 transition-colors flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5 text-cyan-500" />
                              {prompt.title}
                            </p>
                            <p className="text-[#8e8e8e] leading-relaxed">{prompt.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard scrolling message thread view */
                  <div className="flex-1 flex flex-col justify-between overflow-hidden h-full">
                    {/* Chat Scrollbox */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div className="max-w-3xl mx-auto space-y-6">
                        {messages.map((msg) => (
                          <div 
                            key={msg.id} 
                            className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            {/* AI Icon */}
                            {msg.sender === 'ai' && (
                              <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center flex-shrink-0">
                                <Sparkles className="w-4 h-4 text-cyan-400" />
                              </div>
                            )}

                            <div className={`p-4 rounded-2xl max-w-[80%] leading-relaxed ${
                              msg.sender === 'user' 
                                ? 'bg-[#2f2f2f] text-white rounded-tr-none' 
                                : 'bg-[#171717]/80 border border-[#2f2f2f] text-[#ececec] rounded-tl-none space-y-4'
                            }`}>
                              <div className={`space-y-1 mt-0.5 ${msg.sender === 'user' ? 'whitespace-pre-wrap' : ''}`}>
                                {msg.sender === 'user' ? (
                                  msg.text
                                ) : (
                                  <ReactMarkdown 
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      h1: ({node, ...props}) => <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-6 mb-3 tracking-tight border-b border-[#2f2f2f] pb-2" {...props} />,
                                      h2: ({node, ...props}) => <h2 className="text-lg sm:text-xl font-bold text-white mt-5 mb-2.5 tracking-tight" {...props} />,
                                      h3: ({node, ...props}) => <h3 className="text-base sm:text-lg font-bold text-cyan-400 mt-4 mb-2" {...props} />,
                                      p: ({node, ...props}) => <p className="text-sm sm:text-base text-[#d4d4d4] leading-relaxed mb-3" {...props} />,
                                      ul: ({node, ...props}) => <ul className="list-disc pl-6 space-y-1 mb-4 text-[#d4d4d4] text-sm sm:text-base marker:text-cyan-600" {...props} />,
                                      ol: ({node, ...props}) => <ol className="list-decimal pl-6 space-y-1 mb-4 text-[#d4d4d4] text-sm sm:text-base marker:text-cyan-600" {...props} />,
                                      li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                                      strong: ({node, ...props}) => <strong className="font-semibold text-cyan-300" {...props} />,
                                      a: ({node, ...props}) => <a className="text-cyan-400 hover:underline hover:text-cyan-300" {...props} />,
                                      code: ({node, inline, ...props}: any) => 
                                        inline 
                                          ? <code className="bg-[#2a2a2a] text-cyan-300 px-1.5 py-0.5 rounded text-[0.9em] font-mono border border-[#3f3f3f]" {...props} />
                                          : <div className="bg-[#111] p-4 rounded-xl overflow-x-auto border border-[#333] my-4 font-mono text-[#e2e2e2] text-sm whitespace-pre-wrap block" {...props} />,
                                      blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-cyan-600 pl-4 py-1 my-4 bg-cyan-950/20 text-[#a0a0a0] italic" {...props} />,
                                      table: ({node, ...props}) => <div className="overflow-x-auto my-4"><table className="w-full text-sm sm:text-base text-left text-[#d4d4d4]" {...props} /></div>,
                                      th: ({node, ...props}) => <th className="px-4 py-2 border-b border-[#3f3f3f] font-bold text-white bg-[#2a2a2a]" {...props} />,
                                      td: ({node, ...props}) => <td className="px-4 py-2 border-b border-[#2f2f2f]" {...props} />,
                                    }}
                                  >
                                    {msg.text}
                                  </ReactMarkdown>
                                )}
                              </div>

                              {/* Deep link Visualizer CTA */}
                              {msg.sender === 'ai' && msg.suggestModel && (
                                <div className="pt-2 border-t border-[#2f2f2f]">
                                  <button
                                    onClick={() => handleLaunch3D(msg.suggestModel!, msg.suggestLabel!)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 hover:border-cyan-700 text-cyan-400 text-xs font-semibold tracking-wide transition-all shadow-md"
                                  >
                                    <Compass className="w-3.5 h-3.5" />
                                    Interactive 3D Visualizer: {msg.suggestLabel}
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* User Icon */}
                            {msg.sender === 'user' && (
                              <div className="w-8 h-8 rounded-lg bg-neutral-700 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold uppercase">
                                MD
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Thinking Indicator */}
                        {isThinking && (
                          <div className="flex gap-4 justify-start">
                            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center flex-shrink-0">
                              <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                            </div>
                            <div className="p-4 rounded-2xl bg-[#171717]/80 border border-[#2f2f2f] text-[#b4b4b4] rounded-tl-none">
                              <div className="flex gap-1 items-center">
                                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          </div>
                        )}

                        <div ref={messagesEndRef} />
                      </div>
                    </div>

                    {/* Message input bar at bottom during conversation */}
                    <div className="p-4 bg-[#212121] border-t border-[#2f2f2f]">
                      <div className="max-w-3xl mx-auto relative">
                        <textarea 
                          value={inputText}
                          onChange={(e) => {
                            setInputText(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          rows={1}
                          placeholder="Ask about cardiovascular, nervous, or pulmonary systems..."
                          className="w-full pl-4 pr-12 py-3 bg-[#2f2f2f] hover:bg-[#343434] focus:bg-[#343434] border border-[#3f3f3f] focus:border-cyan-700/60 text-[#ececec] placeholder-[#6f6f6f] text-sm rounded-xl focus:outline-none transition-colors shadow-inner resize-none min-h-[46px] leading-relaxed [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#4f4f4f] [&::-webkit-scrollbar-thumb]:rounded-full"
                        />
                        <button 
                          onClick={() => handleSendMessage()}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 flex items-center justify-center text-cyan-400 transition-colors shadow"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-center text-[10px] text-[#6f6f6f] mt-2">
                        MedVis AI models simulated medical systems. Always cross-reference with peer-reviewed medical catalogs.
                      </p>
                    </div>
                  </div>
                )}

              </div>
            )}

            {activeTab === '3d' && (
              <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-[#1b1b1b]">
                
                {!(isGenerating3D || neural4dModelUrl || neural4dImageUrl) ? (
                  /* Neural4D Gallery Hub (Replaces the procedural mockup models!) */
                  <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col">
                    <div className="max-w-5xl mx-auto w-full space-y-8">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-[#2f2f2f] pb-6">
                        <div>
                          <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                            MedVis Anatomical Lab
                          </p>
                          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                            Your Custom Generated 3D Organs
                          </h2>
                          <p className="text-sm text-[#8e8e8e] mt-2 max-w-2xl leading-relaxed">
                            Every time you explore medical topics in chat, MedVis synthesizes actual 3D meshes. Select a generated organ model below to launch the clinical simulator.
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveTab('chat')}
                          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-400 rounded-xl text-xs font-semibold tracking-wide hover:shadow-cyan-950/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex-shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                          Generate New Organ
                        </button>
                      </div>

                      {generatedModels.length === 0 ? (
                        /* Empty Gallery State */
                        <div className="border border-[#2f2f2f] bg-[#171717]/60 rounded-2xl p-16 text-center flex flex-col items-center justify-center space-y-6">
                          <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-800 flex items-center justify-center text-cyan-400">
                            <Compass className="w-8 h-8" />
                          </div>
                          <div className="space-y-2 max-w-sm">
                            <h4 className="font-bold text-white text-lg">No Custom Models Deployed Yet</h4>
                            <p className="text-xs text-[#8e8e8e] leading-relaxed">
                              Use the Clinical Chat Assistant to ask about any organ system (e.g. "Explain how the heart pumps blood") and the MedVis synthesis pipeline will create it for you!
                            </p>
                          </div>
                          <button
                            onClick={() => setActiveTab('chat')}
                            className="px-6 py-3 bg-[#2f2f2f] hover:bg-[#343434] border border-[#3f3f3f] text-white rounded-xl text-xs font-semibold tracking-wide transition-all"
                          >
                            Open Chat Assistant
                          </button>
                        </div>
                      ) : (
                        /* Generated Models Gallery Grid */
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                          {generatedModels.map((model) => (
                            <div
                              key={model.id}
                              onClick={() => handleLoadSavedModel(model)}
                              className="group relative bg-[#171717]/80 hover:bg-[#171717] border border-[#2f2f2f] hover:border-cyan-800/60 rounded-2xl overflow-hidden cursor-pointer shadow-xl transition-all duration-300 hover:scale-[1.02] flex flex-col justify-between"
                            >
                              <div>
                                {/* Custom Preview Image Card */}
                                <div className="relative aspect-video w-full bg-[#0a0a0a] border-b border-[#2f2f2f] overflow-hidden">
                                  {model.image_url ? (
                                    <img
                                      src={model.image_url}
                                      alt={model.topic}
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-cyan-400/40">
                                      <Sparkles className="w-12 h-12" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                                  <span className="absolute bottom-3 left-3 text-xs font-bold text-white uppercase tracking-wider bg-cyan-950/80 border border-cyan-800/40 px-2.5 py-1 rounded-md backdrop-blur-sm">
                                    Neural4D Render
                                  </span>
                                </div>

                                <div className="p-4 space-y-2">
                                  <h4 className="font-bold text-white text-base group-hover:text-cyan-400 transition-colors capitalize text-left">
                                    {model.topic}
                                  </h4>
                                  <p className="text-xs text-[#8e8e8e] leading-relaxed line-clamp-3 italic text-left">
                                    "{model.prompt || 'Generated medical model asset.'}"
                                  </p>
                                </div>
                              </div>

                              <div className="p-4 border-t border-[#2f2f2f] flex items-center justify-between">
                                <span className="text-[10px] text-[#5f5f5f] font-mono">
                                  {new Date(model.created_at).toLocaleDateString()}
                                </span>
                                <span className="text-xs font-bold text-cyan-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                  Launch Visualizer
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* 3D Visualizer Simulator View (Active Custom Model) */
                  <>
                    {/* 3D Viewport Column */}
                    <div className={`w-full md:flex-1 relative flex flex-col bg-[#1b1b1b] border-b md:border-b-0 md:border-r border-[#2f2f2f] overflow-hidden transition-all duration-300 min-h-[320px] ${showHUD ? 'h-[45vh] md:h-full' : 'h-[calc(100vh-70px)] md:h-full'}`}>
                      
                      {/* Top Options Bar (Back to gallery button instead of default mockup tabs!) */}
                      <div className="absolute top-3 left-3 right-3 md:right-auto z-30 flex items-center justify-between md:justify-start gap-2">
                        <button
                          onClick={() => {
                            setNeural4dModelUrl(null);
                            setNeural4dPrompt(null);
                            setNeural4dImageUrl(null);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#171717]/95 border border-[#2f2f2f] text-white hover:border-cyan-800 hover:text-cyan-400 transition-all shadow-xl backdrop-blur-sm"
                        >
                          <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                          <span>Close Simulator</span>
                        </button>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Toggle Rotation Button */}
                          <button
                            onClick={() => setAutoRotate(!autoRotate)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-xl backdrop-blur-sm ${autoRotate ? 'bg-cyan-950 border-cyan-800 text-cyan-400' : 'bg-[#171717]/90 border-[#2f2f2f] text-[#b4b4b4] hover:text-white'}`}
                          >
                            <span className="w-3.5 h-3.5 flex items-center justify-center">↻</span>
                            <span>Rotate: {autoRotate ? 'ON' : 'OFF'}</span>
                          </button>
                          
                          {/* Toggle Labels ON/OFF Button */}
                          <button
                            onClick={() => setShowLabels(!showLabels)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-xl backdrop-blur-sm ${showLabels ? 'bg-cyan-950 border-cyan-800 text-cyan-400' : 'bg-[#171717]/90 border-[#2f2f2f] text-[#b4b4b4] hover:text-white'}`}
                          >
                            <Tag className="w-3.5 h-3.5" />
                            <span>Labels: {showLabels ? 'ON' : 'OFF'}</span>
                          </button>
                        </div>
                      </div>

                      {/* 3D Render Output */}
                      <div className="flex-1 w-full h-full flex items-center justify-center relative">
                        <ThreeDModel 
                          type={selectedModel} 
                          showLabels={showLabels} 
                          activeStructure={activeStructure}
                          onStructureSelect={setActiveStructure}
                          isGenerating={isGenerating3D}
                          neural4dPrompt={neural4dPrompt}
                          neural4dModelUrl={neural4dModelUrl}
                          neural4dImageUrl={neural4dImageUrl}
                          pollProgress={pollProgress}
                          dynamicLabels={dynamicLabels}
                          autoRotate={autoRotate}
                        />
                      </div>

                      {/* Desktop Only: Live HUD Information Overlay */}
                      <div className="hidden md:flex absolute bottom-4 left-4 right-4 z-10 justify-between items-end pointer-events-none">
                        <div className="bg-[#171717]/95 border border-[#2f2f2f] p-4 rounded-xl shadow-xl max-w-sm pointer-events-auto backdrop-blur-sm text-left">
                          <p className="text-[10px] uppercase font-bold text-cyan-400 tracking-widest mb-1 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                            Active Model Telemetry
                          </p>
                          <h4 className="text-md font-bold text-white mb-2 capitalize">{customLabel || selectedModel}</h4>
                          <p className="text-xs text-[#b4b4b4] leading-relaxed line-clamp-3 italic">
                            {neural4dPrompt ? `"${neural4dPrompt}"` : `High-resolution Neural4D simulation active.`}
                          </p>
                        </div>

                        <div className="bg-[#171717]/90 border border-[#2f2f2f] px-4 py-3 rounded-xl shadow-xl pointer-events-auto text-[10px] text-[#8e8e8e] leading-relaxed flex flex-col gap-1 backdrop-blur-sm">
                          <p className="font-semibold text-white">INTERACTION TIPS</p>
                          <p>🖱️ Drag cursor to orbit & rotate axis</p>
                          <p>📜 Scroll wheel / trackpad pinch to zoom</p>
                        </div>
                      </div>

                    </div>

                    {/* Right Structure Selection & Medical Details Panel */}
                    <div className="w-full md:w-80 bg-[#171717] p-5 flex flex-col justify-between md:overflow-y-auto select-none border-t md:border-t-0 md:border-l border-[#2f2f2f]">
                      <div className="space-y-6">
                        <div className="text-left">
                          <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mb-1">
                            Anatomical Lab Module
                          </p>
                          <h3 className="text-lg font-bold text-white leading-tight capitalize">
                            {customLabel || selectedModel} System
                          </h3>
                          <p className="text-xs text-[#8e8e8e] mt-1 italic">
                            Custom MedVis synthesized geometry
                          </p>
                        </div>

                        <div className="h-[1px] bg-[#2f2f2f]" />

                        {/* Structures List */}
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-[#8e8e8e] uppercase tracking-wider mb-3 text-left flex items-center justify-between">
                            Anatomical Regions
                            {isGeneratingLabels && (
                              <span className="text-[9px] text-cyan-400 animate-pulse flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full" /> AI Scanning...
                              </span>
                            )}
                          </p>
                          
                          {isGeneratingLabels && !dynamicLabels && (
                            <div className="w-full flex flex-col items-center justify-center p-6 border border-dashed border-cyan-800/40 rounded-xl bg-cyan-950/10 gap-3">
                               <div className="w-5 h-5 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                               <p className="text-[10px] text-cyan-400/80 tracking-widest uppercase font-bold text-center">
                                 Mapping 12-Point<br/>Anatomical Data...
                               </p>
                            </div>
                          )}

                          {dynamicLabels && dynamicLabels.structures && dynamicLabels.structures.map((item: string) => (
                            <div key={item} className="flex flex-col">
                              <button
                                onClick={() => setActiveStructure(activeStructure === item ? '' : item)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs text-left font-medium transition-all ${activeStructure === item ? 'bg-cyan-950/40 border-cyan-800 text-white shadow shadow-cyan-950/20 rounded-b-none border-b-transparent' : 'border-[#2f2f2f] hover:border-[#3f3f3f] text-[#b4b4b4] hover:text-white'}`}
                              >
                                <span className="flex items-center gap-2.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${activeStructure === item ? 'bg-cyan-400 animate-pulse' : 'bg-neutral-600'}`} />
                                  {item}
                                </span>
                                <ChevronRight className={`w-3.5 h-3.5 text-[#5f5f5f] transition-transform duration-300 ${activeStructure === item ? 'rotate-90 text-cyan-500' : ''}`} />
                              </button>
                              
                              <AnimatePresence>
                                {activeStructure === item && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="p-4 pt-2 border border-t-0 border-cyan-800 bg-cyan-950/20 rounded-b-xl text-[10px] text-cyan-100/70 leading-relaxed shadow-inner">
                                      {dynamicLabels.info?.[item] || "Advanced scanning data is not currently available for this clinical region."}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                        </div>

                        <div className="h-[1px] bg-[#2f2f2f]" />

                        {/* Quick Simulation Stats */}
                        <div className="p-4 rounded-xl bg-[#212121]/50 border border-[#2f2f2f] space-y-3 text-left">
                          <p className="text-[10px] text-[#8e8e8e] uppercase font-bold tracking-wider">
                            Active Telemetry
                          </p>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-[#8e8e8e] text-[10px]">POLY COUNT</p>
                              <p className="font-semibold text-white mt-0.5">High Density</p>
                            </div>
                            <div>
                              <p className="text-[#8e8e8e] text-[10px]">RENDER ENGINE</p>
                              <p className="font-semibold text-cyan-400 mt-0.5 uppercase tracking-wide">Three.js GLTF</p>
                            </div>
                            <div>
                              <p className="text-[#8e8e8e] text-[10px]">PIPELINE</p>
                              <p className="font-semibold text-white mt-0.5">Neural4D Cloud</p>
                            </div>
                            <div>
                              <p className="text-[#8e8e8e] text-[10px]">CORS PROXY</p>
                              <p className="font-semibold text-white mt-0.5">Active</p>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Back to gallery */}
                      <div className="pt-5 border-t border-[#2f2f2f] mt-6">
                        <button 
                          onClick={() => {
                            setNeural4dModelUrl(null);
                            setNeural4dPrompt(null);
                            setNeural4dImageUrl(null);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#2f2f2f] hover:bg-[#343434] border border-[#3f3f3f] text-xs font-semibold text-white transition-colors"
                        >
                          <Compass className="w-3.5 h-3.5" />
                          Close Simulator
                        </button>
                      </div>

                    </div>
                  </>
                )}

              </div>
            )}

          </div>

        </div>
      )}


    </div>
  );
}

// Google Brand SSO Icon Helper Component
const GoogleIcon = () => (
  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);
