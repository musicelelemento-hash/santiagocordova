
import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getAssistantResponse } from '../services/geminiService';
import { 
  Send, Bot, User, Sparkles, Loader2, 
  Trash2, MessageSquare, Shield, Zap,
  ChevronRight, BrainCircuit, Command
} from 'lucide-react';
import { Screen } from '../types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface GeminiScreenProps {
  navigate: (screen: Screen) => void;
}

export const GeminiScreen: React.FC<GeminiScreenProps> = ({ navigate }) => {
  const { clients, tasks } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Bienvenido al Centro de Comando de Inteligencia. Soy su asistente ejecutiva. ¿En qué puedo asistirle hoy con la gestión de sus clientes y obligaciones?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiMessages = newMessages.map(m => ({ 
          role: m.role === 'user' ? 'user' : 'model', 
          text: m.content 
      }));
      const response = await getAssistantResponse(apiMessages as any, clients, tasks);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Lo siento, he tenido un problema conectando con mis registros centrales. Por favor, intente de nuevo en unos momentos.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: 'Memoria despejada. Estoy lista para nuevas instrucciones, Comandante.',
        timestamp: new Date()
      }
    ]);
  };

  const suggestions = [
    "¿Quiénes tienen deudas pendientes?",
    "Resumen de clientes RIMPE",
    "¿Qué tareas vencen esta semana?",
    "Proyección de ingresos del mes"
  ];

  return (
    <div className="flex flex-col h-screen bg-[#050B18] text-white overflow-hidden relative font-sans">
      {/* Background Animated Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#00A896]/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#8B5CF6]/10 rounded-full blur-[150px] animate-pulse pointer-events-none" />

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-6 py-5 border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-[#00A896] to-[#0B2149] rounded-2xl shadow-[0_0_20px_rgba(0,168,150,0.3)] border border-white/20">
            <BrainCircuit size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-white/60 tracking-tight">
              INTELIGENCIA ELITE
            </h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              <span className="text-xs font-medium text-[#00A896] uppercase tracking-[0.2em]">Cerebro Activo</span>
            </div>
          </div>
        </div>
        <button 
          onClick={clearChat}
          className="p-3 bg-white/5 hover:bg-rose-400/20 text-white/60 hover:text-red-400 rounded-2xl transition-all border border-white/10 hover:border-rose-400/30 group"
          title="Limpiar Memoria"
        >
          <Trash2 size={20} className="group-hover:rotate-12 transition-transform" />
        </button>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 scrollbar-hide">
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500`}
            >
              {message.role === 'assistant' && (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00A896] to-[#0B2149] flex items-center justify-center border border-white/20 shadow-lg flex-shrink-0">
                  <Bot size={20} />
                </div>
              )}
              
              <div className={`max-w-[85%] md:max-w-[70%] group relative`}>
                <div className={`
                  px-6 py-4 rounded-[2rem] text-sm leading-relaxed shadow-xl border
                  ${message.role === 'user' 
                    ? 'bg-gradient-to-br from-[#00A896] to-[#0B2149] border-white/10 text-white font-medium rounded-br-none' 
                    : 'bg-white/5 backdrop-blur-2xl border-white/10 text-white/90 rounded-bl-none'
                  }
                `}>
                  {message.content}
                </div>
                <div className={`text-xs mt-2 opacity-30 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {message.role === 'user' && (
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-lg flex-shrink-0">
                  <User size={20} className="text-[#00A896]" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                <Sparkles size={18} className="text-[#00A896] animate-spin-slow" />
              </div>
              <div className="bg-white/5 backdrop-blur-xl px-6 py-4 rounded-[2rem] rounded-bl-none border border-white/10">
                <Loader2 size={20} className="animate-spin text-white/40" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="relative z-20 pb-10 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Quick Suggestions */}
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-2 mb-6 justify-center animate-in fade-in zoom-in duration-700">
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(suggestion);
                  }}
                  className="px-4 py-2 bg-white/5 hover:bg-[#00A896]/20 border border-white/10 hover:border-[#00A896]/30 rounded-full text-[11px] font-medium text-white/60 hover:text-white transition-all flex items-center gap-2 group"
                >
                  <Command size={12} className="opacity-40 group-hover:opacity-100" />
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form 
            onSubmit={handleSendMessage}
            className="group relative"
          >
            {/* Inner Glow */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00A896] to-[#8B5CF6] rounded-[2.5rem] opacity-20 blur group-within:opacity-40 transition-opacity duration-500" />
            
            <div className="relative flex items-center bg-[#0B1221] border border-white/10 group-within:border-white/20 rounded-[2.5rem] p-2 pr-4 transition-all shadow-2xl overflow-hidden">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregunte sobre deudas, clientes o tareas..."
                className="flex-1 bg-transparent border-none outline-none px-6 py-4 text-sm text-white placeholder-white/20 font-medium"
              />
              <button 
                type="submit"
                disabled={!input.trim() || isLoading}
                className={`
                  p-4 rounded-full transition-all flex items-center justify-center
                  ${input.trim() && !isLoading 
                    ? 'bg-gradient-to-r from-[#00A896] to-[#0B2149] text-white shadow-[0_4px_15px_rgba(0,168,150,0.4)] hover:scale-110 active:scale-95' 
                    : 'bg-white/5 text-white/20'
                  }
                `}
              >
                <Send size={20} />
              </button>
            </div>
          </form>
          
          <p className="text-center text-xs text-white/20 mt-4 font-medium tracking-widest uppercase">
            Powered by Gemini 1.5 Pro & Santiago Cordova Engine
          </p>
        </div>
      </footer>
    </div>
  );
};

export default GeminiScreen;
