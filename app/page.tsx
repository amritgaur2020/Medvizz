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
  Maximize2
} from 'lucide-react';
import { BackgroundPaths } from '@/components/background-paths';
import { ThreeDModel } from '@/components/three-d-model';
import { SparklesCore } from '@/components/ui/sparkles';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  suggestModel?: 'heart' | 'brain' | 'lungs';
  suggestLabel?: string;
}

export default function Page() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | '3d'>('chat');
  const [selectedModel, setSelectedModel] = useState<'heart' | 'brain' | 'lungs'>('heart');
  const [activeStructure, setActiveStructure] = useState<string>('Left Ventricle');
  
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

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim()) return;

    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);

    // Simulate clinical AI response
    setTimeout(() => {
      let aiResponseText = "";
      let modelSuggestion: 'heart' | 'brain' | 'lungs' | undefined;
      let labelSuggestion = "";

      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes('heart') || lowerQuery.includes('cardio') || lowerQuery.includes('circulation')) {
        aiResponseText = "### Cardiac Cycle & Coronary Circulation\n\nThe human heart is a precise four-chambered muscle that pumps oxygen-rich blood through the aorta. The left ventricle generates the necessary systemic pressure to propel oxygenated blood through the body. Coronary arteries branch directly from the aorta root, providing vital nutrients to the myocardium.\n\nTo view this dynamically, you can load our interactive 3D Cardiovascular Heart model below to see ventricular contractions and active blood flow particle simulations.";
        modelSuggestion = 'heart';
        labelSuggestion = 'Aorta & Ventricles';
      } else if (lowerQuery.includes('brain') || lowerQuery.includes('cerebral') || lowerQuery.includes('synap') || lowerQuery.includes('neural')) {
        aiResponseText = "### Cerebral Hemispheres & Synaptic Pathways\n\nThe brain comprises two large cerebral hemispheres responsible for high-level cognition, sensory integration, and motor commands. Folds known as gyri and sulci increase surface area. Neural signaling occurs across chemical synapses where neurotransmitters spark micro-electric actions.\n\nYou can launch our real-time 3D Neural Brain simulation to explore cerebral lobes, cerebellic motor loops, and active neural firing particle clouds.";
        modelSuggestion = 'brain';
        labelSuggestion = 'Cerebral Cortex';
      } else if (lowerQuery.includes('lung') || lowerQuery.includes('respir') || lowerQuery.includes('breath') || lowerQuery.includes('oxygen')) {
        aiResponseText = "### Pulmonary Alveoli & Respiratory Exchange\n\nRespiration functions via pressure gradients between lungs and atmosphere. When the diaphragm contracts, lung volume expands, drawing oxygen through the trachea and bronchial branches into microscopic alveoli. Oxygen diffuses into blood capillaries while carbon dioxide is exhaled.\n\nOpen our interactive 3D Pulmonary Respiratory model to witness realistic deep breathing cycles and active oxygen particle diffusion.";
        modelSuggestion = 'lungs';
        labelSuggestion = 'Trachea & Pulmonary Lobes';
      } else {
        aiResponseText = "### Medical Visualization Interface\n\nI have logged your clinical query. MedVis integrates specialized modular visualizers for different anatomy tracks, including the Cardiovascular System, Nervous/Cerebral Networks, and Pulmonary/Respiratory Loops.\n\nChoose one of our core systems to inspect high-fidelity structures and active physiological simulations.";
        modelSuggestion = 'heart';
        labelSuggestion = 'System Default';
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: aiResponseText,
        suggestModel: modelSuggestion,
        suggestLabel: labelSuggestion,
      }]);
      setIsThinking(false);
    }, 1500);
  };

  const handleLaunch3D = (model: 'heart' | 'brain' | 'lungs', label: string) => {
    setSelectedModel(model);
    setActiveStructure(
      model === 'heart' ? 'Left Ventricle' : 
      model === 'brain' ? 'Cerebral Cortex' : 
      'Pulmonary Lobes'
    );
    setActiveTab('3d');
  };

  // Anatomical details database
  const getAnatomicalDetails = () => {
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
              <button 
                onClick={() => setShowDashboard(true)}
                className="px-6 py-2 text-sm font-medium bg-foreground text-background rounded hover:opacity-90 transition-opacity"
              >
                Get Started
              </button>
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
                  onClick={() => setShowDashboard(true)}
                  className="px-8 py-4 bg-foreground text-background font-semibold rounded hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  Launch MedVis AI
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    setShowDashboard(true);
                    setActiveTab('3d');
                  }}
                  className="px-8 py-4 border border-border text-foreground font-semibold rounded hover:bg-card transition-colors"
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

          {/* Features Section */}
          <section id="features" className="relative z-10 py-24 px-6 bg-card/30">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <p className="text-sm text-muted-foreground mb-4 tracking-wide uppercase">Core Features</p>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Everything You Need to Excel</h2>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
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
                  <div key={i} className="p-8 border border-border rounded bg-background/50 hover:border-foreground/50 transition-colors">
                    <div className="w-12 h-12 bg-foreground rounded flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-6 h-6 text-background" />
                    </div>
                    <h3 className="text-lg font-semibold mb-3">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* How It Works */}
          <section id="how" className="relative z-10 py-24 px-6">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-16">
                <p className="text-sm text-muted-foreground mb-4 tracking-wide uppercase">The Process</p>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight">How Medvis Works</h2>
              </div>

              <div className="grid md:grid-cols-4 gap-8">
                {[
                  { step: '01', title: 'Ask', desc: 'Chat naturally with our AI about medical concepts' },
                  { step: '02', title: 'Visualize', desc: 'See 3D models bring anatomy to life' },
                  { step: '03', title: 'Learn', desc: 'Study from AI-generated notes and summaries' },
                  { step: '04', title: 'Master', desc: 'Reinforce learning with practice questions' },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="text-5xl font-bold text-muted-foreground mb-4">{item.step}</div>
                    <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="relative z-10 py-24 px-6 border-t border-border/20 bg-gradient-to-b from-transparent to-[#171717]/20">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-5xl font-bold mb-6 tracking-tight">Ready to explore clinical science?</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Launch our interactive simulator workspace to interact with clinical AI models and master anatomy in real-time.
              </p>
              <button 
                onClick={() => setShowDashboard(true)}
                className="px-8 py-4 bg-foreground text-background font-semibold rounded hover:opacity-90 transition-opacity inline-flex items-center gap-2"
              >
                Launch Simulator
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </section>

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
                  <button onClick={() => setShowDashboard(true)} className="hover:text-foreground transition-colors">Launch Lab</button>
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
          
          {/* LEFT SIDEBAR (ChatGPT Style) */}
          <div className="w-64 flex-shrink-0 bg-[#171717] border-r border-[#2f2f2f] flex flex-col justify-between p-3.5">
            <div className="flex flex-col gap-1.5">
              
              {/* Sidebar Header / New Chat */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <button 
                  onClick={() => {
                    setActiveTab('chat');
                    setMessages([
                      {
                        id: Date.now().toString(),
                        sender: 'ai',
                        text: "Hello! I am your MedVis Medical AI. I can explain complex anatomical concepts, detailed physiological processes, and interactive clinical systems.\n\nType a question below or choose a starter module to begin, and visualize anatomical models instantly in real-time.",
                      }
                    ]);
                  }}
                  className="flex-1 flex items-center gap-2 p-2 hover:bg-[#212121] rounded-lg transition-colors border border-[#2f2f2f] text-sm font-medium text-left"
                >
                  <Plus className="w-4 h-4" />
                  New Chat
                </button>
                <button 
                  onClick={() => setShowDashboard(false)} 
                  title="Back to Landing Page"
                  className="p-2 hover:bg-[#212121] border border-[#2f2f2f] rounded-lg text-[#b4b4b4] hover:text-white transition-colors"
                >
                  <LogOut className="w-4 h-4 rotate-180" />
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

              {/* Recent Conversations */}
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold text-[#6f6f6f] px-2.5 uppercase tracking-wider mb-2">Anatomical Modules</p>
                {[
                  { label: "Coronary Circulation", model: "heart", text: "Explain coronary circulation in heart" },
                  { label: "Cerebral Cortex folds", model: "brain", text: "Explain folds of the cerebral cortex brain" },
                  { label: "Pulmonary Inhalation", model: "lungs", text: "Explain pulmonary breathing mechanics in lungs" }
                ].map((item, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setActiveTab('chat');
                      handleSendMessage(item.text);
                    }}
                    className="flex items-center gap-2 w-full p-2 hover:bg-[#212121] text-[#b4b4b4] hover:text-white rounded-lg text-xs transition-colors text-left truncate"
                  >
                    <Activity className="w-3.5 h-3.5 text-[#5f5f5f]" />
                    {item.label}
                  </button>
                ))}
              </div>

            </div>

            {/* Sidebar Bottom Profile */}
            <div className="flex flex-col gap-2 pt-4 border-t border-[#2f2f2f]">
              <div className="flex items-center gap-3 p-2 rounded-lg text-sm">
                <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center font-bold text-white text-sm">
                  MD
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-white">Medical Student</p>
                  <p className="text-xs text-[#b4b4b4] truncate">Clinical Lab Track</p>
                </div>
              </div>
            </div>

          </div>

          {/* MAIN CONTAINER */}
          <div className="flex-1 flex flex-col bg-[#212121] overflow-hidden relative">
            
            {/* Header */}
            <header className="h-14 border-b border-[#2f2f2f] flex items-center justify-between px-6 bg-[#212121] z-10">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-white tracking-tight flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  MedVis Clinical Dashboard
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 font-semibold tracking-wider uppercase">
                  AI Core Active
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-[#b4b4b4]">
                <button 
                  onClick={() => setShowDashboard(false)}
                  className="hover:text-white flex items-center gap-1.5 transition-colors text-xs border border-[#3f3f3f] px-3 py-1 rounded hover:bg-[#2f2f2f]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Exit Simulator
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
                        <input 
                          type="text"
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder="Ask about cardiovascular, nervous, or pulmonary systems..."
                          className="w-full pl-5 pr-14 py-3.5 bg-[#2f2f2f]/85 hover:bg-[#343434]/95 focus:bg-[#343434] border border-[#3f3f3f] focus:border-cyan-700/60 text-[#ececec] placeholder-[#6f6f6f] text-sm rounded-xl focus:outline-none transition-all shadow-2xl backdrop-blur-md"
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
                              <p className="whitespace-pre-wrap text-sm">{msg.text}</p>

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
                        <input 
                          type="text"
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder="Ask about cardiovascular, nervous, or pulmonary systems..."
                          className="w-full pl-4 pr-12 py-3 bg-[#2f2f2f] hover:bg-[#343434] focus:bg-[#343434] border border-[#3f3f3f] focus:border-cyan-700/60 text-[#ececec] placeholder-[#6f6f6f] text-sm rounded-xl focus:outline-none transition-colors shadow-inner"
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

            {/* TAB CONTENT: 3D INTERACTIVE LAB */}
            {activeTab === '3d' && (
              <div className="flex-1 flex overflow-hidden">
                
                {/* 3D Viewport Column */}
                <div className="flex-1 relative flex flex-col bg-[#1b1b1b] border-r border-[#2f2f2f]">
                  
                  {/* Top Model Options */}
                  <div className="absolute top-4 left-4 z-10 flex gap-1.5 bg-[#171717]/90 border border-[#2f2f2f] p-1.5 rounded-xl shadow-xl backdrop-blur-sm">
                    {[
                      { type: 'heart', label: 'Cardio Heart', icon: Heart },
                      { type: 'brain', label: 'Cerebral Brain', icon: Brain },
                      { type: 'lungs', label: 'Pulmonary Lungs', icon: Activity }
                    ].map((model) => {
                      const Icon = model.icon;
                      return (
                        <button
                          key={model.type}
                          onClick={() => {
                            setSelectedModel(model.type as any);
                            setActiveStructure(
                              model.type === 'heart' ? 'Left Ventricle' : 
                              model.type === 'brain' ? 'Cerebral Cortex' : 
                              'Pulmonary Lobes'
                            );
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${selectedModel === model.type ? 'bg-cyan-950 border border-cyan-800 text-cyan-400 shadow' : 'text-[#b4b4b4] hover:text-white'}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {model.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* 3D Render Output */}
                  <div className="flex-1 w-full h-full flex items-center justify-center">
                    <ThreeDModel type={selectedModel} />
                  </div>

                  {/* Live HUD Information Overlay */}
                  <div className="absolute bottom-4 left-4 right-4 z-10 flex justify-between items-end pointer-events-none">
                    <div className="bg-[#171717]/95 border border-[#2f2f2f] p-4 rounded-xl shadow-xl max-w-sm pointer-events-auto backdrop-blur-sm">
                      <p className="text-[10px] uppercase font-bold text-cyan-400 tracking-widest mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                        Interactive Structure Highlighted
                      </p>
                      <h4 className="text-md font-bold text-white mb-2">{activeStructure}</h4>
                      <p className="text-xs text-[#b4b4b4] leading-relaxed">
                        {anatomicalData.info[activeStructure as keyof typeof anatomicalData.info] || "Select an anatomical structure to highlight."}
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
                <div className="w-80 bg-[#171717] p-5 flex flex-col justify-between overflow-y-auto select-none border-l border-[#2f2f2f]">
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mb-1">
                        Anatomical Lab Module
                      </p>
                      <h3 className="text-lg font-bold text-white leading-tight">
                        {anatomicalData.title}
                      </h3>
                      <p className="text-xs text-[#8e8e8e] mt-1">
                        {anatomicalData.subtitle}
                      </p>
                    </div>

                    <div className="h-[1px] bg-[#2f2f2f]" />

                    {/* Structures List */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[#8e8e8e] uppercase tracking-wider mb-3">
                        Key Anatomical Nodes
                      </p>
                      {anatomicalData.structures.map((item) => (
                        <button
                          key={item}
                          onClick={() => setActiveStructure(item)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs text-left font-medium transition-all ${activeStructure === item ? 'bg-cyan-950/40 border-cyan-800 text-white shadow shadow-cyan-950/20' : 'border-[#2f2f2f] hover:border-[#3f3f3f] text-[#b4b4b4] hover:text-white'}`}
                        >
                          <span className="flex items-center gap-2.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${activeStructure === item ? 'bg-cyan-400 animate-pulse' : 'bg-neutral-600'}`} />
                            {item}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-[#5f5f5f]" />
                        </button>
                      ))}
                    </div>

                    <div className="h-[1px] bg-[#2f2f2f]" />

                    {/* Quick Simulation Stats */}
                    <div className="p-4 rounded-xl bg-[#212121]/50 border border-[#2f2f2f] space-y-3">
                      <p className="text-[10px] text-[#8e8e8e] uppercase font-bold tracking-wider">
                        Active Telemetry
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-[#8e8e8e] text-[10px]">PULSE FREQ</p>
                          <p className="font-semibold text-white mt-0.5">72 BPM</p>
                        </div>
                        <div>
                          <p className="text-[#8e8e8e] text-[10px]">CYCLE STATE</p>
                          <p className="font-semibold text-cyan-400 mt-0.5 uppercase tracking-wide">Pulsing</p>
                        </div>
                        <div>
                          <p className="text-[#8e8e8e] text-[10px]">POLY COUNT</p>
                          <p className="font-semibold text-white mt-0.5">24.5K</p>
                        </div>
                        <div>
                          <p className="text-[#8e8e8e] text-[10px]">ENGINE</p>
                          <p className="font-semibold text-white mt-0.5">WebGL 2</p>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Back to chat assistant button */}
                  <div className="pt-5 border-t border-[#2f2f2f] mt-6">
                    <button 
                      onClick={() => setActiveTab('chat')}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#2f2f2f] hover:bg-[#343434] border border-[#3f3f3f] text-xs font-semibold text-white transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Back to Assistant
                    </button>
                  </div>

                </div>

              </div>
            )}

          </div>

        </div>
      )}
    </div>
  );
}
