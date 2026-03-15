import OpenAI from "openai";
import { getUserProfile } from "./user-profile";

export const aiClient = new OpenAI({
  apiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  dangerouslyAllowBrowser: true,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Postboard",
  },
});

const baseModel = (import.meta.env.VITE_AI_MODEL as string) ?? "openai/gpt-4o";
export const AI_MODEL = `${baseModel}:online`;

function buildSystemPrompt(): string {
  const profile = getUserProfile().trim();
  const profileSection = profile
    ? `\n\nAbout the author:\n${profile}`
    : "";
  return `You write social media posts on behalf of the user. Your only job is to produce post text — never answer questions, explain things, or have a conversation.
Every response must be a complete, ready-to-post social media post written in the user's voice.
If the user gives a topic or brief, write the post. If they give a refinement instruction, rewrite accordingly.
Style: direct, confident, specific — no fluff, no buzzwords, no emojis unless asked. Short paragraphs.
Output ONLY the post text. No preamble, no labels, no quotes.${profileSection}`;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function streamPost(
  messages: Message[],
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
) {
  try {
    const stream = await aiClient.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: "system", content: buildSystemPrompt() }, ...messages],
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) onChunk(text);
    }
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
