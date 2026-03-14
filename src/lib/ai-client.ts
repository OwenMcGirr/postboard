import OpenAI from "openai";

export const aiClient = new OpenAI({
  apiKey: import.meta.env.VITE_OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  dangerouslyAllowBrowser: true,
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Postboard",
  },
});

export const AI_MODEL = (import.meta.env.VITE_AI_MODEL as string) ?? "openai/gpt-4o";

// Edit this to match your voice and audience.
const SYSTEM_PROMPT = `You are a social media copywriter specialising in LinkedIn content.
Write posts that are direct, confident, and specific — no fluff, no buzzwords, no emojis unless asked.
Keep it conversational and human. Use short paragraphs.
When given a brief, produce a complete, ready-to-post LinkedIn post.
When given a refinement instruction, rewrite accordingly while preserving the core message.
Output ONLY the post text — no preamble, no "Here's your post:", no quotes around the text.`;

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
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
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
