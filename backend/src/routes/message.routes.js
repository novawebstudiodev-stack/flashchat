import { Router } from 'express';
import {
  getMessages,
  sendMessage,
  markSeen,
  deleteMessage,
} from '../controllers/message.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = Router();

router.use(protect);

router.get('/:userId',              getMessages);
router.post('/send',                sendMessage);
router.patch('/:messageId/seen',    markSeen);
router.delete('/:messageId',        deleteMessage);

export default router;
