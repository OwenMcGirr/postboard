const KEY = "postboard_ai_online";

export function getAiOnlinePreference(): boolean {
  return localStorage.getItem(KEY) !== "false";
}

export function setAiOnlinePreference(value: boolean) {
  localStorage.setItem(KEY, String(value));
}
