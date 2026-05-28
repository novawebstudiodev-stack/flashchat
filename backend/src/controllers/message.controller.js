import Message from '../models/Message.js';
import User from '../models/User.js';
import { deleteImage } from '../services/cloudinary.service.js';
import { emitToUser } from '../config/socket.js';
import { ok, fail } from '../utils/response.util.js';

// GET /api/messages/:userId — fetch conversation history
export const getMessages = async (req, res, next) => {
  try {
    const myId      = req.user._id;
    const otherId   = req.params.userId;
    const { limit = 30, before } = req.query;

    const query = {
      $or: [
        { senderId: myId,    receiverId: otherId },
        { senderId: otherId, receiverId: myId },
      ],
    };

    if (before) {
      const anchor = await Message.findById(before);
      if (anchor) query.createdAt = { $lt: anchor.createdAt };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .select('+imagePublicId');

    ok(res, { messages: messages.reverse() });
  } catch (err) {
    next(err);
  }
};

// POST /api/messages/send
export const sendMessage = async (req, res, next) => {
  try {
    const senderId   = req.user._id;
    const { receiverId, text, imageUrl, imagePublicId, imageWidth, imageHeight } = req.body;

    if (!receiverId)          return fail(res, 'receiverId is required');
    if (!text && !imageUrl)   return fail(res, 'Message must have text or image');

    const receiver = await User.findById(receiverId);
    if (!receiver) return fail(res, 'Receiver not found', 404);

    const message = await Message.create({
      senderId,
      receiverId,
      text:          text        || null,
      imageUrl:      imageUrl    || null,
      imagePublicId: imagePublicId || null,
      imageWidth:    imageWidth  || null,
      imageHeight:   imageHeight || null,
    });

    // Emit to receiver if online
    emitToUser(receiverId, 'message:new', { message });

    ok(res, { message }, 201);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/messages/:messageId/seen
export const markSeen = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const myId = req.user._id;

    const message = await Message.findOne({
      _id: messageId,
      receiverId: myId,
      seen: false,
    });

    if (!message) return fail(res, 'Message not found or already seen', 404);

    const expiresAt = new Date(Date.now() + Message.SEEN_EXPIRY_MS);
    message.seen      = true;
    message.seenAt    = new Date();
    message.expiresAt = expiresAt;
    await message.save();

    // Notify sender: their message was seen, start 20s countdown
    emitToUser(message.senderId.toString(), 'message:seen:ack', {
      messageId: message._id,
      expiresAt,
    });

    ok(res, { expiresAt });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/messages/:messageId
export const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const myId = req.user._id.toString();

    const message = await Message.findById(messageId).select('+imagePublicId +cloudinaryDeleted');
    if (!message) return fail(res, 'Message not found', 404);

    const isSender   = message.senderId.toString()   === myId;
    const isReceiver = message.receiverId.toString() === myId;
    if (!isSender && !isReceiver) return fail(res, 'Forbidden', 403);

    // Delete Cloudinary image
    if (message.imagePublicId && !message.cloudinaryDeleted) {
      await deleteImage(message.imagePublicId);
    }

    // Hard delete from DB
    await Message.findByIdAndDelete(messageId);

    // Notify both participants
    const otherId = isSender ? message.receiverId.toString() : message.senderId.toString();
    emitToUser(otherId, 'message:deleted', { messageId });
    emitToUser(myId,    'message:deleted', { messageId });

    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
};
