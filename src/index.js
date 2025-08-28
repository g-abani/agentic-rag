/**
 * Agentic RAG Application Server
 * 
 * A comprehensive Node.js application demonstrating intelligent 
 * Retrieval-Augmented Generation with LangGraph, Azure OpenAI, and Azure AI Search.
 * 
 * Features:
 * - Dual agent architecture (Workflow vs React)
 * - Intelligent RAG decision making
 * - Interactive web interface
 * - Comprehensive API with health monitoring
 * - Performance optimization and error handling
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

import config from './config/index.js';
import apiRoutes from './routes/index.js';
import { logger, formatError, PerformanceMonitor } from './utils/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AgenticRAGServer {
  constructor() {
    this.app = express();
    this.server = null;
    this._setupMiddleware();
    this._setupRoutes();
    this._setupErrorHandling();
  }

  _setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false // Allow inline scripts for the UI
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.server.corsOrigin,
      credentials: true
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    this.app.use((req, res, next) => {
      const monitor = new PerformanceMonitor(`${req.method} ${req.path}`);
      req.monitor = monitor;
      
      // Log incoming requests (except health checks)
      if (!req.path.includes('health') && config.server.logLevel === 'debug') {
        logger.debug('Incoming request', {
          method: req.method,
          path: req.path,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
      
      next();
    });

    // Static files for UI
    this.app.use(express.static(path.join(__dirname, '../public')));
  }

  _setupRoutes() {
    // Health check (simple and fast)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.server.environment,
        version: '2.0.0'
      });
    });

    // API routes
    this.app.use('/api', apiRoutes);

    // Root endpoint - serve main UI
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    // API documentation endpoint
    this.app.get('/docs', (req, res) => {
      res.json({
        name: 'Agentic RAG API Documentation',
        version: '2.0.0',
        description: 'Intelligent Retrieval-Augmented Generation with Agentic Decision Making',
        baseUrl: `http://localhost:${config.server.port}`,
        endpoints: {
          health: {
            method: 'GET',
            path: '/health',
            description: 'Health check endpoint'
          },
          info: {
            method: 'GET', 
            path: '/api/info',
            description: 'API information and capabilities'
          },
          workflowQuery: {
            method: 'POST',
            path: '/api/workflow/query',
            description: 'Query the workflow agent',
            body: { query: 'string', options: 'object (optional)' }
          },
          workflowExample: {
            method: 'POST',
            path: '/api/workflow/example',
            description: 'Run workflow agent example (Adobe PRD)'
          },
          reactQuery: {
            method: 'POST',
            path: '/api/react/query', 
            description: 'Query the React agent',
            body: { query: 'string', options: 'object (optional)' }
          },
          reactExample: {
            method: 'POST',
            path: '/api/react/example',
            description: 'Run React agent example (Adobe PRD)'
          },
          compare: {
            method: 'POST',
            path: '/api/compare',
            description: 'Compare both agents on the same query',
            body: { query: 'string', options: 'object (optional)' }
          }
        },
        examples: {
          curlWorkflow: `curl -X POST http://localhost:${config.server.port}/api/workflow/query \\
  -H "Content-Type: application/json" \\
  -d '{"query": "Explain machine learning concepts"}'`,
          curlCompare: `curl -X POST http://localhost:${config.server.port}/api/compare \\
  -H "Content-Type: application/json" \\
  -d '{"query": "Generate a PRD for a mobile app"}'`
        },
        ui: {
          description: 'Interactive web interface available at root URL',
          url: `http://localhost:${config.server.port}/`
        }
      });
    });

    // Catch-all for SPA routing
    this.app.get('*', (req, res) => {
      // If it's an API request that doesn't exist, return 404
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({
          error: 'Endpoint not found',
          message: `API endpoint ${req.path} does not exist`,
          availableEndpoints: ['/api/health', '/api/info', '/api/workflow/query', '/api/react/query', '/api/compare'],
          timestamp: new Date().toISOString()
        });
      }
      
      // Otherwise serve the main UI
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });
  }

  _setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, next) => {
      const monitor = req.monitor;
      if (monitor) {
        monitor.checkpoint('error').finish();
      }

      logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        path: req.path
      });

      const formattedError = formatError(error);
      const statusCode = error.statusCode || 500;
      
      res.status(statusCode).json(formattedError);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
      });
      
      // Graceful shutdown
      this.shutdown();
      process.exit(1);
    });

    // Graceful shutdown on signals
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, starting graceful shutdown');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, starting graceful shutdown');
      this.shutdown();
    });
  }

  async start() {
    try {
      const port = config.server.port;
      
      this.server = this.app.listen(port, () => {
        console.log(`🚀 Agentic RAG Server Started`);
        console.log(`📍 Port: ${port}`);
        console.log(`🌍 Environment: ${config.server.environment}`);
        console.log(`📊 Health Check: http://localhost:${port}/health`);
        console.log(`📚 API Documentation: http://localhost:${port}/docs`);
        console.log(`🎯 Interactive UI: http://localhost:${port}/`);
        console.log(`🤖 Ready to process agentic RAG queries!`);
        
        if (config.server.environment === 'development') {
          console.log(`\n🔧 Development Mode:`);
          console.log(`   • Workflow Agent: POST /api/workflow/query`);
          console.log(`   • React Agent: POST /api/react/query`);
          console.log(`   • Comparison: POST /api/compare`);
          console.log(`   • Examples: POST /api/workflow/example`);
        }
      });

      // Handle server errors
      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${port} is already in use`);
          process.exit(1);
        } else {
          logger.error('Server error', { error: error.message });
          throw error;
        }
      });

    } catch (error) {
      logger.error('Failed to start server', { error: error.message });
      throw error;
    }
  }

  async shutdown() {
    if (this.server) {
      logger.info('Shutting down server...');
      
      this.server.close((error) => {
        if (error) {
          logger.error('Error during server shutdown', { error: error.message });
        } else {
          logger.info('Server shut down gracefully');
        }
        process.exit(error ? 1 : 0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.warn('Forcing server shutdown after timeout');
        process.exit(1);
      }, 10000);
    }
  }
}

// Start the server
const server = new AgenticRAGServer();

if (import.meta.url === `file://${process.argv[1]}`) {
  server.start().catch((error) => {
    console.error('❌ Failed to start Agentic RAG server:', error.message);
    process.exit(1);
  });
}

export default server;