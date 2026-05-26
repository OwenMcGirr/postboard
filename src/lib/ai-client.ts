export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ComposeActivity {
  text: string;
}

type ComposeStreamEvent =
  | { type: "activity"; text: string }
  | { type: "result"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export async function streamPost(
  messages: Message[],
  onActivity: (activity: ComposeActivity) => void,
  onResult: (text: string) => void,
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
    let buffer = "";
    let failed = false;
    let completed = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");

        if (!line) continue;

        let event: ComposeStreamEvent | null = null;
        try {
          event = JSON.parse(line) as ComposeStreamEvent;
        } catch {
          continue;
        }

        if (event.type === "activity") {
          onActivity({ text: event.text });
          continue;
        }

        if (event.type === "result") {
          onResult(event.text);
          continue;
        }

        if (event.type === "error") {
          failed = true;
          onError(new Error(event.message || "AI generation failed."));
          return;
        }

        if (event.type === "done") {
          completed = true;
          onDone();
        }
      }
    }

    buffer += decoder.decode();
    const trailing = buffer.trim();
    if (trailing) {
      try {
        const event = JSON.parse(trailing) as ComposeStreamEvent;
        if (event.type === "activity") onActivity({ text: event.text });
        if (event.type === "result") onResult(event.text);
        if (event.type === "error") {
          failed = true;
          onError(new Error(event.message || "AI generation failed."));
          return;
        }
      } catch {}
    }

    if (!failed && !completed) {
      onDone();
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
