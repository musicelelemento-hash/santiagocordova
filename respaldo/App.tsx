import React, { useState, useEffect, useRef } from 'react';
import { Home, Users, CheckSquare, BarChart, Settings, Sun, Moon, BellRing, CalendarDays, ShoppingCart, RefreshCw } from 'lucide-react';
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
};

const defaultReminderConfig: ReminderConfig = {
  isEnabled: true,
  daysBefore: 3,
  onDueDate: true,
  overdueInterval: 7,
  template: `Estimado/a {clientName}, le recordamos amablemente que su declaración de {period} por un valor de {amount} vence el {dueDate}. Saludos, Soluciones Contables Pro`,
};

type AppState = 'landing' | 'login' | 'dashboard' | 'services' | 'client_portal';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(() => {
      const path = window.location.pathname;
      const isAdminLoggedIn = localStorage.getItem('sc_pro_admin_session') === 'true';
      if (path === '/admin' || path === '/dashboard') return isAdminLoggedIn ? 'dashboard' : 'login';
      if (path === '/services') return 'services';
      if (path === '/portal') return 'login';
      return 'landing';
  });

  const [publicUser, setPublicUser] = useState<PublicUser | null>(null);
  const [loggedClient, setLoggedClient] = useState<Client | null>(null);
  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'light');
  const [activeScreen, setActiveScreen] = useState<Screen>('home');
  const [showSplash, setShowSplash] = useState(true);
  
  const [clients, setClients] = useLocalStorage<Client[]>('clients', mockClients);
  const [tasks, setTasks] = useLocalStorage<Task[]>('tasks', mockTasks);
  const [webOrders, setWebOrders] = useLocalStorage<WebOrder[]>('webOrders', []);
  const [sriCredentials, setSriCredentials] = useLocalStorage<Record<string, string>>('sriCredentials', {});
  const [serviceFees, setServiceFees] = useLocalStorage<ServiceFeesConfig>('serviceFees', initialServiceFees);
  const [reminderConfig, setReminderConfig] = useLocalStorage<ReminderConfig>('reminderConfig', defaultReminderConfig);

  const [clientFilter, setClientFilter] = useState<ClientFilter | null>(null);
  const [taskFilter, setTaskFilter] = useState<{ clientId?: string; taskId?: string } | null>(null);
  const [initialClientData, setInitialClientData] = useState<Partial<Client> | null>(null);
  const [initialTaskData, setInitialTaskData] = useState<Partial<Task> | null>(null);
  const [clientToView, setClientToView] = useState<Client | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const [isSidebarLocked, setIsSidebarLocked] = useLocalStorage<boolean>('sidebarLocked', true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(isSidebarLocked);
  
  const isFirstLoad = useRef(true);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'offline'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carga inicial desde la nube
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
                    setCloudStatus('offline');
                }
            } catch (error) {
                setCloudStatus('offline');
            } finally {
                isFirstLoad.current = false;
            }
        };
        fetchCloudData();
    }
  }, [appState]);

  // Sincronización automática a la nube
  useEffect(() => {
      if (appState !== 'dashboard' || isFirstLoad.current || cloudStatus === 'loading') return;
      const saveData = async () => {
          setCloudStatus('saving');
          try {
              const payload = { clients, tasks, serviceFees, reminderConfig, webOrders, sriCredentials };
              const result = await syncDataToSheet(payload);
              if (result.status === 'offline') setCloudStatus('offline');
              else setCloudStatus('saved');
          } catch (error) {
              setCloudStatus('offline');
          }
      };
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(saveData, 5000); 
      return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [clients, tasks, serviceFees, reminderConfig, webOrders, sriCredentials, appState]); 

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  
  const navigate = (screen: Screen, options: any = {}) => {
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
      case 'home': return <AdminDashboardScreen navigate={navigate} clients={clients} />; 
      case 'clients': return <ClientsScreen clients={clients} setClients={setClients} initialFilter={clientFilter} navigate={navigate} serviceFees={serviceFees} initialClientData={initialClientData} clearInitialClientData={() => setInitialClientData(null)} clientToView={clientToView} clearClientToView={() => setClientToView(null)} sriCredentials={sriCredentials} />;
      case 'tasks': return <TasksScreen tasks={tasks} setTasks={setTasks} clients={clients} setClients={setClients} taskFilter={taskFilter} clearTaskFilter={() => setTaskFilter(null)} serviceFees={serviceFees} initialTaskData={initialTaskData} clearInitialTaskData={() => setInitialTaskData(null)} />;
      case 'calendar': return <CalendarScreen clients={clients} tasks={tasks} navigate={navigate} />;
      case 'reports': return <ReportsScreen clients={clients} tasks={tasks} serviceFees={serviceFees} navigate={navigate} />;
      case 'cobranza': return <CobranzaScreen clients={clients} setClients={setClients} serviceFees={serviceFees} reminderConfig={reminderConfig} />;
      case 'web_orders': return <WebOrdersScreen orders={webOrders} setOrders={setWebOrders} setTasks={setTasks} navigate={navigate} />;
      case 'settings': return <SettingsScreen clients={clients} setClients={setClients} tasks={tasks} setTasks={setTasks} serviceFees={serviceFees} setServiceFees={setServiceFees} reminderConfig={reminderConfig} setReminderConfig={setReminderConfig} webOrders={webOrders} setWebOrders={setWebOrders} sriCredentials={sriCredentials} setSriCredentials={setSriCredentials} navigate={navigate} />;
      default: return <AdminDashboardScreen navigate={navigate} clients={clients} />;
    }
  };

  const navItems = [
    { screen: 'home', icon: Home, label: 'Dashboard' },
    { screen: 'clients', icon: Users, label: 'Clientes' },
    { screen: 'tasks', icon: CheckSquare, label: 'Tareas' },
    { screen: 'web_orders', icon: ShoppingCart, label: 'Pedidos', count: webOrders.filter(o => o.status === 'pending').length },
    { screen: 'calendar', icon: CalendarDays, label: 'Agenda' },
    { screen: 'reports', icon: BarChart, label: 'Reportes' },
    { screen: 'cobranza', icon: BellRing, label: 'Cobros' },
    { screen: 'settings', icon: Settings, label: 'Ajustes' },
  ];

  if (appState === 'services') return <ServicesPage onAdminAccess={() => setAppState('login')} onSubmitOrder={(o) => setWebOrders(p => [...p, o])} onNavigateToHome={() => setAppState('landing')} currentUser={publicUser} onLogin={setPublicUser} onLogout={() => setPublicUser(null)} />;
  if (appState === 'landing') return <LandingPage onAdminAccess={() => setAppState('login')} onNavigateToServices={() => setAppState('services')} currentUser={publicUser} onLogin={setPublicUser} onLogout={() => setPublicUser(null)} />;
  if (appState === 'login') return <LoginScreen onSuccess={handleLoginSuccess} onBack={() => setAppState('landing')} clients={clients} />;
  if (appState === 'client_portal' && loggedClient) return <ClientPortalScreen client={loggedClient} onLogout={() => { setLoggedClient(null); setAppState('landing'); }} serviceFees={serviceFees} />;

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
      <div className="flex-1 flex flex-col min-w-0">
        <header className="hidden md:flex items-center justify-between p-4 px-8 bg-transparent">
             <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm">
                <Clock />
             </div>
             <div className="flex items-center space-x-4">
                <NotificationBell tasks={tasks} clients={clients} navigate={navigate} />
                <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                    {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-sky-600" />}
                </button>
             </div>
        </header>
        <main className="flex-grow p-4 sm:px-8 overflow-y-auto w-full relative">
            <ErrorBoundary>
                {renderScreen()}
            </ErrorBoundary>
        </main>
      </div>
      <Modal isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} title="Cerrar Sesión">
          <div className="text-center p-4">
              <h4 className="text-lg font-bold mb-6">¿Desea salir del panel?</h4>
              <div className="flex space-x-3">
                  <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg">Cancelar</button>
                  <button onClick={handleLogoutConfirm} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold">Sí, Salir</button>
              </div>
          </div>
      </Modal>
    </div>
    </ToastProvider>
  );
};

export default App;