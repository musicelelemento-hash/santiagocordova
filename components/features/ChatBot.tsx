
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

    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const response = await getAssistantResponse(text, clients, tasks);
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
        <div className="mb-4 w-[90vw] md:w-[400px] h-[600px] max-h-[80vh] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-5 fade-in duration-300">
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
          className="p-4 bg-[#0B2149] hover:bg-[#1a3a6e] text-white rounded-2xl shadow-2xl transform transition-all hover:scale-110 active:scale-95 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <MessageSquare className="w-6 h-6 relative z-10" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></div>
        </button>
      )}
    </div>
  );
};
