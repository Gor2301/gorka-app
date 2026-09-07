import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../docs/swagger';

const router = express.Router();

// Swagger UI
router.use('/docs', swaggerUi.serve);
router.get('/docs', swaggerUi.setup(swaggerSpec, {
  customCss: `
    .swagger-ui .topbar { background-color: #1A237E; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    .swagger-ui .info .title { color: #1A237E; }
    .swagger-ui .btn.authorize { border-color: #00BCD4; color: #00BCD4; }
    .swagger-ui .btn.authorize svg { fill: #00BCD4; }
  `,
  customSiteTitle: 'GORKA API Documentation',
  // ✅ ADD THIS - enables Try it out functionality
  swaggerOptions: {
    tryItOutEnabled: true,
    persistAuthorization: true,
  }
}));

// Raw OpenAPI spec
router.get('/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

export default router;