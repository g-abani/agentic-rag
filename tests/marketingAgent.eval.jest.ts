import { describe, it, expect, beforeEach } from '@jest/globals';
import { generateMarketingContent } from '../src/agents/marketingAgent.js';
import { evaluateTwitterContent } from '../src/evaluators/marketingEvaluator.js';

describe("Test Tweet", () => {
   test('should generate and evaluate Twitter content with LLM-as-a-judge', async () => {
    const query = 'write a tweet about LLM';
    const result = await generateMarketingContent(query);
    const evaluation = await evaluateTwitterContent(query, result);
    expect(evaluation.quality_score).toBeGreaterThanOrEqual(1);
    expect(evaluation.quality_score).toBeLessThanOrEqual(5);
    expect(evaluation.clarity_score).toBeGreaterThanOrEqual(1);
    expect(evaluation.clarity_score).toBeLessThanOrEqual(5);
   });
});