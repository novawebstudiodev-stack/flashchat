import User from '../models/User.js';
import { signToken } from '../utils/jwt.util.js';
import { ok, fail } from '../utils/response.util.js';

export const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return fail(res, 'Username, email, and password are required');
    }
    if (password.length < 6) {
      return fail(res, 'Password must be at least 6 characters');
    }

    // Create user — passwordHash pre-save hook will bcrypt it
    const user = await User.create({ username, email, passwordHash: password });

    const token = signToken({ userId: user._id, username: user.username });
    ok(res, { token, user }, 201);
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 'Email and password required');

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) return fail(res, 'Invalid credentials', 401);

    const match = await user.comparePassword(password);
    if (!match) return fail(res, 'Invalid credentials', 401);

    const token = signToken({ userId: user._id, username: user.username });
    ok(res, { token, user });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res) => {
  ok(res, { user: req.user });
};
