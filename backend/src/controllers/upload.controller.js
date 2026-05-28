import { uploadImage } from '../services/cloudinary.service.js';
import { ok, fail } from '../utils/response.util.js';

export const uploadMessageImage = async (req, res, next) => {
  try {
    if (!req.file) return fail(res, 'No image file provided');

    const result = await uploadImage(req.file.buffer);
    ok(res, result, 201);
  } catch (err) {
    next(err);
  }
};
