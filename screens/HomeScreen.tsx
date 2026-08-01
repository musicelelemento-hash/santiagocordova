
import React, { useMemo } from 'react';
import { ArrowRight, UserCheck, Users, Calendar, Clock as ClockIcon, FileText, Receipt, UserPlus, Gift, Activity, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Screen, ClientFilter, TaxRegime, ServiceFeesConfig, Task, Client } from '../types';
import { differenceInCalendarDays } from 'date-fns';
import { DashboardMissingMatrixLines } from '../components/features/DashboardMissingMatrixLines';

interface HomeScreenProps {
  navigate: (screen: Screen, options?: { clientFilter?: ClientFilter, initialTaskData?: Partial<Task>, initialClientData?: Partial<Client> }) => void;
  serviceFees: ServiceFeesConfig;
  clients: Client[];
  tasks: Task[];
}

interface MenuItem {
    title: string;
    description: string;
    icon: React.ElementType;
    navigation: {
        screen: Screen;
        options?: { clientFilter?: ClientFilter; initialTaskData?: Partial<Task>; initialClientData?: Partial<Client> };
    };
    highlight?: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigate, serviceFees, clients, tasks }) => {
    const allMenuItems = useMemo(() => {
        const menuItems: MenuItem[] = [
          { 
            title: 'Protocolo: Nuevo Cliente', 
            description: 'Inscripción de activos y despliegue de perfiles fiscales.', 
            icon: UserPlus, 
            navigation: { 
                screen: 'clients', 
                options: { initialClientData: {} } 
            } 
          },
          { title: 'IVA Mensual', description: 'Monitoreo y liquidación de flujos mensuales.', icon: UserCheck, navigation: { screen: 'clients', options: { clientFilter: { ivaFrequency: 'Mensual', title: 'Clientes IVA Mensual' } } } },
          { title: 'IVA Semestral', description: 'Consolidación táctica de periodos semestrales.', icon: Calendar, navigation: { screen: 'clients', options: { clientFilter: { ivaFrequency: 'Semestral', title: 'Clientes IVA Semestral' } } } },
          { title: 'Renta (NP)', description: 'RIMPE Negocio Popular: Gestión de base.', icon: FileText, navigation: { screen: 'clients', options: { clientFilter: { regimes: [TaxRegime.RimpeNegocioPopular], title: 'Impuesto a la Renta (Negocio Popular)' } } } },
          { 
            title: 'Impuesto a la Renta', 
            description: 'Operaciones General y RIMPE Emprendedor.', 
            icon: FileText, 
            navigation: { 
              screen: 'clients',
              options: {
                clientFilter: { 
                  regimes: [TaxRegime.General, TaxRegime.RimpeEmprendedor],
                  title: 'Impuesto a la Renta (General y Emprendedor)' 
                } 
              }
            } 
          },
          { 
            title: 'Devolución IVA 3ra Edad', 
            description: 'Recuperación de activos para sector senior.', 
            icon: Receipt,
            navigation: { 
                screen: 'clients',
                options: { 
                    clientFilter: { 
                        hasActiveDevolucionIva: true, 
                        title: 'Devolución IVA 3ra Edad' 
                    } 
                }
            }
          },
          {
            title: 'Combo Renta Total',
            description: 'Anexo + Devolución + Declaración (Pack $25).',
            icon: Gift,
            highlight: true,
            navigation: {
                screen: 'tasks',
                options: {
                    initialTaskData: {
                        title: 'Combo Devolución Impuesto a la Renta',
                        description: `SERVICIO COMBO ($25.00) INCLUYE:
1. Elaboración Anexo de Gastos Personales.
2. Trámite de Devolución de Impuesto a la Renta.
3. Declaración de Impuesto a la Renta.`,
                        cost: 25.00
                    }
                }
            }
          },
          { 
            title: 'Devolución Retenciones', 
            description: 'Extracción de valores retenidos en la fuente.', 
            icon: Receipt,
            navigation: { 
                screen: 'tasks',
                options: {
                    initialTaskData: {
                        title: 'Devolución Retenciones',
                        description: 'Preparar y presentar solicitud de devolución de retenciones en la fuente de Impuesto a la Renta.',
                        cost: serviceFees.devolucionRenta,
                    }
                }
            }
          },
          { 
            title: 'Anexo Gastos Personales', 
            description: 'Consolidación de egresos deducibles.',
            icon: FileText,
            navigation: {
                screen: 'tasks',
                options: {
                    initialTaskData: {
                        title: 'Anexo Gastos Personales',
                        description: 'Recopilar y presentar el anexo de gastos personales para el cliente.',
                        cost: serviceFees.anexoGastosPersonales,
                    }
                }
            }
          },
        ];

        const customItems: MenuItem[] = (serviceFees.customPunctualServices || []).map(service => ({
          title: service.name,
          description: 'Despliegue de servicio táctico personalizado.',
          icon: Receipt,
          navigation: {
            screen: 'tasks',
            options: {
              initialTaskData: {
                title: service.name,
                cost: service.price,
                description: `Realizar trámite: ${service.name}.`
              }
            }
          }
        }));
        return [...menuItems, ...customItems];
    }, [navigate, serviceFees]);

    const expiringClients = useMemo(() => {
        const today = new Date();
        const alertDays = 30;
        return clients.filter(c => {
            let isExpiring = false;
            if (c.signatureExpirationDate) {
                const diff = differenceInCalendarDays(new Date(c.signatureExpirationDate), today);
                if (diff <= alertDays) isExpiring = true;
            }
            if (c.facturadorConfig?.expirationDate) {
                const diff = differenceInCalendarDays(new Date(c.facturadorConfig.expirationDate), today);
                if (diff <= alertDays) isExpiring = true;
            }
            return isExpiring;
        });
    }, [clients]);

  return (
    <div className="space-y-8 pb-32 animate-fade-in relative aurora-premium min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 px-1 sm:px-0 mb-4">
          <div className="animate-fade-in-left w-full sm:w-auto">
              <div className="flex items-center justify-between sm:justify-start gap-2 mb-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Command Center Online</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest opacity-50 sm:block hidden">• HQ Terminal v3.0</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-display font-semibold text-slate-900 dark:text-white leading-[0.85] tracking-tighter mb-2 italic">
                  Menú <span className="text-gradient-sky">Principal</span>
              </h2>
              <div className="flex items-center gap-2 text-slate-500 text-[11px] font-medium uppercase tracking-widest">
                  <Activity size={12} className="text-sky-400" />
                  <span>Navegación Táctica de Operaciones</span>
              </div>
          </div>

          {/* RADAR DE VENCIMIENTOS WIDGET */}
          {expiringClients.length > 0 && (
              <div 
                  onClick={() => navigate('clients', { clientFilter: { needsAttention: true, title: 'Atención: Vencimientos' } })}
                  className="w-full sm:w-auto animate-slide-up-fade bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl cursor-pointer hover:bg-rose-500/20 transition-all group flex items-center gap-4"
              >
                  <div className="bg-rose-500/20 p-3 rounded-xl text-rose-400 group-hover:scale-110 group-hover:rotate-12 transition-transform shadow-[0_0_15px_rgba(244,63,94,0.4)]">
                      <ShieldAlert size={24} strokeWidth={2} />
                  </div>
                  <div>
                      <h3 className="text-rose-400 font-bold text-sm uppercase tracking-wider mb-0.5">Radar de Vencimientos</h3>
                      <p className="text-slate-400 text-xs font-medium">
                          <strong className="text-slate-200">{expiringClients.length}</strong> {expiringClients.length === 1 ? 'cliente requiere' : 'clientes requieren'} renovación urgente
                      </p>
                  </div>
                  <ArrowRight size={18} className="text-rose-400/50 group-hover:text-rose-400 group-hover:translate-x-1 transition-all ml-2" />
              </div>
          )}
      </div>

      {/* CAMPAÑA ACTIVA Y LÍNEAS DE MATRIZ DE CLIENTES FALTANTES */}
      <DashboardMissingMatrixLines
          clients={clients}
          navigate={navigate}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
        {allMenuItems.map((item, index) => (
          <div
            key={item.title + index}
            className={`group relative p-8 rounded-[2.5rem] glass-tactical border border-white/5 transition-all duration-500 hover:bg-white/10 hover:border-sky-400/30 cursor-pointer overflow-hidden animate-slide-up-fade ${item.highlight ? 'border-sky-400/30 bg-sky-400/5 shadow-2xl shadow-sky-400/10' : ''}`}
            onClick={() => navigate(item.navigation.screen, item.navigation.options)}
            style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}
          >
            {/* Background Accent */}
            <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full -mr-16 -mt-16 transition-all duration-700 group-hover:scale-150 opacity-10 ${item.highlight ? 'bg-sky-400' : 'bg-slate-500'}`}></div>
            
            {item.highlight && (
                <div className="absolute top-0 right-0 bg-sky-500 text-white text-[11px] font-semibold px-4 py-1.5 rounded-bl-[1.5rem] uppercase tracking-widest shadow-xl z-20">
                    OFERTA ALPHA
                </div>
            )}

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div className={`p-4 rounded-2xl shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${item.title.includes('Nuevo') ? 'bg-emerald-400 text-white shadow-emerald-400/20' : item.highlight ? 'bg-sky-400 text-white shadow-sky-400/20' : 'bg-white/5 text-sky-400 border border-white/10'}`}>
                        <item.icon size={26} strokeWidth={2.5} />
                    </div>
                </div>

                <div className="mb-6">
                    <h3 className="text-xl font-display font-semibold text-slate-900 dark:text-white tracking-tight mb-2 uppercase group-hover:text-sky-400 transition-colors">
                        {item.title}
                    </h3>
                    <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity whitespace-pre-wrap">
                        {item.description}
                    </p>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-white/5 transition-all group-hover:border-sky-400/20">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest hidden sm:inline">EJECUTAR PROTOCOLO</span>
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/5 group-hover:border-sky-400/30 transition-all">
                        <ArrowRight size={20} className="text-slate-400 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
                    </div>
                </div>
            </div>

            {/* Interactive Grid Overlay */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none group-hover:opacity-[0.05] transition-opacity"></div>
          </div>
        ))}
      </div>

      {/* Decorative Tactical Elements */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-sky-400/5 dark:bg-sky-400/5 blur-[160px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-400/5 dark:bg-emerald-400/5 blur-[140px] rounded-full pointer-events-none"></div>
    </div>
  );
};