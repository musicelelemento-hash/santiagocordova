import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import {
  Home, Users, LayoutGrid, Kanban, Box, KeyRound, ShoppingBag,
  FileSpreadsheet, Key, Coins, Wallet, BarChart, FileText, CheckCircle,
  CalendarDays, ShoppingCart, Globe, Settings, History, ArrowRightLeft,
  Search, Sun, Moon, Zap, X, ArrowRight
} from 'lucide-react';
import { LandingPage } from './screens/LandingPage';
import { Logo } from './Logo';
import { Clock } from './components/ui/Clock';
import { NotificationBell } from './components/layout/NotificationBell';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNavBar } from './components/layout/MobileNavBar';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Client, Task, Screen, Theme, ClientFilter, PublicUser, TaxRegime, Declaration, DeclarationStatus } from './types';
import { loadDataFromSheet, syncDataToSheet } from './services/sheetApi';
import { Modal } from './components/ui/Modal';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useAppStore } from './store/useAppStore';
import { getClientUndeclaredSummary } from './services/complianceEngine';

// Lazy-loaded heavy modules & admin screens
const AdminDashboardScreen = React.lazy(() => import('./screens/AdminDashboardScreen').then(m => ({ default: m.AdminDashboardScreen })));
const ClientsScreen = React.lazy(() => import('./screens/ClientsScreen').then(m => ({ default: m.ClientsScreen })));
const ReportsScreen = React.lazy(() => import('./screens/ReportsScreen').then(m => ({ default: m.ReportsScreen })));
const SettingsScreen = React.lazy(() => import('./screens/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const CobranzaScreen = React.lazy(() => import('./screens/CobranzaScreen').then(m => ({ default: m.CobranzaScreen })));
const CalendarScreen = React.lazy(() => import('./screens/CalendarScreen').then(m => ({ default: m.CalendarScreen })));
const WebOrdersScreen = React.lazy(() => import('./screens/WebOrdersScreen').then(m => ({ default: m.WebOrdersScreen })));
const TasksScreen = React.lazy(() => import('./screens/TasksScreen').then(m => ({ default: m.TasksScreen })));
const LoginScreen = React.lazy(() => import('./screens/LoginScreen').then(m => ({ default: m.LoginScreen })));
const ServicesPage = React.lazy(() => import('./screens/ServicesPage').then(m => ({ default: m.ServicesPage })));
const ClientPortalScreen = React.lazy(() => import('./screens/ClientPortalScreen').then(m => ({ default: m.ClientPortalScreen })));
const MusicPage = React.lazy(() => import('./screens/MusicPage').then(m => ({ default: m.MusicPage })));
const AuditLogScreen = React.lazy(() => import('./screens/AuditLogScreen').then(m => ({ default: m.AuditLogScreen })));
const FacturacionSriScreen = React.lazy(() => import('./screens/FacturacionSriScreen').then(m => ({ default: m.FacturacionSriScreen })));
const FirmasScreen = React.lazy(() => import('./screens/FirmasScreen').then(m => ({ default: m.FirmasScreen })));
const FacturadoresScreen = React.lazy(() => import('./screens/FacturadoresScreen').then(m => ({ default: m.FacturadoresScreen })));
const CotizacionesScreen = React.lazy(() => import('./screens/CotizacionesScreen').then(m => ({ default: m.CotizacionesScreen })));
const LicenciasScreen = React.lazy(() => import('./screens/LicenciasScreen').then(m => ({ default: m.LicenciasScreen })));
const RefinanciacionScreen = React.lazy(() => import('./screens/RefinanciacionScreen').then(m => ({ default: m.RefinanciacionScreen })));
const CajaChicaScreen = React.lazy(() => import('./screens/CajaChicaScreen').then(m => ({ default: m.CajaChicaScreen })));
const CrmPipelineScreen = React.lazy(() => import('./screens/CrmPipelineScreen').then(m => ({ default: m.CrmPipelineScreen })));
const ThreeDStudioScreen = React.lazy(() => import('./screens/ThreeDStudioScreen').then(m => ({ default: m.ThreeDStudioScreen })));
const AdaptadorConvert = React.lazy(() => import('./components/features/AdaptadorConvert').then(m => ({ default: m.AdaptadorConvert })));
const GlobalUploadModal = React.lazy(() => import('./components/features/GlobalUploadModal').then(m => ({ default: m.GlobalUploadModal })));
const SalesComboModal = React.lazy(() => import('./components/features/SalesComboModal').then(m => ({ default: m.SalesComboModal })));
const SriPasswordChangerModal = React.lazy(() => import('./components/features/SriPasswordChangerModal').then(m => ({ default: m.SriPasswordChangerModal })));
const CommandPalette = React.lazy(() => import('./components/CommandPalette').then(m => ({ default: m.CommandPalette })));

const ScreenLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[300px] w-full py-16">
    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-3" />
    <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Cargando módulo...</span>
  </div>
);


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
    syncFromSheets,
    updateClient
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
  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'dark');
  const [activeScreen, setActiveScreen] = useState<Screen>('declaraciones');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [previousScreen, setPreviousScreen] = useState<Screen | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isGlobalDropdownOpen, setIsGlobalDropdownOpen] = useState(false);
  const globalSearchRef = useRef<HTMLDivElement>(null);

  const globalSearchResults = useMemo(() => {
    if (!globalSearchQuery.trim()) return [];
    const query = globalSearchQuery.toLowerCase().trim();

    // 1. Smart Tag: r: (Tax Regime)
    if (query.startsWith('r:')) {
      const targetRegime = query.substring(2).trim();
      return clients.filter(c => !c.isDeleted && c.isActive && (
        (targetRegime.includes('pop') && c.regime === TaxRegime.RimpeNegocioPopular) ||
        (targetRegime.includes('emp') && c.regime === TaxRegime.RimpeEmprendedor) ||
        (targetRegime.includes('gen') && c.regime === TaxRegime.General)
      )).slice(0, 8);
    }

    // 2. Smart Tag: v: (Vencidos / Overdue)
    if (query.startsWith('v:')) {
      const targetStatus = query.substring(2).trim();
      if (targetStatus.includes('ven') || targetStatus.includes('pen')) {
        const today = new Date();
        return clients.filter(c => !c.isDeleted && c.isActive && 
          getClientUndeclaredSummary(c, today).overduePeriodsCount > 0
        ).slice(0, 8);
      }
    }

    // 3. Smart Tag: d: (9th Digit of RUC)
    if (query.startsWith('d:')) {
      const digit = query.substring(2).trim();
      if (digit.length === 1 && /^\d$/.test(digit)) {
        return clients.filter(c => !c.isDeleted && c.isActive && c.ruc[8] === digit).slice(0, 8);
      }
    }

    // 4. Smart Tag: n: (Client Notes)
    if (query.startsWith('n:')) {
      const searchTerm = query.substring(2).trim();
      return clients.filter(c => !c.isDeleted && c.isActive && 
        c.notes && c.notes.toLowerCase().includes(searchTerm)
      ).slice(0, 8);
    }

    // Normal Search (Default)
    return clients.filter(c => !c.isDeleted && (
      c.name.toLowerCase().includes(query) ||
      (c.tradeName && c.tradeName.toLowerCase().includes(query)) ||
      c.ruc.includes(query)
    )).slice(0, 8);
  }, [clients, globalSearchQuery]);

  const recentClients = useMemo(() => {
    try {
      const recentRaw = localStorage.getItem('sc_pro_recent_searches');
      const recentIds: string[] = recentRaw ? JSON.parse(recentRaw) : [];
      return recentIds
        .map(id => clients.find(c => c.id === id))
        .filter((c): c is Client => !!c && !c.isDeleted);
    } catch (e) {
      return [];
    }
  }, [clients, isGlobalDropdownOpen]);

  const handleSelectClient = (client: Client) => {
    try {
      const recentRaw = localStorage.getItem('sc_pro_recent_searches');
      let recent: string[] = recentRaw ? JSON.parse(recentRaw) : [];
      recent = recent.filter(id => id !== client.id);
      recent.unshift(client.id);
      recent = recent.slice(0, 3);
      localStorage.setItem('sc_pro_recent_searches', JSON.stringify(recent));
    } catch (e) {
      console.warn("Failed to save recent search:", e);
    }

    navigate('clients', { clientIdToView: client.id });
    setGlobalSearchQuery('');
    setIsGlobalDropdownOpen(false);
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return <span>{text}</span>;
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() 
            ? <strong key={i} className="text-primary font-black">{part}</strong>
            : part
        )}
      </span>
    );
  };

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
  const [sriInvoiceClientId, setSriInvoiceClientId] = useState<string | null>(null);
  const [sriInvoiceAmount, setSriInvoiceAmount] = useState<number | null>(null);
  const [sriInvoiceDescription, setSriInvoiceDescription] = useState<string | null>(null);
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
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenSales = () => setIsSalesModalOpen(true);
    window.addEventListener('open-sales-modal', handleOpenSales);
    return () => window.removeEventListener('open-sales-modal', handleOpenSales);
  }, []);

  // Escuchar actualizaciones automáticas enviadas desde la Extensión de Chrome (SRI & Ecuafact)
  useEffect(() => {
    const handleExtensionSyncMessage = (event: MessageEvent) => {
      if (event.data && event.data.source === 'SC_PRO_EXTENSION' && event.data.type === 'SRI_PASSWORD_UPDATED_SYNC') {
        const { ruc, newPassword } = event.data.data || {};
        if (!ruc || !newPassword) return;

        const targetClient = clients.find(c => c.ruc === ruc);
        if (targetClient) {
          const updatedFacturador = {
            ...targetClient.facturadorConfig,
            programName: targetClient.facturadorConfig?.programName || 'ECUAFACT',
            username: targetClient.ruc,
            password: newPassword,
            documentCount: targetClient.facturadorConfig?.documentCount ?? 60,
            documentStatus: targetClient.facturadorConfig?.documentStatus || 'Prepago'
          };

          updateClient(targetClient.id, {
            sriPassword: newPassword,
            facturadorConfig: updatedFacturador
          });

          console.log(`🎉 [Extension Auto-Sync] Cliente ${targetClient.name} actualizado con nueva clave SRI/Ecuafact: ${newPassword}`);
        }
      }

      if (event.data && event.data.source === 'SC_PRO_EXTENSION' && event.data.type === 'SRI_DECLARATION_COMPLETED_SYNC') {
        const { ruc, period, pdf, metrics } = event.data.data || {};
        if (!ruc) return;

        const cleanRuc = ruc.replace(/\D/g, '');
        const targetClient = clients.find(c => c.ruc.replace(/\D/g, '') === cleanRuc);
        if (targetClient) {
          const targetPeriod = (period && period !== 'AUTO') ? period : '2026-07';
          const existingHistory = Array.isArray(targetClient.declarations) ? targetClient.declarations : [];
          
          const newDecl: Declaration = {
            period: targetPeriod,
            type: 'IVA',
            status: DeclarationStatus.Enviada,
            is_paid: false, // Queda PENDIENTE el pago por petición explícita del usuario
            declaredAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            proof_file: pdf ? {
              name: `Declaracion_IVA_${targetPeriod}.pdf`,
              size: 102400,
              type: 'pdf',
              content: pdf,
              lastModified: Date.now()
            } : undefined
          };

          const updatedHistory = [newDecl, ...existingHistory.filter(d => d.period !== targetPeriod)];
          updateClient(targetClient.id, { declarations: updatedHistory });

          console.log(`🏆 [Extension Auto-Sync] Declaración de ${targetClient.name} (${targetPeriod}) registrada automáticamente como ENVIADA (PENDIENTE DE PAGO).`);
        }
      }
    };

    window.addEventListener('message', handleExtensionSyncMessage);
    return () => window.removeEventListener('message', handleExtensionSyncMessage);
  }, [clients, updateClient]);

  // Transmitir Matriz Completa a la Extensión de Chrome y localStorage
  useEffect(() => {
    if (clients && clients.length > 0) {
      try {
        localStorage.setItem('sc_clients_history', JSON.stringify(clients));
        window.postMessage({
          source: 'SC_PRO_DASHBOARD',
          type: 'SRI_FULL_MATRIX_DATA',
          data: clients
        }, "*");
      } catch (e) {
        console.warn("Error transmitiendo matriz:", e);
      }
    }
  }, [clients]);

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

    // Guardamos tab temporal en window para usarlo en el renderScreen
    if (options.initialTab) {
        (window as any).__TEMP_INITIAL_TAB__ = options.initialTab;
    } else {
        delete (window as any).__TEMP_INITIAL_TAB__;
    }

    if (options.searchTerm) {
        (window as any).__TEMP_FACTURADORES_SEARCH__ = options.searchTerm;
    } else {
        delete (window as any).__TEMP_FACTURADORES_SEARCH__;
    }

    setActiveScreen(screen);
    setClientFilter(options.clientFilter || null);
    setTaskFilter(options.taskFilter || null);
    setInitialClientData(options.initialClientData || null);
    setInitialTaskData(options.initialTaskData || null);
    
    if (screen === 'sri_facturacion') {
      setSriInvoiceClientId(options.clientId || null);
      setSriInvoiceAmount(options.amount || null);
      setSriInvoiceDescription(options.description || null);
    }
    
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
          initialFilter={clientFilter || { activeGroupTab: 'all' }} 
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
          initialTab={(window as any).__TEMP_INITIAL_TAB__}
          globalSearchTerm={globalSearchQuery}
          setGlobalSearchTerm={setGlobalSearchQuery}
        />
      );
      case 'declaraciones': return (
        <ClientsScreen 
          initialFilter={{ activeGroupTab: 'matrix', ...(clientFilter || {}) }} 
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
          initialTab={(window as any).__TEMP_INITIAL_TAB__}
          globalSearchTerm={globalSearchQuery}
          setGlobalSearchTerm={setGlobalSearchQuery}
        />
      );
      case 'calendar': return <CalendarScreen navigate={navigate} />;
      case 'reports': return <ReportsScreen navigate={navigate} />;
      case 'cobranza': return <CobranzaScreen navigate={navigate} />;
      case 'web_orders': return <WebOrdersScreen navigate={navigate} />;
      case 'tasks': return <TasksScreen navigate={navigate} taskFilter={taskFilter} clearTaskFilter={() => setTaskFilter(null)} initialTaskData={initialTaskData} clearInitialTaskData={() => setInitialTaskData(null)} />;
      case 'settings': return <SettingsScreen navigate={navigate} />;
      case 'audit_log': return <AuditLogScreen />;
      case 'sri_facturacion': return (
        <FacturacionSriScreen 
          initialClientId={sriInvoiceClientId}
          initialAmount={sriInvoiceAmount}
          initialDescription={sriInvoiceDescription}
          onClearInitialData={() => {
            setSriInvoiceClientId(null);
            setSriInvoiceAmount(null);
            setSriInvoiceDescription(null);
          }}
        />
      );
      case 'firmas': return <FirmasScreen navigate={navigate} />;
      case 'facturadores': {
        const term = (window as any).__TEMP_FACTURADORES_SEARCH__ || '';
        delete (window as any).__TEMP_FACTURADORES_SEARCH__;
        return <FacturadoresScreen navigate={navigate} initialSearchTerm={term} />;
      }
      case 'cotizaciones': return <CotizacionesScreen navigate={navigate} />;
      case 'licencias': return <LicenciasScreen navigate={navigate} />;
      case 'refinanciacion': return <RefinanciacionScreen navigate={navigate} />;
      case 'caja_chica': return <CajaChicaScreen navigate={navigate} />;
      case 'crm_pipeline': return <CrmPipelineScreen navigate={navigate} />;
      case '3d-studio': return <ThreeDStudioScreen />;
      case 'migracion_zifact': return <AdaptadorConvert />;
      default: return <AdminDashboardScreen navigate={navigate} />;
    }
  };

  const navItems = ([
    { screen: 'declaraciones', icon: LayoutGrid, label: 'Declaraciones SRI', count: clients.filter(c => !c.isDeleted && (c.isActive ?? true)).length },
    { screen: 'clients', icon: Users, label: 'Directorio Clientes' },
    { screen: 'firmas', icon: KeyRound, label: 'Firmas Electrónicas' },
    { screen: 'crm_pipeline', icon: Kanban, label: 'CRM Embudo' },
    { screen: '3d-studio', icon: Box, label: 'Studio 3D Alpha3D' },
    { screen: 'facturadores', icon: ShoppingBag, label: 'Facturadores y Planes' },
    { screen: 'cotizaciones', icon: FileSpreadsheet, label: 'Cotizaciones' },
    { screen: 'licencias', icon: Key, label: 'Licencias SaaS' },
    { screen: 'refinanciacion', icon: Coins, label: 'Refinanciación' },
    { screen: 'caja_chica', icon: Wallet, label: 'Caja Chica TPV' },
    { screen: 'cobranza', icon: BarChart, label: 'Cobranza' },
    { screen: 'sri_facturacion', icon: FileText, label: 'Facturador' },
    { screen: 'tasks', icon: CheckCircle, label: 'Tareas' },
    { screen: 'calendar', icon: CalendarDays, label: 'Agenda' },
    { screen: 'web_orders', icon: ShoppingCart, label: 'Tienda' },
    { screen: 'services', icon: Globe, label: 'Servicios' },
    { screen: 'settings', icon: Settings, label: 'Ajustes' },
    { screen: 'audit_log', icon: History, label: 'Auditoría' },
    { screen: 'migracion_zifact', icon: ArrowRightLeft, label: 'Migración Zifact', onClick: () => navigate('migracion_zifact') },
    { screen: 'landing', icon: Globe, label: 'Sitio Público' },
  ] as any[]);

  if (appState === 'services') return (
    <Suspense fallback={<ScreenLoader />}>
      <ServicesPage
        onAdminAccess={() => setAppState('login')}
        onSubmitOrder={(o) => setWebOrders(p => [...p, o])}
        onNavigateToHome={() => setAppState('landing')}
        currentUser={publicUser}
        onLogin={setPublicUser}
        onLogout={() => setPublicUser(null)}
      />
    </Suspense>
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
  if (appState === 'login') return (
    <Suspense fallback={<ScreenLoader />}>
      <LoginScreen onSuccess={handleLoginSuccess} onBack={() => setAppState('landing')} clients={clients} />
    </Suspense>
  );
  if (appState === 'client_portal' && loggedClient) return (
    <Suspense fallback={<ScreenLoader />}>
      <ClientPortalScreen
        client={loggedClient}
        onLogout={() => { setLoggedClient(null); setAppState('landing'); }}
        serviceFees={serviceFees}
        onUpdateClient={(updatedClient) => {
          setLoggedClient(updatedClient);
          setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
        }}
      />
    </Suspense>
  );
  if (appState === 'music') return (
    <Suspense fallback={<ScreenLoader />}>
      <MusicPage onBack={() => setAppState('landing')} />
    </Suspense>
  );

  return (
    <ToastProvider>
      <div className={`font-body min-h-screen flex ${theme === 'dark' ? 'bg-gradient-obsidian dark' : 'bg-slate-50'} text-slate-800 dark:text-slate-100 transition-colors duration-500 relative overflow-hidden`}>
        {/* Decorative background elements - Enhanced for Dark Elite */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-sky-500/15 via-primary/5 to-transparent blur-[150px] -z-10 animate-aurora pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-emerald-500/10 via-sky-600/5 to-transparent blur-[120px] -z-10 animate-aurora pointer-events-none"></div>
        
        {/* Subtle texture for premium feel */}
        <div className={`absolute inset-0 opacity-[0.04] pointer-events-none bg-noise-animated -z-20 ${theme === 'dark' ? 'invert' : ''}`}></div>

        <Sidebar
          onNavigate={(screen) => {
            if (screen === 'landing' as any) setAppState('landing');
            else navigate(screen as Screen);
          }}
          activeScreen={activeScreen}
          navItems={navItems}
          onQuickManagement={() => setIsUploadModalOpen(true)}
          onOpenSalesModal={() => setIsSalesModalOpen(true)}
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
          <header className="hidden md:flex items-center justify-between p-5 px-10 bg-white/90 dark:bg-[#051424]/90 backdrop-blur-2xl border-b border-slate-200/80 dark:border-white/10 relative z-30 transition-all duration-500 no-print">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white capitalize font-display">
                {activeScreen === 'home' ? 'Centro de Control' : activeScreen.replace('_', ' ')}
              </h1>
            </div>

            {/* Universal Search Bar (Stitch High-Tech Glass) */}
            <div className="relative w-80 group max-w-md no-print">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-10">
                    <Search className="text-slate-400 group-focus-within:text-[#00A896] transition-colors" size={15} />
                </div>
                <input 
                    type="text"
                    placeholder="Buscar por RUC o cliente..."
                    value={globalSearchQuery}
                    onChange={(e) => {
                        setGlobalSearchQuery(e.target.value);
                        setIsGlobalDropdownOpen(true);
                    }}
                    onFocus={() => setIsGlobalDropdownOpen(true)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-100 dark:bg-black/40 border border-slate-200/80 dark:border-white/10 rounded-2xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#00A896]/20 focus:border-[#00A896] transition-all font-mono tracking-wider"
                />
            {globalSearchQuery ? (
                <button 
                    onClick={() => {
                        setGlobalSearchQuery('');
                        setIsGlobalDropdownOpen(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all z-10"
                >
                    <X size={12} />
                </button>
            ) : (
                <kbd 
                    onClick={() => {
                        setIsGlobalDropdownOpen(false);
                        setIsCommandPaletteOpen(true);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded text-[9px] font-mono leading-none border border-slate-300 dark:border-white/5 shadow-sm select-none cursor-pointer z-10 hover:bg-slate-300 dark:hover:bg-white/20 transition-all"
                    title="Atajo de Teclado"
                >
                    Ctrl+K
                </kbd>
            )}

            {/* Floating Results Dropdown */}
            {isGlobalDropdownOpen && (
                <div 
                    ref={globalSearchRef}
                    className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[400] max-h-[26rem] overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-top-2 duration-300"
                >
                    {globalSearchQuery ? (
                        globalSearchResults.length > 0 ? (
                            <div className="p-2 space-y-1">
                                {globalSearchResults.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => handleSelectClient(c)}
                                        className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center justify-between group/item"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide group-hover/item:text-primary transition-colors">
                                                {highlightText(c.tradeName || c.name, globalSearchQuery)}
                                            </span>
                                            <span className="text-[10px] font-mono font-bold text-slate-400 mt-1">
                                                RUC: {highlightText(c.ruc, globalSearchQuery)}
                                            </span>
                                        </div>
                                        <ArrowRight size={12} className="text-slate-400 group-hover/item:text-primary group-hover/item:translate-x-1 transition-all" />
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="px-5 py-6 text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                Sin Resultados
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col divide-y divide-slate-200 dark:divide-white/5 bg-slate-50/50 dark:bg-slate-900/50">
                            {recentClients.length > 0 && (
                                <div className="p-4 space-y-2">
                                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1.5 block">Búsquedas Recientes</span>
                                    <div className="grid grid-cols-1 gap-1">
                                        {recentClients.map((c) => (
                                            <button
                                                key={c.id}
                                                onClick={() => handleSelectClient(c)}
                                                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all flex items-center justify-between group/recent text-xs"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-700 dark:text-slate-300 group-hover/recent:text-primary transition-all uppercase truncate max-w-[220px]">
                                                        {c.tradeName || c.name}
                                                    </span>
                                                    <span className="text-[9px] font-mono text-slate-400 mt-0.5">RUC: {c.ruc}</span>
                                                </div>
                                                <ArrowRight size={10} className="text-slate-400 group-hover/recent:text-primary group-hover/recent:translate-x-1 transition-all" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-white/5">
                                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Guía de Búsqueda Rápida</span>
                                    <button 
                                        onClick={() => {
                                            setGlobalSearchQuery('r:');
                                            setIsGlobalDropdownOpen(true);
                                        }}
                                        className="text-[9px] font-mono text-primary font-bold hover:underline"
                                    >
                                        Probar tags
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { tag: 'r: rimpe', desc: 'Régimen RIMPE' },
                                        { tag: 'v: vencido', desc: 'Vencidos / Deuda' },
                                        { tag: 'd: 9', desc: '9no Dígito del RUC' },
                                        { tag: 'Ctrl + K', desc: 'Comandos Pro', isKbd: true }
                                    ].map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                if (item.isKbd) {
                                                    setIsGlobalDropdownOpen(false);
                                                    setIsCommandPaletteOpen(true);
                                                } else {
                                                    setGlobalSearchQuery(item.tag);
                                                }
                                            }}
                                            className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200/60 dark:border-white/5 hover:border-primary/40 transition-all text-left group/guide"
                                        >
                                            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 truncate mr-1">
                                                {item.desc}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                                                item.isKbd 
                                                    ? 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-white/5' 
                                                    : 'bg-primary/10 text-primary border-primary/20 group-hover/guide:bg-primary group-hover/guide:text-white'
                                            }`}>
                                                {item.tag}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
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
                  {theme === 'dark' ? <Sun size={20} fill="currentColor" /> : <Moon size={20} fill="currentColor" />}
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
                <Zap size={14} className="fill-current" />
              </button>
              
              <div className="scale-75 origin-right">
                <NotificationBell clients={clients} navigate={navigate} />
              </div>

              <button onClick={toggleTheme} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 dark:bg-slate-800/40 border border-white/20 dark:border-white/10 text-sky-600 dark:text-yellow-400 shadow-lg hover:scale-110 active:scale-95 transition-transform">
                {theme === 'dark' ? <Sun size={14} fill="currentColor" /> : <Moon size={14} fill="currentColor" />}
              </button>
            </div>
          </header>

          <main className="flex-grow px-4 pt-24 pb-32 sm:pt-6 sm:p-6 sm:px-10 sm:pb-32 overflow-y-auto w-full relative no-scrollbar">
            <ErrorBoundary>
              <div key={activeScreen} className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-5 duration-700">
                <Suspense fallback={<ScreenLoader />}>
                  {renderScreen()}
                </Suspense>
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
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button onClick={handleLogoutConfirm} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold">Sí, Salir</button>
            </div>
          </div>
        </Modal>
        <Suspense fallback={null}>
          <GlobalUploadModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
          />
          <SalesComboModal
            isOpen={isSalesModalOpen}
            onClose={() => setIsSalesModalOpen(false)}
            onEmitSriInvoice={(client, description, amount) => {
              setIsSalesModalOpen(false);
              setSriInvoiceClientId(client.id);
              setSriInvoiceDescription(description);
              setSriInvoiceAmount(amount);
              navigate('sri_facturacion');
            }}
          />
          <CommandPalette 
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            clients={clients}
            onNavigate={(screen) => navigate(screen as Screen)}
            onAction={handleCommandAction}
          />
        </Suspense>
      </div>
    </ToastProvider>
  );
};

export default App;
