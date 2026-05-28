import { Router } from 'express';
import { searchUsers, getUserById, getConversations } from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

router.get('/search',        searchUsers);
router.get('/conversations', getConversations);
router.get('/:userId',       getUserById);

export default router;
