import { z } from "zod";
import { initializeMcpApiHandler } from "../lib/mcp-api-handler";
import OpenAI from "openai";
import axios from "axios";

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

    // Enhanced tool: moodEnhancer with user information integration
    server.tool(
      "moodEnhancer",
      { message: z.string(), userId: z.number() },
      async ({ message, userId }) => {
        try {
          // Fetch user information from the API
          const userResponse = await axios.get(
            "https://dev-agent.api.pinai.tech/api/open/user/personas",
            {
              headers: {
                "x-api-key": process.env.PINAI_API_KEY || "",
              },
            }
          );

          const users = userResponse.data;
          const currentUser = users.find((user) => user.persona_id === userId);

          if (!currentUser) {
            return {
              content: [{ type: "text", text: "User not found. Please provide a valid user ID." }],
            };
          }

          const userInfo = `Hello ${currentUser.name}! It's great to connect with you. I see you're a ${currentUser.occupation} and have interests in ${currentUser.data.interests.slice(0, 3).join(", ")}. Let me know how I can assist you today.`;

          const actionableSuggestions = [
            "Consider trying a 10-minute meditation. Here's a link to a guided session",
            "Would you like me to help you book an appointment with a therapist?",
            "How about taking a short walk outside to clear your mind?",
            "If you're feeling overwhelmed, try writing down your thoughts in a journal.",
            "Would you like to explore some mindfulness exercises?",
            "Consider reaching out to a friend or family member for support.",
          ];

          const chatCompletion = await openai.chat.completions.create({
            model: "solar-pro",
            messages: [
              {
                role: "system",
                content: `You are a highly empathetic and professional psychological counselor. Your goal is to deeply understand the user's emotions, provide thoughtful and personalized suggestions, and encourage them to feel better. Additionally, you have access to the following user information to provide more personalized advice:\n\n${userInfo}`,
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
            content: [
              { type: "text", text: userInfo },
              { type: "text", text: response },
              { type: "text", text: "Here are some suggestions to help you feel better:" },
              ...actionableSuggestions.map((suggestion) => ({ type: "text", text: suggestion })),
            ],
          };
        } catch (error) {
          console.error("Error with LLM inference or fetching user data:", error);
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
          description: "Enhance the user's mood by providing empathetic, actionable suggestions and facilitating real-world actions using LLM inference and user information",
        },
      },
    },
  }
);

export default handler;
