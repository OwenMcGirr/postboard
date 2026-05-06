const KEY = "postboard_user_profile";
const MIGRATION_KEY = "postboard_user_profile_migrated";

export function getUserProfile(): string {
  return localStorage.getItem(KEY) ?? "";
}

export function setUserProfile(profile: string) {
  localStorage.setItem(KEY, profile);
}

export function hasUserProfileMigrationRun(): boolean {
  return localStorage.getItem(MIGRATION_KEY) === "true";
}

export function markUserProfileMigrated() {
  localStorage.setItem(MIGRATION_KEY, "true");
}
