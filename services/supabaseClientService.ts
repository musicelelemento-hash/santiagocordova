import { supabase } from './supabase';
import { Client, TaxRegime, RentaCategory } from '../types/client';
import { Task, TaskStatus } from '../types/task';

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
    const dbClient = this.mapClientToDb(client);
    const { error } = await supabase
      .from('clients')
      .upsert(dbClient);

    if (error) throw error;
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
      is_vip: client.isVip,
      renta_category: client.rentaCategory,
      economic_activity: client.economicActivity,
      is_active: client.isActive,
      is_deleted: client.isDeleted,
      tax_profile: client.taxProfile,
      fee_structure: client.feeStructure,
      custom_service_fee: client.customServiceFee,
      is_artisan: client.isArtisan,
      establishment_count: client.establishmentCount,
      jurisdiction: client.jurisdiction,
      signature_password: client.electronicSignaturePassword,
      iess_password: client.iessPassword,
      signature_expiration: client.signatureExpirationDate,
      advance_credits: client.advanceCredits,
      declaration_history: client.declarationHistory,
      vault: client.vault,
      structured_notes: client.structuredNotes,
      annual_renta_status: client.annualRentaStatus,
      annual_renta_paid: client.annualRentaPaid,
      annual_renta_proof: client.annualRentaProof,
      anexo_gastos_status: client.anexoGastosStatus,
      anexo_gastos_paid: client.anexoGastosPaid,
      anexo_gastos_proof: client.anexoGastosProof,
      devolucion_iva_status: client.devolucionIvaStatus,
      devolucion_iva_paid: client.devolucionIvaPaid,
      devolucion_iva_proof: client.devolucionIvaProof,
      ice_anexo_status: client.iceAnexoStatus,
      ice_anexo_paid: client.iceAnexoPaid,
      ice_anexo_proof: client.iceAnexoProof,
      ice_declaration_status: client.iceDeclarationStatus,
      ice_declaration_paid: client.iceDeclarationPaid,
      ice_declaration_proof: client.iceDeclarationProof,
      anexo_pvp_status: client.anexoPvpStatus,
      anexo_pvp_paid: client.anexoPvpPaid,
      anexo_pvp_proof: client.anexoPvpProof,
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
      regime: db.regime as TaxRegime,
      isVip: db.is_vip,
      rentaCategory: db.renta_category as RentaCategory,
      economicActivity: db.economic_activity,
      isActive: db.is_active,
      isDeleted: db.is_deleted,
      taxProfile: db.tax_profile,
      feeStructure: db.fee_structure,
      customServiceFee: db.custom_service_fee,
      isArtisan: db.is_artisan,
      establishmentCount: db.establishment_count,
      jurisdiction: db.jurisdiction,
      electronicSignaturePassword: db.signature_password,
      iessPassword: db.iess_password,
      signatureExpirationDate: db.signature_expiration,
      advanceCredits: db.advance_credits,
      declarationHistory: db.declaration_history || [],
      vault: db.vault || [],
      structuredNotes: db.structured_notes || [],
      annualRentaStatus: db.annual_renta_status,
      annualRentaPaid: db.annual_renta_paid,
      annualRentaProof: db.annual_renta_proof,
      anexoGastosStatus: db.anexo_gastos_status,
      anexoGastosPaid: db.anexo_gastos_paid,
      anexoGastosProof: db.anexo_gastos_proof,
      devolucionIvaStatus: db.devolucion_iva_status,
      devolucionIvaPaid: db.devolucion_iva_paid,
      devolucionIvaProof: db.devolucion_iva_proof,
      iceAnexoStatus: db.ice_anexo_status,
      iceAnexoPaid: db.ice_anexo_paid,
      iceAnexoProof: db.ice_anexo_proof,
      iceDeclarationStatus: db.ice_declaration_status,
      iceDeclarationPaid: db.ice_declaration_paid,
      iceDeclarationProof: db.ice_declaration_proof,
      anexoPvpStatus: db.anexo_pvp_status,
      anexoPvpPaid: db.anexo_pvp_paid,
      anexoPvpProof: db.anexo_pvp_proof,
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
  }
};
