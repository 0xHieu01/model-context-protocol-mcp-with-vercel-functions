import { z } from "zod";
import { initializeMcpApiHandler } from "../lib/mcp-api-handler";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.UPSTAGE_API_KEY || "", // Ensure the key is loaded from the environment
  baseURL: "https://api.upstage.ai/v1",
});

const handler = initializeMcpApiHandler(
  (server) => {
    // Add more tools, resources, and prompts here
    server.tool("echo", { message: z.string() }, async ({ message }) => ({
      content: [{ type: "text", text: `Tool echo: ${message}` }],
    }));

    // Updated tool: moodEnhancer with improved prompting
    server.tool(
      "moodEnhancer",
      { message: z.string() },
      async ({ message }) => {
        try {
          const chatCompletion = await openai.chat.completions.create({
            model: "solar-pro",
            messages: [
              {
                role: "system",
                content: `You are a highly empathetic and professional psychological counselor. Your goal is to deeply understand the user's profile, user's emotions, provide thoughtful and personalized suggestions, and encourage them to feel better. Always respond with kindness, understanding, and actionable advice.`,
              },
              {
                role: "user",
                content: message,
              },
            ],
            stream: false, // Disable streaming for simplicity
          });

          const response = chatCompletion.choices[0]?.message?.content || "I'm here to help!";

          return {
            content: [{ type: "text", text: response }],
          };
        } catch (error) {
          console.error("Error with LLM inference:", error);
          return {
            content: [{ type: "text", text: "Sorry, I couldn't process your request at the moment." }],
          };
        }
      }
    );
  },
  {
    capabilities: {
      tools: {
        echo: {
          description: "Echo a message",
        },
        moodEnhancer: {
          description: "Enhance the user's mood by providing empathetic and actionable suggestions using LLM inference",
        },
      },
    },
  }
);

export default handler;
