export interface Nameable {
  name: string;
  preferred_name?: string | null;
}

export function displayName(member: Nameable): string {
  return member.preferred_name?.trim() || member.name;
}
