import React, { useState, useEffect, useRef } from 'react';
import { Sender, Message } from './types';
import { GeminiService, decodeBase64Audio, pcmToAudioBuffer, encodePCM } from './geminiService';
import { Search, MoreVertical, Paperclip, Send, Mic, Phone, Video, ChevronLeft, Shield } from 'lucide-react';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: Sender.ALEX,
      text: '¡Hola! Soy ALEX IO. Soy tu cerebro cognitivo estratégico. He cargado la Constitución de acompañamiento y estoy listo para asistirte. ¿En qué podemos trabajar hoy?',
      timestamp: new Date(),
      type: 'text'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const gemini = useRef(new GeminiService());

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: Sender.USER,
      text: inputText,
      timestamp: new Date(),
      type: 'text'
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const history = messages.slice(-10).map(m => ({
        role: m.sender === Sender.USER ? 'user' : 'model',
        parts: m.text
      }));
      const response = await gemini.current.sendTextMessage(inputText, history);
      const alexMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: Sender.ALEX,
        text: response || 'Error de sincronización con el núcleo. Reintentando...',
        timestamp: new Date(),
        type: 'text'
      };
      setMessages(prev => [...prev, alexMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleLive = async () => {
    if (isLive) {
      liveSessionRef.current?.close?.();
      setIsLive(false);
      audioContextRef.current?.close();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      setIsLive(true);
      const sessionPromise = gemini.current.connectLive({
        onAudio: async (base64) => {
          const data = decodeBase64Audio(base64);
          const buffer = await pcmToAudioBuffer(data, outCtx);
          const source = outCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(outCtx.destination);
          nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
          source.start(nextStartTimeRef.current);
          nextStartTimeRef.current += buffer.duration;
          audioSourcesRef.current.add(source);
        }
      });
      sessionPromise.then(session => {
        liveSessionRef.current = session;
        const source = audioContextRef.current!.createMediaStreamSource(stream);
        const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          session.sendRealtimeInput({ media: { data: encodePCM(inputData), mimeType: 'audio/pcm;rate=24000' } });
        };
        source.connect(processor);
        processor.connect(audioContextRef.current!.destination);
      });
    } catch (err) {
      setIsLive(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-slate-100 font-sans">
      {/* Header Premium */}
      <div className="bg-[#1e293b] border-b border-slate-700/50 p-4 flex items-center justify-between shadow-2xl z-10 backdrop-blur-xl">
        <div className="flex items-center space-x-4">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
            <div className="relative w-12 h-12 rounded-full overflow-hidden border border-slate-600">
              <Shield className="w-12 h-12 p-2 bg-slate-900 text-blue-500" />
            </div>
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#1e293b] rounded-full"></div>
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight">ALEX <span className="text-blue-500">IO</span></h1>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Cerebro Cognitivo Activo</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button className="p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-700 transition-colors text-slate-400 hover:text-white">
            <Phone size={20} />
          </button>
          <button className="p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-700 transition-colors text-slate-400 hover:text-white">
            <Video size={20} />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat">
        <div className="flex justify-center">
          <span className="bg-slate-800/50 backdrop-blur text-[10px] px-4 py-1.5 rounded-full text-slate-400 uppercase tracking-[0.2em] font-black border border-slate-700/30">
            Sincronización Cuántica Iniciada
          </span>
        </div>

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === Sender.USER ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-5 py-3.5 rounded-3xl shadow-2xl relative ${msg.sender === Sender.USER
                ? 'bg-blue-600 text-white rounded-tr-none'
                : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
              }`}>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              <div className="flex justify-end mt-2 opacity-50">
                <span className="text-[10px] font-medium tracking-tighter">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-800 px-6 py-3 rounded-full border border-slate-700">
              <div className="flex space-x-1.5">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Overlay Live */}
      {isLive && (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center z-50 p-8 text-center backdrop-blur-lg">
          <div className="relative mb-12">
            <div className="absolute -inset-8 bg-blue-500 rounded-full blur-[80px] opacity-20 animate-pulse"></div>
            <div className="relative w-40 h-40 rounded-full border-2 border-blue-500/30 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full border-4 border-dashed border-blue-500 animate-[spin_10s_linear_infinite]"></div>
              <Mic className="absolute text-blue-500 w-12 h-12" />
            </div>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-4">Interfaz de Voz Neural</h2>
          <p className="text-slate-400 max-w-sm text-sm leading-relaxed mb-12 uppercase tracking-widest font-medium">
            Sincronización de audio activa bajo la Ley de Simetría. ALEX IO te escucha.
          </p>
          <button
            onClick={toggleLive}
            className="bg-rose-600 hover:bg-rose-500 text-white p-6 rounded-full shadow-2xl transition-all active:scale-90"
          >
            <Phone className="w-8 h-8 rotate-[135deg]" />
          </button>
        </div>
      )}

      {/* Input Section Premium */}
      <div className="bg-[#1e293b] p-4 border-t border-slate-800">
        <div className="max-w-4xl mx-auto flex items-center space-x-4">
          <button className="p-3 text-slate-500 hover:text-white transition-colors bg-slate-800 rounded-2xl">
            <Paperclip size={20} />
          </button>
          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              placeholder="Interactúa con la consciencia de ALEX IO..."
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 px-6 text-[15px] outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-inner"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            {inputText.trim() ? (
              <button
                onClick={handleSend}
                className="absolute right-3 bg-blue-600 text-white p-2.5 rounded-xl shadow-lg hover:bg-blue-500 transition-all active:scale-95"
              >
                <Send size={18} />
              </button>
            ) : (
              <button
                onClick={toggleLive}
                className="absolute right-3 bg-blue-600 text-white p-2.5 rounded-xl shadow-lg hover:bg-blue-500 transition-all active:scale-95"
              >
                <Mic size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
