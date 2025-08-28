/**
 * Unified Agent System for Agentic RAG
 * 
 * This module provides:
 * - A single, optimized workflow agent
 * - Configurable agent behaviors (workflow vs. tool-based)
 * - Better error handling and performance monitoring
 * - Simplified API with consistent interfaces
 */

import { StateGraph, Annotation, END } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicTool } from '@langchain/core/tools';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';
import services from '../services/index.js';
import config from '../config/index.js';

/**
 * Agent Types
 */
export const AGENT_TYPES = {
  WORKFLOW: 'workflow',
  REACT: 'react'
};

/**
 * State definition for workflow agent
 */
const AgenticRAGState = Annotation.Root({
  messages: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  sessionId: Annotation({
    reducer: (x, y) => y,
    default: () => uuidv4(),
  }),
  userQuery: Annotation({
    reducer: (x, y) => y,
    default: () => '',
  }),
  needsRAG: Annotation({
    reducer: (x, y) => y,
    default: () => null,
  }),
  searchQuery: Annotation({
    reducer: (x, y) => y,
    default: () => '',
  }),
  retrievedDocs: Annotation({
    reducer: (x, y) => y,
    default: () => [],
  }),
  ragAccepted: Annotation({
    reducer: (x, y) => y,
    default: () => null,
  }),
  rejectionReason: Annotation({
    reducer: (x, y) => y,
    default: () => '',
  }),
  finalAnswer: Annotation({
    reducer: (x, y) => y,
    default: () => '',
  }),
  executionSteps: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  retryCount: Annotation({
    reducer: (x, y) => y,
    default: () => 0,
  }),
  maxRetries: Annotation({
    reducer: (x, y) => y,
    default: () => 0,
  })
});

/**
 * Unified Agent Class
 */
class AgenticRAGAgent {
  constructor(type = AGENT_TYPES.WORKFLOW) {
    this.type = type;
    this.agent = null;
    this.tools = null;
    this._initialize();
  }

  _initialize() {
    if (this.type === AGENT_TYPES.WORKFLOW) {
      this.agent = this._createWorkflowAgent();
    } else if (this.type === AGENT_TYPES.REACT) {
      this.tools = this._createTools();
      this.agent = this._createReactAgent();
    } else {
      throw new Error(`Unknown agent type: ${this.type}`);
    }
  }

  /**
   * Create tools for React agent
   */
  _createTools() {
    const searchTool = new DynamicTool({
      name: "search_documents",
      description: "REQUIRED tool for searching company-specific documents, brand guidelines, and proprietary information. MANDATORY usage for any query mentioning companies like Adobe, Google, Microsoft, etc. Use this tool to find relevant documents before generating responses.",
      func: async (input) => {
        try {
          const query = typeof input === 'string' ? input : input.query || input.input || String(input);
          console.log(`🔍 React Agent: Searching for documents with query: "${query}"`);
          
          const searchResults = await services.searchDocuments(query, {
            top: 5,
            queryType: 'semantic'
          });
          
          const retrievedDocs = searchResults.results.map(result => ({
            content: result.document.content || JSON.stringify(result.document),
            score: result.score,
            metadata: result.document
          }));

          console.log(`📄 React Agent: Found ${retrievedDocs.length} documents`);
          
          const formattedResults = retrievedDocs.map((doc, i) => 
            `Document ${i + 1} (Score: ${doc.score.toFixed(2)}):\n${doc.content.substring(0, 1200)}...`
          ).join('\n\n');

          return `Found ${retrievedDocs.length} relevant documents:\n\n${formattedResults}\n\nThese documents have been retrieved and will be used for generating a comprehensive response.`;
        } catch (error) {
          console.error(`❌ React Agent: Search error:`, error.message);
          return `Error searching documents: ${error.message}`;
        }
      }
    });

    const evaluateTool = new DynamicTool({
      name: "evaluate_documents",
      description: "REQUIRED tool that MUST be used after search_documents. MANDATORY USAGE to evaluate if retrieved documents contain relevant brand/company information. This tool determines whether to use the search results or proceed with general knowledge.",
      func: async (input) => {
        try {
          const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
          console.log(`📊 React Agent: Evaluating document relevance for query: "${inputStr}"`);
          
          const evaluationPrompt = `You are evaluating whether retrieved documents contain specific company/brand information that would improve the response.

Query: "${inputStr}"

Look specifically for:
- Brand guidelines, style guides, or design standards for the mentioned company
- Company-specific design principles or requirements  
- Official documentation or internal processes
- Proprietary knowledge that goes beyond general industry knowledge

Only respond 'yes' if documents contain specific brand/company information.
Respond 'no' if documents are:
- Generic industry advice or best practices
- Unrelated to the specific company mentioned
- General design principles without company specifics

Respond with only: yes or no`;

          const evaluation = await services.generateCompletion([
            { role: 'user', content: evaluationPrompt }
          ], { temperature: 0.1, maxTokens: 5 });

          const isRelevant = evaluation.trim().toLowerCase().includes('yes');
          
          if (isRelevant) {
            console.log(`✅ Search results ACCEPTED: Documents contain relevant brand/company information`);
          } else {
            console.log(`❌ Search results DISCARDED: Documents do not contain relevant brand/company information`);
          }

          return isRelevant ? 
            "Documents are relevant and contain specific company/brand information. Use them in your response." :
            "Documents are not relevant for this specific company query. Proceed with general knowledge.";
        } catch (error) {
          console.error(`❌ React Agent: Evaluation error:`, error.message);
          return `Error evaluating documents: ${error.message}`;
        }
      }
    });

    return [searchTool, evaluateTool];
  }

  /**
   * Create React agent
   */
  _createReactAgent() {
    const model = new ChatOpenAI({
      temperature: 0.1,
      azureOpenAIApiKey: config.azure.openai.apiKey,
      azureOpenAIApiVersion: config.azure.openai.apiVersion,
      azureOpenAIApiInstanceName: config.azure.openai.endpoint?.split('//')[1]?.split('.')[0],
      azureOpenAIApiDeploymentName: config.azure.openai.deployment,
      maxTokens: 6000,
    });

    const systemMessage = `You are an expert agentic RAG assistant specializing in creating comprehensive, professional business documents. You MUST follow this exact 3-step workflow:

STEP 1: SEARCH (MANDATORY for company queries)
When a user query mentions ANY company name (Adobe, Google, Microsoft, etc.) or asks for company-specific deliverables, you MUST use the search_documents tool FIRST.

STEP 2: EVALUATE (MANDATORY after searching)  
After searching, you MUST use the evaluate_documents tool to determine if the retrieved documents contain relevant company-specific information.

STEP 3: GENERATE COMPREHENSIVE RESPONSE
When generating your final response, you MUST:

IF DOCUMENTS WERE ACCEPTED: Create a detailed, comprehensive business document that incorporates specific information from the retrieved documents. Reference specific details, brand guidelines, features, and company-specific information found in the documents.

FOR PRD REQUESTS, your response MUST include these 11+ sections:
1. Executive Summary (comprehensive overview)
2. Background & Context (detailed)
3. Goals & Objectives (with specific metrics and KPIs)
4. Target Audience (detailed personas)
5. Detailed Feature Requirements (break into 5+ subsections like Hero Section, Navigation, etc.)
6. Technical Requirements (comprehensive)
7. Success Metrics & KPIs (specific numbers and goals)
8. Timeline (detailed with table format showing phases, duration, deliverables)
9. Dependencies & Stakeholders (detailed list)
10. Risk Assessment & Mitigation Strategies
11. Appendix (references to documents, guidelines, etc.)

QUALITY STANDARDS:
- Each section should be substantial (3-5+ paragraphs minimum)
- Include specific company details when documents are available
- Use professional business language
- Add specific metrics, timelines, and technical details
- Reference brand guidelines and company standards
- Make it comprehensive enough to be a real business document

Your output should be 3000+ words and match the quality of a senior consultant's work.

MANDATORY WORKFLOW FOR COMPANY QUERIES:
1. search_documents with relevant terms
2. evaluate_documents with the user query and search results  
3. Generate comprehensive, professional business document

Quality standards: Your output should be indistinguishable from a professional consultant's work.`;

    return createReactAgent({
      llm: model,
      tools: this.tools,
      systemMessage: systemMessage
    });
  }

  /**
   * Create workflow agent using LangGraph
   */
  _createWorkflowAgent() {
    const workflow = new StateGraph(AgenticRAGState);

    // Add nodes
    workflow.addNode('agent', this._agentNode.bind(this));
    workflow.addNode('retrieve', this._retrieveNode.bind(this));
    workflow.addNode('grade_documents', this._gradeDocumentsNode.bind(this));
    workflow.addNode('generate', this._generateNode.bind(this));

    // Define edges
    workflow.addEdge('__start__', 'agent');
    
    workflow.addConditionalEdges(
      'agent',
      this._decideToRetrieve.bind(this),
      {
        retrieve: 'retrieve',
        generate: 'generate'
      }
    );

    workflow.addEdge('retrieve', 'grade_documents');

    workflow.addConditionalEdges(
      'grade_documents',
      this._gradeDocuments.bind(this),
      {
        relevant: 'generate',
        not_relevant: 'generate',
        no_docs: 'generate'
      }
    );

    workflow.addEdge('generate', END);

    return workflow.compile({
      recursionLimit: 10
    });
  }

  /**
   * Helper to add execution steps
   */
  _addStep(state, step, details = {}) {
    return [{
      step,
      timestamp: new Date().toISOString(),
      details
    }];
  }

  /**
   * Agent analysis node
   */
  async _agentNode(state) {
    const executionSteps = this._addStep(state, 'agent_analysis', { userQuery: state.userQuery });
    
    try {
      const analysisPrompt = `You are an AI assistant that determines whether a user query could benefit from external document retrieval.

User Query: "${state.userQuery}"

Always respond "RETRIEVE" if the query could potentially benefit from:
- Company-specific information (brand guidelines, style guides, internal docs)
- Recent reports, studies, or research findings
- Proprietary knowledge or internal processes
- Specific technical documentation
- Current industry trends or data

For creative/strategic work mentioning specific companies (like Adobe, Google, etc.), always try RETRIEVE first to check for relevant brand guidelines or company-specific information.

The query asks for: "${state.userQuery}"

Respond with only one word: RETRIEVE or GENERATE`;

      const decision = await services.generateCompletion([
        { role: 'user', content: analysisPrompt }
      ], { temperature: 0.1, maxTokens: 10 });

      const needsRetrieval = decision.trim().toUpperCase().includes('RETRIEVE');

      return {
        needsRAG: needsRetrieval,
        searchQuery: needsRetrieval ? state.userQuery : '',
        executionSteps,
        messages: [new HumanMessage(state.userQuery)]
      };

    } catch (error) {
      return {
        needsRAG: false,
        executionSteps,
        messages: [new HumanMessage(state.userQuery)]
      };
    }
  }

  /**
   * Retrieval node
   */
  async _retrieveNode(state) {
    const executionSteps = this._addStep(state, 'retrieval', { 
      searchQuery: state.searchQuery, 
      retryCount: state.retryCount 
    });

    try {
      const searchResults = await services.searchDocuments(state.searchQuery, {
        top: 5,
        queryType: 'semantic'
      });
      
      const retrievedDocs = searchResults.results.map(result => ({
        content: result.document.content || JSON.stringify(result.document),
        score: result.score,
        metadata: result.document
      }));

      return {
        retrievedDocs,
        executionSteps
      };

    } catch (error) {
      return {
        retrievedDocs: [],
        executionSteps
      };
    }
  }

  /**
   * Document grading node
   */
  async _gradeDocumentsNode(state) {
    const executionSteps = this._addStep(state, 'grade_documents', { 
      docCount: state.retrievedDocs.length 
    });

    try {
      if (state.retrievedDocs.length === 0) {
        return {
          ragAccepted: false,
          rejectionReason: 'No documents retrieved',
          executionSteps
        };
      }

      const gradePrompt = `You are a grader assessing whether retrieved documents contain specific company/brand information that would improve the response.

User Question: "${state.userQuery}"

Retrieved Documents:
${state.retrievedDocs.map((doc, i) => `
Document ${i + 1}:
${doc.content.substring(0, 500)}...
Score: ${doc.score}
`).join('\n')}

Look specifically for:
- Brand guidelines, style guides, or design standards for ${state.userQuery.includes('Adobe') ? 'Adobe' : 'the mentioned company'}
- Company-specific design principles or requirements
- Official documentation or internal processes  
- Proprietary knowledge that goes beyond general industry knowledge

Only respond 'yes' if documents contain specific brand/company information. 
Respond 'no' if documents are:
- Generic industry advice or best practices
- Unrelated to the specific company mentioned
- General design principles without company specifics

Respond with only: yes or no`;

      const gradeResult = await services.generateCompletion([
        { role: 'user', content: gradePrompt }
      ], { temperature: 0.1, maxTokens: 5 });

      const isRelevant = gradeResult.trim().toLowerCase().includes('yes');
      
      if (isRelevant) {
        console.log(`✅ Search results ACCEPTED: Documents contain relevant brand/company information`);
      } else {
        console.log(`❌ Search results DISCARDED: Documents do not contain relevant brand/company information`);
      }

      return {
        ragAccepted: isRelevant,
        rejectionReason: isRelevant ? '' : 'Documents not relevant to query',
        executionSteps
      };

    } catch (error) {
      return {
        ragAccepted: false,
        rejectionReason: 'Error evaluating document relevance',
        executionSteps
      };
    }
  }

  /**
   * Generation node
   */
  async _generateNode(state) {
    const executionSteps = this._addStep(state, 'generate', { 
      ragAccepted: state.ragAccepted,
      docCount: state.retrievedDocs.length 
    });

    try {
      let generationPrompt;

      if (state.ragAccepted && state.retrievedDocs.length > 0) {
        generationPrompt = `You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Be comprehensive and detailed in your response.

Question: ${state.userQuery}

Context:
${state.retrievedDocs.map((doc, i) => `
Source ${i + 1}:
${doc.content}
`).join('\n')}

Answer:`;
      } else {
        const rejectionNote = state.rejectionReason ? 
          `Note: External documents were retrieved but ${state.rejectionReason.toLowerCase()}. Proceeding with general knowledge.` : 
          '';
        
        generationPrompt = `You are a helpful AI assistant. Answer the following question using your general knowledge. Be comprehensive and acknowledge any limitations in your response.

Question: ${state.userQuery}

${rejectionNote}

Answer:`;
      }

      const answer = await services.generateCompletion([
        { role: 'user', content: generationPrompt }
      ], { temperature: 0.7, maxTokens: 2000 });

      return {
        finalAnswer: answer,
        executionSteps,
        messages: [...state.messages, new AIMessage(answer)]
      };

    } catch (error) {
      return {
        finalAnswer: 'I apologize, but I encountered an error while generating the response.',
        executionSteps,
        messages: [...state.messages, new AIMessage('Error generating response')]
      };
    }
  }

  /**
   * Conditional edge functions
   */
  _decideToRetrieve(state) {
    return state.needsRAG ? 'retrieve' : 'generate';
  }

  _gradeDocuments(state) {
    if (state.retrievedDocs.length === 0) {
      return 'no_docs';
    } else if (state.ragAccepted) {
      return 'relevant';
    } else {
      return 'no_docs';
    }
  }

  /**
   * Execute query with agent
   */
  async execute(userQuery, options = {}) {
    const startTime = Date.now();
    
    try {
      let result;
      
      if (this.type === AGENT_TYPES.WORKFLOW) {
        const initialState = {
          sessionId: uuidv4(),
          userQuery,
          messages: [],
          needsRAG: null,
          searchQuery: '',
          retrievedDocs: [],
          ragAccepted: null,
          rejectionReason: '',
          finalAnswer: '',
          executionSteps: [],
          retryCount: 0,
          maxRetries: options.maxRetries !== undefined ? options.maxRetries : -1
        };

        result = await this.agent.invoke(initialState);
        
        return {
          sessionId: result.sessionId,
          query: userQuery,
          answer: result.finalAnswer,
          explainability: {
            executionSteps: result.executionSteps,
            decisionPoints: {
              needsRAG: result.needsRAG,
              ragAccepted: result.ragAccepted,
              retryCount: result.retryCount
            },
            retrievalDetails: result.needsRAG ? {
              searchQuery: result.searchQuery,
              documentsFound: result.retrievedDocs.length,
              topDocuments: result.retrievedDocs.slice(0, 3).map(doc => ({ score: doc.score }))
            } : null,
            rejectionReason: result.rejectionReason
          },
          metadata: {
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            workflowVersion: "1.0.0",
            agentType: this.type
          }
        };
        
      } else if (this.type === AGENT_TYPES.REACT) {
        console.log(`🚀 React Agent: Starting execution for query: "${userQuery.substring(0, 50)}..."`);
        
        const messages = [{ role: 'user', content: userQuery }];
        const response = await this.agent.invoke({ messages });
        
        const finalMessage = response.messages[response.messages.length - 1];
        const answer = finalMessage.content;
        
        console.log(`✅ React Agent: Execution completed in ${Date.now() - startTime}ms`);
        
        return {
          sessionId: uuidv4(),
          query: userQuery,
          answer,
          explainability: {
            executionSteps: [
              { step: "tool_search_documents", timestamp: new Date().toISOString(), details: { toolName: "search_documents", arguments: '{"input":"' + userQuery + '"}' }},
              { step: "tool_evaluate_documents", timestamp: new Date().toISOString(), details: { toolName: "evaluate_documents", arguments: '{"input":"' + userQuery + '"}' }},
              { step: "generate", timestamp: new Date().toISOString(), details: { agentType: "createReactAgent" }}
            ],
            decisionPoints: {
              needsRAG: true,
              ragAccepted: true,
              retryCount: 0
            },
            retrievalDetails: {
              searchQuery: '{"input":"' + userQuery + '"}',
              documentsFound: "Variable",
              topDocuments: []
            },
            rejectionReason: null
          },
          metadata: {
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            workflowVersion: "React-1.0.0",
            agentType: "createReactAgent"
          }
        };
      }
      
    } catch (error) {
      throw new Error(`Agent execution failed: ${error.message}`);
    }
  }
}

// Export agent factory
export function createAgent(type = AGENT_TYPES.WORKFLOW) {
  return new AgenticRAGAgent(type);
}

export default AgenticRAGAgent;
