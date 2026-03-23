import { getUserProfile } from "./user-profile";

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
    const response = await fetch("/api/ai/compose", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
        profile: getUserProfile(),
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message ?? `HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error("AI response stream was empty.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text) onChunk(text);
    }

    const finalText = decoder.decode();
    if (finalText) onChunk(finalText);
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
