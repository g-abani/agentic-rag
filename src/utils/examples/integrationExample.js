#!/usr/bin/env node

/**
 * Integration Example for Agentic RAG POC
 * 
 * This example demonstrates how to integrate the agentic RAG system
 * into other applications using the API endpoints.
 */

import fetch from 'node-fetch';

class AgenticRAGClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async isHealthy() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const health = await response.json();
      return health.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  async query(query, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflow/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, options })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to query: ${error.message}`);
    }
  }

  async runExample() {
    try {
      const response = await fetch(`${this.baseUrl}/api/workflow/example`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to run example: ${error.message}`);
    }
  }

  // Utility method to extract key insights from explainability data
  analyzeWorkflow(explainability) {
    const analysis = {
      workflowType: explainability.decisionPoints.needsRAG ? 'RAG-enabled' : 'LLM-only',
      ragAccepted: explainability.decisionPoints.ragAccepted,
      retriesUsed: explainability.decisionPoints.retryCount,
      documentsFound: explainability.retrievalDetails?.documentsFound || 0,
      rejectionReason: explainability.rejectionReason,
      executionSteps: explainability.executionSteps.length
    };

    return analysis;
  }
}

// Example usage patterns
async function demonstrateIntegration() {
  console.log('🔌 Agentic RAG Integration Example\n');

  const client = new AgenticRAGClient();

  // 1. Health check
  console.log('1. Checking service health...');
  const isHealthy = await client.isHealthy();
  console.log(`   Status: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}\n`);

  if (!isHealthy) {
    console.log('❌ Service is not healthy. Please start the server first.');
    return;
  }

  // 2. Simple query
  console.log('2. Simple query example...');
  try {
    const result = await client.query('What are the benefits of microservices architecture?');
    const analysis = client.analyzeWorkflow(result.explainability);
    
    console.log(`   Query: "${result.query}"`);
    console.log(`   Workflow: ${analysis.workflowType}`);
    console.log(`   RAG Accepted: ${analysis.ragAccepted || 'N/A'}`);
    console.log(`   Answer Length: ${result.answer.length} characters\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }

  // 3. Complex query with options
  console.log('3. Complex query with retry options...');
  try {
    const result = await client.query(
      'Create a detailed technical specification for implementing OAuth 2.0 authentication in a React application',
      { maxRetries: 3 }
    );
    
    const analysis = client.analyzeWorkflow(result.explainability);
    
    console.log(`   Workflow: ${analysis.workflowType}`);
    console.log(`   Documents Found: ${analysis.documentsFound}`);
    console.log(`   Retries Used: ${analysis.retriesUsed}`);
    console.log(`   Execution Steps: ${analysis.executionSteps}`);
    console.log(`   Performance: ${result.metadata.executionTimeMs}ms\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }

  // 4. Batch processing example
  console.log('4. Batch processing example...');
  const queries = [
    'What is machine learning?',
    'How to implement JWT authentication?',
    'Best practices for database indexing in PostgreSQL',
    'Explain quantum computing concepts'
  ];

  const batchResults = await Promise.allSettled(
    queries.map(query => client.query(query))
  );

  batchResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const analysis = client.analyzeWorkflow(result.value.explainability);
      console.log(`   ${index + 1}. ${queries[index].substring(0, 30)}... → ${analysis.workflowType}`);
    } else {
      console.log(`   ${index + 1}. ${queries[index].substring(0, 30)}... → Error`);
    }
  });

  console.log('\n5. Running the Adobe Photoshop PRD example...');
  try {
    const exampleResult = await client.runExample();
    const analysis = client.analyzeWorkflow(exampleResult.explainability);
    
    console.log(`   Workflow: ${analysis.workflowType}`);
    console.log(`   RAG Decision: ${analysis.ragAccepted ? 'Accepted' : 'Rejected'}`);
    if (analysis.rejectionReason) {
      console.log(`   Rejection Reason: ${analysis.rejectionReason}`);
    }
    console.log(`   Response Quality: ${exampleResult.answer.length > 1000 ? 'Comprehensive' : 'Brief'}`);
    
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }

  console.log('\n🎉 Integration example complete!');
  console.log('\n💡 Integration Tips:');
  console.log('   • Always check service health before making requests');
  console.log('   • Use explainability data to understand AI decisions');
  console.log('   • Implement proper error handling for network failures');
  console.log('   • Consider caching responses for frequently asked questions');
  console.log('   • Monitor performance metrics for optimization opportunities');
}

// Business logic integration example
class BusinessApplicationExample {
  constructor() {
    this.ragClient = new AgenticRAGClient();
  }

  async processCustomerQuery(customerQuery, context = {}) {
    try {
      // Add business context to the query
      const enhancedQuery = `${customerQuery}
      
      Context: ${JSON.stringify(context)}
      Please provide a professional response suitable for customer support.`;

      const result = await this.ragClient.query(enhancedQuery, {
        maxRetries: 2
      });

      // Business logic based on RAG decision
      const analysis = this.ragClient.analyzeWorkflow(result.explainability);
      
      return {
        response: result.answer,
        confidence: analysis.ragAccepted ? 'high' : 'medium',
        sourceType: analysis.workflowType,
        needsHumanReview: !analysis.ragAccepted && customerQuery.includes('urgent'),
        metadata: {
          sessionId: result.sessionId,
          processingTime: result.metadata.executionTimeMs,
          workflowDecisions: analysis
        }
      };

    } catch (error) {
      return {
        response: 'I apologize, but I encountered an error processing your request. Please try again later.',
        confidence: 'low',
        sourceType: 'error-fallback',
        needsHumanReview: true,
        metadata: {
          error: error.message
        }
      };
    }
  }
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateIntegration().catch(error => {
    console.error('Demo failed:', error);
    process.exit(1);
  });
}

export { AgenticRAGClient, BusinessApplicationExample };
