import { Router } from 'express';
import { getUsers, getStats, addMemory, getMemories, deleteMemory, getAgentLogs, updateUserExpiry, autoAddMemory } from '../controllers/admin.controller';
import { protect, admin } from '../middleware/auth.middleware';

const router = Router();

// All routes are protected and require admin role
router.use(protect, admin);

router.get('/users', getUsers);
router.put('/users/:id/expiry', updateUserExpiry);
router.get('/stats', getStats);
router.post('/memory', addMemory);
router.post('/memory/auto', autoAddMemory);
router.get('/memory', getMemories);
router.delete('/memory/:id', deleteMemory);
router.get('/logs', getAgentLogs);

export default router;
