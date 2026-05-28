import mongoose from 'mongoose';

const SEEN_EXPIRY_MS  = 20 * 1000;           // 20 seconds after seen
const UNSEEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h safety fallback

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  text: {
    type: String,
    trim: true,
    maxlength: [1000, 'Message too long'],
    default: null,
  },

  // Image
  imageUrl:      { type: String,  default: null },
  imagePublicId: { type: String,  default: null, select: false },
  imageWidth:    { type: Number,  default: null },
  imageHeight:   { type: Number,  default: null },

  // Lifecycle
  seen:    { type: Boolean, default: false, index: true },
  seenAt:  { type: Date,    default: null },

  // TTL — MongoDB hard-deletes when Date.now() >= expiresAt
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + UNSEEN_EXPIRY_MS),
    index: { expireAfterSeconds: 0 },
  },

  // Cloudinary cleanup flag
  cloudinaryDeleted: { type: Boolean, default: false, select: false },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────
// Fast conversation fetch (both directions)
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });

// ── Statics ───────────────────────────────────────────────────
messageSchema.statics.SEEN_EXPIRY_MS   = SEEN_EXPIRY_MS;
messageSchema.statics.UNSEEN_EXPIRY_MS = UNSEEN_EXPIRY_MS;

export default mongoose.model('Message', messageSchema);
