import { api } from './api.service';

export interface CredentialField {
  name: string;
  label: string;
  type: 'password' | 'text' | 'email' | 'tel';
  required: boolean;
  placeholder?: string;
  default?: string;
}

export interface CredentialSchema {
  credentials: CredentialField[];
  configuration: CredentialField[];
}

export interface CatalogEntry {
  code: string;
  name: string;
  description: string | null;
  category: 'SMS' | 'VOICE' | 'EMAIL' | 'AI' | 'PUSH';
  provider: string;
  isManagedByGorka: boolean;
  mvpStatus: 'LIVE' | 'COMING_SOON';
  credentialSchema?: CredentialSchema | null;
}

export interface EnablementRow {
  id: string;
  organizationId: string;
  connectorCode: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  credentialsLocation: 'LOCAL' | 'CLOUD';
  credentialSource: 'GORKA' | 'BYOP' | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
}

export interface EnableResponse {
  row: EnablementRow | null;
  credential?: { value: string; configuration: Record<string, any> };
  alreadyEnabled?: boolean;
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
  ): Promise<EnableResponse> {
    const body = await api.post<any>('/connectors/enable', {
      connectorCode,
      credentialsLocation: 'LOCAL',
      zone3Acknowledged: options?.zone3Acknowledged === true,
      tier1Acknowledged: options?.tier1Acknowledged === true,
    });
    return {
      row: body?.data ?? null,
      credential: body?.credential,
      alreadyEnabled: body?.alreadyEnabled,
    };
  },
  async disable(connectorCode: string): Promise<EnablementRow | null> {
    const body = await api.post<any>('/connectors/disable', { connectorCode });
    return body?.data ?? null;
  },
};