#!/usr/bin/env node

/**
 * Test script for Agentic RAG POC
 * 
 * This script demonstrates the agentic RAG workflow with different types of queries:
 * 1. Queries that benefit from RAG (specific, domain-knowledge)
 * 2. Queries that don't need RAG (general knowledge)
 * 3. Queries where RAG might fail and fallback is needed
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

// Updated API endpoints for new unified structure

const testQueries = [
  {
    name: "Adobe Photoshop PRD (Main Example)",
    query: "Generate a PRD draft for Adobe Photoshop's homepage redesign using recent design best practices.",
    expectedBehavior: "Should attempt RAG, potentially fall back to LLM reasoning if docs insufficient"
  },
  {
    name: "Specific Technical Query",
    query: "What are the latest security best practices for React applications in 2024?",
    expectedBehavior: "Should attempt RAG for recent security practices"
  },
  {
    name: "General Knowledge Query",
    query: "Explain the concept of recursion in computer science with examples.",
    expectedBehavior: "Should skip RAG and use LLM knowledge directly"
  },
  {
    name: "Ambiguous Query",
    query: "How do I optimize performance?",
    expectedBehavior: "May skip RAG due to lack of specificity"
  },
  {
    name: "Recent Events Query",
    query: "What are the key features announced in the latest Azure OpenAI updates?",
    expectedBehavior: "Should attempt RAG for recent information"
  }
];

async function testQuery(testCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`📝 Query: ${testCase.query}`);
  console.log(`🎯 Expected: ${testCase.expectedBehavior}`);
  console.log(`⏳ Executing...`);

  const startTime = Date.now();

  try {
    const response = await fetch(`${BASE_URL}/api/workflow/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: testCase.query,
        options: { maxRetries: 2 }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    const executionTime = Date.now() - startTime;

    console.log(`✅ Success (${executionTime}ms)`);
    console.log(`📊 Session ID: ${result.sessionId}`);
    
    // Display explainability information
    const explainability = result.explainability;
    console.log(`\n🔍 Workflow Analysis:`);
    console.log(`   • RAG Required: ${explainability.decisionPoints.needsRAG ? '✅ Yes' : '❌ No'}`);
    
    if (explainability.decisionPoints.needsRAG) {
      console.log(`   • RAG Accepted: ${explainability.decisionPoints.ragAccepted ? '✅ Yes' : '❌ No'}`);
      console.log(`   • Retry Count: ${explainability.decisionPoints.retryCount}`);
      
      if (explainability.retrievalDetails) {
        console.log(`   • Search Query: "${explainability.retrievalDetails.searchQuery}"`);
        console.log(`   • Documents Found: ${explainability.retrievalDetails.documentsFound}`);
      }
      
      if (explainability.rejectionReason) {
        console.log(`   • Rejection Reason: ${explainability.rejectionReason}`);
      }
    }

    // Display execution steps
    console.log(`\n📋 Execution Steps (${explainability.executionSteps.length} steps):`);
    explainability.executionSteps.forEach((step, index) => {
      const timestamp = new Date(step.timestamp).toLocaleTimeString();
      console.log(`   ${index + 1}. ${step.step} (${timestamp})`);
    });

    // Display answer preview
    const answerPreview = result.answer.substring(0, 200) + (result.answer.length > 200 ? '...' : '');
    console.log(`\n💬 Answer Preview:`);
    console.log(`   ${answerPreview}`);

    console.log(`\n⚡ Performance:`);
    console.log(`   • Total Execution Time: ${result.metadata.executionTimeMs}ms`);
    console.log(`   • Network Overhead: ${executionTime - result.metadata.executionTimeMs}ms`);

    return {
      success: true,
      result,
      executionTime
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.log(`❌ Failed (${executionTime}ms)`);
    console.log(`💥 Error: ${error.message}`);
    
    return {
      success: false,
      error: error.message,
      executionTime
    };
  }
}

async function runHealthCheck() {
  console.log(`🏥 Health Check...`);
  
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const health = await response.json();
    
    if (health.status === 'healthy') {
      console.log(`✅ Server is healthy`);
      console.log(`   • Environment: ${health.environment}`);
      console.log(`   • Uptime: ${Math.round(health.uptime)}s`);
      return true;
    } else {
      console.log(`❌ Server health check failed`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log(`
🚀 Agentic RAG POC Test Suite
════════════════════════════════════════════════════════════════
Testing intelligent retrieval decision-making and fallback strategies
  `);

  // Health check first
  const isHealthy = await runHealthCheck();
  if (!isHealthy) {
    console.log(`\n❌ Server is not healthy. Please start the server first:\n   npm start\n`);
    process.exit(1);
  }

  const results = [];
  
  for (const testCase of testQueries) {
    const result = await testQuery(testCase);
    results.push({ testCase, result });
    
    // Add delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log(`\n📊 Test Summary`);
  console.log(`════════════════════════════════════════════════════════════════`);
  
  const successful = results.filter(r => r.result.success).length;
  const failed = results.filter(r => !r.result.success).length;
  const totalTime = results.reduce((sum, r) => sum + r.result.executionTime, 0);
  
  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log(`⏱️ Total Time: ${totalTime}ms`);
  console.log(`📈 Average Time: ${Math.round(totalTime / results.length)}ms`);

  // RAG behavior analysis
  const ragResults = results
    .filter(r => r.result.success)
    .map(r => r.result.result.explainability.decisionPoints);
  
  const ragAttempted = ragResults.filter(r => r.needsRAG).length;
  const ragAccepted = ragResults.filter(r => r.needsRAG && r.ragAccepted).length;
  const ragRejected = ragResults.filter(r => r.needsRAG && !r.ragAccepted).length;
  
  console.log(`\n🧠 Agentic Behavior Analysis:`);
  console.log(`   • RAG Attempted: ${ragAttempted}/${successful} queries`);
  console.log(`   • RAG Accepted: ${ragAccepted}/${ragAttempted} attempts`);
  console.log(`   • RAG Rejected: ${ragRejected}/${ragAttempted} attempts`);
  console.log(`   • Fallback Used: ${ragRejected + (successful - ragAttempted)} times`);

  if (failed > 0) {
    console.log(`\n❌ Failed Tests:`);
    results
      .filter(r => !r.result.success)
      .forEach(r => {
        console.log(`   • ${r.testCase.name}: ${r.result.error}`);
      });
  }

  console.log(`\n🎉 Testing complete! Check the results above for agentic behavior patterns.`);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n👋 Test suite interrupted. Goodbye!`);
  process.exit(0);
});

// Run the test suite
main().catch(error => {
  console.error(`💥 Test suite failed:`, error);
  process.exit(1);
});
