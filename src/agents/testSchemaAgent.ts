import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Type assertion to avoid deep type instantiation issues
const createTool = tool as any;


const llm = new ChatOpenAI({
  temperature: 0.1,
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2025-01-01-preview',
  azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_INSTANCE_NAME ?? 'beher-maaweqv1-eastus2',
  azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4.1-mini',
  maxTokens: 6000,
});

const entitySchema = z.object({
  query: z.string().describe("The original user query"),
  entities: z.array(
    z.object({
      type: z.enum(["component", "url", "page", "other"]).describe("The type of entity"),
      value: z.string().describe("The extracted entity value"),
    })
  ).describe("List of extracted entities"),
});

const multiplySchema = z.object({
  a: z.number().describe("First operand"),
  b: z.number().describe("Second operand"),
});

const multiply = createTool(
    async (input: any) => {
      console.log(input);
      if (input.a === 42) {
        throw new Error("The ultimate error");
      }
      return input.a * input.b;
    },
    {
      name: "multiply",
      schema: multiplySchema,
      description: "Multiply two numbers.",
      returnDirect: true,
    }
  );

export const extractEntity = createTool(
    async (input: any) => {
      console.log("User Query:", input.query);
      console.log("Extracted Entities:", input.entities);
      return input.entities;
    },
    {
      name: "extractEntity",
      schema: entitySchema,
      description: "Extract entities like components, URLs, or pages from a user query",
      returnDirect: true,
    }
  );
  const agent = createReactAgent({
    llm,
    tools: [extractEntity],
  });
//const response = await agent.invoke({ messages: [{ role: "user", content: "what's 2 x 7 and 5 * 8?" }] });
const response = await agent.invoke({ messages: [{ role: "user", content: "update marquee with the latest figma" }] });
console.log(response.messages[response.messages.length - 1].content);



//what's 42 x 7?
//Multiply the two numbers: 294