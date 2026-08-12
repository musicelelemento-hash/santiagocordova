
import React, { memo, useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
    customPeriod?: string;
    isTrashView?: boolean;
    isCobrosView?: boolean;
}

interface ClientRowProps {
    index: number;
    style?: React.CSSProperties;
    clients: Client[];
    serviceFees: ServiceFeesConfig;
    onView: (client: Client, tab?: string) => void;
    onQuickAction?: (client: Client, action: 'declare' | 'pay' | 'cancel' | 'revert' | 'deactivate' | 'restore' | 'purge', period?: string) => void;
    onUploadReceipt?: (client: Client, period?: string) => void;
    onPreview?: (client: Client, declaration: Declaration) => void;
    variant?: 'tactical' | 'zen';
    frequency?: 'Mensual' | 'Semestral' | 'Anual' | 'all';
    customPeriod?: string;
    isTrashView?: boolean;
    isCobrosView?: boolean;
}

const ClientRow = memo(({ index, style, clients, serviceFees, onView, onQuickAction, onUploadReceipt, onPreview, variant = 'zen', frequency, customPeriod, isTrashView, isCobrosView }: ClientRowProps) => {
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
                customPeriod={customPeriod}
                isTrashView={isTrashView}
                isCobrosView={isCobrosView}
            />
        </div>
    );
});

export const VirtualClientList: React.FC<VirtualClientListProps> = (props) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const variant = props.variant || 'zen';
    const dynamicItemSize = isMobile ? 380 : 180;
    const finalItemSize = variant === 'zen' ? dynamicItemSize : 300;

    const rowVirtualizer = useVirtualizer({
        count: props.clients.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => finalItemSize,
        overscan: 5,
    });

    return (
        <div ref={parentRef} className="w-full h-full overflow-auto no-scrollbar" style={{ height: 'calc(100vh - 350px)', minHeight: '600px' }}>
            <div
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                    <div
                        key={virtualRow.key}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                        }}
                    >
                        <ClientRow
                            index={virtualRow.index}
                            clients={props.clients}
                            serviceFees={props.serviceFees}
                            onView={props.onView}
                            onQuickAction={props.onQuickAction}
                            onUploadReceipt={props.onUploadReceipt}
                            onPreview={props.onPreview}
                            variant={props.variant}
                            frequency={props.frequency}
                            customPeriod={props.customPeriod}
                            isTrashView={props.isTrashView}
                            isCobrosView={props.isCobrosView}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
