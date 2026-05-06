import { InterviewAnswerResult, InterviewSummary, ResearchFinding } from "./memory-types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}

export function startInterview() {
  return request<{ firstQuestion: { id: string; prompt: string } }>("/api/memory/interview/start", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function answerInterview(sessionId: string, questionId: string, answer: string) {
  return request<InterviewAnswerResult>("/api/memory/interview/message", {
    method: "POST",
    body: JSON.stringify({ sessionId, questionId, answer }),
  });
}

export function completeInterview(sessionId: string) {
  return request<InterviewSummary>("/api/memory/interview/complete", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export function updateCanonicalSummary(canonicalSummary: string, displayName: string) {
  return request<{ ok: boolean }>("/api/memory/profile", {
    method: "POST",
    body: JSON.stringify({ canonicalSummary, displayName }),
  });
}

export function importLegacyProfile(profile: string) {
  return request<{ imported: boolean }>("/api/memory/import_local_profile", {
    method: "POST",
    body: JSON.stringify({ profile }),
  });
}

export function previewResearch(target: string) {
  return request<{ findings: ResearchFinding[] }>("/api/memory/research", {
    method: "POST",
    body: JSON.stringify({ target }),
  });
}

export function saveResearch(target: string, findings: ResearchFinding[]) {
  return request<{ saved: number }>("/api/memory/research", {
    method: "POST",
    body: JSON.stringify({ target, findings, persist: true }),
  });
}

export function populateMemoryFromResearch(target: string) {
  return request<{
    saved: number;
    factCount: number;
    findings: ResearchFinding[];
    summary: InterviewSummary;
  }>("/api/memory/research_bootstrap", {
    method: "POST",
    body: JSON.stringify({ target }),
  });
}

export function saveWritingExample(text: string, label: string, sourceBrief?: string) {
  return request<{ id: string }>("/api/memory/examples", {
    method: "POST",
    body: JSON.stringify({ text, label, sourceBrief }),
  });
}
