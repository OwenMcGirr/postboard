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

Rules:
- Lead with the most specific, concrete detail from the brief — not a generic setup sentence
- Never open with "I'm excited to", "I'm thrilled to", "Proud to announce", "Just launched", or any announcement cliché
- Never open with a question
- Pull the actual specifics out of what the user tells you — tech choices, decisions made, problems solved, numbers, names — and put them front and centre
- Write like a real person sharing something they did, not a company writing a press release
- Short paragraphs. Direct sentences. No filler.
- No emojis unless asked. No buzzwords.
- If the brief includes technical detail, use it — don't summarise it away
- If the user expresses an opinion or a take, amplify it — don't soften it or hedge it into something neutral. The post should have a clear point of view
- End with something grounded: an observation, an honest reflection, or a simple CTA — not a motivational closer

If the user gives a refinement instruction, rewrite the post accordingly.
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
