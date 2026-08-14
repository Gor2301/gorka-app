import * as express from 'express';
import { EmailService } from '../services/email.service';
import { PushService } from '../services/push.service';
import { requireTenant } from '../middleware/tenant';
import { authenticateToken } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
      user?: any;
    }
  }
}

// ==================== IN-MEMORY STORE ====================
let communicationsStore: any[] = [];

// ==================== GET ALL COMMUNICATIONS ====================
router.get('/', authenticateToken, requireTenant, async (req, res) => {
  try {
    // Filter by organization
    const filtered = communicationsStore.filter(c => c.organizationId === req.organizationId);
    
    res.json({
      success: true,
      data: filtered,
      message: 'Communications retrieved successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve communications'
    });
  }
});

// ==================== GET COMMUNICATION BY ID ====================
router.get('/:id', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const comm = communicationsStore.find(c => c.id === id && c.organizationId === req.organizationId);
    if (comm) {
      res.json({
        success: true,
        data: comm,
        message: 'Communication retrieved successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Communication not found'
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve communication'
    });
  }
});

// ==================== CREATE COMMUNICATION ====================
router.post('/', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { to, subject, content, channel, debtorId } = req.body;
    const newComm = {
      id: `comm_${Date.now()}`,
      channel,
      subject,
      content,
      status: 'PENDING',
      contactEmail: to,
      debtorId,
      organizationId: req.organizationId,
      createdAt: new Date().toISOString()
    };
    communicationsStore.unshift(newComm);
    res.status(201).json({
      success: true,
      data: newComm,
      message: 'Communication created successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create communication'
    });
  }
});

// ==================== SMS SENDING ENDPOINT ====================
router.post('/sms', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { to, message, from, debtorId } = req.body;

    console.log('📤 Received SMS request:', { to, message, from });

    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: to'
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: message'
      });
    }

    const cleanTo = to.replace(/[^0-9]/g, '');
    const token = process.env.MOCEAN_TOKEN;
    const fromNumber = from || 'MOCEAN';

    console.log(`📤 Sending SMS to: ${cleanTo}`);
    console.log(`📝 Message: ${message}`);

    const params = new URLSearchParams();
    params.append('mocean-from', fromNumber);
    params.append('mocean-to', cleanTo);
    params.append('mocean-text', message);

    const response = await fetch('https://rest.moceanapi.com/rest/2/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${token}`
      },
      body: params.toString()
    });

    const text = await response.text();
    console.log('📨 Mocean response:', text);

    const statusMatch = text.match(/<status>(\d+)<\/status>/);
    const msgidMatch = text.match(/<msgid>([^<]+)<\/msgid>/);
    const errMsgMatch = text.match(/<err_msg>([^<]+)<\/err_msg>/);

    const status = statusMatch ? statusMatch[1] : '1';
    const msgid = msgidMatch ? msgidMatch[1] : undefined;
    const errMsg = errMsgMatch ? errMsgMatch[1] : undefined;

    if (status === '0') {
      // ✅ Save to communication history with org
      communicationsStore.unshift({
        id: msgid || `sms_${Date.now()}`,
        channel: 'SMS',
        subject: 'SMS Message',
        content: message,
        status: 'SENT',
        contactEmail: cleanTo,
        debtorId: debtorId || null,
        organizationId: req.organizationId,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      console.log('📊 Communications store size:', communicationsStore.length);

      return res.status(200).json({
        success: true,
        messageId: msgid,
        status: 'SENT',
        provider: 'mocean'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: errMsg || 'Failed to send SMS',
        details: text
      });
    }
  } catch (error: any) {
    console.error('Error sending SMS:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// ==================== SMS HEALTH ====================
router.get('/sms/health', async (req, res) => {
  try {
    const response = await fetch('https://rest.moceanapi.com/rest/2/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${process.env.MOCEAN_TOKEN}`
      },
      body: new URLSearchParams({
        'mocean-from': 'MOCEAN',
        'mocean-to': '639999999999',
        'mocean-text': 'ping'
      }).toString()
    });

    res.json({
      success: true,
      healthy: response.status === 200,
      provider: 'mocean'
    });
  } catch (error: any) {
    res.json({
      success: false,
      healthy: false,
      error: error.message
    });
  }
});

// ==================== EMAIL SENDING ENDPOINT ====================
router.post('/email', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { to, subject, content, from, replyTo, cc, bcc, debtorId } = req.body;

    if (!to || !subject || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, subject, content'
      });
    }

    const emailService = new EmailService();
    const result = await emailService.sendEmail({
      to,
      subject,
      content,
      from,
      replyTo,
      cc,
      bcc
    });

    if (result.success) {
      // ✅ Save to communication history with org
      communicationsStore.unshift({
        id: result.messageId || `email_${Date.now()}`,
        channel: 'EMAIL',
        subject: subject,
        content: content,
        status: 'SENT',
        contactEmail: Array.isArray(to) ? to.join(', ') : to,
        debtorId: debtorId || null,
        organizationId: req.organizationId,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      console.log('📊 Communications store size:', communicationsStore.length);

      return res.status(200).json({
        success: true,
        messageId: result.messageId,
        status: result.status,
        provider: result.provider
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send email'
      });
    }
  } catch (error: any) {
    console.error('Error sending email:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// ==================== EMAIL HEALTH ====================
router.get('/email/health', async (req, res) => {
  res.json({
    success: true,
    healthy: true,
    provider: 'resend'
  });
});

// ==================== PUSH SENDING ENDPOINT ====================
router.post('/push', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { userId, title, body, icon, badge, sound, data, debtorId } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, title, body'
      });
    }

    const pushService = new PushService();
    const result = await pushService.sendPush({
      userId,
      title,
      body,
      icon,
      badge,
      sound,
      data
    });

    if (result.success) {
      // ✅ Save to communication history with org
      communicationsStore.unshift({
        id: result.messageId || `push_${Date.now()}`,
        channel: 'PUSH',
        subject: title,
        content: body,
        status: 'SENT',
        contactEmail: userId,
        debtorId: debtorId || null,
        organizationId: req.organizationId,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      console.log('📊 Communications store size:', communicationsStore.length);

      return res.status(200).json({
        success: true,
        messageId: result.messageId,
        status: result.status,
        provider: result.provider
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send push notification'
      });
    }
  } catch (error: any) {
    console.error('Error sending push:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// ==================== PUSH HEALTH ====================
router.get('/push/health', async (req, res) => {
  res.json({
    success: true,
    healthy: true,
    provider: 'mock-push'
  });
});

// ==================== VOICE (MOCK) SENDING ENDPOINT ====================
router.post('/voice', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { to, message, from, voice, language, debtorId } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: to, message'
      });
    }

    console.log('📞 [MOCK] Voice call request:');
    console.log(`  To: ${to}`);
    console.log(`  Message: ${message}`);

    const success = Math.random() < 0.95;

    if (success) {
      // ✅ Save to communication history with org
      communicationsStore.unshift({
        id: `voice_${Date.now()}`,
        channel: 'VOICE',
        subject: 'Voice Call (Mock)',
        content: message,
        status: 'SENT',
        contactEmail: to,
        debtorId: debtorId || null,
        organizationId: req.organizationId,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      console.log('📊 Communications store size:', communicationsStore.length);

      return res.status(200).json({
        success: true,
        callId: `mock_call_${Date.now()}`,
        status: 'SENT',
        provider: 'mock-voice'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Mock voice call failed (simulated)'
      });
    }
  } catch (error: any) {
    console.error('Error making voice call:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// ==================== VOICE HEALTH ====================
router.get('/voice/health', async (req, res) => {
  res.json({
    success: true,
    healthy: true,
    provider: 'mock-voice'
  });
});

// ==================== LIVE VOICE CALL ENDPOINTS (Twilio) ====================

/**
 * Initiate a live voice call (Click-to-Call)
 * POST /api/communications/call
 * 
 * Request body:
 * {
 *   "debtorPhone": "+639610489002",
 *   "agentPhone": "+639610489002"
 * }
 */
router.post('/call', authenticateToken, requireTenant, async (req, res) => {
  try {
    const { debtorPhone, agentPhone } = req.body;

    if (!debtorPhone || !agentPhone) {
      return res.status(400).json({
        success: false,
        error: 'Missing debtorPhone or agentPhone'
      });
    }

    // Get Twilio credentials from environment
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioPhone) {
      return res.status(500).json({
        success: false,
        error: 'Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env'
      });
    }

    // Dynamically import TwilioVoiceProvider (avoid circular dependency)
    const { TwilioVoiceProvider } = require('../providers/voice/twilio.voice.provider');

    const provider = new TwilioVoiceProvider({
      accountSid,
      authToken,
      phoneNumber: twilioPhone,
      baseUrl: process.env.BASE_URL || 'http://localhost:3000'
    });

    const result = await provider.initiateCall({
      debtorPhone,
      agentPhone
    });

    if (result.success) {
      // Save to communication history with org
      communicationsStore.unshift({
        id: `call_${Date.now()}`,
        channel: 'VOICE',
        subject: 'Live Agent Call',
        content: `Agent: ${agentPhone} → Debtor: ${debtorPhone}`,
        status: 'INITIATED',
        contactEmail: debtorPhone,
        callSid: result.callSid,
        organizationId: req.organizationId,
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      console.log('📊 Communications store size:', communicationsStore.length);

      return res.status(200).json({
        success: true,
        callSid: result.callSid,
        status: result.status
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to initiate call'
      });
    }
  } catch (error: any) {
    console.error('Call initiation error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * TwiML response for call connection
 * GET /api/communications/voice/twiml
 */
router.get('/voice/twiml', async (req, res) => {
  const debtorPhone = req.query.debtor as string;

  if (!debtorPhone) {
    return res.status(400).send('Missing debtor phone number');
  }

  const twilioPhone = process.env.TWILIO_PHONE_NUMBER || '';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="woman">
    Connecting you to the debtor. Please wait.
  </Say>
  <Dial callerId="${twilioPhone}">
    <Number>${debtorPhone}</Number>
  </Dial>
</Response>`;

  res.set('Content-Type', 'text/xml');
  res.send(twiml);
});

/**
 * Call Status Webhook
 * POST /api/communications/voice/status
 */
router.post('/voice/status', async (req, res) => {
  try {
    const { CallSid, CallStatus, Duration, From, To } = req.body;

    console.log(`📞 Call ${CallSid} status: ${CallStatus}`);

    // Update call record in history
    const callRecord = communicationsStore.find(c => c.callSid === CallSid);
    if (callRecord) {
      callRecord.status = CallStatus.toUpperCase();
      if (CallStatus === 'completed' && Duration) {
        callRecord.duration = Duration;
        callRecord.sentAt = new Date().toISOString();
        callRecord.status = 'COMPLETED';
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Status webhook error:', error);
    res.sendStatus(500);
  }
});

// ==================== DEBUG ENDPOINT ====================
router.get('/debug/store', authenticateToken, requireTenant, async (req, res) => {
  const filtered = communicationsStore.filter(c => c.organizationId === req.organizationId);
  res.json({
    count: filtered.length,
    data: filtered
  });
});

export default router;