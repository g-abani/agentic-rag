import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the external dependencies to avoid actual API calls
const mockInvoke = jest.fn() as jest.MockedFunction<any>;

jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: mockInvoke
  }))
}));

jest.mock('langsmith/traceable', () => ({
  traceable: jest.fn().mockImplementation((fn: any) => fn)
}));

// Import after mocking
import { MarketingAgent, generateMarketingContent, marketingAgent } from '../src/agents/marketingAgent.js';

describe('MarketingAgent Integration Tests', () => {
  let agent: MarketingAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockInvoke as any).mockResolvedValue({
      content: 'Mocked response from OpenAI'
    });
    agent = new MarketingAgent();
  });

  describe('Constructor and Configuration', () => {
    it('should create instance with default configuration', () => {
      const defaultAgent = new MarketingAgent();
      expect(defaultAgent).toBeInstanceOf(MarketingAgent);
      expect(defaultAgent.getSystemPrompt()).toBe('You are a expert technical marketer who does NOT write clickbait');
    });

    it('should create instance with custom configuration', () => {
      const customAgent = new MarketingAgent({
        temperature: 0.5,
        maxTokens: 1000
      });
      expect(customAgent).toBeInstanceOf(MarketingAgent);
    });
  });

  describe('System Prompt Management', () => {
    it('should get default system prompt', () => {
      expect(agent.getSystemPrompt()).toBe('You are a expert technical marketer who does NOT write clickbait');
    });

    it('should set and get custom system prompt', () => {
      const newPrompt = 'You are a creative marketing specialist';
      agent.setSystemPrompt(newPrompt);
      expect(agent.getSystemPrompt()).toBe(newPrompt);
    });

    it('should throw error for empty system prompt', () => {
      expect(() => agent.setSystemPrompt('')).toThrow('System prompt cannot be empty');
      expect(() => agent.setSystemPrompt('   ')).toThrow('System prompt cannot be empty');
    });

    it('should throw error for null/undefined system prompt', () => {
      expect(() => agent.setSystemPrompt(null as any)).toThrow('System prompt cannot be empty');
      expect(() => agent.setSystemPrompt(undefined as any)).toThrow('System prompt cannot be empty');
    });
  });

  describe('Content Generation', () => {
    it('should generate marketing content for valid query', async () => {
      const query = 'Generate marketing content for AI technology';
      const result = await agent.generateMarketingContent(query);
      console.log(result);
      expect(typeof result).toBe('string');
      expect(result).toBe('Mocked response from OpenAI');
    });

    it('should throw error for empty query', async () => {
      await expect(agent.generateMarketingContent('')).rejects.toThrow('User query cannot be empty');
      await expect(agent.generateMarketingContent('   ')).rejects.toThrow('User query cannot be empty');
    });

    it('should throw error for null/undefined query', async () => {
      await expect(agent.generateMarketingContent(null as any)).rejects.toThrow('User query cannot be empty');
      await expect(agent.generateMarketingContent(undefined as any)).rejects.toThrow('User query cannot be empty');
    });

    it('should handle multiple content generation requests', async () => {
      const queries = [
        'Generate Twitter content about AI',
        'Create LinkedIn post about machine learning',
        'Write Instagram story about tech innovation'
      ];

      for (const query of queries) {
        const result = await agent.generateMarketingContent(query);
        expect(typeof result).toBe('string');
        expect(result).toBe('Mocked response from OpenAI');
      }
    });
  });

  describe('Exported Functions and Instances', () => {
    it('should test exported generateMarketingContent function', async () => {
      const result = await generateMarketingContent('Test query');
      expect(typeof result).toBe('string');
      expect(result).toBe('Mocked response from OpenAI');
    });

    it('should test exported marketingAgent instance', () => {
      expect(marketingAgent).toBeInstanceOf(MarketingAgent);
      expect(marketingAgent.getSystemPrompt()).toBe('You are a expert technical marketer who does NOT write clickbait');
    });

    it('should verify exported instance functionality', async () => {
      const result = await marketingAgent.generateMarketingContent('Test with exported instance');
      expect(typeof result).toBe('string');
      expect(result).toBe('Mocked response from OpenAI');
    });
  });

  describe('Error Handling', () => {
    it('should handle input validation errors', async () => {
      // Test various invalid inputs
      const invalidInputs = [null, undefined, '', '   '];
      
      for (const input of invalidInputs) {
        await expect(agent.generateMarketingContent(input as any)).rejects.toThrow('User query cannot be empty');
      }
    });

    it('should handle prompt validation errors', () => {
      const invalidPrompts = [null, undefined, '', '   '];
      
      for (const prompt of invalidPrompts) {
        expect(() => agent.setSystemPrompt(prompt as any)).toThrow('System prompt cannot be empty');
      }
    });
  });

  describe('Workflow Integration', () => {
    it('should handle complete workflow with custom prompt and content generation', async () => {
      // Set custom prompt
      const customPrompt = 'You are a social media expert focusing on tech content';
      agent.setSystemPrompt(customPrompt);
      expect(agent.getSystemPrompt()).toBe(customPrompt);

      // Generate content multiple times
      const queries = [
        'Create a tweet about AI innovation',
        'Write a LinkedIn post about machine learning trends',
        'Generate Instagram content for tech startup'
      ];

      for (const query of queries) {
        const result = await agent.generateMarketingContent(query);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      }

      // Verify prompt persists
      expect(agent.getSystemPrompt()).toBe(customPrompt);
    });

    it('should handle multiple agents independently', () => {
      const agent1 = new MarketingAgent({ temperature: 0.1 });
      const agent2 = new MarketingAgent({ temperature: 0.9 });

      agent1.setSystemPrompt('Conservative marketing tone');
      agent2.setSystemPrompt('Creative marketing tone');

      expect(agent1.getSystemPrompt()).toBe('Conservative marketing tone');
      expect(agent2.getSystemPrompt()).toBe('Creative marketing tone');
      
      // Verify they are independent
      expect(agent1.getSystemPrompt()).not.toBe(agent2.getSystemPrompt());
    });
  });
});
