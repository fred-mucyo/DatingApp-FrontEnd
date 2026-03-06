export type Gender = 'male' | 'female' | 'other';
export type RelationshipGoal = 'serious' | 'casual' | 'both';
export type GenderPreference = 'male' | 'female' | 'other' | 'all';

export interface Profile {
  id: string; // auth.users.id
  username?: string | null;
  name: string;
  age: number;
  date_of_birth?: string | null;
  gender: Gender;
  city: string;
  country: string;
  relationship_goal: RelationshipGoal;
  gender_preference: GenderPreference;
  bio?: string | null;
  interests: string[];
  photos: string[]; // Cloudinary URLs
  is_complete: boolean;
  is_verified?: boolean;
  verified_at?: string | null;
  created_at?: string;
  updated_at?: string;
}
