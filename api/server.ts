import { z } from "zod";
import { initializeMcpApiHandler } from "../lib/mcp-api-handler";
import OpenAI from "openai";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.UPSTAGE_API_KEY || "", // Ensure the key is loaded from the environment
  baseURL: "https://api.upstage.ai/v1",
});

// Ensure the Supabase client is initialized only if the required keys are present
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error("Supabase URL and Anon Key must be provided in the environment variables.");
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Hardcode the user ID for the hackathon prototype
const FIXED_USER_ID = "00000000-0000-0000-0000-000000000000";

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

    /**
     * Fetch today's journal entries for the user.
     * @returns {Promise<Object[]>} - Array of journal entries.
     */
    async function fetchTodaysJournalEntries() {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("journal_entries_v2")
        .select(
          "id, content, mood_score, created_at, analysis_data, entry_emotions_v2(emotions(name)), entry_themes_v2(themes(name))"
        )
        .eq("user_id", FIXED_USER_ID)
        .gte("created_at", today);
    
      if (error) {
        console.error("Error fetching today's journal entries:", error);
        throw new Error("Failed to fetch today's journal entries.");
      }
    
      return data;
    }
    
    /**
     * Fetch the latest mood score for the user.
     * @returns {Promise<Object>} - Latest journal entry with mood score.
     */
    async function fetchLatestMoodScore() {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("journal_entries_v2")
        .select("id, mood_score, created_at, analysis_data")
        .eq("user_id", FIXED_USER_ID)
        .gte("created_at", today)
        .order("created_at", { ascending: false })
        .limit(1);
    
      if (error) {
        console.error("Error fetching latest mood score:", error);
        throw new Error("Failed to fetch latest mood score.");
      }
    
      return data[0];
    }
    
    /**
     * Fetch weekly mood data for the user.
     * @returns {Promise<Object[]>} - Array of mood data from the past week.
     */
    async function fetchWeeklyMoodData() {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("journal_entries_v2")
        .select("mood_score, created_at, analysis_data")
        .eq("user_id", FIXED_USER_ID)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false });
    
      if (error) {
        console.error("Error fetching weekly mood data:", error);
        throw new Error("Failed to fetch weekly mood data.");
      }
    
      return data;
    }
    
    /**
     * Fetch all documents uploaded by the user.
     * @returns {Promise<Object[]>} - Array of user documents.
     */
    async function fetchUserDocuments() {
      const { data, error } = await supabase
        .from("journal_documents")
        .select("id, file_name, file_type, public_url, parsed_content, status, created_at")
        .eq("user_id", FIXED_USER_ID)
        .order("created_at", { ascending: false });
    
      if (error) {
        console.error("Error fetching user documents:", error);
        throw new Error("Failed to fetch user documents.");
      }
    
      return data;
    }
    
    // Integrate these functions into the tools in the MCP server
    server.tool(
      "fetchUserInsights",
      async () => { // Removed the userId argument since it's not needed
        try {
          const [journalEntries, latestMood, weeklyMood, documents] = await Promise.all([
            fetchTodaysJournalEntries(),
            fetchLatestMoodScore(),
            fetchWeeklyMoodData(),
            fetchUserDocuments(),
          ]);
    
          return {
            content: [
              { type: "text", text: `Today's Journal Entries: ${journalEntries.length}` },
              { type: "text", text: `Latest Mood Score: ${latestMood?.mood_score || "N/A"}` },
              { type: "text", text: `Weekly Mood Data Points: ${weeklyMood.length}` },
              { type: "text", text: `Uploaded Documents: ${documents.length}` },
            ],
          };
        } catch (error) {
          console.error("Error fetching user insights:", error);
          return {
            content: [{ type: "text", text: "Failed to fetch user insights." }],
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
        fetchUserInsights: {
          description: "Fetch comprehensive user insights including today's journal entries, latest mood score, weekly mood data, and uploaded documents",
        },
      },
    },
  }
);

export default handler;
