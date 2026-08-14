import { logger } from '../config/logger';

// Message worker is temporarily disabled
// import { messageWorker } from './message-worker';

export function startWorkers() {
  logger.info('🚀 Starting workers...');
  
  // TODO: Re-enable when message-worker.ts is fixed
  // messageWorker.start();
  
  logger.info('✅ Workers started successfully');
}

export function stopWorkers() {
  logger.info('🛑 Stopping workers...');
  // messageWorker.stop();
  logger.info('✅ Workers stopped');
}