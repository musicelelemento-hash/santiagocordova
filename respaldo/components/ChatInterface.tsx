
import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { Send, Sparkles, X, Bot, FileText, Calculator } from 'lucide-react';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
  onClose: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isProcessing, onClose }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    onSendMessage(input);
    setInput('');
  };

  const suggestions = [
    "¿Cuál es el límite de ingresos para RIMPE Popular?",
    "Redactar correo de cobro formal a cliente",
    "Calcular multa por declaración tardía de IVA",
    "Requisitos para devolución de IVA 3ra Edad"
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl w-full md:w-[400px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-[#0B2149] text-white flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00A896] rounded-xl shadow-lg shadow-teal-900/20">
                <Bot size={20} className="text-white"/>
            </div>
            <div>
                <h3 className="text-sm font-bold font-display leading-tight uppercase tracking-wide">Asistente Tributario</h3>
                <p className="text-[10px] text-slate-300 font-medium">Potenciado por Gemini 2.0</p>
            </div>
        </div>
        {onClose && (
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                <X size={18}/>
            </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-100 dark:bg-slate-950/50" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-sm">
                <Sparkles className="w-8 h-8 text-[#00A896]" />
            </div>
            <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-2 text-sm uppercase tracking-wide">Consulta Experta</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-8 max-w-[240px] leading-relaxed">
                Puedo ayudarte con cálculos, redacción de correos, normativas del SRI o consultas sobre régimen RIMPE.
            </p>
            <div className="grid grid-cols-1 gap-2 w-full">
                {suggestions.map((s, i) => (
                    <button 
                        key={i} 
                        onClick={() => onSendMessage(s)}
                        className="text-[11px] font-medium text-left p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-[#00A896] hover:text-[#00A896] transition-all shadow-sm flex items-center gap-2 group"
                    >
                        <div className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-[#00A896]"></div>
                        {s}
                    </button>
                ))}
            </div>
          </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-[#0B2149] text-white rounded-br-none'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-none border border-slate-200 dark:border-slate-700'
              } ${msg.isError ? 'bg-red-50 dark:bg-red-900/20 border-red-200 text-red-600' : ''}`}
            >
              {msg.text}
            </div>
            
            {/* Render sources if available */}
            {msg.sources && msg.sources.length > 0 && (
              <div className="w-full flex flex-wrap gap-2 justify-end mt-1">
                {msg.sources.map((source, idx) => (
                  <a
                    key={idx}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-full hover:bg-slate-300 transition-colors"
                  >
                    <FileText size={10} />
                    <span className="truncate max-w-[100px]">{source.title}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-none border border-slate-200 dark:border-slate-700 flex space-x-1 items-center shadow-sm">
              <div className="w-1.5 h-1.5 bg-[#00A896] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 bg-[#00A896] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-[#00A896] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu consulta tributaria..."
            className="w-full bg-slate-100 dark:bg-slate-800 border-none text-slate-800 dark:text-white placeholder-slate-400 rounded-xl py-3.5 pl-4 pr-12 focus:ring-2 focus:ring-[#00A896] focus:outline-none text-xs font-medium transition-all"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="absolute right-1.5 p-2 bg-[#00A896] hover:bg-teal-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-transform transform active:scale-95 shadow-md"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="text-[10px] text-center text-slate-400 mt-2 font-medium">
            La IA puede cometer errores. Verifica la normativa vigente.
        </div>
      </form>
    </div>
  );
};
