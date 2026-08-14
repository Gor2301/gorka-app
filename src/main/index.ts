import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { app, BrowserWindow } from 'electron';

// Import route modules
import authRoutes from '../backend/routes/auth';
import debtorRoutes from '../backend/routes/debtors';
import actionRoutes from '../backend/routes/actions';
import communicationRoutes from '../backend/routes/communications';
import templateRoutes from '../backend/routes/templates';
import copilotRoutes from '../backend/routes/copilot.routes';

// Import logger
import { logger } from '../backend/config/logger';

dotenv.config();

const expressApp = express();
const PORT = process.env.PORT || 3000;

// Middleware
expressApp.use(cors());
expressApp.use(express.json());

// Swagger UI (if it exists)
try {
  const { swaggerUi, swaggerSpec } = require('../backend/config/swagger');
  expressApp.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  expressApp.get('/api/docs.json', (req, res) => {
    res.json(swaggerSpec);
  });
} catch (error) {
  console.log('Swagger not configured, skipping...');
}

// API Routes
expressApp.use('/api/auth', authRoutes);
expressApp.use('/api/debtors', debtorRoutes);
expressApp.use('/api/actions', actionRoutes);
expressApp.use('/api/communications', communicationRoutes);
expressApp.use('/api/templates', templateRoutes);
expressApp.use('/api/copilot', copilotRoutes);

// Health check
expressApp.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = createServer(expressApp);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

server.listen(PORT, () => {
  logger.info(`🚀 GORKA Application initialized`);
  logger.info(`🚀 Express server running on http://localhost:${PORT}`);
  logger.info(`📚 Swagger docs available at http://localhost:${PORT}/api/docs`);
  logger.info(`🤖 Copilot available at http://localhost:${PORT}/api/copilot/health`);
});

// ============================================
// Electron Window Creation
// ============================================

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  // Load the index.html of the app
  const indexPath = path.join(__dirname, '../renderer/index.html');
  console.log('Loading index from:', indexPath);
  mainWindow.loadFile(indexPath);

  // Open the DevTools (remove for production)
  mainWindow.webContents.openDevTools();

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS applications usually stay open until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});