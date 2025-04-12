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

    // New tool: moodEnhancer using LLM inference with psychological counseling prompt
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
                content: "You are a compassionate psychological counselor. Your role is to listen empathetically to the user, understand their feelings, and provide thoughtful suggestions or encouragement to help them feel better.",
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
          description: "Enhance the user's mood by providing encouragement or suggestions using LLM inference with a psychological counseling approach",
        },
      },
    },
  }
);

export default handler;
