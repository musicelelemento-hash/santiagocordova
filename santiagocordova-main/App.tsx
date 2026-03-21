
import React, { useState, useEffect, useRef } from 'react';
import { Home, Users, CheckSquare, BarChart, Settings, Sun, Moon, BellRing, CalendarDays, ShoppingCart, RefreshCw, AlertTriangle, LogOut } from 'lucide-react';
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
import { PublicVaultScreen } from './screens/PublicVaultScreen';
import { Clock } from './components/Clock';
import { NotificationBell } from './components/NotificationBell';
import { Sidebar } from './components/Sidebar';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Client, Task, Screen, Theme, ClientFilter, ServiceFeesConfig, ReminderConfig, WebOrder, PublicUser } from './types';
import { useAppStore } from './store/useAppStore';
import { loadDataFromSheet, syncDataToSheet, autoBackupToSheets } from './services/sheetApi';
import { Modal } from './components/Modal';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';

type AppState = 'landing' | 'login' | 'dashboard' | 'services' | 'client_portal' | 'public_vault';

const App: React.FC = () => {
  // Global Store
  const { clients, setClients, tasks, setTasks, loadFromDB, isLoaded } = useAppStore();

  const [appState, setAppState] = useState<AppState>(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'vault' && params.get('id') && params.get('token')) return 'public_vault';
      const isAdminLoggedIn = localStorage.getItem('sc_pro_admin_session') === 'true';
      const path = window.location.pathname;
      if (path === '/admin' || path === '/dashboard') return isAdminLoggedIn ? 'dashboard' : 'login';
      if (path === '/services') return 'services';
      return 'landing';
  });

  const [theme, setTheme] = useLocalStorage<Theme>('theme', 'light');
  const [activeScreen, setActiveScreen] = useState<Screen>('home');
  const [isSidebarLocked, setIsSidebarLocked] = useLocalStorage<boolean>('sidebarLocked', true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(isSidebarLocked);
  
  const [clientFilter, setClientFilter] = useState<ClientFilter | null>(null);
  const [taskFilter, setTaskFilter] = useState<{ clientId?: string; taskId?: string } | null>(null);
  const [initialClientData, setInitialClientData] = useState<Partial<Client> | null>(null);
  const [initialTaskData, setInitialTaskData] = useState<Partial<Task> | null>(null);
  const [clientToView, setClientToView] = useState<Client | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error' | 'offline'>('idle');
  const isFirstLoad = useRef(true);

  // Inicialización de Datos
  useEffect(() => {
    loadFromDB();
  }, []);

  // Carga desde la Nube
  useEffect(() => {
    if (appState === 'dashboard' && isLoaded && isFirstLoad.current) {
        const fetchCloudData = async () => {
            setCloudStatus('loading');
            try {
                const result = await loadDataFromSheet();
                if (result.status === 'success' && result.data) {
                    if (result.data.clients) setClients(result.data.clients);
                    if (result.data.tasks) setTasks(result.data.tasks);
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
  }, [appState, isLoaded]);

  const navigate = (screen: Screen, options: any = {}) => {
    setActiveScreen(screen);
    setClientFilter(options.clientFilter || null);
    setTaskFilter(options.taskFilter || null);
    setInitialClientData(options.initialClientData || null);
    setInitialTaskData(options.initialTaskData || null);
    
    if (options.clientIdToView) {
        // CORRECCIÓN: Buscamos en el estado más reciente del store para evitar undefined
        const currentClients = useAppStore.getState().clients;
        const found = currentClients.find(c => c.id === options.clientIdToView);
        setClientToView(found || null);
    } else {
        setClientToView(null);
    }
  };
  
  const handleLoginSuccess = (role: 'admin' | 'client', clientData?: Client) => {
      if (role === 'admin') {
          localStorage.setItem('sc_pro_admin_session', 'true'); 
          setAppState('dashboard');
      }
  };

  const renderScreen = () => {
    if (!isLoaded) return <div className="flex items-center justify-center h-full"><RefreshCw className="animate-spin text-brand-teal" size={32}/></div>;
    
    switch (activeScreen) {
      case 'home': return <AdminDashboardScreen navigate={navigate} clients={clients} />; 
      case 'clients': return <ClientsScreen clients={clients} setClients={setClients} initialFilter={clientFilter} navigate={navigate} serviceFees={useAppStore.getState().serviceFees} initialClientData={initialClientData} clearInitialClientData={() => setInitialClientData(null)} clientToView={clientToView} clearClientToView={() => setClientToView(null)} />;
      case 'tasks': return <TasksScreen tasks={tasks} setTasks={setTasks} clients={clients} setClients={setClients} taskFilter={taskFilter} clearTaskFilter={() => setTaskFilter(null)} serviceFees={useAppStore.getState().serviceFees} initialTaskData={initialTaskData} clearInitialTaskData={() => setInitialTaskData(null)} />;
      case 'calendar': return <CalendarScreen clients={clients} tasks={tasks} navigate={navigate} />;
      case 'reports': return <ReportsScreen clients={clients} tasks={tasks} serviceFees={useAppStore.getState().serviceFees} navigate={navigate} />;
      case 'cobranza': return <CobranzaScreen clients={clients} setClients={setClients} serviceFees={useAppStore.getState().serviceFees} reminderConfig={useAppStore.getState().reminderConfig} />;
      case 'settings': return <SettingsScreen clients={clients} setClients={setClients} tasks={tasks} setTasks={setTasks} serviceFees={useAppStore.getState().serviceFees} setServiceFees={() => {}} reminderConfig={useAppStore.getState().reminderConfig} setReminderConfig={() => {}} webOrders={[]} setWebOrders={() => {}} navigate={navigate} />;
      default: return <AdminDashboardScreen navigate={navigate} clients={clients} />;
    }
  };

  const navItems = [
    { screen: 'home', icon: Home, label: 'Dashboard' },
    { screen: 'clients', icon: Users, label: 'Clientes' },
    { screen: 'tasks', icon: CheckSquare, label: 'Tareas' },
    { screen: 'calendar', icon: CalendarDays, label: 'Agenda' },
    { screen: 'reports', icon: BarChart, label: 'Reportes' },
    { screen: 'cobranza', icon: BellRing, label: 'Cobros' },
    { screen: 'settings', icon: Settings, label: 'Ajustes' },
  ];

  if (appState === 'login') return <LoginScreen onSuccess={handleLoginSuccess} onBack={() => setAppState('landing')} clients={clients} />;

  return (
    <ToastProvider>
      <div className={`font-body min-h-screen flex ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'} text-slate-800 dark:text-slate-100`}>
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
          <header className="hidden md:flex items-center justify-between p-4 px-8">
               <Clock />
               <div className="flex items-center space-x-4">
                  <NotificationBell tasks={tasks} clients={clients} navigate={navigate} />
                  <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800">
                      {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-sky-600" />}
                  </button>
               </div>
          </header>
          <main className="flex-grow p-4 sm:px-8 overflow-y-auto">
              <ErrorBoundary>
                  {renderScreen()}
              </ErrorBoundary>
          </main>
        </div>
        <Modal isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} title="Cerrar Sesión">
            <div className="text-center p-4">
                <h4 className="text-lg font-bold mb-6">¿Desea salir del panel?</h4>
                <div className="flex space-x-3">
                    <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg">Cancelar</button>
                    <button onClick={() => { localStorage.removeItem('sc_pro_admin_session'); window.location.reload(); }} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold">Sí, Salir</button>
                </div>
            </div>
        </Modal>
      </div>
    </ToastProvider>
  );
};

export default App;
