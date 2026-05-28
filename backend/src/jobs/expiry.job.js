import cron from 'node-cron';
import Message from '../models/Message.js';
import { deleteImage } from '../services/cloudinary.service.js';

export const scheduleJobs = () => {
  // Every hour: delete Cloudinary images for expired/deleted messages
  cron.schedule('0 * * * *', async () => {
    try {
      const orphans = await Message.find({
        imagePublicId:     { $ne: null },
        cloudinaryDeleted: false,
        $or: [
          { expiresAt: { $lt: new Date() } },
          { seen: true, seenAt: { $lt: new Date(Date.now() - 60 * 1000) } },
        ],
      }).select('+imagePublicId +cloudinaryDeleted');

      for (const msg of orphans) {
        await deleteImage(msg.imagePublicId);
        msg.cloudinaryDeleted = true;
        await msg.save();
      }

      if (orphans.length > 0) {
        console.log(`[Cron] Cleaned ${orphans.length} orphaned Cloudinary images`);
      }
    } catch (err) {
      console.error('[Cron] Orphan cleanup failed:', err.message);
    }
  });

  console.log('[Cron] Jobs scheduled');
};
