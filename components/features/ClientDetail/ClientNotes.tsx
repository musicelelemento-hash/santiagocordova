import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { ClientNote, NoteCategory } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';

interface ClientNotesProps {
  clientId: string;
  notes: ClientNote[];
}

const CATEGORY_STYLES = {
  [NoteCategory.Important]: 'bg-rose-50/50 text-rose-700 border-rose-100/50 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]',
  [NoteCategory.Note]: 'bg-blue-50/50 text-blue-700 border-blue-100/50 dark:bg-primary/10 dark:text-primary-low dark:border-primary/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]',
  [NoteCategory.Suggestion]: 'bg-emerald-50/50 text-emerald-700 border-emerald-100/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
  [NoteCategory.Key]: 'bg-amber-50/50 text-amber-700 border-amber-100/50 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]',
  [NoteCategory.Other]: 'bg-slate-50/50 text-slate-700 border-slate-100/50 dark:bg-surface-low/30 dark:text-slate-400 dark:border-white/10 shadow-[0_0_10px_rgba(148,163,184,0.1)]',
};

const CATEGORY_ICONS = {
  [NoteCategory.Important]: LucideIcons.AlertCircle,
  [NoteCategory.Note]: LucideIcons.Info,
  [NoteCategory.Suggestion]: LucideIcons.Lightbulb,
  [NoteCategory.Key]: LucideIcons.Key,
  [NoteCategory.Other]: LucideIcons.MoreHorizontal,
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
    <div className="bg-white dark:bg-surface/40 backdrop-blur-3xl rounded-[2rem] p-8 shadow-architect border border-slate-100 dark:border-white/10 h-full flex flex-col relative overflow-hidden transition-all duration-700 group">
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-primary/10 flex items-center justify-center text-blue-600 dark:text-primary-low shadow-[0_0_15px_rgba(59,130,246,0.1)] border border-blue-100 dark:border-primary/20 group-hover:scale-105 transition-transform duration-700">
            <LucideIcons.StickyNote size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[12px] font-bold text-slate-900 dark:text-slate-50 uppercase tracking-tight font-premium">
              INTELIGENCIA FISCAL
            </h3>
            <p className="text-[9px] font-mono font-bold text-blue-500 dark:text-primary-low uppercase tracking-[0.2em] mt-0.5">INTEL_ASSIST_SYSTEM</p>
          </div>
        </div>
        
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-surface-low text-slate-500 dark:text-slate-400 hover:bg-slate-900 dark:hover:bg-primary hover:text-white dark:hover:text-white transition-all border border-slate-200 dark:border-white/5 flex items-center justify-center active:scale-90"
          >
            <LucideIcons.Plus size={18} strokeWidth={3} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-3 custom-scrollbar relative z-10">
        {isAdding && (
          <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-slate-100 dark:bg-surface-low border border-slate-200 dark:border-white/5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-700 mb-8">
            <div className="flex flex-wrap gap-2 mb-6">
              {Object.values(NoteCategory).map((cat) => {
                const Icon = CATEGORY_ICONS[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-2 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider border transition-all flex items-center gap-2 ${
                      category === cat 
                        ? CATEGORY_STYLES[cat] + ' scale-105 z-10' 
                        : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-white/5 hover:border-blue-400 dark:hover:border-primary'
                    }`}
                  >
                    <Icon size={12} strokeWidth={3} />
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
              className="w-full glass-card-premium focus:border-blue-400 dark:focus:border-primary p-5 rounded-xl text-sm text-slate-900 dark:text-slate-50 placeholder:text-slate-400 dark:placeholder:text-slate-700 resize-none h-32 transition-all outline-none font-medium shadow-inner"
            />
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-6 py-3 rounded-xl text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest hover:text-slate-600 truncate transition-all"
              >
                DISCARD
              </button>
              <button
                type="submit"
                disabled={!content.trim()}
                className="px-6 py-3 rounded-xl bg-slate-900 dark:bg-primary text-white text-[9px] font-mono font-bold uppercase tracking-widest hover:bg-black dark:hover:bg-primary-low transition-all disabled:opacity-50 shadow-lg active:scale-95"
              >
                REGISTER_NOTE
              </button>
            </div>
          </form>
        )}

        {notes.length === 0 && !isAdding && (
          <div className="flex flex-col items-center justify-center py-24 text-center relative group/empty bg-slate-50/50 dark:bg-surface-low/10 rounded-2xl border border-dashed border-slate-200 dark:border-white/5">
            <div className="w-16 h-16 rounded-full glass-card-premium flex items-center justify-center text-slate-200 dark:text-slate-800 shadow-inner group-hover/empty:scale-105 transition-transform duration-1000">
              <LucideIcons.MessageSquare size={26} strokeWidth={1.5} />
            </div>
            <p className="text-[10px] font-mono font-bold text-slate-300 dark:text-slate-600 uppercase tracking-[0.4em] mt-6">NO_ACTIVITY_LOGGED</p>
            <div className="flex items-center justify-center gap-3 mt-4 opacity-40">
                <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse"></span>
                <p className="text-[8px] font-mono font-bold tracking-[0.4em] text-slate-300 dark:text-slate-700 uppercase">IDLE_STATE</p>
            </div>
          </div>
        )}

        {[...notes].reverse().map((note, idx) => {
          const Icon = CATEGORY_ICONS[note.category];
          const style = CATEGORY_STYLES[note.category];
          
          return (
            <div 
              key={note.id}
              className="group/note relative p-6 rounded-2xl bg-white/50 dark:bg-surface-low/30 border border-slate-100 dark:border-white/5 hover:border-blue-200 dark:hover:border-primary/30 transition-all duration-700 hover:shadow-md animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className={`px-3 py-1 rounded-lg text-[9px] font-mono font-bold uppercase tracking-wider border flex items-center gap-2 ${style}`}>
                  <Icon size={12} strokeWidth={3} />
                  {note.category}
                </div>
                <div className="flex items-center gap-2">
                   <button
                    onClick={() => removeClientNote(clientId, note.id)}
                    className="opacity-0 group-hover/note:opacity-100 p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all active:scale-95 border border-transparent hover:border-rose-100 dark:hover:border-rose-500/20"
                    title="Eliminar registro"
                  >
                    <LucideIcons.Trash2 size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
              <p className="text-[14px] text-slate-900 dark:text-slate-100 whitespace-pre-wrap leading-relaxed font-semibold tracking-tight font-premium">
                {note.content}
              </p>
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest leading-none">
                    {new Date(note.createdAt).toLocaleDateString('es-ES', { 
                      day: '2-digit', 
                      month: 'short', 
                      hour: '2-digit',
                      minute: '2-digit'
                    }).toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/5">
                    <LucideIcons.ShieldCheck size={11} className="text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                    <span className="text-[8px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">LOG_VALIDATED</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
