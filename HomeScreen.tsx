
import React, { useMemo } from 'react';
import { ArrowRight, UserCheck, Users, Calendar, Clock as ClockIcon, FileText, Receipt } from 'lucide-react';
import { Screen, ClientFilter, TaxRegime, ServiceFeesConfig, Task } from './types';

interface HomeScreenProps {
  navigate: (screen: Screen, options?: { clientFilter?: ClientFilter, initialTaskData?: Partial<Task> }) => void;
  serviceFees: ServiceFeesConfig;
}

interface MenuItem {
    title: string;
    description: string;
    icon: React.ElementType;
    navigation: {
        screen: Screen;
        options?: { clientFilter?: ClientFilter; initialTaskData?: Partial<Task> };
    };
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigate, serviceFees }) => {
    const allMenuItems = useMemo(() => {
        const menuItems: MenuItem[] = [
          { title: 'Gestión Mensual IVA', description: 'Clientes con obligaciones de IVA mensuales (Suscripción VIP).', icon: UserCheck, navigation: { screen: 'clients', options: { clientFilter: { ivaFrequency: 'Mensual', title: 'Gestión Mensual IVA' } } } },
          { title: 'Gestión Semestral IVA', description: 'Clientes con obligaciones de IVA semestrales (Suscripción VIP).', icon: Calendar, navigation: { screen: 'clients', options: { clientFilter: { ivaFrequency: 'Semestral', title: 'Gestión Semestral IVA' } } } },
          { title: 'Impuesto a la Renta (NP)', description: 'RIMPE Negocio Popular.', icon: FileText, navigation: { screen: 'clients', options: { clientFilter: { regimes: [TaxRegime.RimpeNegocioPopular], title: 'Impuesto a la Renta (NP)' } } } },
          { 
            title: 'Impuesto a la Renta (G/E)', 
            description: 'General y RIMPE Emprendedor.', 
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
            description: 'Gestión mensual de devolución de IVA.', 
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
            title: 'Trámites Puntuales', 
            description: 'Devolución de retenciones y anexos.', 
            icon: Receipt,
            navigation: { 
                screen: 'tasks',
                options: {
                    initialTaskData: {
                        title: 'Nuevo Trámite',
                        description: 'Gestión de trámite puntual para el cliente.',
                    }
                }
            }
          },
        ];

        const customItems: MenuItem[] = (serviceFees.customPunctualServices || []).map(service => ({
          title: service.name,
          description: 'Servicio y tarea puntual personalizada.',
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

  return (
    <div>
      <h2 className="text-3xl lg:text-4xl font-display text-gold mb-6 tracking-wide">Menú Principal</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {allMenuItems.map((item, index) => (
          <div
            key={item.title + index}
            className="p-6 rounded-lg shadow-lg cursor-pointer bg-white dark:from-gray-800 dark:to-gray-900 dark:bg-gradient-to-br hover:shadow-gold/20 transition-all duration-300 transform hover:-translate-y-1 group animate-slide-up-fade"
            onClick={() => navigate(item.navigation.screen, item.navigation.options)}
            style={{ animationDelay: `${index * 80}ms`, opacity: 0 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <item.icon className="w-8 h-8 text-gold" />
                <div>
                  <h3 className="text-xl font-bold font-body text-gray-800 dark:text-white">{item.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{item.description}</p>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400 dark:text-gray-500 transition-transform duration-300 group-hover:translate-x-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
