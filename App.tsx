import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { AdminDashboardScreen } from './screens/AdminDashboardScreen';
import { ClientsScreen } from './screens/ClientsScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CobranzaScreen } from './screens/CobranzaScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { WebOrdersScreen } from './screens/WebOrdersScreen';
import { TasksScreen } from './screens/TasksScreen';
import { LandingPage } from './screens/LandingPage';
import { LoginScreen } from './screens/LoginScreen';
import { ServicesPage } from './screens/ServicesPage';
import { ClientPortalScreen } from './screens/ClientPortalScreen';
import { MusicPage } from './screens/MusicPage';
import { AuditLogScreen } from './screens/AuditLogScreen';
import { Logo } from './Logo';
import { Clock } from './components/ui/Clock';
import { NotificationBell } from './components/layout/NotificationBell';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNavBar } from './components/layout/MobileNavBar';
import { useLocalStorage } from './hooks/useLocalStorage';
import { GlobalUploadModal } from './components/features/GlobalUploadModal';
import { Client, Task, Screen, Theme, ClientFilter, PublicUser } from './types';
import { loadDataFromSheet, syncDataToSheet } from './services/sheetApi';
import { CommandPalette } from './components/CommandPalette';
import { Modal } from './components/ui/Modal';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useAppStore } from './store/useAppStore';


type AppState = 'landing' | 'login' | 'dashboard' | 'services' | 'client_portal' | 'music';

const App: React.FC = () => {
  const {
    clients, setClients,
    webOrders, setWebOrders,
    sriCredentials, setSriCredentials,
    serviceFees, setServiceFees,
    reminderConfig, setReminderConfig,
    isLoaded: isStoreLoaded,
    loadFromDB,
    syncFromFirebase,
    syncFromSheets
  } = useAppStore();

  const [appState, setAppState] = useState<AppState>(() => {
    const path = window.location.pathname;
    // Prioridad Absoluta: El acceso al raíz (/) siempre muestra la página pública
    if (path === '/' || path === '' || path === '/index.html') return 'landing';

    const isAdminLoggedIn = localStorage.getItem('sc_pro_admin_session') === 'true';
    if (path === '/admin' || path === '/dashboard' || path === '/login') {
      return isAdminLoggedIn ? 'dashboard' : 'login';
    }
    if (path === '/services') return 'services';
    if (path === '/musica' || path === '/music') return 'music';
    if (path === '/portal') return 'login';
    return 'landing';
  });

  // Sincronizar appState con la URL del navegador
  useEffect(() => {
    const path = window.location.pathname;
    let targetPath = '/';

    if (appState === 'landing') targetPath = '/';
    else if (appState === 'login') targetPath = '/dashboard';
    else if (appState === 'dashboard') targetPath = '/dashboard';
    else if (appState === 'services') targetPath = '/services';
    else if (appState === 'client_portal') targetPath = '/portal';
    else if (appState === 'music') targetPath = '/musica';

    if (path !== targetPath) {
      window.history.pushState({ appState }, '', targetPath);
    }
  }, [appState]);

  // Manejar navegación atrás/adelante del navegador
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const path = window.location.pathname;
      const isAdminLoggedIn = localStorage.getItem('sc_pro_admin_session') === 'true';

      if (path === '/' || path === '' || path === '/index.html') {
        setAppState('landing');
      } else if (path === '/admin' || path === '/dashboard' || path === '/login') {
        setAppState(isAdminLoggedIn ? 'dashboard' : 'login');
      } else if (path === '/services') {
        setAppState('services');
      } else if (path === '/musica' || path === '/music') {
        setAppState('music');
      } else if (path === '/portal') {
        setAppState('login');
      } else {
        setAppState('landing');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [publicUser, setPublicUser] = useState<PublicUser | null>(null);
  const [loggedClient, setLoggedClient] = useState<Client | null>(null);
  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'light');
  const [activeScreen, setActiveScreen] = useState<Screen>('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [previousScreen, setPreviousScreen] = useState<Screen | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isGlobalDropdownOpen, setIsGlobalDropdownOpen] = useState(false);
  const globalSearchRef = useRef<HTMLDivElement>(null);

  const globalSearchResults = useMemo(() => {
    if (!globalSearchQuery.trim()) return [];
    const query = globalSearchQuery.toLowerCase();
    return clients.filter(c => !c.isDeleted && (
      c.name.toLowerCase().includes(query) ||
      (c.tradeName && c.tradeName.toLowerCase().includes(query)) ||
      c.ruc.includes(query)
    )).slice(0, 8);
  }, [clients, globalSearchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (globalSearchRef.current && !globalSearchRef.current.contains(event.target as Node)) {
        setIsGlobalDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [showSplash, setShowSplash] = useState(true);

  const [clientFilter, setClientFilter] = useState<ClientFilter | null>(null);
  const [taskFilter, setTaskFilter] = useState<{ clientId?: string; taskId?: string } | null>(null);
  const [initialClientData, setInitialClientData] = useState<Partial<Client> | null>(null);
  const [initialTaskData, setInitialTaskData] = useState<Partial<Task> | null>(null);
  const [clientToView, setClientToView] = useState<Client | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'offline'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carga inicial desde IndexedDB (vía Store) + Firebase Sync
  useEffect(() => {
    if (!isStoreLoaded) {
      loadFromDB();
    }
  }, [isStoreLoaded, loadFromDB]);

  useEffect(() => {
    let unsubscribe: () => void;
    if (isStoreLoaded) {
      unsubscribe = syncFromFirebase() as any;
    }
    return () => unsubscribe?.();
  }, [isStoreLoaded, syncFromFirebase]);

  // Firebase + IndexedDB son ahora el Storage Principal.
  // Sheets funcionará como Respaldo de Emergencia (Doble Nube).
  useEffect(() => {
    const checkAndRestore = async () => {
      if ((appState === 'dashboard' || appState === 'client_portal') && !isDataLoaded && isStoreLoaded) {
        setIsDataLoaded(true); // Bloqueo inmediato para evitar re-ejecución

        // Si no hay nada o solo está el demo, intentamos el respaldo de Sheets
        const isActuallyEmpty = clients.length === 0 || (clients.length === 1 && clients[0].ruc === '0702706813001');

        if (isActuallyEmpty) {
          console.log("🛠️ Capa Doble Nube: Intentando recuperación automática...");
          setCloudStatus('loading');
          try {
            await syncFromSheets();
            setCloudStatus('idle');
          } catch (e) {
            console.warn("⚠️ Capa Doble Nube failed:", e);
            setCloudStatus('offline');
          }
        } else {
          setCloudStatus('idle');
        }
      }
    };
    checkAndRestore();
  }, [appState, isStoreLoaded, isDataLoaded]);

  // Sincronización a la nube (Refactorizada para permitir manual)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const saveData = async () => {
    if (cloudStatus === 'loading') return;

    // PROTECCIÓN: No sobreescribir la nube si no hay clientes cargados (evita borrar el respaldo accidentalmente)
    if (clients.length === 0) {
      console.warn("Sincronización cancelada: No hay clientes para guardar.");
      return;
    }

    setCloudStatus('saving');
    try {
      const payload = { clients, serviceFees, reminderConfig, webOrders, sriCredentials };
      await syncDataToSheet(payload);
      setCloudStatus('saved');
    } catch (error) {
      setCloudStatus('offline');
    }
  };

  const handleManualSave = () => {
    saveData();
  };

  // Sincronización automática a la nube (Solo si hay datos para proteger el respaldo)
  useEffect(() => {
    if (appState !== 'dashboard' || !isDataLoaded || cloudStatus === 'loading' || clients.length === 0) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(saveData, 5000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [clients, serviceFees, reminderConfig, webOrders, sriCredentials, appState, isDataLoaded]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCommandAction = (action: string, payload?: any) => {
    if (action === 'view_client') {
      setClientToView(payload);
      setActiveScreen('clients');
    } else if (action === 'sync') {
      handleManualSave();
    } else if (action === 'new_client') {
      setInitialClientData({});
      setActiveScreen('clients');
    } else if (action === 'logout') {
      setShowLogoutConfirm(true);
    }
  };

  const navigate = (screen: Screen, options: any = {}) => {
    // Si estamos navegando a un cliente específico desde otra pantalla, guardamos la actual como "previous"
    if (options.clientIdToView && activeScreen !== screen) {
      setPreviousScreen(activeScreen);
    } else if (!options.clientIdToView) {
      // Si es una navegación normal de menú, limpiamos el historial de "atrás" específico
      setPreviousScreen(null);
    }

    // Guardamos tab temporal en window para usarlo en el renderScreen (solución ligera para no alterar más AppState ahora)
    if (options.initialTab) {
        (window as any).__TEMP_INITIAL_TAB__ = options.initialTab;
    } else {
        delete (window as any).__TEMP_INITIAL_TAB__;
    }

    setActiveScreen(screen);
    setClientFilter(options.clientFilter || null);
    setTaskFilter(options.taskFilter || null);
    setInitialClientData(options.initialClientData || null);
    setInitialTaskData(options.initialTaskData || null);
    
    if (options.clientIdToView) {
      const client = clients.find(c => c.id === options.clientIdToView);
      setClientToView(client || null);
    } else {
      setClientToView(null);
    }
  };

  const handleLogoutConfirm = () => {
    localStorage.removeItem('sc_pro_admin_session');
    setAppState('landing');
    setShowLogoutConfirm(false);
    setLoggedClient(null);
  };

  const handleLoginSuccess = (role: 'admin' | 'client', clientData?: Client) => {
    if (role === 'admin') {
      localStorage.setItem('sc_pro_admin_session', 'true');
      setAppState('dashboard');
      setShowSplash(true);
    } else if (role === 'client' && clientData) {
      setLoggedClient(clientData);
      setAppState('client_portal');
    }
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case 'home': return <AdminDashboardScreen navigate={navigate} theme={theme === 'dark' ? 'dark' : 'light'} />;
      case 'clients': return (
        <ClientsScreen 
          initialFilter={clientFilter} 
          navigate={navigate} 
          initialClientData={initialClientData} 
          clearInitialClientData={() => setInitialClientData(null)} 
          clientToView={clientToView} 
          clearClientToView={() => {
            setClientToView(null);
            if (previousScreen) {
              setActiveScreen(previousScreen);
              setPreviousScreen(null);
            }
          }} 
          // Pasamos initialTab del estado/options guardado o usar una variable del estado si hace falta
          // (Lo mejor es añadir el tab al estado del app o en options)
          initialTab={(window as any).__TEMP_INITIAL_TAB__}
        />
      );
      case 'calendar': return <CalendarScreen navigate={navigate} />;
      case 'reports': return <ReportsScreen navigate={navigate} />;
      case 'cobranza': return <CobranzaScreen />;
      case 'web_orders': return <WebOrdersScreen navigate={navigate} />;
      case 'tasks': return <TasksScreen navigate={navigate} taskFilter={taskFilter} clearTaskFilter={() => setTaskFilter(null)} initialTaskData={initialTaskData} clearInitialTaskData={() => setInitialTaskData(null)} />;
      case 'settings': return <SettingsScreen navigate={navigate} />;
      case 'audit_log': return <AuditLogScreen />;
      default: return <AdminDashboardScreen navigate={navigate} />;
    }
  };

  const navItems = [
    { screen: 'home', icon: LucideIcons.Home, label: 'Dashboard' },
    { screen: 'clients', icon: LucideIcons.Users, label: 'Clientes' },
    { screen: 'cobranza', icon: LucideIcons.BarChart, label: 'Cobranza' },
    { screen: 'tasks', icon: LucideIcons.CheckCircle, label: 'Tareas' },
    { screen: 'calendar', icon: LucideIcons.CalendarDays, label: 'Agenda' },
    { screen: 'web_orders', icon: LucideIcons.ShoppingCart, label: 'Tienda' },
    { screen: 'services', icon: LucideIcons.Globe, label: 'Servicios' },
    { screen: 'settings', icon: LucideIcons.Settings, label: 'Ajustes' },
    { screen: 'audit_log', icon: LucideIcons.History, label: 'Auditoría' },
    { screen: 'add_client' as any, icon: LucideIcons.Users, label: 'Nuevo Cliente', onClick: () => navigate('clients', { initialClientData: { isActive: true } }) },
    { screen: 'landing' as any, icon: LucideIcons.Globe, label: 'Sitio Público' },
  ];

  if (appState === 'services') return (
    <ServicesPage
      onAdminAccess={() => setAppState('login')}
      onSubmitOrder={(o) => setWebOrders(p => [...p, o])}
      onNavigateToHome={() => setAppState('landing')}
      currentUser={publicUser}
      onLogin={setPublicUser}
      onLogout={() => setPublicUser(null)}
    />
  );

  if (appState === 'landing') return (
    <LandingPage
      onAdminAccess={() => setAppState('login')}
      onNavigateToServices={() => setAppState('services')}
      currentUser={publicUser}
      onLogin={setPublicUser}
      onLogout={() => setPublicUser(null)}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  );
  if (appState === 'login') return <LoginScreen onSuccess={handleLoginSuccess} onBack={() => setAppState('landing')} clients={clients} />;
  if (appState === 'client_portal' && loggedClient) return <ClientPortalScreen
    client={loggedClient}
    onLogout={() => { setLoggedClient(null); setAppState('landing'); }}
    serviceFees={serviceFees}
    onUpdateClient={(updatedClient) => {
      setLoggedClient(updatedClient);
      setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
    }}
  />;
  if (appState === 'music') return <MusicPage onBack={() => setAppState('landing')} />;

  return (
    <ToastProvider>
      <div className={`font-body min-h-screen flex ${theme === 'dark' ? 'bg-background dark' : 'bg-slate-50'} text-slate-800 dark:text-slate-100 transition-colors duration-500 relative overflow-hidden`}>
        {/* Decorative background elements - Enhanced for Dark Elite */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-sky-500/15 via-primary/5 to-transparent blur-[150px] -z-10 animate-aurora pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-emerald-500/10 via-sky-600/5 to-transparent blur-[120px] -z-10 animate-aurora pointer-events-none"></div>
        
        {/* Subtle texture for premium feel */}
        <div className={`absolute inset-0 opacity-[0.03] pointer-events-none bg-noise -z-20 ${theme === 'dark' ? 'invert' : ''}`}></div>

        <Sidebar
          onNavigate={(screen) => {
            if (screen === 'landing' as any) setAppState('landing');
            else navigate(screen as Screen);
          }}
          activeScreen={activeScreen}
          navItems={navItems}
          onQuickManagement={() => setIsUploadModalOpen(true)}
          onLogout={() => setShowLogoutConfirm(true)}
          cloudStatus={cloudStatus}
          onManualSave={handleManualSave}
          userName="Santiago Cordova"
          role="ADMINISTRADOR"
          sessionCode="AQ.Ab8RN"
          theme={theme}
          isCollapsed={isSidebarCollapsed || !!clientToView}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        />
        <div className={`flex-1 flex flex-col min-w-0 relative z-10 transition-all duration-500 ${(isSidebarCollapsed || !!clientToView) ? 'md:pl-[84px]' : 'md:pl-[280px]'}`}>
          <header className="hidden md:flex items-center justify-between p-6 px-10 bg-white/40 dark:bg-surface/60 backdrop-blur-3xl border-b border-slate-200/50 dark:border-white/10 relative overflow-hidden transition-all duration-700 no-print">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-light tracking-tight text-slate-800 dark:text-white capitalize">
                {activeScreen === 'home' ? 'Resumen General' : activeScreen.replace('_', ' ')}
              </h1>
            </div>

            {/* Universal Search Bar */}
            <div className="relative w-80 group max-w-md no-print">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-10">
                    <LucideIcons.Search className="text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors" size={16} />
                </div>
                <input 
                    type="text"
                    placeholder="Buscar por RUC o nombre..."
                    value={globalSearchQuery}
                    onChange={(e) => {
                        setGlobalSearchQuery(e.target.value);
                        setIsGlobalDropdownOpen(true);
                    }}
                    onFocus={() => setIsGlobalDropdownOpen(true)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-premium uppercase tracking-wider"
                />
                {globalSearchQuery && (
                    <button 
                        onClick={() => {
                            setGlobalSearchQuery('');
                            setIsGlobalDropdownOpen(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all z-10"
                    >
                        <LucideIcons.X size={12} />
                    </button>
                )}

                {/* Floating Results Dropdown */}
                {isGlobalDropdownOpen && (
                    <div 
                        ref={globalSearchRef}
                        className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[400] max-h-80 overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-2 duration-300"
                    >
                        {globalSearchResults.length > 0 ? (
                            <div className="p-2 space-y-1">
                                {globalSearchResults.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => {
                                            navigate('clients', { clientIdToView: c.id });
                                            setGlobalSearchQuery('');
                                            setIsGlobalDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center justify-between group/item"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide group-hover/item:text-primary transition-colors">
                                                {c.tradeName || c.name}
                                            </span>
                                            <span className="text-[10px] font-mono font-bold text-slate-400 mt-1">
                                                RUC: {c.ruc}
                                            </span>
                                        </div>
                                        <LucideIcons.ArrowRight size={12} className="text-slate-400 group-hover/item:text-primary group-hover/item:translate-x-1 transition-all" />
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="px-5 py-6 text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                {globalSearchQuery ? 'Sin Resultados' : 'Escribe para buscar...'}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center space-x-6">
              <NotificationBell clients={clients} navigate={navigate} />

              <div className="flex items-center bg-white/40 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-white/20 dark:border-white/10 shadow-lg group">
                <button
                  onClick={toggleTheme}
                  className={`p-2.5 rounded-xl transition-all duration-500 ${theme === 'dark' ? 'bg-slate-700 text-yellow-400' : 'bg-white text-sky-600 shadow-xl'}`}
                >
                  {theme === 'dark' ? <LucideIcons.Sun size={20} fill="currentColor" /> : <LucideIcons.Moon size={20} fill="currentColor" />}
                </button>
              </div>

              <div className="h-8 w-[1px] bg-white/10 mx-2"></div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-emerald-500 p-0.5 shadow-lg">
                  <div className="w-full h-full rounded-[9px] bg-slate-900 flex items-center justify-center overflow-hidden">
                    <Logo className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Mobile Ultra-Premium Header */}
          <header className="flex md:hidden fixed top-0 w-full z-50 items-center justify-between px-5 py-3 glass-zen border-b border-white/20 shadow-xl no-print">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-800 dark:bg-white flex items-center justify-center shadow-md pointer-events-none">
                <Logo className="w-5 h-5 text-white dark:text-slate-900" />
              </div>
              <span className="font-sans font-medium text-slate-800 dark:text-white text-sm tracking-wide">Directorio</span>
            </div>
            
            <div className="flex items-center gap-4">
              <button onClick={() => setIsUploadModalOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:scale-110 active:scale-95 transition-transform shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <LucideIcons.Zap size={14} className="fill-current" />
              </button>
              
              <div className="scale-75 origin-right">
                <NotificationBell clients={clients} navigate={navigate} />
              </div>

              <button onClick={toggleTheme} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 dark:bg-slate-800/40 border border-white/20 dark:border-white/10 text-sky-600 dark:text-yellow-400 shadow-lg hover:scale-110 active:scale-95 transition-transform">
                {theme === 'dark' ? <LucideIcons.Sun size={14} fill="currentColor" /> : <LucideIcons.Moon size={14} fill="currentColor" />}
              </button>
            </div>
          </header>

          <main className="flex-grow px-4 pt-24 pb-32 sm:pt-6 sm:p-6 sm:px-10 sm:pb-32 overflow-y-auto w-full relative no-scrollbar">
            <ErrorBoundary>
              <div key={activeScreen} className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-5 duration-700">
                {renderScreen()}
              </div>
            </ErrorBoundary>
            {!clientToView && (
              <div className="no-print">
                <MobileNavBar
                  navItems={navItems}
                  activeScreen={activeScreen}
                  onNavigate={(s) => {
                    if (s === 'landing' as any) setAppState('landing');
                    else navigate(s as Screen);
                  }}
                />
              </div>
            )}
          </main>
        </div>
        <Modal isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} title="Cerrar Sesión">
          <div className="text-center p-4">
            <h4 className="text-lg font-bold mb-6">¿Desea salir del panel?</h4>
            <div className="flex space-x-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg">Cancelar</button>
              <button onClick={() => toggleTheme()} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-sky-500 transition-all border border-slate-200 dark:border-slate-700 shadow-sm">
                {theme === 'dark' ? <LucideIcons.Sun size={20} /> : <LucideIcons.Moon size={20} />}
              </button>
              <button onClick={handleLogoutConfirm} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold">Sí, Salir</button>
            </div>
          </div>
        </Modal>
        <GlobalUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
        />

        <CommandPalette 
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          clients={clients}
          onNavigate={(screen) => navigate(screen as Screen)}
          onAction={handleCommandAction}
        />
        

      </div>
    </ToastProvider>
  );
};

export default App;
