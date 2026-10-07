import { api } from './api.service';

export interface CatalogEntry {
  code: string;
  name: string;
  description: string | null;
  category: 'SMS' | 'VOICE' | 'EMAIL' | 'AI' | 'PUSH';
  provider: string;
  isManagedByGorka: boolean;
  mvpStatus: 'LIVE' | 'COMING_SOON';
}

export interface EnablementRow {
  id: string;
  organizationId: string;
  connectorCode: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  credentialsLocation: 'LOCAL' | 'CLOUD';
  connectedAt: string | null;
  disconnectedAt: string | null;
}

export const connectorsService = {
  async listCatalog(): Promise<CatalogEntry[]> {
    const body = await api.get<any>('/connectors/catalog');
    return body?.data?.rows ?? [];
  },

  async listEnablements(): Promise<EnablementRow[]> {
    const body = await api.get<any>('/connectors');
    return body?.data?.rows ?? [];
  },

  async enable(
    connectorCode: string,
    options?: { zone3Acknowledged?: boolean; tier1Acknowledged?: boolean },
  ): Promise<EnablementRow | null> {
    const body = await api.post<any>('/connectors/enable', {
      connectorCode,
      credentialsLocation: 'LOCAL',
      zone3Acknowledged: options?.zone3Acknowledged === true,
      tier1Acknowledged: options?.tier1Acknowledged === true,
    });
    return body?.data ?? null;
  },

  async disable(connectorCode: string): Promise<EnablementRow | null> {
    const body = await api.post<any>('/connectors/disable', { connectorCode });
    return body?.data ?? null;
  },
};