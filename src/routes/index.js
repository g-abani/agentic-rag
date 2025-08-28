/**
 * Unified API Routes for Agentic RAG
 * 
 * This module provides:
 * - Consolidated API endpoints
 * - Consistent error handling and response formatting
 * - Performance monitoring and logging
 * - Support for both agent types
 */

import express from 'express';
import { createAgent, AGENT_TYPES } from '../agents/index.js';
import services from '../services/index.js';
import config from '../config/index.js';

const router = express.Router();

// Create agent instances
const workflowAgent = createAgent(AGENT_TYPES.WORKFLOW);
const reactAgent = createAgent(AGENT_TYPES.REACT);

/**
 * Middleware for request validation and logging
 */
const validateQuery = (req, res, next) => {
  const { query } = req.body;
  
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'Query parameter is required and must be a non-empty string',
      timestamp: new Date().toISOString()
    });
  }
  
  // Sanitize query
  req.body.query = query.trim();
  
  next();
};

/**
 * Error handler middleware
 */
const handleError = (error, req, res, next) => {
  console.error('❌ API Error:', error.message);
  
  const statusCode = error.statusCode || 500;
  const response = {
    error: 'Request failed',
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString()
  };
  
  if (config.server.environment === 'development') {
    response.stack = error.stack;
  }
  
  res.status(statusCode).json(response);
};

/**
 * Generic query handler
 */
const handleQuery = (agent, agentType) => async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const { query, options = {} } = req.body;
    
    console.log(`🔄 Processing ${agentType} query: "${query.substring(0, 50)}..."`);
    
    const result = await agent.execute(query, options);
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ ${agentType} query completed in ${responseTime}ms`);
    
    res.json(result);
    
  } catch (error) {
    next(error);
  }
};

/**
 * Example query handler
 */
const handleExample = (agent, agentType) => async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const exampleQuery = "Generate a PRD draft for Adobe Photoshop's homepage redesign using recent design best practices.";
    
    console.log(`🔄 Processing ${agentType} example query`);
    
    const result = await agent.execute(exampleQuery);
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ ${agentType} example completed in ${responseTime}ms`);
    
    res.json(result);
    
  } catch (error) {
    next(error);
  }
};

// Workflow Agent Routes
router.post('/workflow/query', validateQuery, handleQuery(workflowAgent, 'workflow'));
router.post('/workflow/example', handleExample(workflowAgent, 'workflow'));

// React Agent Routes  
router.post('/react/query', validateQuery, handleQuery(reactAgent, 'react'));
router.post('/react/example', handleExample(reactAgent, 'react'));

// Legacy routes for backward compatibility
router.post('/agentic-rag/query', validateQuery, handleQuery(workflowAgent, 'workflow'));
router.post('/agentic-rag/example', handleExample(workflowAgent, 'workflow'));
router.post('/react-agentic-rag/query', validateQuery, handleQuery(reactAgent, 'react'));
router.post('/react-agentic-rag/example', handleExample(reactAgent, 'react'));

// Agent comparison endpoint
router.post('/compare', validateQuery, async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    const { query, options = {} } = req.body;
    
    console.log(`🔄 Processing comparison query: "${query.substring(0, 50)}..."`);
    
    // Execute both agents in parallel
    const [workflowResult, reactResult] = await Promise.all([
      workflowAgent.execute(query, options),
      reactAgent.execute(query, options)
    ]);
    
    const responseTime = Date.now() - startTime;
    console.log(`✅ Comparison query completed in ${responseTime}ms`);
    
    res.json({
      query,
      comparison: {
        workflow: workflowResult,
        react: reactResult,
        performanceComparison: {
          workflowTime: workflowResult.metadata.executionTimeMs,
          reactTime: reactResult.metadata.executionTimeMs,
          totalTime: responseTime
        }
      },
      metadata: {
        executionTimeMs: responseTime,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// Health check endpoint
router.get('/health', async (req, res, next) => {
  try {
    const healthStatus = await services.healthCheck();
    
    const response = {
      status: healthStatus.overall ? 'healthy' : 'unhealthy',
      services: healthStatus,
      environment: config.server.environment,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
    
    const statusCode = healthStatus.overall ? 200 : 503;
    res.status(statusCode).json(response);
    
  } catch (error) {
    next(error);
  }
});

// Agent info endpoint
router.get('/info', (req, res) => {
  res.json({
    name: 'Agentic RAG API',
    version: '2.0.0',
    description: 'Intelligent Retrieval-Augmented Generation with Agentic Decision Making',
    agents: {
      workflow: {
        type: 'Custom LangGraph Workflow',
        description: 'Structured workflow with explicit RAG decision making',
        endpoints: ['/api/workflow/query', '/api/workflow/example']
      },
      react: {
        type: 'LangGraph React Agent',
        description: 'Tool-based agent with autonomous reasoning',
        endpoints: ['/api/react/query', '/api/react/example']
      }
    },
    features: [
      'Dynamic RAG decision making',
      'Document relevance evaluation', 
      'Fallback to LLM-only reasoning',
      'Comprehensive explainability',
      'Performance monitoring',
      'Agent comparison'
    ],
    endpoints: [
      'GET /api/health - Health check',
      'GET /api/info - API information',
      'POST /api/workflow/query - Query workflow agent',
      'POST /api/workflow/example - Run workflow example',
      'POST /api/react/query - Query React agent',
      'POST /api/react/example - Run React example',
      'POST /api/compare - Compare both agents'
    ],
    timestamp: new Date().toISOString()
  });
});

// Apply error handler
router.use(handleError);

export default router;
