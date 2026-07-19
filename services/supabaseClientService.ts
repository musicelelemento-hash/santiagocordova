import { supabase } from './supabase';
import { Client, TaxRegime, RentaCategory } from '../types/client';
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
      .select('*')
      .eq('is_deleted', false);

    if (error) throw error;
    return (data || []).map(d => this.mapClientFromDb(d));
  },

  async upsertClient(client: Client): Promise<void> {
    const mappedClient = this.mapClientToDb(client);
    
    // Diagnostic: Log size of the payload for PDF debugging
    const payloadSize = JSON.stringify(mappedClient).length;
    console.log(`[Supabase] Upserting client ${client.ruc}. Payload size: ${(payloadSize / 1024).toFixed(2)} KB`);

    const { error } = await supabase
      .from('clients')
      .upsert(mappedClient, { onConflict: 'ruc' });

    if (error) {
      console.error(`[Supabase Error] FAILED upsert for client ${client.ruc}:`, error);
      throw error;
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
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);
    if (error) throw error;
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
      cost: db.cost,
      advancePayment: db.advance_payment
    };
  },

  mapClientToDb(client: Client): any {
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
      is_active: client.isActive,
      is_deleted: client.isDeleted,
      tax_profile: client.taxProfile,
      fee_structure: client.fee_structure,
      custom_service_fee: client.customServiceFee,
      is_artisan: client.isArtisan,
      establishment_count: client.establishmentCount,
      jurisdiction: client.jurisdiction,
      signature_password: client.electronicSignaturePassword,
      iess_password: client.iessPassword,
      signature_expiration: client.signatureExpirationDate,
      advance_credits: client.advanceCredits,
      declaration_history: client.declarations,
      vault: client.vault,
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
    const taxProfile = {
      ivaFrequency: rawTaxProfile.ivaFrequency || (
        normalizedRegime === TaxRegime.RimpeEmprendedor ? 'Semestral' :
        (normalizedRegime === TaxRegime.RimpeNegocioPopular ? 'Ninguno' : 'Mensual')
      ),
      requiresAnnualRenta: rawTaxProfile.requiresAnnualRenta ?? (
        normalizedRegime === TaxRegime.RimpeEmprendedor ||
        normalizedRegime === TaxRegime.RimpeNegocioPopular ||
        normalizedRegime === TaxRegime.General
      ),
      requiresAnexosGastos: !!rawTaxProfile.requiresAnexosGastos,
      hasActiveDevolucionIva: !!rawTaxProfile.hasActiveDevolucionIva,
      hasActiveElderlyDevolucionIva: !!rawTaxProfile.hasActiveElderlyDevolucionIva,
      requiresIce: !!rawTaxProfile.requiresIce,
      requiresAnexoPvp: !!rawTaxProfile.requiresAnexoPvp
    };

    // Forzar consistencia estricta según el régimen
    if (normalizedRegime === TaxRegime.RimpeNegocioPopular) {
      taxProfile.ivaFrequency = 'Ninguno';
      taxProfile.requiresAnnualRenta = true;
    } else if (normalizedRegime === TaxRegime.RimpeEmprendedor) {
      taxProfile.ivaFrequency = 'Semestral';
      taxProfile.requiresAnnualRenta = true;
    }

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
      // isVip logic removed, all treated as VIP

      rentaCategory: db.renta_category as RentaCategory,
      economicActivity: db.economic_activity,
      isActive: db.is_active,
      isDeleted: db.is_deleted,
      taxProfile: taxProfile as any,
      fee_structure: db.fee_structure,
      customServiceFee: db.custom_service_fee,
      isArtisan: db.is_artisan,
      establishmentCount: db.establishment_count,
      jurisdiction: db.jurisdiction,
      electronicSignaturePassword: db.signature_password,
      iessPassword: db.iess_password,
      signatureExpirationDate: db.signature_expiration,
      advanceCredits: db.advance_credits,
      declarations: db.declaration_history || [],
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
  }
};
