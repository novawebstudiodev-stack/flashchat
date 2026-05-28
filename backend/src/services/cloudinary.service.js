import cloudinary from '../config/cloudinary.js';
import streamifier from 'streamifier';

export const uploadImage = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'flashchat/messages',
        resource_type: 'image',
        transformation: [
          { width: 1200, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url:      result.secure_url,
          publicId: result.public_id,
          width:    result.width,
          height:   result.height,
        });
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

export const deleteImage = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (err) {
    // Log but don't throw — TTL and cron job are the backup
    console.error('[Cloudinary] delete failed for', publicId, ':', err.message);
  }
};
