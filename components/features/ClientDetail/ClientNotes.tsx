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
  MessageSquare
} from 'lucide-react';
import { ClientNote, NoteCategory } from '../../../types';
import { useAppStore } from '../../../store/useAppStore';

interface ClientNotesProps {
  clientId: string;
  notes: ClientNote[];
}

const CATEGORY_STYLES = {
  [NoteCategory.Important]: 'bg-rose-400/10 text-rose-400 border-rose-400/20',
  [NoteCategory.Note]: 'bg-sky-400/10 text-sky-400 border-sky-400/20',
  [NoteCategory.Suggestion]: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  [NoteCategory.Key]: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  [NoteCategory.Other]: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
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
    <div className="glass-card p-6 rounded-3xl border border-slate-200/50 dark:border-white/5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-sky-400/10 text-sky-400 border border-sky-400/20">
            <StickyNote size={18} className="sm:w-5 sm:h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white uppercase tracking-tight">
              PREGUNTAS ABIERTAS
            </h3>
            <p className="text-[10px] font-medium text-slate-400">Esperando Revisión</p>
          </div>
        </div>
        
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-sky-400 hover:text-white transition-all border border-transparent hover:border-sky-400/30"
          >
            <Plus size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        {isAdding && (
          <form onSubmit={handleSubmit} className="p-4 rounded-3xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-4 p-2 bg-white/50 dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5">
              {Object.values(NoteCategory).map((cat) => {
                const Icon = CATEGORY_ICONS[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 sm:px-4 py-2 rounded-xl text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider border transition-all flex items-center justify-center sm:justify-start gap-2 ${
                      category === cat 
                        ? CATEGORY_STYLES[cat] + ' shadow-lg scale-[1.02] sm:scale-105' 
                        : 'bg-white dark:bg-white/5 text-slate-400 border-slate-100 dark:border-white/5 hover:border-sky-400/30'
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
              placeholder="Escribe algo importante..."
              className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 resize-none h-24"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!content.trim()}
                className="px-4 py-2 rounded-xl bg-sky-400 text-white text-xs font-semibold hover:bg-sky-500 transition-all disabled:opacity-50 uppercase tracking-wider shadow-lg shadow-sky-400/20"
              >
                Guardar Nota
              </button>
            </div>
          </form>
        )}

        {notes.length === 0 && !isAdding && (
          <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 mb-3 grayscale">
              <StickyNote size={32} />
            </div>
            <p className="text-sm font-medium text-slate-500">No hay notas registradas.</p>
            <p className="text-[10px] uppercase font-semibold tracking-widest mt-1">Status: Empty</p>
          </div>
        )}

        {notes.map((note, idx) => {
          const Icon = CATEGORY_ICONS[note.category];
          const style = CATEGORY_STYLES[note.category];
          
          return (
            <div 
              key={note.id}
              className="group relative p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-sky-400/30 transition-all duration-300 hover:shadow-xl hover:shadow-sky-400/5 animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest border flex items-center gap-1 shadow-sm ${style}`}>
                  <Icon size={10} />
                  {note.category}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => removeClientNote(clientId, note.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-rose-400 hover:bg-rose-400/10 transition-all active:scale-95"
                    title="Eliminar Nota"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-medium">
                {note.content}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="text-[10px] font-medium text-slate-400">
                    {new Date(note.createdAt).toLocaleDateString('es-ES', { 
                      day: 'numeric', 
                      month: 'short', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="h-px bg-slate-200 dark:bg-white/5 flex-1 mx-3" />
                <span className="text-[9px] font-semibold text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em] group-hover:text-sky-400/50 transition-colors">
                  Encrypted Log
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
