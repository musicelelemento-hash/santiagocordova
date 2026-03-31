import React, { useState } from 'react';
import { 
  StickyNote, 
  Plus, 
  Trash2, 
  AlertCircle, 
  Info, 
  Lightbulb, 
  Key, 
  MoreHorizontal,
  X,
  Search,
  MessageSquare,
  ShieldCheck
} from 'lucide-react';
import { ClientNote, NoteCategory } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';

interface ClientNotesProps {
  clientId: string;
  notes: ClientNote[];
}

const CATEGORY_STYLES = {
  [NoteCategory.Important]: 'bg-rose-50 text-rose-700 border-rose-100',
  [NoteCategory.Note]: 'bg-blue-50 text-blue-700 border-blue-100',
  [NoteCategory.Suggestion]: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  [NoteCategory.Key]: 'bg-amber-50 text-amber-700 border-amber-100',
  [NoteCategory.Other]: 'bg-slate-50 text-slate-700 border-slate-100',
};

const CATEGORY_ICONS = {
  [NoteCategory.Important]: AlertCircle,
  [NoteCategory.Note]: Info,
  [NoteCategory.Suggestion]: Lightbulb,
  [NoteCategory.Key]: Key,
  [NoteCategory.Other]: MoreHorizontal,
};

export const ClientNotes: React.FC<ClientNotesProps> = ({ clientId, notes }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoteCategory>(NoteCategory.Note);
  const addClientNote = useAppStore(state => state.addClientNote);
  const removeClientNote = useAppStore(state => state.removeClientNote);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    addClientNote(clientId, {
      content: content.trim(),
      category
    });

    setContent('');
    setIsAdding(false);
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100 h-full flex flex-col relative overflow-hidden transition-all duration-700 group">
      <div className="flex items-center justify-between mb-10 relative z-10">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100 group-hover:scale-105 transition-transform duration-700">
            <StickyNote size={24} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.25em] font-premium">
              INTELIGENCIA FISCAL
            </h3>
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.2em] mt-1.5 font-premium">SISTEMA DE ASISTENCIA</p>
          </div>
        </div>
        
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-500 hover:bg-slate-900 hover:text-white transition-all shadow-sm border border-slate-100 flex items-center justify-center active:scale-90"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-3 custom-scrollbar relative z-10">
        {isAdding && (
          <form onSubmit={handleSubmit} className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 shadow-sm animate-in fade-in slide-in-from-top-4 duration-700 mb-8">
            <div className="flex flex-wrap gap-2.5 mb-8">
              {Object.values(NoteCategory).map((cat) => {
                const Icon = CATEGORY_ICONS[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2.5 font-premium ${
                      category === cat 
                        ? CATEGORY_STYLES[cat] + ' shadow-sm scale-[1.02]' 
                        : 'bg-white text-slate-400 border-slate-100 hover:border-blue-200'
                    }`}
                  >
                    <Icon size={14} strokeWidth={2.5} />
                    {cat}
                  </button>
                );
              })}
            </div>
            <textarea
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describa la observación o recomendación técnica..."
              className="w-full bg-white border border-slate-100 focus:border-blue-400 p-6 rounded-[1.5rem] text-[15px] text-slate-950 placeholder:text-slate-300 resize-none h-40 transition-all outline-none font-medium shadow-inner"
            />
            <div className="flex justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-8 py-4 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-white hover:text-slate-600 transition-all font-premium"
              >
                DESCARTAR
              </button>
              <button
                type="submit"
                disabled={!content.trim()}
                className="px-8 py-4 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 shadow-xl shadow-slate-200 font-premium active:scale-95"
              >
                REGISTRAR NOTA
              </button>
            </div>
          </form>
        )}

        {notes.length === 0 && !isAdding && (
          <div className="flex flex-col items-center justify-center py-24 text-center relative group/empty">
            <div className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-200 mb-8 shadow-inner group-hover/empty:scale-110 transition-transform duration-1000">
              <MessageSquare size={32} strokeWidth={1} />
            </div>
            <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em] font-premium">SIN ACTIVIDAD REGISTRADA</p>
            <div className="flex items-center justify-center gap-4 mt-5 opacity-40">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                <p className="text-[10px] uppercase font-black tracking-[0.5em] text-slate-300 font-premium">IDLE SYSTEM</p>
            </div>
          </div>
        )}

        {[...notes].reverse().map((note, idx) => {
          const Icon = CATEGORY_ICONS[note.category];
          const style = CATEGORY_STYLES[note.category];
          
          return (
            <div 
              key={note.id}
              className="group/note relative p-8 rounded-[1.5rem] bg-white border border-slate-100 hover:border-blue-200 transition-all duration-700 hover:shadow-md animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border flex items-center gap-2.5 font-premium ${style}`}>
                  <Icon size={12} strokeWidth={3} />
                  {note.category}
                </div>
                <div className="flex items-center gap-2">
                   <button
                    onClick={() => removeClientNote(clientId, note.id)}
                    className="opacity-0 group-hover/note:opacity-100 p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 transition-all active:scale-90 border border-transparent hover:border-rose-100"
                    title="Eliminar registro"
                  >
                    <Trash2 size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
              <p className="text-[15px] text-slate-900 whitespace-pre-wrap leading-relaxed font-semibold font-premium tracking-tight">
                {note.content}
              </p>
              <div className="mt-8 flex items-center justify-between border-t border-slate-50 pt-5">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {new Date(note.createdAt).toLocaleDateString('es-ES', { 
                      day: '2-digit', 
                      month: 'short', 
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                    <ShieldCheck size={12} className="text-emerald-600" strokeWidth={3} />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em] font-premium">LOG VALIDADO</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
