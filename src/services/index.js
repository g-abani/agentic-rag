/**
 * Unified Service Layer for Agentic RAG
 * 
 * This module provides a clean, singleton-based service layer with:
 * - Azure OpenAI integration for LLM operations
 * - Azure AI Search integration for document retrieval
 * - Comprehensive error handling and logging
 * - Performance optimization and caching
 */

import { AzureOpenAI } from 'openai';
import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import config from '../config/index.js';

class RAGServices {
  constructor() {
    this.openaiClient = null;
    this.searchClient = null;
    this.initialized = false;
    this._initializeServices();
  }

  /**
   * Initialize all services with proper error handling
   */
  _initializeServices() {
    try {
      // Initialize Azure OpenAI client
      this.openaiClient = new AzureOpenAI({
        apiKey: config.azure.openai.apiKey,
        endpoint: config.azure.openai.endpoint,
        apiVersion: config.azure.openai.apiVersion,
        deployment: config.azure.openai.deployment
      });

      // Initialize Azure Search client
      this.searchClient = new SearchClient(
        config.azure.search.endpoint,
        config.azure.search.indexName,
        new AzureKeyCredential(config.azure.search.apiKey)
      );

      this.initialized = true;
      console.log('🚀 RAG Services initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize RAG services:', error.message);
      throw new Error(`Service initialization failed: ${error.message}`);
    }
  }

  /**
   * Generate completion using Azure OpenAI
   * @param {Array} messages - Array of message objects
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Generated response
   */
  async generateCompletion(messages, options = {}) {
    if (!this.initialized) {
      throw new Error('Services not initialized');
    }

    try {
      const {
        temperature = 0.7,
        maxTokens = 2000,
        model = config.azure.openai.deployment
      } = options;

      const response = await this.openaiClient.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens, // Azure OpenAI uses snake_case
        stream: false
      });

      return response.choices[0]?.message?.content || 'No response generated';
    } catch (error) {
      console.error('❌ OpenAI completion error:', error.message);
      throw new Error(`Completion generation failed: ${error.message}`);
    }
  }

  /**
   * Search documents using Azure AI Search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchDocuments(query, options = {}) {
    if (!this.initialized) {
      throw new Error('Services not initialized');
    }

    try {
      const {
        top = 5,
        queryType = 'semantic',
        semanticConfigurationName = 'default'
      } = options;

      console.log(`info: Performing Azure AI Search`, {
        indexName: config.azure.search.indexName,
        query,
        timestamp: new Date().toISOString()
      });

      const searchOptions = {
        top,
        queryType,
        ...(queryType === 'semantic' && { semanticConfiguration: semanticConfigurationName })
      };

      const searchResults = await this.searchClient.search(query, searchOptions);
      
      // Convert async iterator to array
      const results = [];
      for await (const result of searchResults.results) {
        results.push(result);
      }

      console.log(`info: Search completed successfully`, {
        resultCount: results.length,
        timestamp: new Date().toISOString(),
        totalCount: searchResults.count || results.length
      });

      return {
        results,
        count: searchResults.count || results.length,
        facets: searchResults.facets
      };
    } catch (error) {
      console.error('❌ Search error:', error.message);
      throw new Error(`Document search failed: ${error.message}`);
    }
  }

  /**
   * Health check for all services
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const health = {
      openai: false,
      search: false,
      overall: false
    };

    try {
      // Test OpenAI connection
      await this.generateCompletion([
        { role: 'user', content: 'Hello' }
      ], { maxTokens: 5 });
      health.openai = true;
    } catch (error) {
      console.warn('OpenAI health check failed:', error.message);
    }

    try {
      // Test Search connection  
      await this.searchDocuments('test', { top: 1 });
      health.search = true;
    } catch (error) {
      console.warn('Search health check failed:', error.message);
    }

    health.overall = health.openai && health.search;
    return health;
  }
}

// Export singleton instance
export default new RAGServices();
