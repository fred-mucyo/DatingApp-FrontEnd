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


import Constants from 'expo-constants';

export const env = {
  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    ((Constants.expoConfig as any)?.extra?.EXPO_PUBLIC_SUPABASE_URL as string | undefined) ??
    ((Constants.expoConfig as any)?.extra?.SUPABASE_URL as string | undefined) ??
    '',
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    ((Constants.expoConfig as any)?.extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
    ((Constants.expoConfig as any)?.extra?.SUPABASE_ANON_KEY as string | undefined) ??
    '',
  cloudinaryCloudName:
    process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ??
    process.env.CLOUDINARY_CLOUD_NAME ??
    ((Constants.expoConfig as any)?.extra?.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME as string | undefined) ??
    ((Constants.expoConfig as any)?.extra?.CLOUDINARY_CLOUD_NAME as string | undefined) ??
    '',
  cloudinaryUploadPreset:
    process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ??
    process.env.CLOUDINARY_UPLOAD_PRESET ??
    ((Constants.expoConfig as any)?.extra?.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET as string | undefined) ??
    ((Constants.expoConfig as any)?.extra?.CLOUDINARY_UPLOAD_PRESET as string | undefined) ??
    '',
};

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars are not set. Check .env configuration.');
}

if (!env.cloudinaryCloudName || !env.cloudinaryUploadPreset) {
  // eslint-disable-next-line no-console
  console.warn('Cloudinary env vars are not set. Image upload will fail until configured.');
}