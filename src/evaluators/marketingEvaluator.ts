import { ChatOpenAI } from "@langchain/openai";
import { traceable } from "langsmith/traceable";
import { wrapOpenAI } from "langsmith/wrappers";
import { OpenAI } from "openai";
import dotenv from 'dotenv';

dotenv.config();

// Configuration for the evaluator
interface EvaluatorConfig {
  temperature?: number;
  maxTokens?: number;
}

// Evaluation result interface
export interface MarketingEvaluationResult {
  quality_score: number; // 1-5 scale
  clarity_score: number; // 1-5 scale
  engagement_score: number; // 1-5 scale
  platform_appropriateness: number; // 1-5 scale
  overall_feedback: string;
  meets_requirements: boolean;
}

// Input interface for evaluation
export interface EvaluationInput {
  query: string;
  response: string;
  platform?: string;
  max_length?: number;
}

export class MarketingContentEvaluator {
  private llm: ChatOpenAI;

  constructor(config?: EvaluatorConfig) {
    this.llm = new ChatOpenAI({
      temperature: config?.temperature ?? 0.1,
      azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
      azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
      azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_INSTANCE_NAME,
      azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT,
      maxTokens: config?.maxTokens ?? 1000,
    });
  }

  public evaluateMarketingContent = traceable(
    async (input: EvaluationInput): Promise<MarketingEvaluationResult> => {
      const evaluationPrompt = this.createEvaluationPrompt(input);
      
      const response = await this.llm.invoke([
        { role: "system", content: this.getSystemPrompt() },
        { role: "user", content: evaluationPrompt }
      ]);

      return this.parseEvaluationResponse(response.content as string);
    }
  );

  private getSystemPrompt(): string {
    return `You are an expert marketing content evaluator. Your role is to assess marketing content quality across multiple dimensions.

Evaluation Criteria:
1. Quality (1-5): Content accuracy, professionalism, and overall excellence
2. Clarity (1-5): How clear and understandable the message is
3. Engagement (1-5): How likely the content is to engage the target audience
4. Platform Appropriateness (1-5): How well the content fits the specified platform

Scoring Scale:
- 1: Poor/Unacceptable
- 2: Below Average/Needs Improvement
- 3: Average/Acceptable
- 4: Good/Above Average
- 5: Excellent/Outstanding

Provide your evaluation in the following JSON format:
{
  "quality_score": <number>,
  "clarity_score": <number>,
  "engagement_score": <number>,
  "platform_appropriateness": <number>,
  "overall_feedback": "<detailed feedback>",
  "meets_requirements": <boolean>
}`;
  }

  private createEvaluationPrompt(input: EvaluationInput): string {
    const platform = input.platform ? ` for ${input.platform}` : '';
    const lengthRequirement = input.max_length ? ` (max ${input.max_length} characters)` : '';
    
    return `Please evaluate the following marketing content:

Original Query: "${input.query}"
Platform: ${input.platform || 'General'}${lengthRequirement}

Generated Content:
"${input.response}"

Content Length: ${input.response.length} characters

Evaluation Requirements:
${input.max_length ? `- Content should be within ${input.max_length} character limit` : '- No specific length requirement'}
- Content should be appropriate for ${input.platform || 'general marketing'} platform
- Content should be engaging and professional
- Content should address the original query effectively

Please provide your evaluation following the JSON format specified in the system prompt.`;
  }

  private parseEvaluationResponse(response: string): MarketingEvaluationResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        
        // Validate the structure
        return {
          quality_score: this.validateScore(result.quality_score),
          clarity_score: this.validateScore(result.clarity_score),
          engagement_score: this.validateScore(result.engagement_score),
          platform_appropriateness: this.validateScore(result.platform_appropriateness),
          overall_feedback: result.overall_feedback || 'No feedback provided',
          meets_requirements: Boolean(result.meets_requirements)
        };
      }
    } catch (error) {
      console.warn('Failed to parse evaluation response:', error);
    }

    // Fallback if parsing fails
    return {
      quality_score: 3,
      clarity_score: 3,
      engagement_score: 3,
      platform_appropriateness: 3,
      overall_feedback: `Raw evaluation response: ${response}`,
      meets_requirements: true
    };
  }

  private validateScore(score: any): number {
    const numScore = Number(score);
    if (isNaN(numScore) || numScore < 1 || numScore > 5) {
      return 3; // Default to average if invalid
    }
    return Math.round(numScore);
  }
}

// Helper functions for common evaluation scenarios
export const createTwitterEvaluator = () => new MarketingContentEvaluator({ temperature: 0.1 });

export const createLinkedInEvaluator = () => new MarketingContentEvaluator({ temperature: 0.1 });

export const createInstagramEvaluator = () => new MarketingContentEvaluator({ temperature: 0.1 });

// Simplified evaluation function for quick assessments
export const evaluateTwitterContent = traceable(
  async (query: string, response: string): Promise<MarketingEvaluationResult> => {
    const evaluator = createTwitterEvaluator();
    return evaluator.evaluateMarketingContent({
      query,
      response,
      platform: 'Twitter',
      max_length: 280
    });
  }
);

// LangSmith-compatible evaluator function
export const langsmithTwitterEvaluator = traceable(
  async (input: any) => {
    const evaluator = createTwitterEvaluator();
    const result = await evaluator.evaluateMarketingContent({
      query: input.query || 'Twitter content evaluation',
      response: input.response || input.content,
      platform: 'Twitter',
      max_length: 280
    });

    // Return in LangSmith format
    return {
      key: 'twitter_evaluation',
      score: result.meets_requirements ? 1 : 0,
      value: result.meets_requirements,
      comment: result.overall_feedback,
      correction: null,
      feedback: {
        quality_score: result.quality_score,
        clarity_score: result.clarity_score,
        engagement_score: result.engagement_score,
        platform_appropriateness: result.platform_appropriateness,
        average_score: (result.quality_score + result.clarity_score + 
                      result.engagement_score + result.platform_appropriateness) / 4
      }
    };
  }
);

// Batch evaluation function
export const evaluateMultipleContents = traceable(
  async (evaluations: EvaluationInput[]): Promise<MarketingEvaluationResult[]> => {
    const evaluator = new MarketingContentEvaluator();
    const results: MarketingEvaluationResult[] = [];
    
    for (const input of evaluations) {
      const result = await evaluator.evaluateMarketingContent(input);
      results.push(result);
      
      // Small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return results;
  }
);
