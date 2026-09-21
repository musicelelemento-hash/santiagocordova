import React from 'react';
import { Modal } from '../ui/Modal';
import { ClientForm } from './ClientForm';
import { Client } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../../context/ToastContext';

interface GlobalNewClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onClientCreated?: (client: Client) => void;
}

export const GlobalNewClientModal: React.FC<GlobalNewClientModalProps> = ({
    isOpen,
    onClose,
    onClientCreated
}) => {
    const { clients, addClient, updateClient, sriCredentials } = useAppStore();
    const { toast } = useToast();

    const handleSubmit = (clientData: Client) => {
        const existingClient = clients.find(c => c.id === clientData.id || c.ruc === clientData.ruc);

        if (existingClient) {
            const isRestoring = !!existingClient.isDeleted;
            const mergedClient: Client = {
                ...clientData,
                id: existingClient.id,
                declarations: existingClient.declarations,
                vault: existingClient.vault,
                createdAt: existingClient.createdAt,
                isDeleted: false,
                isActive: typeof clientData.isActive === 'boolean' ? clientData.isActive : true
            };
            updateClient(existingClient.id, mergedClient);
            if (isRestoring) {
                toast.success(`Cliente ${existingClient.name} restaurado de la Papelera y actualizado.`);
            } else {
                toast.success(`Perfil de ${existingClient.name} actualizado exitosamente.`);
            }
            if (onClientCreated) onClientCreated(mergedClient);
        } else {
            const newClient: Client = {
                ...clientData,
                isDeleted: false,
                isActive: typeof clientData.isActive === 'boolean' ? clientData.isActive : true
            };
            addClient(newClient);
            toast.success(`Cliente ${newClient.name} creado exitosamente.`);
            if (onClientCreated) onClientCreated(newClient);
        }

        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Agregar Nuevo Cliente"
            size="4xl"
        >
            <ClientForm
                onSubmit={handleSubmit}
                onCancel={onClose}
                sriCredentials={sriCredentials}
            />
        </Modal>
    );
};
