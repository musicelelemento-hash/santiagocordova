
import React from 'react';
import * as LucideIcons from 'lucide-react';
import { CampaignContext } from '../../hooks/useCampaignContext';

interface CampaignBannerProps {
  campaign: CampaignContext;
  className?: string;
  compact?: boolean;
}

/**
 * Banner inteligente de campaña fiscal.
 * Se adapta automáticamente a la fase del calendario tributario.
 * 
 * - Mensual: morado/violeta con dígito del día
 * - Semestral (jul/ene): azul con días restantes
 * - Renta (mar-jun): verde esmeralda
 * - Preparación (días 1-9): gris quieto
 */
export const CampaignBanner: React.FC<CampaignBannerProps> = ({ campaign, className = '', compact = false }) => {
  const getUrgencyRing = () => {
    switch (campaign.urgency) {
      case 'critical': return 'ring-1 ring-rose-500/40';
      case 'high': return 'ring-1 ring-current/20';
      case 'medium': return '';
      default: return '';
    }
  };

  const getGradientStyle = (): React.CSSProperties => {
    switch (campaign.phase) {
      case 'semestral_s1':
      case 'semestral_s2':
        return { background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.08) 100%)' };
      case 'renta_activa':
        return { background: 'linear-gradient(135deg, rgba(16,185,129,0.10) 0%, rgba(20,184,166,0.06) 100%)' };
      case 'mensual_activa':
        return campaign.todaySriDigit !== null
          ? { background: 'linear-gradient(135deg, rgba(244,63,94,0.10) 0%, rgba(139,92,246,0.06) 100%)' }
          : { background: 'linear-gradient(135deg, rgba(139,92,246,0.10) 0%, rgba(99,102,241,0.06) 100%)' };
      default:
        return { background: 'linear-gradient(135deg, rgba(100,116,139,0.08) 0%, transparent 100%)' };
    }
  };

  const getBorderColor = () => {
    switch (campaign.phase) {
      case 'semestral_s1': return 'rgba(59,130,246,0.25)';
      case 'semestral_s2': return 'rgba(99,102,241,0.25)';
      case 'renta_activa': return 'rgba(16,185,129,0.25)';
      case 'mensual_activa':
        return campaign.todaySriDigit !== null ? 'rgba(244,63,94,0.30)' : 'rgba(139,92,246,0.25)';
      default: return 'rgba(100,116,139,0.15)';
    }
  };

  const getIconColor = () => {
    switch (campaign.phase) {
      case 'semestral_s1': return '#3b82f6';
      case 'semestral_s2': return '#6366f1';
      case 'renta_activa': return '#10b981';
      case 'mensual_activa': return campaign.todaySriDigit !== null ? '#f43f5e' : '#8b5cf6';
      default: return '#94a3b8';
    }
  };

  const getTextColor = () => {
    switch (campaign.phase) {
      case 'semestral_s1': return 'text-blue-600 dark:text-blue-400';
      case 'semestral_s2': return 'text-indigo-600 dark:text-indigo-400';
      case 'renta_activa': return 'text-emerald-600 dark:text-emerald-400';
      case 'mensual_activa': return campaign.todaySriDigit !== null ? 'text-rose-600 dark:text-rose-400' : 'text-violet-600 dark:text-violet-400';
      default: return 'text-slate-500 dark:text-slate-400';
    }
  };

  const getAccentBg = () => {
    switch (campaign.phase) {
      case 'semestral_s1': return 'bg-blue-500/10 border-blue-500/20';
      case 'semestral_s2': return 'bg-indigo-500/10 border-indigo-500/20';
      case 'renta_activa': return 'bg-emerald-500/10 border-emerald-500/20';
      case 'mensual_activa': return campaign.todaySriDigit !== null ? 'bg-rose-500/10 border-rose-500/20' : 'bg-violet-500/10 border-violet-500/20';
      default: return 'bg-slate-500/10 border-slate-500/20';
    }
  };

  const iconColor = getIconColor();

  // ── MODO COMPACTO (chip inline) ──────────────────────────────────────────────
  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-[0.15em] ${getAccentBg()} ${getTextColor()} ${className}`}
      >
        <span>{campaign.icon}</span>
        <span>{campaign.label}</span>
        {campaign.daysRemaining !== null && campaign.daysRemaining <= 15 && (
          <span className="opacity-70">· {campaign.daysRemaining}d</span>
        )}
        {campaign.daysUntilOpen !== null && (
          <span className="opacity-70">· en {campaign.daysUntilOpen}d</span>
        )}
      </div>
    );
  }

  // ── MODO COMPLETO ──────────────────────────────────────────────────────────
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border backdrop-blur-sm transition-all duration-500 ${className}`}
      style={{ ...getGradientStyle(), borderColor: getBorderColor() }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${iconColor}60, transparent)` }}
      />

      <div className="px-5 py-3.5 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        {/* Left: icono + textos */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {/* Icono de fase */}
          <div
            className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border backdrop-blur-md"
            style={{
              background: `${iconColor}15`,
              borderColor: `${iconColor}30`,
            }}
          >
            {campaign.phase === 'mensual_activa' && campaign.todaySriDigit !== null ? (
              <LucideIcons.Zap size={18} style={{ color: iconColor }} />
            ) : campaign.phase === 'semestral_s1' || campaign.phase === 'semestral_s2' ? (
              <LucideIcons.CalendarRange size={18} style={{ color: iconColor }} />
            ) : campaign.phase === 'renta_activa' ? (
              <LucideIcons.ShieldCheck size={18} style={{ color: iconColor }} />
            ) : campaign.phase === 'mensual_activa' ? (
              <LucideIcons.CalendarCheck size={18} style={{ color: iconColor }} />
            ) : (
              <LucideIcons.CalendarDays size={18} style={{ color: iconColor }} />
            )}
          </div>

          {/* Texto principal */}
          <div className="min-w-0">
            <p
              className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] mb-0.5"
              style={{ color: `${iconColor}90` }}
            >
              Campaña Activa · SRI Ecuador
            </p>
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
              {campaign.label}
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 hidden sm:block">
              {campaign.sublabel}
            </p>
          </div>
        </div>

        {/* Right: métricas de campaña */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 w-full sm:w-auto">
          {/* Días restantes (si aplica) */}
          {campaign.daysRemaining !== null && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black"
              style={{
                background: campaign.daysRemaining <= 7 ? `rgba(244,63,94,0.10)` : `${iconColor}10`,
                borderColor: campaign.daysRemaining <= 7 ? 'rgba(244,63,94,0.25)' : `${iconColor}25`,
                color: campaign.daysRemaining <= 7 ? '#f43f5e' : iconColor,
              }}
            >
              <LucideIcons.Timer size={11} />
              <span>{campaign.daysRemaining}d restantes</span>
            </div>
          )}

          {/* Días hasta apertura (modo preparación) */}
          {campaign.daysUntilOpen !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[10px] font-black text-slate-500">
              <LucideIcons.Clock size={11} />
              <span>Abre en {campaign.daysUntilOpen}d</span>
            </div>
          )}

          {/* Dígito urgente del día (mensual activa) */}
          {campaign.todaySriDigit !== null && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 text-[10px] font-black text-rose-500">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              <span>Dígito {campaign.todaySriDigit} vence hoy</span>
            </div>
          )}

          {/* Next campaign hint */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.03] text-[9px] font-bold text-slate-400 max-w-[180px] truncate">
            <LucideIcons.ArrowRight size={10} className="shrink-0" />
            <span className="truncate">{campaign.nextCampaignLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── MINI BADGE (para el tab de Clientes) ──────────────────────────────────────

interface CampaignBadgeProps {
  campaign: CampaignContext;
  count?: number;
}

export const CampaignBadge: React.FC<CampaignBadgeProps> = ({ campaign, count }) => {
  if (campaign.phase === 'quieto' || campaign.phase === 'mensual_preparacion') return null;

  const isSemestral = campaign.phase === 'semestral_s1' || campaign.phase === 'semestral_s2';
  const isRenta = campaign.phase === 'renta_activa';

  const color = isSemestral ? 'blue' : isRenta ? 'emerald' : 'violet';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider
        ${color === 'blue' ? 'bg-blue-500/15 text-blue-500 border border-blue-500/25' : ''}
        ${color === 'emerald' ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/25' : ''}
        ${color === 'violet' ? 'bg-violet-500/15 text-violet-500 border border-violet-500/25' : ''}
      `}
    >
      {campaign.icon}
      {count !== undefined && count > 0 && <span>{count}</span>}
    </span>
  );
};

// ── PROGRESS BAR DE CAMPAÑA ────────────────────────────────────────────────────

interface CampaignProgressProps {
  campaign: CampaignContext;
  total: number;
  completed: number;
}

export const CampaignProgress: React.FC<CampaignProgressProps> = ({ campaign, total, completed }) => {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = total - completed;

  const getBarColor = () => {
    if (pct >= 90) return 'from-emerald-500 to-teal-400';
    if (pct >= 60) return 'from-violet-500 to-purple-400';
    if (pct >= 30) return 'from-amber-500 to-orange-400';
    return 'from-rose-500 to-red-400';
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getBarColor()} transition-all duration-1000 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-black text-slate-900 dark:text-white">{pct}%</span>
        {remaining > 0 && (
          <span className="text-[10px] text-slate-400">· {remaining} pendientes</span>
        )}
      </div>
    </div>
  );
};
