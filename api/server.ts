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

    // Enhanced tool: moodEnhancer with actionable suggestions and real-world integrations
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
                content: `You are a highly empathetic and professional psychological counselor. Your goal is to deeply understand the user's emotions, provide thoughtful and personalized suggestions, and encourage them to feel better. Additionally, you can suggest actionable steps and facilitate real-world actions, such as booking appointments, scheduling activities, or providing links to helpful resources. Always respond with kindness, understanding, and actionable advice.`,
              },
              {
                role: "user",
                content: message,
              },
            ],
            stream: false, // Disable streaming for simplicity
          });

          const response = chatCompletion.choices[0]?.message?.content || "I'm here to help!";

          // Example: Add actionable suggestions or integrations
          const actionableSuggestions = [
            "Consider trying a 10-minute meditation. Here's a link to a guided session: https://www.youtube.com/watch?v=ZToicYcHIOU",
            "Would you like me to help you book an appointment with a therapist?",
            "How about taking a short walk outside to clear your mind?",
            "If you're feeling overwhelmed, try writing down your thoughts in a journal.",
            "Would you like to explore some mindfulness exercises?",
            "Consider reaching out to a friend or family member for support.",
          ];

          return {
            content: [
              { type: "text", text: response },
              { type: "text", text: "Here are some suggestions to help you feel better:" },
              ...actionableSuggestions.map((suggestion) => ({ type: "text", text: suggestion })),
            ],
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
          description: "Enhance the user's mood by providing empathetic, actionable suggestions and facilitating real-world actions using LLM inference",
        },
      },
    },
  }
);

export default handler;
