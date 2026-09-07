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

// GET /api/connectors
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

// GET /api/connectors/:id
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

// POST /api/connectors/:id/connect
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

// POST /api/connectors/:id/disconnect
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

// POST /api/connectors/:id/test - Test external API connection
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

// GET /api/connectors/types
router.get('/types', authenticateToken, async (req: Request, res: Response) => {
  try {
    const connectorTypes = [
      { provider: 'resend', type: 'EMAIL', category: 'EXTERNAL', name: 'Resend' },
      { provider: 'mocean', type: 'SMS', category: 'EXTERNAL', name: 'Mocean' },
      { provider: 'twilio_voice', type: 'VOICE', category: 'EXTERNAL', name: 'Twilio Voice' },
      { provider: 'sendgrid', type: 'EMAIL', category: 'EXTERNAL', name: 'SendGrid' },
      { provider: 'twilio_sms', type: 'SMS', category: 'EXTERNAL', name: 'Twilio SMS' },
      { provider: 'external_api', type: 'DATA_SOURCE', category: 'EXTERNAL', name: 'External API' },
    ];
    
    return res.json({
      success: true,
      data: connectorTypes
    });
  } catch (error) {
    console.error('Error fetching connector types:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch connector types' });
  }
});

export default router;