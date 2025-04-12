import { z } from "zod";
import { initializeMcpApiHandler } from "../lib/mcp-api-handler";

const handler = initializeMcpApiHandler(
  (server) => {
    // Add more tools, resources, and prompts here
    server.tool("echo", { message: z.string() }, async ({ message }) => ({
      content: [{ type: "text", text: `Tool echo: ${message}` }],
    }));

    // New tool: moodEnhancer
    server.tool(
      "moodEnhancer",
      { message: z.string() },
      async ({ message }) => {
        // Analyze the mood (basic example)
        const positiveWords = ["happy", "great", "awesome", "good"];
        const negativeWords = ["sad", "bad", "terrible", "down"];
        let response = "I'm here to help!";

        if (positiveWords.some((word) => message.includes(word))) {
          response = "That's wonderful to hear! Keep up the positivity!";
        } else if (negativeWords.some((word) => message.includes(word))) {
          response =
            "I'm sorry you're feeling this way. Remember, tough times don't last. You're stronger than you think!";
        } else {
          response =
            "Thank you for sharing. How about trying something new today to lift your mood?";
        }

        return {
          content: [{ type: "text", text: response }],
        };
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
          description: "Enhance the user's mood by providing encouragement or suggestions",
        },
      },
    },
  }
);

export default handler;
