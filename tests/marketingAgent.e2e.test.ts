import { describe, it, expect, beforeEach } from '@jest/globals';
import { MarketingAgent, generateMarketingContent } from '../src/agents/marketingAgent.js';
import { evaluateTwitterContent, MarketingContentEvaluator } from '../src/evaluators/marketingEvaluator.js';

// End-to-end tests with REAL API calls
// These tests will make actual calls to Azure OpenAI
describe('MarketingAgent E2E Tests (Real API Calls)', () => {
  let agent: MarketingAgent;

  beforeEach(() => {
    agent = new MarketingAgent();
  });

  // Real API tests - these will make actual calls to Azure OpenAI
  describe('Real API Integration', () => {
    it('should generate Twitter content and check length', async () => {
      const query = 'Generate a marketing tweet about AI technology benefits, keep it under 280 characters';
      const result = await agent.generateMarketingContent(query);
      
      console.log('Query:', query);
      console.log('Response:', result);
      console.log('Length:', result.length, 'characters');
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(280); // Twitter character limit

      const evaluation = await evaluateTwitterContent(query, result);
      
      console.log('\n=== LLM-AS-A-JUDGE EVALUATION ===');
      console.log('Quality Score:', evaluation.quality_score, '/5');
      console.log('Clarity Score:', evaluation.clarity_score, '/5');
      console.log('Engagement Score:', evaluation.engagement_score, '/5');
      console.log('Platform Appropriateness:', evaluation.platform_appropriateness, '/5');
      console.log('Meets Requirements:', evaluation.meets_requirements);
      console.log('Overall Feedback:', evaluation.overall_feedback);

      expect(evaluation.quality_score).toBeGreaterThanOrEqual(1);
      expect(evaluation.quality_score).toBeLessThanOrEqual(5);
      expect(evaluation.clarity_score).toBeGreaterThanOrEqual(1);
      expect(evaluation.clarity_score).toBeLessThanOrEqual(5);
      expect(evaluation.engagement_score).toBeGreaterThanOrEqual(1);
      expect(evaluation.engagement_score).toBeLessThanOrEqual(5);
      expect(evaluation.platform_appropriateness).toBeGreaterThanOrEqual(1);
      expect(evaluation.platform_appropriateness).toBeLessThanOrEqual(5);
      expect(typeof evaluation.overall_feedback).toBe('string');
      expect(evaluation.overall_feedback.length).toBeGreaterThan(0);
      
      // Quality threshold - expect at least average scores
      const averageScore = (evaluation.quality_score + evaluation.clarity_score + 
                           evaluation.engagement_score + evaluation.platform_appropriateness) / 4;
      console.log('Average Score:', averageScore.toFixed(2), '/5');
      expect(averageScore).toBeGreaterThanOrEqual(2.5); // At least average quality

    }, 30000); // 30 second timeout for API calls

  /*describe('Real API with Error Handling', () => {
    it('should still validate inputs even with real API', async () => {
      // These should fail before making API calls
      await expect(agent.generateMarketingContent('')).rejects.toThrow('User query cannot be empty');
      await expect(agent.generateMarketingContent('   ')).rejects.toThrow('User query cannot be empty');
      await expect(agent.generateMarketingContent(null as any)).rejects.toThrow('User query cannot be empty');
    });

    it('should still validate system prompts', () => {
      expect(() => agent.setSystemPrompt('')).toThrow('System prompt cannot be empty');
      expect(() => agent.setSystemPrompt('   ')).toThrow('System prompt cannot be empty');
      expect(() => agent.setSystemPrompt(null as any)).toThrow('System prompt cannot be empty');
    });*/
  });

  describe('Configuration Tests', () => {
    it('should create agent with custom configuration', () => {
      const customAgent = new MarketingAgent({
        temperature: 0.8,
        maxTokens: 2000
      });
      
      expect(customAgent).toBeInstanceOf(MarketingAgent);
      expect(customAgent.getSystemPrompt()).toBe('You are a expert technical marketer who does NOT write clickbait');
    });

    it('should test exported functions', () => {
      expect(typeof generateMarketingContent).toBe('function');
    });
  });
});
