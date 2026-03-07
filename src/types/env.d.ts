declare module '@env' {
  export const SUPABASE_URL: string;
  export const SUPABASE_ANON_KEY: string;
  export const CLOUDINARY_CLOUD_NAME: string;
  export const CLOUDINARY_UPLOAD_PRESET: string;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js';
}
