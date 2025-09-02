import * as ls from 'langsmith/jest';
import { generateMarketingContent } from '../src/agents/marketingAgent.js';
import { langsmithTwitterEvaluator } from '../src/evaluators/marketingEvaluator.js';

ls.describe("Test Tweet", () => {
   ls.test('should generate and evaluate Twitter content with LLM-as-a-judge', 
   {
      inputs: {
        query: 'write a tweet about Generative AI'
      }
   },  
   async ({inputs: {query}} : {inputs: {query: string}}) => {
      const result = await generateMarketingContent(query);
      ls.logOutputs({response: result});

      ls.logFeedback({
        key: 'length',
        score: result.length,
      });

      ls.logFeedback({
         key: 'tweet_length',
         score: result.length <= 280,
       });

      const wrappedEvaluator = ls.wrapEvaluator(langsmithTwitterEvaluator);
      await wrappedEvaluator({
        content: result,
        query_type: 'tweet',
      } as any);
   });
});