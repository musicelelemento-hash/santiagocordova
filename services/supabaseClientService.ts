import { supabase } from './supabase';
import { Client, TaxRegime, RentaCategory, DeclarationStatus } from '../types/client';
import { Task, TaskStatus } from '../types/task';
import { AuditLog } from '../types';

/**
 * Service to handle data operations with Supabase.
 * Maps between frontend CamelCase types and DB snake_case tables.
 */
export const SupabaseService = {
  // --- Clients ---
  
  async getClients(): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*, sri_declaraciones(*), billing_plans(*)')
      .eq('is_deleted', false);

    if (error) throw error;
    return (data || []).map(d => this.mapClientFromDb(d));
  },

  async upsertClient(client: Client): Promise<void> {
    const mappedClient = this.mapClientToDb(client);

    const { error } = await supabase
      .from('clients')
      .upsert(mappedClient, { onConflict: 'ruc' });

    if (error) {
      console.error(`[Supabase Error] FAILED upsert for client ${client.ruc}:`, error);
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

            const record = {
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

            try {
                // Intento 1: upsert con constraint (client_id, type, period)
                const { error: e1 } = await supabase
                    .from('sri_declaraciones')
                    .upsert(record, { onConflict: 'client_id,type,period' });

                if (e1) {
                    console.warn(`[sri_declaraciones] upsert (3-col) failed for ${dec.period}/${decType}:`, e1.message);
                    // Intento 2: upsert con constraint (client_id, period)
                    const { error: e2 } = await supabase
                        .from('sri_declaraciones')
                        .upsert(record, { onConflict: 'client_id,period' });

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
                            // Preservar proof_file existente si el nuevo es null
                            const updatePayload = sanitizedProofFile
                                ? record
                                : { ...record, proof_file: undefined };
                            await supabase.from('sri_declaraciones').update(updatePayload).eq('id', existing.id);
                        } else {
                            await supabase.from('sri_declaraciones').insert(record);
                        }
                    }
                }
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
    const dbClients = clients.map(c => this.mapClientToDb(c));
    const { error } = await supabase
      .from('clients')
      .upsert(dbClients);
    if (error) throw error;
  },

  async deleteClient(id: string): Promise<void> {
    console.log(`[Supabase] Eliminando cliente y registros dependientes: ${id}...`);
    try {
      await supabase.from('sri_declaraciones').delete().eq('client_id', id);
      await supabase.from('billing_plans').delete().eq('client_id', id);
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);
      if (error) throw error;
      console.log(`✅ [Supabase] Cliente ${id} eliminado permanentemente.`);
    } catch (err) {
      console.error(`[Supabase Error] Error al eliminar cliente ${id}:`, err);
      throw err;
    }
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
    let query = supabase
      .from('clients')
      .select('*, billing_plans(*), sri_declaraciones(*)', { count: 'exact' })
      .eq('is_deleted', false);

    // Aplicar el filtro de categoría a nivel SQL para que la paginación y el count sean correctos
    const cat = (filterCategory || '').toLowerCase();
    let catFilter: string | null = null;
    if (cat === 'particulares') {
      catFilter = '(client_type.eq.solo_plan,requires_declarations.eq.false)';
    } else if (cat === 'clientes') {
      catFilter = '(and(client_type.neq.solo_plan,requires_declarations.neq.false,facturador_config.not.isnull))';
    } else if (cat === 'recursos_listos') {
      catFilter = '(facturador_config.not.isnull,and(facturador_activation_status.is.null,facturador_activation_status.eq.recursos_listos))';
    } else if (cat === 'subido_plataforma') {
      catFilter = 'facturador_activation_status.eq.subido_plataforma';
    } else if (cat === 'activado') {
      catFilter = 'facturador_activation_status.eq.activado';
    } else if (cat === 'sin_firma') {
      catFilter = '(and(facturador_config.not.isnull,signature_file.is.null))';
    }

    if (catFilter) {
      query = query.or(catFilter);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,trade_name.ilike.%${search}%,ruc.ilike.%${search}%`);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    query = query.range(from, to).order('name', { ascending: true });

    const { data, error, count } = await query;

    if (error) {
      console.error("[Supabase Error] getFacturadoresPaginated:", error);
      throw error;
    }

    const mappedClients = (data || []).map(d => this.mapClientFromDb(d));

    return {
      clients: mappedClients,
      count: count || mappedClients.length
    };
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
      client_type: clientType,
      requires_declarations: requiresDeclarations,
      facturador_config: facturadorConfigObj,
      facturador_activation_status: client.facturadorActivationStatus || 'recursos_listos',
      signature_provider: client.signatureProvider,
      id_card_front: client.idCardFront,
      id_card_back: client.idCardBack,
      id_card_selfie: client.idCardSelfie,
      ecuafact_signed_request: client.ecuafactSignedRequest,
      tax_profile: {
        ...(client.taxProfile || {}),
        clientStartPeriod: client.clientStartPeriod,
        clientType: clientType,
        requiresDeclarations: requiresDeclarations,
        facturadorConfig: facturadorConfigObj,
        facturadorActivationStatus: client.facturadorActivationStatus
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
          isNotifiedWhatsApp: d.is_notified_whatsapp ?? d.isNotifiedWhatsApp ?? false,
          notifiedWhatsAppAt: d.notified_whatsapp_at ?? d.notifiedWhatsAppAt ?? null
        });
      } else {
        const finalProof = (dHasUrl || !existingHasUrl) ? (d.proof_file || existing.proof_file) : existing.proof_file;
        const finalStatus = (d.status === 'Enviada' || d.status === 'Pagada' || !existing.status) ? d.status : existing.status;
        
        declMap.set(key, {
          ...existing,
          ...d,
          type: decType,
          period: d.period || existing.period,
          status: finalStatus,
          proof_file: finalProof,
          is_paid: isPaid || existing.is_paid,
          isNotifiedWhatsApp: d.is_notified_whatsapp ?? d.isNotifiedWhatsApp ?? existing.isNotifiedWhatsApp,
          notifiedWhatsAppAt: d.notified_whatsapp_at ?? d.notifiedWhatsAppAt ?? existing.notifiedWhatsAppAt
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
      signatureProvider: db.signature_provider,
      idCardFront: db.id_card_front,
      idCardBack: db.id_card_back,
      idCardSelfie: db.id_card_selfie,
      ecuafactSignedRequest: db.ecuafact_signed_request,
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
