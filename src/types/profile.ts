export type Gender = 'male' | 'female' | 'other';
export type RelationshipGoal = 'serious' | 'casual' | 'both';
export type GenderPreference = 'male' | 'female' | 'other' | 'all';

export interface Profile {
  id: string; // auth.users.id
  name: string;
  age: number;
  gender: Gender;
  city: string;
  country: string;
  relationship_goal: RelationshipGoal;
  gender_preference: GenderPreference;
  bio?: string | null;
  interests: string[];
  photos: string[]; // Cloudinary URLs
  is_complete: boolean;
  created_at?: string;
  updated_at?: string;
}
