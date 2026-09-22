import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { encryptObject, decryptObject } from '../utils/encryption';
import { authenticateToken } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Helper to get organizationId from request
const getOrgId = (req: Request): string | null => {
  return (req as any).user?.organizationId || null;
};

// Helper function for connector type
function getConnectorType(provider: string): string {
  switch (provider) {
    case 'resend':
    case 'sendgrid':
      return 'EMAIL';
    case 'mocean':
    case 'twilio_sms':
      return 'SMS';
    case 'twilio_voice':
      return 'VOICE';
    default:
      return 'DATA_SOURCE';
  }
}

// ─── GET /api/connectors ──────────────────────────────────────────────
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = getOrgId(req);
    
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const connectors = await prisma.connector.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        category: true,
        provider: true,
        isDefault: true,
        isEnabled: true,
        status: true,
        lastTestedAt: true,
        acknowledged: true,
      }
    });
    
    const connectorsWithCredentials = await Promise.all(
      connectors.map(async (connector) => {
        const raw = await prisma.connector.findFirst({
          where: { id: connector.id },
          select: { credentials: true }
        });
        return {
          ...connector,
          hasCredentials: !!raw?.credentials
        };
      })
    );
    
    return res.json({
      success: true,
      data: connectorsWithCredentials
    });
  } catch (error) {
    console.error('Error fetching connectors:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch connectors' });
  }
});

// ─── GET /api/connectors/types ────────────────────────────────────────
// ✅ MOVED HERE — BEFORE /:id SO IT DOESN'T GET INTERCEPTED
router.get('/types', authenticateToken, async (req: Request, res: Response) => {
  console.log('🟥🟥🟥 CONNECTOR TYPES HANDLER EXECUTING — BUILD IS FRESH 🟥🟥🟥');
  try {
    const connectorTypes = [
      { 
        id: 'resend',
        provider: 'resend', 
        type: 'EMAIL', 
        category: 'EXTERNAL', 
        name: 'Resend',
        description: 'Email delivery service for transactional emails',
        status: 'DISCONNECTED',
        hasCredentials: false,
        isDefault: true,
        isEnabled: true,
        acknowledged: false,
      },
      { 
        id: 'mocean',
        provider: 'mocean', 
        type: 'SMS', 
        category: 'EXTERNAL', 
        name: 'Mocean',
        description: 'SMS and Voice API for messaging',
        status: 'DISCONNECTED',
        hasCredentials: false,
        isDefault: false,
        isEnabled: true,
        acknowledged: false,
      },
      { 
        id: 'twilio_voice',
        provider: 'twilio_voice', 
        type: 'VOICE', 
        category: 'EXTERNAL', 
        name: 'Twilio Voice',
        description: 'Voice calling API',
        status: 'DISCONNECTED',
        hasCredentials: false,
        isDefault: false,
        isEnabled: true,
        acknowledged: false,
      },
      { 
        id: 'sendgrid',
        provider: 'sendgrid', 
        type: 'EMAIL', 
        category: 'EXTERNAL', 
        name: 'SendGrid',
        description: 'Email delivery service',
        status: 'DISCONNECTED',
        hasCredentials: false,
        isDefault: false,
        isEnabled: true,
        acknowledged: false,
      },
      { 
        id: 'twilio_sms',
        provider: 'twilio_sms', 
        type: 'SMS', 
        category: 'EXTERNAL', 
        name: 'Twilio SMS',
        description: 'SMS messaging API',
        status: 'DISCONNECTED',
        hasCredentials: false,
        isDefault: false,
        isEnabled: true,
        acknowledged: false,
      },
      { 
        id: 'external_api',
        provider: 'external_api', 
        type: 'DATA_SOURCE', 
        category: 'EXTERNAL', 
        name: 'External API',
        description: 'Connect to any external REST API',
        status: 'DISCONNECTED',
        hasCredentials: false,
        isDefault: false,
        isEnabled: true,
        acknowledged: false,
      },
    ];
    
    console.log('🟢 Returning connector types:', connectorTypes.length);
    return res.json({
      success: true,
      data: connectorTypes
    });
  } catch (error) {
    console.error('Error fetching connector types:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch connector types' });
  }
});

// ─── POST /api/connectors/:id/connect-auto ────────────────────────────
// For built-in connectors — uses credentials from .env
router.post('/:id/connect-auto', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = getOrgId(req);
    const { id } = req.params;
    
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    // ─── Get provider from connector ID ────────────────────────────────
    // Map connector ID to provider
    const providerMap: Record<string, string> = {
      'resend': 'resend',
      'mocean': 'mocean',
      'twilio_voice': 'twilio_voice',
      'twilio_sms': 'twilio_sms',
      'sendgrid': 'sendgrid',
    };
    
    const provider = providerMap[id];
    if (!provider) {
      return res.status(400).json({ 
        success: false, 
        error: 'Auto-connect not supported for this connector' 
      });
    }
    
    // ─── Get credentials from .env ──────────────────────────────────────
    let credentials: Record<string, any> = {};
    let config: Record<string, any> = {};
    
    switch (provider) {
      case 'resend':
        credentials = { apiKey: process.env.RESEND_API_KEY || '' };
        config = { apiUrl: 'https://api.resend.com' };
        break;
      case 'mocean':
        credentials = { 
          apiKey: process.env.MOCEAN_API_KEY || '',
          apiSecret: process.env.MOCEAN_API_SECRET || ''
        };
        config = { apiUrl: 'https://rest.moceanapi.com' };
        break;
      case 'twilio_voice':
      case 'twilio_sms':
        credentials = {
          accountSid: process.env.TWILIO_ACCOUNT_SID || '',
          authToken: process.env.TWILIO_AUTH_TOKEN || ''
        };
        config = { apiUrl: 'https://api.twilio.com' };
        break;
      case 'sendgrid':
        credentials = { apiKey: process.env.SENDGRID_API_KEY || '' };
        config = { apiUrl: 'https://api.sendgrid.com/v3' };
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Unknown provider' 
        });
    }
    
    // ─── Check if credentials exist ─────────────────────────────────────
    const hasCredentials = Object.values(credentials).some(v => v && v !== 'your_*' && v !== '');
    if (!hasCredentials) {
      return res.status(400).json({
        success: false,
        error: `${provider} credentials not configured in .env. Please add them.`
      });
    }
    
    // ─── Encrypt and save ──────────────────────────────────────────────
    const encryptedConfig = encryptObject(config);
    const encryptedCredentials = encryptObject(credentials);
    
    // Check if connector exists
    let connector = await prisma.connector.findFirst({
      where: { id, organizationId }
    });
    
    if (connector) {
      // Update existing
      connector = await prisma.connector.update({
        where: { id: connector.id },
        data: {
          config: encryptedConfig,
          credentials: encryptedCredentials,
          status: 'CONNECTED',
          isEnabled: true,
          acknowledged: true,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new
      connector = await prisma.connector.create({
        data: {
          id,
          name: provider.charAt(0).toUpperCase() + provider.slice(1).replace('_', ' '),
          provider,
          type: getConnectorType(provider),
          category: 'EXTERNAL',
          organizationId,
          config: encryptedConfig,
          credentials: encryptedCredentials,
          status: 'CONNECTED',
          isEnabled: true,
          isDefault: false,
          acknowledged: true,
        }
      });
    }
    
    return res.json({
      success: true,
      data: {
        id: connector.id,
        status: connector.status,
        hasCredentials: true
      }
    });
    
  } catch (error) {
    console.error('Error auto-connecting connector:', error);
    return res.status(500).json({ success: false, error: 'Failed to connect connector' });
  }
});

// ─── GET /api/connectors/:id ──────────────────────────────────────────
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = getOrgId(req);
    const { id } = req.params;
    
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const connector = await prisma.connector.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        category: true,
        provider: true,
        isDefault: true,
        isEnabled: true,
        status: true,
        lastTestedAt: true,
        acknowledged: true,
        credentials: true
      }
    });
    
    if (!connector) {
      return res.status(404).json({ success: false, error: 'Connector not found' });
    }
    
    const hasCredentials = !!connector.credentials;
    const { credentials, ...connectorWithoutCredentials } = connector;
    
    return res.json({
      success: true,
      data: {
        ...connectorWithoutCredentials,
        hasCredentials
      }
    });
  } catch (error) {
    console.error('Error fetching connector:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch connector' });
  }
});

// ─── POST /api/connectors/:id/connect ────────────────────────────────
router.post('/:id/connect', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = getOrgId(req);
    const { id } = req.params;
    const { acknowledged, config, credentials } = req.body;
    
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    if (!acknowledged) {
      return res.status(400).json({
        success: false,
        error: 'You must acknowledge the third-party connection declaration'
      });
    }
    
    const connector = await prisma.connector.findFirst({
      where: { id, organizationId }
    });
    
    if (!connector) {
      return res.status(404).json({ success: false, error: 'Connector not found' });
    }
    
    const encryptedConfig = encryptObject(config || {});
    const encryptedCredentials = encryptObject(credentials || {});
    
    const updated = await prisma.connector.update({
      where: { id },
      data: {
        config: encryptedConfig,
        credentials: encryptedCredentials,
        status: 'CONNECTED',
        acknowledged: true,
        updatedAt: new Date()
      }
    });
    
    return res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        hasCredentials: true
      }
    });
  } catch (error) {
    console.error('Error connecting connector:', error);
    return res.status(500).json({ success: false, error: 'Failed to connect connector' });
  }
});

// ─── POST /api/connectors/:id/disconnect ─────────────────────────────
router.post('/:id/disconnect', authenticateToken, async (req: Request, res: Response) => {
  try {
    const organizationId = getOrgId(req);
    const { id } = req.params;
    
    if (!organizationId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const connector = await prisma.connector.findFirst({
      where: { id, organizationId }
    });
    
    if (!connector) {
      return res.status(404).json({ success: false, error: 'Connector not found' });
    }
    
    const updated = await prisma.connector.update({
      where: { id },
      data: {
        status: 'DISCONNECTED',
        isEnabled: false,
        updatedAt: new Date()
      }
    });
    
    return res.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status
      }
    });
  } catch (error) {
    console.error('Error disconnecting connector:', error);
    return res.status(500).json({ success: false, error: 'Failed to disconnect connector' });
  }
});

// ─── POST /api/connectors/:id/test ────────────────────────────────────
router.post('/:id/test', authenticateToken, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    console.log('🔵 [TEST] Stage 0: Endpoint reached');
    const organizationId = getOrgId(req);
    const { id } = req.params;
    
    if (!organizationId) {
      console.log('🔴 [TEST] Stage 0: Unauthorized - no organizationId');
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    console.log('🔵 [TEST] Stage 1: Fetching connector from database');
    const connector = await prisma.connector.findFirst({
      where: { id, organizationId }
    });
    
    if (!connector) {
      console.log('🔴 [TEST] Stage 1: Connector not found');
      return res.status(404).json({ success: false, error: 'Connector not found' });
    }
    console.log('🔵 [TEST] Stage 1: Connector found -', connector.name);
    
    // Stage 2: Decrypt config
    console.log('🔵 [TEST] Stage 2: Decrypting config');
    let config: any = {};
    try {
      const decrypted = decryptObject(connector.config);
      console.log('🔵 [TEST] Stage 2: Decrypted raw:', decrypted);
      console.log('🔵 [TEST] Stage 2: Decrypted type:', typeof decrypted);
      
      config = typeof decrypted === 'string' ? JSON.parse(decrypted) : decrypted;
      console.log('🔵 [TEST] Stage 2: Parsed config:', JSON.stringify(config, null, 2));
      console.log('🔵 [TEST] Stage 2: Config loaded successfully');
      console.log('🔵 [TEST] Stage 2: baseUrl =', config.baseUrl);
      console.log('🔵 [TEST] Stage 2: authType =', config.authType);
      console.log('🔵 [TEST] Stage 2: All keys =', Object.keys(config));
    } catch (err) {
      console.log('🔴 [TEST] Stage 2: Failed to decrypt config');
      console.log('🔴 [TEST] Stage 2: Error:', err);
      return res.status(400).json({ 
        success: false, 
        stage: 'config_decrypt',
        error: 'Invalid connector configuration' 
      });
    }
    
    // Stage 3: Check if external API connector
    if (!config.baseUrl || !config.authType) {
      console.log('🔴 [TEST] Stage 3: Not an external API connector');
      return res.status(400).json({
        success: false,
        stage: 'config_validation',
        error: 'This connector is not configured as an external API connector'
      });
    }
    console.log('🔵 [TEST] Stage 3: Valid external API connector');
    
    // Stage 4: Decrypt credentials
    console.log('🔵 [TEST] Stage 4: Decrypting credentials');
    let credentials: any = {};
    try {
      credentials = decryptObject(connector.credentials);
      console.log('🔵 [TEST] Stage 4: Credentials loaded successfully');
      const hasCreds = !!credentials.apiKey || !!credentials.bearerToken || (!!credentials.username && !!credentials.password);
      console.log('🔵 [TEST] Stage 4: Credentials present:', hasCreds);
    } catch (err) {
      console.log('🔴 [TEST] Stage 4: Failed to decrypt credentials');
      return res.status(400).json({ 
        success: false, 
        stage: 'credentials_decrypt',
        error: 'Invalid credentials' 
      });
    }
    
    // Stage 5: Build request
    console.log('🔵 [TEST] Stage 5: Building request');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(config.headers || {})
    };
    
    // Add authentication
    if (config.authType === 'API Key') {
      headers['X-API-Key'] = credentials.apiKey || 'test-key';
      console.log('🔵 [TEST] Stage 5: Auth type = API Key');
    } else if (config.authType === 'Bearer Token') {
      headers['Authorization'] = `Bearer ${credentials.bearerToken || 'test-token'}`;
      console.log('🔵 [TEST] Stage 5: Auth type = Bearer Token');
    } else if (config.authType === 'Basic Auth') {
      const auth = Buffer.from(`${credentials.username || 'test'}:${credentials.password || 'test'}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
      console.log('🔵 [TEST] Stage 5: Auth type = Basic Auth');
    } else {
      console.log('🔴 [TEST] Stage 5: Unsupported auth type');
      return res.status(400).json({ 
        success: false, 
        stage: 'auth_type',
        error: `Unsupported auth type: ${config.authType}` 
      });
    }
    
    // Stage 6: Build test payload
    console.log('🔵 [TEST] Stage 6: Building test payload');
    const testPayload = {
      test: true,
      source: 'gorka',
      connectorId: id,
      timestamp: new Date().toISOString()
    };
    
    console.log('🔵 [TEST] Stage 6: Payload:', JSON.stringify(testPayload));
    
    // Stage 7: Build URL
    console.log('🔵 [TEST] Stage 7: Building URL');
    let fullUrl = config.baseUrl;
    console.log('🔵 [TEST] Stage 7: Base URL:', fullUrl);
    
    // Stage 8: SSRF Validation
    console.log('🔵 [TEST] Stage 8: SSRF Validation');
    console.log('🔵 [TEST] Stage 8: fullUrl =', fullUrl);
    
    try {
      const { validateRequestUrl } = require('../utils/ssrf');
      validateRequestUrl(fullUrl);
      console.log('🔵 [TEST] Stage 8: SSRF Validation PASSED');
    } catch (err: any) {
      console.log('🔴 [TEST] Stage 8: SSRF Validation FAILED:', err.message);
      return res.status(400).json({
        success: false,
        stage: 'ssrf_validation',
        error: err.message || 'SSRF validation failed',
        url: fullUrl
      });
    }
    
    // Stage 9: HTTP Request
    console.log('🔵 [TEST] Stage 9: Making HTTP request');
    console.log('🔵 [TEST] Stage 9: URL:', fullUrl);
    console.log('🔵 [TEST] Stage 9: Method: POST');
    console.log('🔵 [TEST] Stage 9: Headers:', JSON.stringify(headers));
    
    let response;
    try {
      const { http } = require('../utils/http-client');
      response = await http.post(fullUrl, testPayload, { headers });
      console.log('🔵 [TEST] Stage 9: HTTP request COMPLETED');
      console.log('🔵 [TEST] Stage 9: Status:', response.status);
      console.log('🔵 [TEST] Stage 9: Duration:', response.durationMs, 'ms');
    } catch (err: any) {
      console.log('🔴 [TEST] Stage 9: HTTP request FAILED');
      console.log('🔴 [TEST] Stage 9: Error:', err.message);
      return res.status(500).json({
        success: false,
        stage: 'http_request',
        error: err.message || 'HTTP request failed',
        durationMs: Date.now() - startTime
      });
    }
    
    // Stage 10: Update lastTestedAt
    console.log('🔵 [TEST] Stage 10: Updating lastTestedAt');
    await prisma.connector.update({
      where: { id },
      data: {
        lastTestedAt: new Date()
      }
    });
    
    // Stage 11: Success
    console.log('✅ [TEST] ALL STAGES COMPLETE - SUCCESS');
    return res.json({
      success: true,
      stage: 'complete',
      data: {
        status: response.status,
        durationMs: response.durationMs,
        message: 'Test successful'
      }
    });
    
  } catch (error: any) {
    console.log('🔴 [TEST] UNHANDLED ERROR:', error.message);
    return res.status(500).json({ 
      success: false, 
      stage: 'unhandled',
      error: error.message || 'Failed to test connector',
      durationMs: Date.now() - startTime
    });
  }
});

console.log('🟢 Connector routes registered: /, /types, /:id/connect-auto, /:id, /:id/connect, /:id/disconnect, /:id/test');

export default router;