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
  [NoteCategory.Important]: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  [NoteCategory.Note]: 'bg-primary/10 text-primary border-primary/20',
  [NoteCategory.Suggestion]: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  [NoteCategory.Key]: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  [NoteCategory.Other]: 'bg-on-surface-variant/10 text-on-surface-variant border-on-surface-variant/20',
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
    <div className="bg-surface-lowest rounded-[2rem] p-8 shadow-architect border border-surface-low h-full flex flex-col relative overflow-hidden transition-all duration-700 group">
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-architect-low group-hover:scale-110 transition-transform">
            <StickyNote size={20} />
          </div>
          <div>
            <h3 className="text-[10px] font-black text-on-surface uppercase tracking-[0.25em] font-premium">
              INTELIGENCIA FISCAL
            </h3>
            <p className="text-[9px] font-bold text-primary uppercase tracking-[0.25em] mt-1 font-premium">ASISTENCIA EN TIEMPO REAL</p>
          </div>
        </div>
        
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-10 h-10 rounded-xl bg-surface-low text-on-surface-variant hover:bg-primary hover:text-white transition-all shadow-sm flex items-center justify-center active:scale-90"
          >
            <Plus size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar relative z-10">
        {isAdding && (
          <form onSubmit={handleSubmit} className="p-6 rounded-[2rem] bg-surface border border-primary/10 shadow-architect-low animate-in fade-in slide-in-from-top-4 duration-500 mb-6">
            <div className="flex flex-wrap gap-2 mb-6">
              {Object.values(NoteCategory).map((cat) => {
                const Icon = CATEGORY_ICONS[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 font-premium ${
                      category === cat 
                        ? CATEGORY_STYLES[cat] + ' shadow-architect-low scale-[1.02]' 
                        : 'bg-surface-low text-on-surface-variant/40 border-transparent hover:border-primary/20'
                    }`}
                  >
                    <Icon size={12} />
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
              className="w-full bg-surface-low border border-surface-low focus:border-primary/30 p-4 rounded-2xl text-sm text-on-surface placeholder:text-on-surface-variant/30 resize-none h-32 transition-all outline-none font-medium"
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-6 py-3 rounded-xl text-[10px] font-black text-on-surface-variant uppercase tracking-widest hover:bg-surface-low transition-all font-premium"
              >
                DESCARTAR
              </button>
              <button
                type="submit"
                disabled={!content.trim()}
                className="px-6 py-3 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:bg-primary-hover transition-all disabled:opacity-50 shadow-lg shadow-primary/20 font-premium active:scale-95"
              >
                REGISTRAR NOTA
              </button>
            </div>
          </form>
        )}

        {notes.length === 0 && !isAdding && (
          <div className="flex flex-col items-center justify-center py-20 text-center relative group/empty">
            <div className="w-16 h-16 rounded-full bg-surface-low border border-surface-low flex items-center justify-center text-on-surface-variant/20 mb-6 shadow-inner group-hover/empty:scale-110 transition-transform duration-700">
              <MessageSquare size={24} strokeWidth={1.5} />
            </div>
            <p className="text-[10px] font-black text-on-surface-variant/40 uppercase tracking-[0.3em] font-premium">SIN ACTIVIDAD REGISTRADA</p>
            <div className="flex items-center justify-center gap-3 mt-4 opacity-50">
                <span className="w-1 h-1 rounded-full bg-primary/40 animate-pulse"></span>
                <p className="text-[9px] uppercase font-black tracking-[0.4em] text-on-surface-variant/30 font-premium">IDLE SYSTEM</p>
            </div>
          </div>
        )}

        {[...notes].reverse().map((note, idx) => {
          const Icon = CATEGORY_ICONS[note.category];
          const style = CATEGORY_STYLES[note.category];
          
          return (
            <div 
              key={note.id}
              className="group/note relative p-5 rounded-2xl bg-surface border border-surface-low hover:border-primary/20 transition-all duration-500 hover:shadow-architect-low animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border flex items-center gap-2 font-premium ${style}`}>
                  <Icon size={10} />
                  {note.category}
                </div>
                <div className="flex items-center gap-2">
                   <button
                    onClick={() => removeClientNote(clientId, note.id)}
                    className="opacity-0 group-hover/note:opacity-100 p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all active:scale-95"
                    title="Eliminar registro"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed font-medium">
                {note.content}
              </p>
              <div className="mt-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
                  <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">
                    {new Date(note.createdAt).toLocaleDateString('es-ES', { 
                      day: 'numeric', 
                      month: 'short', 
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="h-[1px] bg-surface-low flex-1 mx-4" />
                <div className="flex items-center gap-2 opacity-0 group-hover/note:opacity-100 transition-opacity">
                    <ShieldCheck size={10} className="text-primary/40" />
                    <span className="text-[9px] font-black text-primary/30 uppercase tracking-[0.1em] font-premium">LOG VALIDADO</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Decorative Architectural Line */}
      <div className="absolute right-0 top-0 w-px h-full bg-gradient-to-b from-transparent via-primary/5 to-transparent/0 pointer-events-none"></div>
    </div>
  );
};
