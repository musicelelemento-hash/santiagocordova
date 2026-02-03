
import React, { useState, useEffect, useRef } from 'react';
import { Home, Users, CheckSquare, BarChart, Settings, Sun, Moon, BellRing, CalendarDays, LogOut, ShoppingCart, Cloud, RefreshCw, Check, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { HomeScreen } from './screens/HomeScreen';
import { AdminDashboardScreen } from './screens/AdminDashboardScreen'; 
import { ClientsScreen } from './screens/ClientsScreen';
import { TasksScreen } from './screens/TasksScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CobranzaScreen } from './screens/CobranzaScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { WebOrdersScreen } from './screens/WebOrdersScreen';
import { LandingPage } from './screens/LandingPage';
import { LoginScreen } from './screens/LoginScreen';
import { ServicesPage } from './screens/ServicesPage';
import { DesignScreen } from './screens/DesignScreen';
import { ClientPortalScreen } from './screens/ClientPortalScreen';
import { Clock } from './components/Clock';
import { NotificationBell } from './components/NotificationBell';
import { Sidebar } from './components/Sidebar';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Client, Task, Screen, Theme, ClientFilter, ServiceFeesConfig, ReminderConfig, WebOrder, PublicUser } from './types';
import { mockClients, mockTasks } from './constants';
import { loadDataFromSheet, syncDataToSheet } from './services/sheetApi';
import { Modal } from './components/Modal';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';

const initialServiceFees: ServiceFeesConfig = {
  ivaMensual: 5,
  ivaSemestral: 8,
  rentaNP: 10,
  rentaGeneral: 15,
  devolucionIva: 12,
  devolucionRenta: 15,
  anexoGastosPersonales: 15,
  customPunctualServices: [],
  serviceBundles: []
};

const defaultReminderConfig: ReminderConfig = {
  isEnabled: true,
  daysBefore: 3,
  onDueDate: true,
  overdueInterval: 7,
  template: `Estimado/a {clientName},

Le recordamos amablemente que su declaración de {period} por un valor de ${'$'}{amount} vence el {dueDate}.

Saludos cordiales,
Soluciones Contables Pro`,
};

type AppState = 'landing' | 'login' | 'dashboard' | 'services' | 'client_portal';

const App: React.FC = () => {
  // --- SESSION & ROUTING LOGIC ---
  const [appState, setAppState] = useState<AppState>(() => {
      const path = window.location.pathname;
      const isAdminLoggedIn = localStorage.getItem('sc_pro_admin_session') === 'true';

      if (path === '/admin' || path === '/dashboard') {
          return isAdminLoggedIn ? 'dashboard' : 'login';
      }
      if (path === '/services') return 'services';
      if (path === '/portal') return 'login';
      
      return 'landing';
  });

  const [publicUser, setPublicUser] = useState<PublicUser | null>(null);
  const [loggedClient, setLoggedClient] = useState<Client | null>(null);

  useEffect(() => {
      let path = '/';
      if (appState === 'dashboard') path = '/dashboard';
      else if (appState === 'services') path = '/services';
      else if (appState === 'login') path = '/login';
      else if (appState === 'client_portal') path = '/portal';
      
      if (window.location.pathname !== path) {
          try {
            window.history.pushState({}, '', path);
          } catch (e) {
            console.debug('History pushState blocked (expected in preview environment).');
          }
      }
  }, [appState]);

  useEffect(() => {
      const handlePopState = () => {
          const path = window.location.pathname;
          if (path === '/dashboard' || path === '/admin') {
              const isAdmin = localStorage.getItem('sc_pro_admin_session') === 'true';
              setAppState(isAdmin ? 'dashboard' : 'login');
          } else if (path === '/services') {
              setAppState('services');
          } else if (path === '/login') {
              setAppState('login');
          } else {
              setAppState('landing');
          }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Dashboard State
  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'light');
  const [activeScreen, setActiveScreen] = useState<Screen>('home');
  const [showSplash, setShowSplash] = useState(true);
  
  // Data State
  const [clients, setClients] = useLocalStorage<Client[]>('clients', mockClients);
  const [tasks, setTasks] = useLocalStorage<Task[]>('tasks', mockTasks);
  const [webOrders, setWebOrders] = useLocalStorage<WebOrder[]>('webOrders', []);
  const [sriCredentials, setSriCredentials] = useLocalStorage<Record<string, string>>('sriCredentials', {});
  const [serviceFees, setServiceFees] = useLocalStorage<ServiceFeesConfig>('serviceFees', initialServiceFees);
  const [reminderConfig, setReminderConfig] = useLocalStorage<ReminderConfig>('reminderConfig', defaultReminderConfig);

  // UI State
  const [clientFilter, setClientFilter] = useState<ClientFilter | null>(null);
  const [taskFilter, setTaskFilter] = useState<{ clientId?: string; taskId?: string } | null>(null);
  const [initialClientData, setInitialClientData] = useState<Partial<Client> | null>(null);
  const [initialTaskData, setInitialTaskData] = useState<Partial<Task> | null>(null);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [clientToView, setClientToView] = useState<Client | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // Sidebar Logic (Pro de Elite)
  const [isSidebarLocked, setIsSidebarLocked] = useLocalStorage<boolean>('sidebarLocked', true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(isSidebarLocked);
  
  const isFirstLoad = useRef(true);

  // Cloud Sync State
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- AUTOMATIC CLOUD SYNC LOGIC ---
  useEffect(() => {
    if ((appState === 'dashboard' || appState === 'client_portal') && isFirstLoad.current) {
        const fetchCloudData = async () => {
            setCloudStatus('loading');
            try {
                const result = await loadDataFromSheet();
                if (result.status === 'success' && result.data) {
                    const { clients: c, tasks: t, serviceFees: f, reminderConfig: r, webOrders: w, sriCredentials: s } = result.data;
                    if (Array.isArray(c) && c.length > 0) setClients(c);
                    if (Array.isArray(t)) setTasks(t);
                    if (f) setServiceFees(f);
                    if (r) setReminderConfig(r);
                    if (Array.isArray(w)) setWebOrders(w);
                    if (s) setSriCredentials(s);
                    setCloudStatus('saved');
                } else {
                    setCloudStatus('idle'); 
                }
            } catch (error) {
                console.error("Error loading data:", error);
                setCloudStatus('error');
            } finally {
                isFirstLoad.current = false;
            }
        };
        fetchCloudData();
    }
  }, [appState, setClients, setTasks, setServiceFees, setReminderConfig, setWebOrders, setSriCredentials]);

  useEffect(() => {
      if (appState !== 'dashboard' || isFirstLoad.current || cloudStatus === 'loading') return;
      
      const saveData = async () => {
          setCloudStatus('saving');
          try {
              const payload = { clients, tasks, serviceFees, reminderConfig, webOrders, sriCredentials };
              await syncDataToSheet(payload);
              setCloudStatus('saved');
          } catch (error) {
              console.error("Error auto-saving:", error);
              setCloudStatus('error');
          }
      };

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setCloudStatus('saving'); 
      saveTimeoutRef.current = setTimeout(() => { saveData(); }, 5000); 
      return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [clients, tasks, serviceFees, reminderConfig, webOrders, sriCredentials, appState]); 

  // --- Routing and Theme ---
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark'); 
    if (appState === 'dashboard') {
        if (theme === 'dark') root.classList.add('dark');
        else root.classList.add('light');
    } 
  }, [theme, appState]);

  useEffect(() => {
      if (showSplash && appState === 'dashboard') {
        const timer = setTimeout(() => setShowSplash(false), 2000);
        return () => clearTimeout(timer);
      }
  }, [showSplash, appState]);

  useEffect(() => {
      if (isSidebarLocked) {
          setIsSidebarExpanded(true);
      }
  }, [isSidebarLocked]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  
  const navigate = (screen: Screen, options: { clientFilter?: ClientFilter, taskFilter?: { clientId?: string; taskId?: string }, initialClientData?: Partial<Client>, initialTaskData?: Partial<Task>, clientIdToView?: string } = {}) => {
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
  
  const clearTaskFilter = () => setTaskFilter(null);
  const handleWebOrderSubmit = (order: WebOrder) => setWebOrders(prev => [...prev, order]);
  
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
      case 'home': return <AdminDashboardScreen navigate={navigate} clients={clients} />; 
      case 'clients': return <ClientsScreen clients={clients} setClients={setClients} initialFilter={clientFilter} navigate={navigate} serviceFees={serviceFees} initialClientData={initialClientData} clearInitialClientData={() => setInitialClientData(null)} clientToView={clientToView} clearClientToView={() => setClientToView(null)} sriCredentials={sriCredentials} />;
      case 'tasks': return <TasksScreen tasks={tasks} setTasks={setTasks} clients={clients} setClients={setClients} taskFilter={taskFilter} clearTaskFilter={clearTaskFilter} serviceFees={serviceFees} initialTaskData={initialTaskData} clearInitialTaskData={() => setInitialTaskData(null)} />;
      case 'calendar': return <CalendarScreen clients={clients} tasks={tasks} navigate={navigate} />;
      case 'reports': return <ReportsScreen clients={clients} tasks={tasks} serviceFees={serviceFees} navigate={navigate} />;
      case 'cobranza': return <CobranzaScreen clients={clients} setClients={setClients} serviceFees={serviceFees} reminderConfig={reminderConfig} />;
      case 'web_orders': return <WebOrdersScreen orders={webOrders} setOrders={setWebOrders} setTasks={setTasks} navigate={navigate} />;
      case 'settings': return <SettingsScreen clients={clients} setClients={setClients} tasks={tasks} setTasks={setTasks} serviceFees={serviceFees} setServiceFees={setServiceFees} reminderConfig={reminderConfig} setReminderConfig={setReminderConfig} webOrders={webOrders} setWebOrders={setWebOrders} sriCredentials={sriCredentials} setSriCredentials={setSriCredentials} navigate={navigate} />;
      case 'scanner': return <DesignScreen navigate={navigate} sriCredentials={sriCredentials} />;
      default: return <AdminDashboardScreen navigate={navigate} clients={clients} />;
    }
  };

  const getThemeIcon = () => theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-sky-600" />;
  
  const navItems = [
    { screen: 'home', icon: Home, label: 'Área de Trabajo' },
    { screen: 'clients', icon: Users, label: 'Clientes' },
    { screen: 'tasks', icon: CheckSquare, label: 'Tareas' },
    { screen: 'web_orders', icon: ShoppingCart, label: 'Pedidos', count: webOrders.filter(o => o.status === 'pending').length },
    { screen: 'calendar', icon: CalendarDays, label: 'Agenda' },
    { screen: 'reports', icon: BarChart, label: 'Reportes' },
    { screen: 'cobranza', icon: BellRing, label: 'Cobros' },
    { screen: 'settings', icon: Settings, label: 'Ajustes' },
  ];

  if (appState === 'services') return <ServicesPage onAdminAccess={() => setAppState('login')} onSubmitOrder={handleWebOrderSubmit} onNavigateToHome={() => setAppState('landing')} currentUser={publicUser} onLogin={setPublicUser} onLogout={() => setPublicUser(null)} />;
  if (appState === 'landing') return <LandingPage onAdminAccess={() => setAppState('login')} onNavigateToServices={() => setAppState('services')} currentUser={publicUser} onLogin={setPublicUser} onLogout={() => setPublicUser(null)} />;
  if (appState === 'login') return <LoginScreen onSuccess={handleLoginSuccess} onBack={() => setAppState('landing')} clients={clients} />;
  if (appState === 'client_portal' && loggedClient) return <ClientPortalScreen client={loggedClient} onLogout={() => { setLoggedClient(null); setAppState('landing'); }} serviceFees={serviceFees} />;

  // Splash Screen
  if (showSplash) {
      // ... same splash code
  }

  return (
    <ToastProvider>
    <div className={`font-body min-h-screen flex ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'} text-slate-800 dark:text-slate-100 transition-colors duration-300`}>
      
      <Sidebar 
        isExpanded={isSidebarExpanded}
        isLocked={isSidebarLocked}
        onToggleLock={() => setIsSidebarLocked(!isSidebarLocked)}
        onToggleExpand={(val) => !isSidebarLocked && setIsSidebarExpanded(val)}
        onNavigate={(screen) => navigate(screen)}
        activeScreen={activeScreen}
        navItems={navItems}
        onQuickManagement={() => navigate('tasks', { initialTaskData: {} })}
        onLogout={() => setShowLogoutConfirm(true)}
        cloudStatus={cloudStatus}
      />

      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <header className="sticky top-0 z-30 flex md:hidden items-center justify-between p-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-800">
             {/* Mobile Header content */}
             {/* ... */}
        </header>

        <header className="hidden md:flex items-center justify-between p-4 px-8 bg-transparent">
             <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm">
                <Clock />
             </div>
             <div className="flex items-center space-x-4">
                <NotificationBell tasks={upcomingTasks} clients={clients} navigate={navigate} />
                <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                    {getThemeIcon()}
                </button>
             </div>
        </header>
        
        <main className="flex-grow p-3 sm:p-6 sm:px-8 overflow-y-auto mb-20 md:mb-0 w-full relative">
            <ErrorBoundary>
                {renderScreen()}
            </ErrorBoundary>
        </main>
      </div>

      <Modal isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} title="Cerrar Sesión">
          <div className="text-center">
              <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2">¿Desea salir del panel?</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Verifique que sus cambios se hayan guardado en la nube.</p>
              <div className="flex space-x-3">
                  <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-medium">Cancelar</button>
                  <button onClick={handleLogoutConfirm} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold shadow-lg">Sí, Salir</button>
              </div>
          </div>
      </Modal>
    </div>
    </ToastProvider>
  );
};

export default App;
