// import { SUPABASE_URL, SUPABASE_ANON_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '@env';

// export const env = {
//   supabaseUrl: SUPABASE_URL ?? '',
//   supabaseAnonKey: SUPABASE_ANON_KEY ?? '',
//   cloudinaryCloudName: CLOUDINARY_CLOUD_NAME ?? '',
//   cloudinaryUploadPreset: CLOUDINARY_UPLOAD_PRESET ?? '',
// };

// if (!env.supabaseUrl || !env.supabaseAnonKey) {
//   // eslint-disable-next-line no-console
//   console.warn('Supabase env vars are not set. Check .env configuration.');
// }

// if (!env.cloudinaryCloudName || !env.cloudinaryUploadPreset) {
//   // eslint-disable-next-line no-console
//   console.warn('Cloudinary env vars are not set. Image upload will fail until configured.');
// }




// src/config/env.ts


export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  cloudinaryCloudName: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!,
  cloudinaryUploadPreset: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!,
};

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars are not set. Check .env configuration.');
}

if (!env.cloudinaryCloudName || !env.cloudinaryUploadPreset) {
  // eslint-disable-next-line no-console
  console.warn('Cloudinary env vars are not set. Image upload will fail until configured.');
}