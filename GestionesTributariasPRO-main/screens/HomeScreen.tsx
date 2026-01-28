
import React, { useMemo } from 'react';
import { ArrowRight, UserCheck, Users, Calendar, Clock as ClockIcon, FileText, Receipt } from 'lucide-react';
import { Screen, ClientCategory, ClientFilter, TaxRegime, ServiceFeesConfig, Task, Client } from '../types';

interface HomeScreenProps {
  navigate: (screen: Screen, options?: { clientFilter?: ClientFilter, initialTaskData?: Partial<Task> }) => void;
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
        options?: { clientFilter?: ClientFilter; initialTaskData?: Partial<Task> };
    };
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigate, serviceFees, clients, tasks }) => {
    const allMenuItems = useMemo(() => {
        const menuItems: MenuItem[] = [
          { title: 'Suscripción Mensual IVA', description: 'Clientes con suscripción mensual de IVA.', icon: UserCheck, navigation: { screen: 'clients', options: { clientFilter: { category: ClientCategory.SuscripcionMensual, title: 'Suscripción Mensual IVA' } } } },
          { title: 'Interno Mensual IVA', description: 'Clientes que avisan para su declaración mensual.', icon: Users, navigation: { screen: 'clients', options: { clientFilter: { category: ClientCategory.InternoMensual, title: 'Interno Mensual IVA' } } } },
          { title: 'Suscripción Semestral IVA', description: 'Declaraciones de IVA semestrales por suscripción.', icon: Calendar, navigation: { screen: 'clients', options: { clientFilter: { category: ClientCategory.SuscripcionSemestral, title: 'Suscripción Semestral IVA' } } } },
          { title: 'Interno Semestral IVA', description: 'Declaración Semestral Iva.', icon: ClockIcon, navigation: { screen: 'clients', options: { clientFilter: { category: ClientCategory.InternoSemestral, title: 'Interno Semestral IVA' } } } },
          { title: 'Impuesto a la Renta', description: 'RIMPE Negocio Popular.', icon: FileText, navigation: { screen: 'clients', options: { clientFilter: { category: ClientCategory.ImpuestoRentaNegocioPopular, title: 'Impuesto a la Renta (Negocio Popular)' } } } },
          { 
            title: 'Impuesto a la Renta', 
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
            description: 'Gestión mensual de devolución de IVA para 3ra edad.', 
            icon: Receipt,
            navigation: { 
                screen: 'clients',
                options: { 
                    clientFilter: { 
                        category: ClientCategory.DevolucionIvaTerceraEdad, 
                        title: 'Devolución IVA 3ra Edad' 
                    } 
                }
            }
          },
          { 
            title: 'Devolución Retenciones', 
            description: 'Devolución de valor de retención sin fuente de Imp. Renta.', 
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
            description: 'Recopilar y presentar anexo de gastos personales.',
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
