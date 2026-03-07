import { env } from '../config/env';

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

export const uploadImageToCloudinary = async (uri: string): Promise<CloudinaryUploadResult> => {
  if (!env.cloudinaryCloudName || !env.cloudinaryUploadPreset) {
    throw new Error('Cloudinary is not configured');
  }

  const data = new FormData();
  // Cloudinary expects file under `file` key
  data.append(
    'file',
    {
      // @ts-ignore - React Native FormData file type
      uri,
      type: 'image/jpeg',
      name: `upload-${Date.now()}.jpg`,
    } as any,
  );
  data.append('upload_preset', env.cloudinaryUploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/image/upload`, {
    method: 'POST',
    body: data,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudinary upload failed: ${text}`);
  }

  const json = await res.json();
  return {
    url: json.secure_url,
    publicId: json.public_id,
  };
};
