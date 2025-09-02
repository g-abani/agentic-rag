import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { traceable } from "langsmith/traceable";
import dotenv from 'dotenv';

dotenv.config();

export interface MarketingAgentConfig {
  temperature?: number;
  maxTokens?: number;
  azureOpenAIApiKey?: string;
  azureOpenAIApiVersion?: string;
  azureOpenAIApiInstanceName?: string;
  azureOpenAIApiDeploymentName?: string;
}

export class MarketingAgent {
  private llm: ChatOpenAI;
  private systemPrompt: string;

  constructor(config?: MarketingAgentConfig) {
    this.systemPrompt = "You are a expert technical marketer who does NOT write clickbait";
    
    this.llm = new ChatOpenAI({
      temperature: config?.temperature ?? 0.1,
      azureOpenAIApiKey: config?.azureOpenAIApiKey ?? process.env.AZURE_OPENAI_API_KEY,
      azureOpenAIApiVersion: config?.azureOpenAIApiVersion ?? process.env.AZURE_OPENAI_API_VERSION ?? "2025-01-01-preview",
      azureOpenAIApiInstanceName: config?.azureOpenAIApiInstanceName ?? process.env.AZURE_OPENAI_INSTANCE_NAME ?? "beher-maaweqv1-eastus2",
      azureOpenAIApiDeploymentName: config?.azureOpenAIApiDeploymentName ?? process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4.1-mini",
      maxTokens: config?.maxTokens ?? 6000,
    });
  }

  public generateMarketingContent = traceable(
    async (userQuery: string): Promise<string> => {
      if (!userQuery || userQuery.trim().length === 0) {
        throw new Error('User query cannot be empty');
      }

      const response = await this.llm.invoke([
        { role: "system", content: this.systemPrompt },
        { role: "user", content: userQuery }
      ]);
      
      return response.content as string;
    }
  );

  public setSystemPrompt(prompt: string): void {
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('System prompt cannot be empty');
    }
    this.systemPrompt = prompt;
  }

  public getSystemPrompt(): string {
    return this.systemPrompt;
  }
}

// Export default instance for backwards compatibility
export const marketingAgent = new MarketingAgent();

// Export the generate function for backwards compatibility
export const generateMarketingContent = marketingAgent.generateMarketingContent;

// Example usage - uncomment to run directly
/*
// Debug LangSmith configuration
console.log('LangSmith Config Check:');
console.log('LANGCHAIN_TRACING_V2:', process.env.LANGCHAIN_TRACING_V2);
console.log('LANGCHAIN_PROJECT:', process.env.LANGCHAIN_PROJECT);
console.log('LANGCHAIN_API_KEY:', process.env.LANGCHAIN_API_KEY ? 'Set' : 'Not Set');

// Example usage
const content = await generateMarketingContent("Generate a marketing content on RAG for instagram");
console.log(content?.length);
console.log(content);
*/
