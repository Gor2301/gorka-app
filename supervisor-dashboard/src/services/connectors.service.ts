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

export interface EnableResponse {
  row: EnablementRow | null;
  /**
   * Present only when the backend holds a GORKA-managed Tier 1
   * credential for the requested connector code AND the enable was
   * sent with tier1Acknowledged: true. Omitted otherwise. The value
   * is a UTF-8 string (a bare API key for Resend, a JSON string for
   * Twilio). The caller re-encodes it to bytes before calling
   * write_local_connector_credential. See SLICE-5-SPEC §5.
   *
   * This value is a secret. It must never be logged, rendered, or
   * stored anywhere except the local SQLCipher database via
   * write_local_connector_credential.
   */
  credential?: { value: string; configuration: Record<string, any> };
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
    };
  },

  async disable(connectorCode: string): Promise<EnablementRow | null> {
    const body = await api.post<any>('/connectors/disable', { connectorCode });
    return body?.data ?? null;
  },
};