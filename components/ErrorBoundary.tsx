import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Activity, Home, BarChart } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
  compact?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Componente ErrorBoundary de grado empresarial.
 * Captura errores de renderizado para evitar la pantalla blanca de la muerte (WSOD).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("SC Pro System Error Caught:", error, errorInfo);
  }

  handleReload = () => {
    if (this.props.compact) {
        this.setState({ hasError: false, error: null });
    } else {
        window.location.reload();
    }
  }

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    const { hasError, error } = this.state;
    const { compact, children } = this.props;

    if (hasError) {
      const isChunkError = error?.message?.includes('Failed to fetch') || 
                           error?.message?.includes('Importing a module script failed');

      if (compact) {
          return (
            <div className="h-full w-full min-h-[150px] flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center animate-fade-in">
                <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-full mb-2">
                    <BarChart size={20} className="text-red-400" />
                </div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Módulo no disponible</p>
                <button 
                    onClick={this.handleReload}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-xs font-bold text-slate-600 dark:text-slate-200 hover:text-brand-teal hover:border-brand-teal transition-colors shadow-sm"
                >
                    <RefreshCw size={10} /> Reintentar
                </button>
            </div>
          );
      }

      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] p-8 text-center animate-fade-in-up bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 m-4 shadow-sm">
          <div className="relative mb-8 group">
            <div className="absolute inset-0 bg-red-100 dark:bg-red-900/30 rounded-full blur-2xl opacity-70 group-hover:opacity-100 transition-opacity animate-pulse"></div>
            <div className="relative p-6 bg-white dark:bg-slate-800 rounded-full shadow-2xl border-4 border-red-50 dark:border-red-900/50">
                <ShieldAlert className="w-16 h-16 text-red-500" />
            </div>
          </div>
          
          <h2 className="text-3xl font-display font-bold text-slate-800 dark:text-white mb-3">
            {isChunkError ? 'Actualización Requerida' : 'Sistema de Protección Activado'}
          </h2>
          
          <p className="text-slate-600 dark:text-slate-400 max-w-md mb-8 text-lg leading-relaxed">
            {isChunkError 
                ? 'Se ha detectado una nueva versión de la aplicación. Recargue para obtener las últimas mejoras fiscales.'
                : 'Hemos aislado un error técnico para proteger la integridad de sus datos contables.'}
          </p>

          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl border border-red-100 dark:border-red-900/30 p-4 mb-8 text-left shadow-sm overflow-hidden">
             <div className="flex items-center gap-2 mb-2 text-xs font-bold text-red-500 uppercase tracking-wider">
                <Activity size={14} /> Diagnóstico Técnico
             </div>
             <p className="text-xs font-mono text-slate-600 dark:text-slate-400 break-words bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                {error?.message || 'Error de ejecución desconocido'}
             </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <button 
                onClick={this.handleReload}
                className="flex items-center justify-center space-x-3 px-8 py-4 bg-[#0B2149] hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-slate-900/10 transition-all transform hover:scale-105 active:scale-95 group"
              >
                <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-700" />
                <span>{isChunkError ? 'Actualizar Ahora' : 'Reiniciar Módulo'}</span>
              </button>
              
              <button 
                onClick={this.handleGoHome}
                className="flex items-center justify-center space-x-3 px-8 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition-all"
              >
                <Home size={20} />
                <span>Volver al Dashboard</span>
              </button>
          </div>
        </div>
      );
    }

    return children;
  }
}