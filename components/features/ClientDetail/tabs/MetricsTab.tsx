import React from 'react';
import { Client } from '../../../../types';
import { FinancialMetricsOverview } from '../FinancialMetricsOverview';

interface MetricsTabProps {
    client: Client;
}

export const MetricsTab: React.FC<MetricsTabProps> = ({ client }) => {
    return (
        <div className="w-full">
            <FinancialMetricsOverview client={client} theme="dark" />
        </div>
    );
};
