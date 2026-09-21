import { supabase } from './supabase';
import { Client, TaxRegime, RentaCategory, DeclarationStatus } from '../types/client';
import { Task, TaskStatus } from '../types/task';
import { AuditLog } from '../types';

/**
 * Columnas REALES de `public.clients`, verificadas una por una contra el
 * proyecto (08-sep-2026). Cualquier clave que no esté acá hace que PostgREST
 * rechace el payload ENTERO:
 *
 *   400 PGRST204  Could not find the 'client_type' column of 'clients'
 *                 in the schema cache
 *
 * No descarta el campo malo: aborta la operación completa. Por eso el guardado,
 * el borrado a papelera, la restauración y la purga no llegaban nunca a la
 * nube (el cliente solo vivía en el IndexedDB del navegador).
 *
 * Las columnas que NO existen en la tabla (client_type, requires_declarations,
 * facturador_config, facturador_activation_status, signature_provider,
 * id_card_front/back/selfie, ecuafact_signed_request) viajan dentro de
 * `tax_profile`, que sí existe y que la extensión Nueva Luz ya sabe leer
 * (`c.client_type || c.clientType || tp.clientType`).
 *
 * Si algún día se crea una columna nueva en la base, sumarla también acá.
 */
const CLIENT_TABLE_COLUMNS: readonly string[] = [
  'id', 'ruc', 'name', 'trade_name', 'sri_password', 'phones', 'email', 'address',
  'notes', 'regime', 'is_vip', 'renta_category', 'economic_activity', 'is_active',
  'is_deleted', 'tax_profile', 'fee_structure', 'custom_service_fee', 'is_artisan',
  'establishment_count', 'jurisdiction', 'signature_password', 'iess_password',
  'signature_expiration', 'advance_credits', 'declaration_history', 'vault',
  'structured_notes', 'signature_file', 'ruc_pdf', 'ruc_certificate',
  'has_renta_refund', 'renta_refund_amount', 'renta_refund_status',
  'renta_refund_requested_at', 'renta_refund_paid', 'renta_refund_proof',
  'has_elderly_devolucion_iva', 'elderly_devolucion_iva_status',
  'elderly_devolucion_iva_paid', 'elderly_devolucion_iva_resolution_file',
  'renta_refund_resolution_file', 'renta_refund_confirmation_started_at',
  'renta_refund_confirmation_deadline', 'created_at', 'updated_at',
];

/**
 * Deja solo claves que existen en la tabla. Es la red que impide que una
 * columna inventada (o una columna borrada en la base) tumbe el guardado
 * completo en silencio. Lo que se omite queda GRITADO en consola.
 */
const sanitizeClientPayload = (payload: Record<string, any>, contexto: string): Record<string, any> => {
  const limpio: Record<string, any> = {};
  const omitidas: string[] = [];
  for (const clave of Object.keys(payload)) {
    if (CLIENT_TABLE_COLUMNS.includes(clave)) limpio[clave] = payload[clave];
    else omitidas.push(clave);
  }
  if (omitidas.length > 0) {
    console.warn(
      `[clients] ${contexto}: se omiten claves que no existen en la tabla ` +
      `(romperían el guardado con 400 PGRST204): ${omitidas.join(', ')}`
    );
  }
  return limpio;
};

/** Mensaje legible de un error de Supabase/PostgREST, con su código. */
const describirError = (err: any): string => {
  if (!err) return 'error desconocido';
  const code = err.code ? `${err.code} · ` : '';
  return `${code}${err.message || err.details || String(err)}`;
};

/**
 * Service to handle data operations with Supabase.
 * Maps between frontend CamelCase types and DB snake_case tables.
 */
export const SupabaseService = {
  // --- Clients ---
  
  async getClients(): Promise<Client[]> {
    // Intento 1: consulta ideal — todas las columnas + declaraciones.
    //
    // A PROPÓSITO no se filtra por `.eq('is_deleted', false)` acá: el resto
    // del código (TaxComplianceMatrix, ClientsScreen, la Papelera) ya filtra
    // por `isDeleted` del lado del cliente. Filtrar en el SQL tenía dos
    // costos escondidos: (1) un cliente recién dado de baja en OTRO
    // dispositivo desaparecía de la Papelera acá, porque `loadFromDB`
    // reemplaza el estado local con lo que vuelve de esta consulta — nunca
    // llegaba a existir localmente para poder mostrarse borrado; y (2) forzaba
    // a que la única señal de "¿está borrado?" viniera de un WHERE en vez de
    // una columna, así que una lectura degradada (ver abajo) no tenía forma
    // de pedir "todos, con o sin baja" — o filtraba mal, o no filtraba nada.
    let { data, error } = await supabase
      .from('clients')
      .select('*, sri_declaraciones(*)');

    // Intento 2+: el rol `anon` no tiene permiso sobre varias columnas de
    // `clients` (sri_password, notes, structured_notes, is_deleted…), así que
    // `select('*')` responde 401/42501 SIEMPRE. Se degrada a pedir solo lo que
    // sí puede leer, intentando conservar `is_deleted`/`is_active`: sin ellos
    // las bajas de la papelera vuelven a la lista como si estuvieran activas
    // (la protección real contra eso vive en useAppStore.loadFromDB, que mira
    // si esta consulta trajo el dato CRUDO antes de confiar en él).
    if (error) {
      console.warn('[SupabaseService] getClients: la consulta completa falló, se degrada la lectura:', describirError(error));

      const lecturasDegradadas = [
        'id, ruc, name, regime, tax_profile, declaration_history, updated_at, is_deleted, is_active, sri_declaraciones(*)',
        'id, ruc, name, regime, tax_profile, declaration_history, updated_at, is_deleted, sri_declaraciones(*)',
        'id, ruc, name, regime, tax_profile, declaration_history, updated_at, sri_declaraciones(*)',
      ];

      for (const columnas of lecturasDegradadas) {
        const intento = await supabase.from('clients').select(columnas);
        if (!intento.error) {
          data = intento.data;
          error = null;
          console.warn(`[SupabaseService] getClients: lectura degradada aceptada (${columnas.includes('is_deleted') ? 'con' : 'SIN'} is_deleted).`);
          break;
        }
      }

      if (error) throw error;
    }

    return (data || []).map(d => this.mapClientFromDb(d));
  },

  async upsertClient(client: Client): Promise<void> {
    const mappedClient = sanitizeClientPayload(this.mapClientToDb(client), `guardando ${client.ruc || client.id}`);

    // Intento 1 (camino normal): upsert por RUC.
    let { error } = await supabase
      .from('clients')
      .upsert(mappedClient, { onConflict: 'ruc' });

    if (error) {
      const code = (error as any).code || '';
      const msg = error.message || '';
      const conflictoInvalido = code === '42P10' || /no unique or exclusion constraint/i.test(msg);
      const columnaDesconocida = code === 'PGRST204' || code === '42703' || /schema cache|does not exist/i.test(msg);

      if (conflictoInvalido) {
        // La base no tiene un único sobre `ruc`: se resuelve a mano sin perder el guardado.
        console.warn(`[clients] ${client.ruc}: upsert por RUC no soportado (${describirError(error)}); se usa UPDATE + INSERT.`);
        const { data: existente } = await supabase
          .from('clients')
          .select('id')
          .eq('ruc', client.ruc)
          .maybeSingle();

        const reintento = existente?.id
          ? await supabase.from('clients').update(mappedClient).eq('id', existente.id)
          : await supabase.from('clients').insert(mappedClient);
        error = reintento.error;
      } else if (columnaDesconocida) {
        console.error(
          `[clients] ${client.ruc}: el payload trae una columna fuera de CLIENT_TABLE_COLUMNS. ` +
          `Revisar mapClientToDb() — la base no la conoce y rechaza el guardado completo.`,
          describirError(error)
        );
      }
    }

    if (error) {
      console.error(`[Supabase Error] FAILED upsert for client ${client.ruc}:`, describirError(error));
      throw error;
    }

    // Sincronizar array 'declarations' hacia la tabla relacional sri_declaraciones
    if (client.declarations && client.declarations.length > 0) {
        // ELITE FIX: Upsert individual por declaración para evitar fallos silenciosos de bulk
        for (const dec of client.declarations) {
            if (!dec || !dec.period) continue;

            const decType = dec.type || (dec.period?.includes('ANEXO') ? 'ANEXO' : (dec.period?.length === 7 ? 'IVA' : 'RENTA'));

            // CRITICAL FIX: Solo crear sanitizedProofFile si tiene url o content REAL
            let sanitizedProofFile = null;
            if (dec.proof_file) {
                const hasUrl = !!dec.proof_file.url;
                const hasContent = typeof dec.proof_file.content === 'string' && dec.proof_file.content.length > 100;
                if (hasUrl || hasContent) {
                    sanitizedProofFile = {
                        name: dec.proof_file.name || `declaracion_${decType}_${dec.period}.pdf`,
                        type: dec.proof_file.type || 'pdf',
                        size: dec.proof_file.size || 0,
                        lastModified: dec.proof_file.lastModified || Date.now(),
                        url: dec.proof_file.url || (hasContent && dec.proof_file.content!.startsWith('http') ? dec.proof_file.content : null),
                        content: hasUrl ? null : (hasContent ? dec.proof_file.content : null),
                        metadata: dec.proof_file.metadata || {}
                    };
                }
            }

            let record: Record<string, any> = {
                client_id: client.id,
                type: decType,
                period: dec.period,
                status: dec.status || 'Pendiente',
                is_paid: !!dec.is_paid,
                paid_at: dec.paidAt || null,
                proof_file: sanitizedProofFile,
                is_notified_whatsapp: !!dec.isNotifiedWhatsApp,
                notified_whatsapp_at: dec.notifiedWhatsAppAt || null,
                created_at: dec.declaredAt || new Date().toISOString(),
                updated_at: dec.updatedAt || new Date().toISOString()
            };

            // Solo enviar notification_count si tiene valor
            if (dec.notificationCount !== undefined && dec.notificationCount !== null) {
                record.notification_count = dec.notificationCount;
            }

            try {
                const executeUpsert = async (payload: any) => {
                    // Intento 1: upsert con constraint (client_id, type, period)
                    let { error: e1 } = await supabase
                        .from('sri_declaraciones')
                        .upsert(payload, { onConflict: 'client_id,type,period' });

                    // Si falla por columna inexistente (42703 / notification_count), reintentar sin ella
                    if (e1 && (e1.code === '42703' || e1.message?.includes('notification_count'))) {
                        const { notification_count, ...stripped } = payload;
                        payload = stripped;
                        const retry = await supabase
                            .from('sri_declaraciones')
                            .upsert(payload, { onConflict: 'client_id,type,period' });
                        e1 = retry.error;
                    }

                    if (e1) {
                        console.warn(`[sri_declaraciones] upsert (3-col) failed for ${dec.period}/${decType}:`, e1.message);
                        // Intento 2: upsert con constraint (client_id, period)
                        let { error: e2 } = await supabase
                            .from('sri_declaraciones')
                            .upsert(payload, { onConflict: 'client_id,period' });

                        if (e2 && (e2.code === '42703' || e2.message?.includes('notification_count'))) {
                            const { notification_count, ...stripped } = payload;
                            payload = stripped;
                            const retry = await supabase
                                .from('sri_declaraciones')
                                .upsert(payload, { onConflict: 'client_id,period' });
                            e2 = retry.error;
                        }

                        if (e2) {
                            console.warn(`[sri_declaraciones] upsert (2-col) failed for ${dec.period}:`, e2.message);
                            // Intento 3: SELECT + UPDATE manual (máxima compatibilidad)
                            const { data: existing } = await supabase
                                .from('sri_declaraciones')
                                .select('id')
                                .eq('client_id', client.id)
                                .eq('period', dec.period)
                                .eq('type', decType)
                                .maybeSingle();

                            if (existing?.id) {
                                const updatePayload = sanitizedProofFile
                                    ? payload
                                    : { ...payload, proof_file: undefined };
                                const { error: uErr } = await supabase.from('sri_declaraciones').update(updatePayload).eq('id', existing.id);
                                if (uErr && (uErr.code === '42703' || uErr.message?.includes('notification_count'))) {
                                    const { notification_count, ...cleanUpdate } = updatePayload;
                                    await supabase.from('sri_declaraciones').update(cleanUpdate).eq('id', existing.id);
                                }
                            } else {
                                const { error: iErr } = await supabase.from('sri_declaraciones').insert(payload);
                                if (iErr && (iErr.code === '42703' || iErr.message?.includes('notification_count'))) {
                                    const { notification_count, ...cleanInsert } = payload;
                                    await supabase.from('sri_declaraciones').insert(cleanInsert);
                                }
                            }
                        }
                    }
                };

                await executeUpsert(record);
            } catch (decErr) {
                console.error(`[sri_declaraciones] Error crítico sincronizando ${dec.period}/${decType}:`, decErr);
            }
        }
    }

    // Upsert Billing Plan
    if (client.billingPlan || client.facturadorConfig) {
      const plan = client.billingPlan || client.facturadorConfig;
      const { error: planError } = await supabase
        .from('billing_plans')
        .upsert({
          client_id: client.id,
          program_name: plan?.programName,
          url: plan?.url,
          username: plan?.username,
          password: plan?.password,
          expiration_date: plan?.expirationDate,
          document_status: plan?.documentStatus,
          document_count: plan?.documentCount,
          price: plan?.price,
          sold_by_me: plan?.soldByMe,
          provider_name: plan?.providerName,
          free_support_and_cancellation: plan?.freeSupportAndCancellation,
          updated_at: new Date().toISOString()
        }, { onConflict: 'client_id' });
      
      if (planError) {
        console.error(`[Supabase Error] FAILED upserting billing_plans for ${client.ruc}:`, planError);
      }
    }
  },

  async bulkUpsertClients(clients: Client[]): Promise<void> {
    if (!clients || clients.length === 0) return;

    const dbClients = clients.map(c => sanitizeClientPayload(this.mapClientToDb(c), `guardando ${c.ruc || c.id}`));
    const { error } = await supabase
      .from('clients')
      .upsert(dbClients, { onConflict: 'ruc' });

    if (!error) return;

    // Sin único sobre `ruc`, o con una fila problemática dentro del lote, la
    // ráfaga entera se perdía en silencio. Se reintenta registro por registro
    // para que uno malo no tumbe a los otros 156.
    console.warn(`[clients] bulk upsert falló (${describirError(error)}); se reintenta por registro.`);
    const fallos: string[] = [];
    for (const c of clients) {
      try {
        await this.upsertClient(c);
      } catch (e: any) {
        fallos.push(`${c.ruc || c.id}: ${describirError(e)}`);
      }
    }

    if (fallos.length === clients.length) {
      throw new Error(`No se pudo guardar ningún cliente (${fallos.length} intentos). Primer error → ${fallos[0]}`);
    }
    if (fallos.length > 0) {
      console.warn(`[clients] ${fallos.length} de ${clients.length} clientes no se guardaron en la nube:`, fallos);
    }
  },

  async deleteClient(id: string): Promise<void> {
    console.log(`[Supabase] Eliminando cliente y registros dependientes: ${id}...`);

    // Las tablas dependientes se limpian best-effort: pueden no tener filas o
    // no permitir DELETE según el rol, y eso no debe impedir borrar al cliente.
    const dependientes: Array<[string, PromiseLike<{ error: any }>]> = [
      ['sri_declaraciones', supabase.from('sri_declaraciones').delete().eq('client_id', id)],
      ['billing_plans', supabase.from('billing_plans').delete().eq('client_id', id)],
    ];
    for (const [tabla, operacion] of dependientes) {
      try {
        const { error } = await operacion;
        if (error) console.warn(`[Supabase] ${tabla} no se pudo limpiar para ${id}: ${describirError(error)}`);
      } catch (e) {
        console.warn(`[Supabase] ${tabla} no se pudo limpiar para ${id}:`, e);
      }
    }

    // El borrado del cliente SÍ se verifica. PostgREST responde 204 sin error
    // cuando una política RLS filtra la fila, así que "sin error" no significa
    // "borrado": antes se cantaba éxito y el cliente seguía vivo en la nube.
    const conFilas = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .select('id');

    if (conFilas.error) {
      // Puede ser que el rol no tenga permiso para pedir la representación
      // (return=representation exige SELECT sobre las columnas devueltas).
      // Se reintenta a secas y se verifica por AUSENCIA, que solo necesita
      // permiso de lectura sobre `id`.
      console.warn(`[Supabase] Borrado con representación no permitido (${describirError(conFilas.error)}); se reintenta y se verifica por ausencia.`);

      const simple = await supabase.from('clients').delete().eq('id', id);
      if (simple.error) {
        console.error(`[Supabase Error] Error al eliminar cliente ${id}: ${describirError(simple.error)}`);
        throw simple.error;
      }

      const chequeo = await supabase.from('clients').select('id').eq('id', id).limit(1);
      if (chequeo.error) {
        console.warn(`[Supabase] No se pudo verificar el borrado de ${id} (${describirError(chequeo.error)}); se da por hecho.`);
        return;
      }
      if ((chequeo.data?.length ?? 0) > 0) {
        const err = new Error(
          `La nube no borró el cliente ${id} (la fila sigue existiendo). ` +
          `Suele ser la política RLS / GRANT DELETE del rol que usa la sesión.`
        );
        console.error(`[Supabase Error] ${err.message}`);
        throw err;
      }
      console.log(`✅ [Supabase] Cliente ${id} eliminado permanentemente (verificado por ausencia).`);
      return;
    }

    if ((conFilas.data?.length ?? 0) === 0) {
      const err = new Error(
        `La nube no borró ninguna fila de clients (id ${id}). ` +
        `Suele ser la política RLS / GRANT DELETE del rol que usa la sesión, o un id que ya no existe.`
      );
      console.error(`[Supabase Error] ${err.message}`);
      throw err;
    }

    console.log(`✅ [Supabase] Cliente ${id} eliminado permanentemente.`);
  },

  // --- Tasks ---

  async getTasks(): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*');
    if (error) throw error;
    return (data || []).map(d => this.mapTaskFromDb(d));
  },

  async upsertTask(task: Task): Promise<void> {
    const dbTask = this.mapTaskToDb(task);
    const { error } = await supabase
      .from('tasks')
      .upsert(dbTask);
    if (error) throw error;
  },

  // --- Audit Logs ---
  async getAuditLogs(limit: number = 200): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);
      
    if (error) {
      console.warn("Failed to fetch audit logs", error);
      return [];
    }
    return (data || []) as AuditLog[];
  },

  async addAuditLog(log: AuditLog): Promise<void> {
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        id: log.id,
        timestamp: log.timestamp,
        action: log.action,
        details: log.details,
        type: log.type,
        severity: log.severity
      });
    if (error) console.error("Error inserting audit log:", error);
  },

  async upsertFile(id: string, content: string): Promise<void> {
    const { error } = await supabase
      .from('files')
      .upsert({ id, content, updated_at: new Date().toISOString() });
    if (error) {
      console.error(`[Supabase Error] FAILED upsert for file ${id}:`, error);
      throw error;
    }
  },

  async getFile(id: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('files')
      .select('content')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data?.content || null;
  },

  // --- Storage ---
  async uploadFileToStorage(bucket: string, path: string, fileDataUrl: string): Promise<{url: string, path: string}> {
    try {
      // Convert data URL to Blob
      const response = await fetch(fileDataUrl);
      const blob = await response.blob();
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, blob, { upsert: true });

      if (error) throw error;
      
      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);

      return {
        url: publicUrlData.publicUrl,
        path: data.path
      };
    } catch (err) {
      console.error(`[Supabase Storage] Failed to upload ${path} to ${bucket}:`, err);
      throw err;
    }
  },

  // --- Paginated Fetch for Facturadores ---
  async getFacturadoresPaginated(page: number, limit: number, search: string, filterCategory: string): Promise<{clients: Client[], count: number}> {
    // Los filtros de categoría apuntaban a columnas que NO existen en la tabla
    // (facturador_config, client_type, requires_declarations,
    // facturador_activation_status) y PostgREST devolvía 400 en cada carga.
    // Esos datos viven en `tax_profile` (JSONB), así que se filtran ahí.
    const cat = (filterCategory || '').toLowerCase();
    let catFilter: string | null = null;
    if (cat === 'particulares') {
      catFilter = '(tax_profile->>clientType.eq.solo_plan,tax_profile->>requiresDeclarations.eq.false)';
    } else if (cat === 'clientes') {
      catFilter = '(and(tax_profile->>clientType.neq.solo_plan,tax_profile->>requiresDeclarations.neq.false,tax_profile->facturadorConfig.not.isnull))';
    } else if (cat === 'recursos_listos') {
      // OJO: la condición original era `is.null AND eq.recursos_listos`
      // (imposible de cumplir). La intención, según los KPI de la pantalla,
      // es "sin estado o recursos_listos".
      catFilter = '(and(tax_profile->facturadorConfig.not.isnull,or(tax_profile->>facturadorActivationStatus.is.null,tax_profile->>facturadorActivationStatus.eq.recursos_listos)))';
    } else if (cat === 'subido_plataforma') {
      catFilter = 'tax_profile->>facturadorActivationStatus.eq.subido_plataforma';
    } else if (cat === 'activado') {
      catFilter = 'tax_profile->>facturadorActivationStatus.eq.activado';
    } else if (cat === 'sin_firma') {
      catFilter = '(and(tax_profile->facturadorConfig.not.isnull,signature_file.is.null))';
    }

    const desde = (page - 1) * limit;
    const hasta = desde + limit - 1;

    // El rol `anon` no puede leer varias columnas de `clients` (401/42501), así
    // que `select('*')` y el filtro por `is_deleted` fallan siempre. Se intenta
    // la consulta completa y, si no, una degradada que sí es legible.
    const perfiles = [
      { select: '*, sri_declaraciones(*)', filtrarBajas: true, buscarPorRazonSocial: true },
      { select: 'id, ruc, name, regime, tax_profile, declaration_history, updated_at, sri_declaraciones(*)', filtrarBajas: false, buscarPorRazonSocial: false },
    ];

    let ultimoError: any = null;
    for (const perfil of perfiles) {
      let query = supabase
        .from('clients')
        .select(perfil.select, { count: 'exact' });

      // Con `is_deleted` legible se excluyen las bajas en SQL; si no, el filtro
      // local de la pantalla (storeClients) es el que las descarta.
      if (perfil.filtrarBajas) query = query.eq('is_deleted', false);
      if (catFilter) query = query.or(catFilter);
      if (search) {
        const campos = perfil.buscarPorRazonSocial
          ? `name.ilike.%${search}%,trade_name.ilike.%${search}%,ruc.ilike.%${search}%`
          : `name.ilike.%${search}%,ruc.ilike.%${search}%`;
        query = query.or(campos);
      }

      const { data, error, count } = await query.range(desde, hasta).order('name', { ascending: true });

      if (!error) {
        if (!perfil.filtrarBajas) {
          console.warn('[SupabaseService] getFacturadoresPaginated: lectura degradada (sin is_deleted ni trade_name).');
        }
        const mappedClients = (data || []).map(d => this.mapClientFromDb(d));
        return { clients: mappedClients, count: count || mappedClients.length };
      }

      ultimoError = error;
    }

    console.error("[Supabase Error] getFacturadoresPaginated:", ultimoError);
    throw ultimoError;
  },

  // --- Real-time Sync ---

  subscribeToChanges(table: string, callback: (payload: any) => void) {
    return supabase
      .channel(`public:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        callback(payload);
      })
      .subscribe();
  },

  // --- Mapping Helpers ---

  mapTaskToDb(task: Task): any {
    return {
      id: task.id,
      client_id: task.clientId,
      title: task.title,
      description: task.description,
      non_client_name: task.nonClientName,
      non_client_ruc: task.nonClientRuc,
      sri_password: task.sriPassword,
      due_date: task.dueDate,
      status: task.status,
      cost: task.cost,
      advance_payment: task.advancePayment
    };
  },

  mapTaskFromDb(db: any): Task {
    return {
      id: db.id,
      clientId: db.client_id,
      title: db.title,
      description: db.description,
      nonClientName: db.non_client_name,
      nonClientRuc: db.non_client_ruc,
      sriPassword: db.sri_password,
      dueDate: db.due_date,
      status: db.status as TaskStatus,
      cost: Number(db.cost || 0),
      advancePayment: Number(db.advance_payment || 0)
    };
  },

  mapClientToDb(client: Client): any {
    const isSoloPlan = client.clientType === 'solo_plan' || client.requiresDeclarations === false;
    const clientType = isSoloPlan ? 'solo_plan' : (client.clientType || 'completo');
    const requiresDeclarations = isSoloPlan ? false : (typeof client.requiresDeclarations === 'boolean' ? client.requiresDeclarations : true);

    const facturadorConfigObj = client.facturadorConfig || client.billingPlan;

    return {
      id: client.id,
      ruc: client.ruc,
      name: client.name,
      trade_name: client.tradeName,
      sri_password: client.sriPassword,
      phones: client.phones,
      email: client.email,
      address: client.address,
      notes: client.notes,
      regime: client.regime,
      is_vip: true, // Decisión de negocio: todos los clientes son VIP (campo legacy)
      renta_category: client.rentaCategory,
      economic_activity: client.economicActivity,
      is_active: typeof client.isActive === 'boolean' ? client.isActive : true,
      is_deleted: !!client.isDeleted,
      // OJO: client_type / requires_declarations / facturador_config /
      // facturador_activation_status / signature_provider / id_card_* /
      // ecuafact_signed_request NO son columnas de `clients` en esta base.
      // Mandarlas aquí hacía que PostgREST rechazara el guardado COMPLETO
      // (400 PGRST204). Van dentro de tax_profile, que sí existe y que la
      // extensión ya lee con fallback (`c.client_type || tp.clientType`).
      tax_profile: {
        ...(client.taxProfile || {}),
        clientStartPeriod: client.clientStartPeriod,
        clientType: clientType,
        requiresDeclarations: requiresDeclarations,
        facturadorConfig: facturadorConfigObj,
        facturadorActivationStatus: client.facturadorActivationStatus ?? (client.taxProfile as any)?.facturadorActivationStatus,
        // Identidad y firma: sin columna propia, se guardan acá para no perderlas.
        signatureProvider: client.signatureProvider ?? (client.taxProfile as any)?.signatureProvider,
        idCardFront: client.idCardFront ?? (client.taxProfile as any)?.idCardFront,
        idCardBack: client.idCardBack ?? (client.taxProfile as any)?.idCardBack,
        idCardSelfie: client.idCardSelfie ?? (client.taxProfile as any)?.idCardSelfie,
        ecuafactSignedRequest: client.ecuafactSignedRequest ?? (client.taxProfile as any)?.ecuafactSignedRequest,
      },
      fee_structure: client.fee_structure,
      custom_service_fee: client.customServiceFee,
      is_artisan: client.isArtisan,
      establishment_count: client.establishmentCount,
      jurisdiction: client.jurisdiction,
      signature_password: client.electronicSignaturePassword,
      iess_password: client.iessPassword,
      signature_expiration: client.signatureExpirationDate,
      advance_credits: client.advanceCredits,
      declaration_history: (client.declarations || []).map(d => d?.proof_file?.url ? { ...d, proof_file: { ...d.proof_file, content: null } } : d),
      vault: (client.vault || []).map(f => f?.url ? { ...f, content: null } : f),
      structured_notes: client.structuredNotes,
      signature_file: client.signatureFile,
      ruc_pdf: client.rucPdf,
      ruc_certificate: client.rucCertificate,
      has_renta_refund: client.hasRentaRefund,
      renta_refund_amount: client.rentaRefundAmount,
      renta_refund_status: client.rentaRefundStatus,
      renta_refund_requested_at: client.rentaRefundRequestedAt,
      renta_refund_paid: client.rentaRefundPaid,
      renta_refund_proof: client.rentaRefundProof,
      has_elderly_devolucion_iva: client.hasElderlyDevolucionIva,
      elderly_devolucion_iva_status: client.elderlyDevolucionIvaStatus,
      elderly_devolucion_iva_paid: client.elderlyDevolucionIvaPaid,
      elderly_devolucion_iva_resolution_file: client.elderlyDevolucionIvaResolutionFile,
      renta_refund_resolution_file: client.rentaRefundResolutionFile,
      renta_refund_confirmation_started_at: client.rentaRefundConfirmationStartedAt,
      renta_refund_confirmation_deadline: client.rentaRefundConfirmationDeadline,
      created_at: client.createdAt,
      updated_at: new Date().toISOString()
    };
  },

  mapClientFromDb(db: any): Client {
    // Normalizar el régimen robustamente para evitar discrepancias de snake_case o texto
    let normalizedRegime = db.regime as TaxRegime;
    if (db.regime) {
      const r = db.regime.toString().toUpperCase().replace(/_/g, ' ');
      if (r.includes('POPULAR')) {
        normalizedRegime = TaxRegime.RimpeNegocioPopular;
      } else if (r.includes('EMPRENDEDOR')) {
        normalizedRegime = TaxRegime.RimpeEmprendedor;
      } else if (r.includes('GENERAL')) {
        normalizedRegime = TaxRegime.General;
      }
    }

    // Normalizar y blindar el taxProfile
    const rawTaxProfile = db.tax_profile || {};
    const isSoloPlan = db.client_type === 'solo_plan' || 
                       rawTaxProfile.clientType === 'solo_plan' || 
                       db.requires_declarations === false || 
                       rawTaxProfile.requiresDeclarations === false;
    
    const clientType: 'completo' | 'solo_plan' = isSoloPlan ? 'solo_plan' : (db.client_type || rawTaxProfile.clientType || 'completo');
    const requiresDeclarations = isSoloPlan ? false : (typeof db.requires_declarations === 'boolean' ? db.requires_declarations : (rawTaxProfile.requiresDeclarations ?? true));

    const taxProfile = {
      // Conservar TODO lo que vive en el JSON (alias/quickNote, sriCredencial
      // que escribe la extensión, clientType, facturadorConfig, identidad…).
      // Antes se reconstruía campo por campo y lo demás se perdía al leer.
      ...rawTaxProfile,
      ivaFrequency: isSoloPlan ? 'Ninguno' : (rawTaxProfile.ivaFrequency || (
        normalizedRegime === TaxRegime.RimpeEmprendedor ? 'Semestral' :
        (normalizedRegime === TaxRegime.RimpeNegocioPopular ? 'Ninguno' : 'Mensual')
      )),
      requiresAnnualRenta: isSoloPlan ? false : (rawTaxProfile.requiresAnnualRenta ?? (
        normalizedRegime === TaxRegime.RimpeEmprendedor ||
        normalizedRegime === TaxRegime.RimpeNegocioPopular ||
        normalizedRegime === TaxRegime.General
      )),
      requiresAnexosGastos: !!rawTaxProfile.requiresAnexosGastos,
      hasActiveDevolucionIva: !!rawTaxProfile.hasActiveDevolucionIva,
      hasActiveElderlyDevolucionIva: !!rawTaxProfile.hasActiveElderlyDevolucionIva,
      requiresIce: !!rawTaxProfile.requiresIce,
      requiresAnexoPvp: !!rawTaxProfile.requiresAnexoPvp,
      clientStartPeriod: rawTaxProfile.clientStartPeriod || db.client_start_period,
      // Lo escribe la extensión Nueva Luz cuando el SRI rechaza la clave.
      sriCredencial: rawTaxProfile.sriCredencial || undefined
    };

    // Forzar consistencia estricta según el régimen (solo si no es solo_plan)
    if (!isSoloPlan) {
      if (normalizedRegime === TaxRegime.RimpeNegocioPopular) {
        taxProfile.ivaFrequency = 'Ninguno';
        taxProfile.requiresAnnualRenta = true;
      } else if (normalizedRegime === TaxRegime.RimpeEmprendedor) {
        taxProfile.ivaFrequency = 'Semestral';
        taxProfile.requiresAnnualRenta = true;
      }
    }

    // Unificar y desduplicar declaraciones del join relacional y del JSON history
    const relDeclarations = Array.isArray(db.sri_declaraciones) ? db.sri_declaraciones : [];
    const jsonDeclarations = Array.isArray(db.declaration_history) ? db.declaration_history : [];

    const declMap = new Map<string, any>();
    // Procesar primero jsonDeclarations y luego relDeclarations (la tabla relacional manda)
    [...jsonDeclarations, ...relDeclarations].forEach((d: any) => {
      if (!d || !d.period) return;
      const decType = (d.type || (d.period?.toString().includes('ANEXO') ? 'ANEXO' : (d.period?.toString().length === 7 ? 'IVA' : 'RENTA'))).toUpperCase();
      const cleanPeriod = d.period.toString().toUpperCase().trim();
      const key = `${decType}_${cleanPeriod}`;
      const existing = declMap.get(key);

      const dHasUrl = !!d.proof_file?.url || (typeof d.proof_file?.content === 'string' && d.proof_file.content.length > 50);
      const existingHasUrl = !!existing?.proof_file?.url || (typeof existing?.proof_file?.content === 'string' && existing.proof_file.content.length > 50);
      const isPaid = typeof d.is_paid === 'boolean' ? d.is_paid : (d.status === 'Pagada' || d.status === DeclarationStatus.Pagada);

      if (!existing) {
        declMap.set(key, {
          ...d,
          type: decType,
          period: d.period,
          is_paid: isPaid,
          isNotifiedWhatsApp: Boolean(d.is_notified_whatsapp || d.isNotifiedWhatsApp),
          notifiedWhatsAppAt: d.notified_whatsapp_at || d.notifiedWhatsAppAt || undefined,
          notificationCount: d.notification_count ?? d.notificationCount ?? 0
        });
      } else {
        const finalProof = (dHasUrl || !existingHasUrl) ? (d.proof_file || existing.proof_file) : existing.proof_file;
        const finalStatus = (d.status === 'Enviada' || d.status === 'Pagada' || !existing.status) ? d.status : existing.status;
        
        const existingTime = existing.updatedAt || existing.updated_at ? new Date(existing.updatedAt || existing.updated_at).getTime() : 0;
        const incomingTime = d.updatedAt || d.updated_at ? new Date(d.updatedAt || d.updated_at).getTime() : 0;
        const resolvedIsPaid = (existingTime > 0 && incomingTime > 0)
          ? (incomingTime >= existingTime ? isPaid : existing.is_paid)
          : (typeof isPaid === 'boolean' ? isPaid : existing.is_paid);

        declMap.set(key, {
          ...existing,
          ...d,
          type: decType,
          period: d.period || existing.period,
          status: finalStatus,
          proof_file: finalProof,
          is_paid: resolvedIsPaid,
          // CRITICAL FIX: Preservar la marca de notificado si CUALQUIERA de las fuentes la tiene en true
          isNotifiedWhatsApp: Boolean(d.is_notified_whatsapp || d.isNotifiedWhatsApp || existing.isNotifiedWhatsApp),
          notifiedWhatsAppAt: d.notified_whatsapp_at || d.notifiedWhatsAppAt || existing.notifiedWhatsAppAt || undefined,
          notificationCount: Math.max(
            d.notification_count ?? d.notificationCount ?? 0,
            existing.notificationCount ?? 0)
        });
      }
    });

    const unifiedDeclarations = Array.from(declMap.values());

    const facturadorConfig = db.facturador_config || rawTaxProfile.facturadorConfig || (db.billing_plans && db.billing_plans.length > 0 ? {
      programName: db.billing_plans[0].program_name,
      url: db.billing_plans[0].url,
      username: db.billing_plans[0].username,
      password: db.billing_plans[0].password,
      expirationDate: db.billing_plans[0].expiration_date,
      documentStatus: db.billing_plans[0].document_status,
      documentCount: db.billing_plans[0].document_count,
      price: db.billing_plans[0].price,
      soldByMe: db.billing_plans[0].sold_by_me,
      providerName: db.billing_plans[0].provider_name,
      freeSupportAndCancellation: db.billing_plans[0].free_support_and_cancellation,
    } : undefined);

    return {
      id: db.id,
      ruc: db.ruc,
      name: db.name,
      tradeName: db.trade_name,
      sriPassword: db.sri_password,
      phones: db.phones,
      email: db.email,
      address: db.address,
      notes: db.notes,
      regime: normalizedRegime,
      clientType,
      requiresDeclarations,
      facturadorConfig,
      billingPlan: facturadorConfig,
      facturadorActivationStatus: db.facturador_activation_status || rawTaxProfile.facturadorActivationStatus || 'recursos_listos',
      // Identidad/firma: la columna no existe en `clients`, viven en tax_profile.
      signatureProvider: db.signature_provider || rawTaxProfile.signatureProvider,
      idCardFront: db.id_card_front || rawTaxProfile.idCardFront,
      idCardBack: db.id_card_back || rawTaxProfile.idCardBack,
      idCardSelfie: db.id_card_selfie || rawTaxProfile.idCardSelfie,
      ecuafactSignedRequest: db.ecuafact_signed_request || rawTaxProfile.ecuafactSignedRequest,
      rentaCategory: db.renta_category as RentaCategory,
      economicActivity: db.economic_activity,
      isActive: db.is_active,
      isDeleted: db.is_deleted,
      taxProfile: taxProfile as any,
      clientStartPeriod: rawTaxProfile.clientStartPeriod || db.client_start_period,
      fee_structure: db.fee_structure,
      customServiceFee: db.custom_service_fee,
      isArtisan: db.is_artisan,
      establishmentCount: db.establishment_count,
      jurisdiction: db.jurisdiction,
      electronicSignaturePassword: db.signature_password,
      iessPassword: db.iess_password,
      signatureExpirationDate: db.signature_expiration,
      advanceCredits: db.advance_credits,
      declarations: unifiedDeclarations,
      vault: db.vault || [],
      structuredNotes: db.structured_notes || [],
      signatureFile: db.signature_file,
      rucPdf: db.ruc_pdf,
      rucCertificate: db.ruc_certificate,
      hasRentaRefund: db.has_renta_refund,
      rentaRefundAmount: db.renta_refund_amount,
      rentaRefundStatus: db.renta_refund_status,
      rentaRefundRequestedAt: db.renta_refund_requested_at,
      rentaRefundPaid: db.renta_refund_paid,
      rentaRefundProof: db.renta_refund_proof,
      hasElderlyDevolucionIva: db.has_elderly_devolucion_iva,
      elderlyDevolucionIvaStatus: db.elderly_devolucion_iva_status,
      elderlyDevolucionIvaPaid: db.elderly_devolucion_iva_paid,
      elderlyDevolucionIvaResolutionFile: db.elderly_devolucion_iva_resolution_file,
      rentaRefundResolutionFile: db.renta_refund_resolution_file,
      rentaRefundConfirmationStartedAt: db.renta_refund_confirmation_started_at,
      rentaRefundConfirmationDeadline: db.renta_refund_confirmation_deadline,
      createdAt: db.created_at,
      updatedAt: db.updated_at
    };
  },

  // --- SRI Comprobantes ---
  async getSriComprobantes(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('sri_comprobantes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(d => ({
        id: d.id,
        tipo: d.tipo,
        secuencial: d.secuencial,
        claveAcceso: d.clave_acceso,
        rucReceptor: d.ruc_receptor,
        nombreReceptor: d.nombre_receptor,
        fechaEmision: d.fecha_emision,
        total: Number(d.total),
        estado: d.estado,
        xml: d.xml,
        ambiente: d.ambiente,
        mensajeError: d.mensaje_error
      }));
    } catch (err) {
      console.error('Error fetching sri comprobantes:', err);
      return [];
    }
  },

  async upsertSriComprobante(comp: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('sri_comprobantes')
        .upsert({
          tipo: comp.tipo,
          secuencial: comp.secuencial,
          clave_acceso: comp.claveAcceso,
          ruc_receptor: comp.rucReceptor,
          nombre_receptor: comp.nombreReceptor,
          fecha_emision: comp.fechaEmision,
          total: comp.total,
          estado: comp.estado,
          xml: comp.xml,
          ambiente: comp.ambiente,
          mensaje_error: comp.mensajeError
        }, { onConflict: 'clave_acceso' });
      if (error) throw error;
    } catch (err) {
      console.error('Error upserting sri comprobante:', err);
      throw err;
    }
  },

  // --- Emisor Settings & Signature Persistence ---
  async getEmisorConfig(): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('emisor_settings')
        .select('*')
        .eq('id', 'default_emisor')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        emisorRuc: data.ruc,
        emisorRazonSocial: data.razon_social,
        emisorNombreComercial: data.nombre_comercial,
        emisorDirMatriz: data.dir_matriz,
        emisorEstab: data.estab,
        emisorPtoEmi: data.pto_emi,
        emisorRegimen: data.regimen,
        ambiente: data.ambiente,
        emisorSecuencialInicio: data.secuencial_inicio,
        lastSeqFactura: data.last_seq_factura,
        lastSeqRetencion: data.last_seq_retencion,
        p12Base64: data.p12_base64,
        p12FileName: data.p12_filename,
        p12Password: data.p12_password,
        p12StartDate: data.p12_start,
        p12ExpiryDate: data.p12_expiry,
        p12SubjectName: data.p12_subject,
        p12OwnerName: data.p12_owner,
        emisorLogo: data.logo_base64
      };
    } catch (err) {
      console.warn('[Supabase] Warning reading emisor_settings:', err);
      return null;
    }
  },

  async upsertEmisorConfig(config: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('emisor_settings')
        .upsert({
          id: 'default_emisor',
          ruc: config.emisorRuc,
          razon_social: config.emisorRazonSocial,
          nombre_comercial: config.emisorNombreComercial,
          dir_matriz: config.emisorDirMatriz,
          estab: config.emisorEstab,
          pto_emi: config.emisorPtoEmi,
          regimen: config.emisorRegimen,
          ambiente: config.ambiente,
          secuencial_inicio: config.emisorSecuencialInicio,
          last_seq_factura: config.lastSeqFactura,
          last_seq_retencion: config.lastSeqRetencion,
          p12_base64: config.p12Base64,
          p12_filename: config.p12FileName,
          p12_password: config.p12Password,
          p12_start: config.p12StartDate,
          p12_expiry: config.p12ExpiryDate,
          p12_subject: config.p12SubjectName,
          p12_owner: config.p12OwnerName,
          logo_base64: config.emisorLogo,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      if (error) throw error;
    } catch (err) {
      console.error('[Supabase] Error saving emisor_settings:', err);
    }
  },

  async getNextSriSecuencial(tipo: 'factura' | 'retencion'): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('get_next_sri_secuencial', { p_tipo: tipo });
      
      if (error) {
        console.error('[Supabase] Error calling get_next_sri_secuencial:', error);
        throw error;
      }
      return data as number;
    } catch (err) {
      console.error('[Supabase] Exception in getNextSriSecuencial:', err);
      // Fallback in case RPC fails (e.g., if the user hasn't run the SQL script yet)
      throw new Error(`Error obteniendo el siguiente secuencial desde la base de datos para ${tipo}. ¿Ejecutaste el script SQL en Supabase?`);
    }
  }
};
