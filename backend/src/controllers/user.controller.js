import User from '../models/User.js';
import Message from '../models/Message.js';
import { ok, fail } from '../utils/response.util.js';

export const searchUsers = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return ok(res, { users: [] });

    const users = await User.find({
      _id: { $ne: req.user._id },
      username: { $regex: q, $options: 'i' },
    }).limit(15).select('username avatarUrl isOnline lastSeen');

    ok(res, { users });
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('username avatarUrl isOnline lastSeen');
    if (!user) return fail(res, 'User not found', 404);
    ok(res, { user });
  } catch (err) {
    next(err);
  }
};

// Returns recent conversation partners with last message preview
export const getConversations = async (req, res, next) => {
  try {
    const myId = req.user._id;

    // Find distinct users we have messages with
    const sent     = await Message.distinct('receiverId', { senderId: myId });
    const received = await Message.distinct('senderId',   { receiverId: myId });
    const partnerIds = [...new Set([...sent, ...received].map(String))];

    // Fetch user details and last message for each partner
    const conversations = await Promise.all(
      partnerIds.map(async (partnerId) => {
        const partner = await User.findById(partnerId)
          .select('username avatarUrl isOnline lastSeen');
        if (!partner) return null;

        const lastMessage = await Message.findOne({
          $or: [
            { senderId: myId, receiverId: partnerId },
            { senderId: partnerId, receiverId: myId },
          ],
        }).sort({ createdAt: -1 });

        const unreadCount = await Message.countDocuments({
          senderId: partnerId,
          receiverId: myId,
          seen: false,
        });

        return { partner, lastMessage, unreadCount };
      })
    );

    // Filter nulls and sort by last message time
    const valid = conversations
      .filter(Boolean)
      .sort((a, b) =>
        (b.lastMessage?.createdAt || 0) - (a.lastMessage?.createdAt || 0)
      );

    ok(res, { conversations: valid });
  } catch (err) {
    next(err);
  }
};
