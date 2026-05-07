
import React, { memo } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Client, ServiceFeesConfig, Declaration } from '../../types';
import { ClientCard } from './ClientCard';

interface VirtualClientListProps {
    clients: Client[];
    serviceFees: ServiceFeesConfig;
    onView: (client: Client, tab?: string) => void;
    onQuickAction?: (client: Client, action: 'declare' | 'pay' | 'cancel' | 'revert' | 'deactivate' | 'restore' | 'purge', period?: string) => void;
    onUploadReceipt?: (client: Client, period?: string) => void;
    onPreview?: (client: Client, declaration: Declaration) => void;
    variant?: 'tactical' | 'zen';
    frequency?: 'Mensual' | 'Semestral' | 'Anual' | 'all';
}

const ClientRow = memo(({ data, index, style }: ListChildComponentProps<VirtualClientListProps>) => {
    const { clients, serviceFees, onView, onQuickAction, onUploadReceipt, onPreview, variant = 'zen', frequency } = data;
    const client = clients[index];

    const itemStyle = {
        ...style,
        top: (style.top as number) + 12,
        height: (style.height as number) - 24,
        paddingLeft: '1.5rem',
        paddingRight: '1.5rem',
    };

    return (
        <div style={itemStyle}>
            <ClientCard 
                client={client}
                serviceFees={serviceFees}
                onView={onView}
                onQuickAction={onQuickAction}
                onUploadReceipt={onUploadReceipt}
                onPreview={onPreview}
                variant={variant}
                compact={variant === 'zen'}
                frequency={frequency}
            />
        </div>
    );
});

export const VirtualClientList: React.FC<VirtualClientListProps> = (props) => {
    // Determine item size based on variant (default to zen for dashboard)
    const variant = props.variant || 'zen';
    const itemSize = variant === 'zen' ? 130 : 280;

    return (
        <div className="w-full h-full" style={{ minHeight: '600px' }}>
            <AutoSizer>
                {({ height, width }) => (
                    <List
                        height={height}
                        itemCount={props.clients.length}
                        itemSize={itemSize}
                        width={width}
                        itemData={props}
                        className="no-scrollbar"
                    >
                        {ClientRow}
                    </List>
                )}
            </AutoSizer>
        </div>
    );
};
