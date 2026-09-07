import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GORKA Debt Collection Platform API',
      version: '1.0.0',
      description: `
# 🏦 GORKA Collection Platform

> **Start Ready. Customize Freely. Scale Confidently.**

## Core Capabilities:
- **Debtor Management** - Full lifecycle tracking
- **Omnichannel Communications** - Email, SMS, Push, WhatsApp
- **Action Management** - Automated workflows with email triggers
- **Analytics & Reporting** - Real-time insights and KPIs

## Architecture:
- 🔒 **Org-scoped** - Multi-tenant isolation
- ⚡ **Queue-based** - Reliable async processing with BullMQ
- 📊 **Event-driven** - Full audit trails
- 🔐 **JWT Auth** - Secure by design
      `,
      contact: {
        name: 'GORKA Team',
        email: 'support@gorka.com',
        url: 'https://gorka.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Development Server'
      },
      {
        url: 'https://api.gorka.com/api',
        description: 'Production Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token'
        }
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'DEBTOR_001'
                },
                message: {
                  type: 'string',
                  example: 'Debtor not found in your organization'
                },
                statusCode: {
                  type: 'number',
                  example: 404
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  example: '2026-08-09T14:32:15.000Z'
                },
                requestId: {
                  type: 'string',
                  example: 'req_abc123'
                }
              }
            }
          }
        },
        Debtor: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'debtor_123' },
            name: { type: 'string', example: 'John Smith' },
            email: { type: 'string', example: 'john.smith@example.com' },
            phone: { type: 'string', example: '+1 (555) 123-4567' },
            organizationId: { type: 'string', example: 'org_456' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        MessageLog: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'msg_789' },
            channel: { type: 'string', enum: ['EMAIL', 'SMS', 'PUSH', 'WHATSAPP'] },
            contactEmail: { type: 'string', example: 'john.smith@example.com' },
            contactName: { type: 'string', example: 'John Smith' },
            userId: { type: 'string', example: 'user_123' },
            debtorId: { type: 'string', example: 'debtor_456', nullable: true },
            subject: { type: 'string', example: 'Payment Reminder' },
            status: { type: 'string', enum: ['PENDING', 'SENT', 'FAILED', 'SCHEDULED'] },
            sentAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    tags: [
      {
        name: 'Auth',
        description: 'Authentication endpoints'
      },
      {
        name: 'Debtors',
        description: 'Debtor management and profiles'
      },
      {
        name: 'Communications',
        description: 'Omnichannel communication sending'
      },
      {
        name: 'Actions',
        description: 'Action management with triggers'
      },
      {
        name: 'Health',
        description: 'Service health and monitoring'
      }
    ]
  },
  apis: ['./src/backend/routes/*.ts', './src/backend/api/**/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);