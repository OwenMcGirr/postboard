const KEY = "postboard_user_profile";

export function getUserProfile(): string {
  return localStorage.getItem(KEY) ?? "";
}

export function setUserProfile(profile: string) {
  localStorage.setItem(KEY, profile);
}
