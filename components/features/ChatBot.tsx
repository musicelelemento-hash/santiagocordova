
import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Bot, Sparkles, MessageSquare } from 'lucide-react';
import { ChatInterface } from './ChatInterface';
import { useAppStore } from '../../store/useAppStore';
import { getAssistantResponse } from '../../services/geminiService';
import { Message } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { clients, tasks } = useAppStore();

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      text
    };

    const currentMessages = [...messages, userMsg];
    setMessages(currentMessages);
    setIsProcessing(true);

    try {
      // Envía el historial de la conversación, limitándolo a los últimos 6 mensajes para ahorrar
      const historyToSend = currentMessages.slice(-6);
      const response = await getAssistantResponse(historyToSend, clients, tasks);
      const botMsg: Message = {
        id: uuidv4(),
        role: 'model',
        text: response
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error("Chat Error:", error);
      const errorMsg: Message = {
        id: uuidv4(),
        role: 'model',
        text: "Lo siento, tuve un problema al procesar tu solicitud.",
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[1000] flex flex-col items-end">
      {isOpen ? (
        <div className="mb-4 w-[90vw] md:w-[420px] h-[650px] max-h-[85vh] rounded-[2.5rem] overflow-hidden shadow-2xl glass-tactical border border-white/10 animate-in slide-in-from-bottom-5 fade-in duration-500">
          <ChatInterface 
            messages={messages}
            onSendMessage={handleSendMessage}
            isProcessing={isProcessing}
            onClose={() => setIsOpen(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 bg-slate-950 text-white rounded-2xl shadow-2xl border border-white/10 flex items-center justify-center transform transition-all hover:scale-110 active:scale-95 group relative overflow-hidden animate-float-premium"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-[#00A896]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <MessageSquare className="w-7 h-7 relative z-10 text-[#00A896]" />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#00A896] rounded-full border-2 border-slate-950 animate-pulse shadow-[0_0_15px_rgba(0,168,150,0.5)]"></div>
        </button>
      )}
    </div>
  );
};
