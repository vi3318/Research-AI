const express = require('express');
const chatController = require('../controllers/chatController');
const { requireAuth, syncUser } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ChatSession:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_id:
 *           type: string
 *         title:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         metadata:
 *           type: object
 *     
 *     Message:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         session_id:
 *           type: string
 *           format: uuid
 *         role:
 *           type: string
 *           enum: [user, assistant, system]
 *         content:
 *           type: string
 *         metadata:
 *           type: object
 *         created_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/chat/sessions:
 *   post:
 *     summary: Create a new chat session
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatSession'
 */
router.post('/sessions', requireAuth, syncUser, chatController.createSession);

/**
 * @swagger
 * /api/chat/sessions:
 *   get:
 *     summary: Get user's chat sessions
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of user sessions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ChatSession'
 */
router.get('/sessions', requireAuth, syncUser, chatController.getSessions);

/**
 * @swagger
 * /api/chat/sessions/{sessionId}/messages:
 *   get:
 *     summary: Get messages for a session
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 */
router.get('/sessions/:sessionId/messages', requireAuth, syncUser, chatController.getSessionMessages);

/**
 * @swagger
 * /api/chat/sessions/{sessionId}/messages:
 *   post:
 *     summary: Send a message to a session
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [chat, research, paper_qa]
 *                 default: chat
 *     responses:
 *       200:
 *         description: Message sent and response received
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userMessage:
 *                   $ref: '#/components/schemas/Message'
 *                 assistantMessage:
 *                   $ref: '#/components/schemas/Message'
 *                 session:
 *                   $ref: '#/components/schemas/ChatSession'
 */
router.post('/sessions/:sessionId/messages', requireAuth, syncUser, chatController.sendMessage);

/**
 * @swagger
 * /api/chat/sessions/{sessionId}/context:
 *   post:
 *     summary: Add papers to session context
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - papers
 *             properties:
 *               papers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                     authors:
 *                       type: string
 *                     abstract:
 *                       type: string
 *                     doi:
 *                       type: string
 *                     pdfUrl:
 *                       type: string
 *                     url:
 *                       type: string
 *     responses:
 *       200:
 *         description: Papers added to context
 */
router.post('/sessions/:sessionId/context', requireAuth, syncUser, chatController.addPapersToContext);

/**
 * @swagger
 * /api/chat/sessions/{sessionId}/context:
 *   get:
 *     summary: Get session context papers
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session context papers
 */
router.get('/sessions/:sessionId/context', requireAuth, syncUser, chatController.getSessionContext);

/**
 * @swagger
 * /api/chat/sessions/{sessionId}:
 *   put:
 *     summary: Update session (e.g., title)
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       200:
 *         description: Session updated
 */
router.put('/sessions/:sessionId', requireAuth, syncUser, chatController.updateSession);

/**
 * @swagger
 * /api/chat/sessions/{sessionId}:
 *   delete:
 *     summary: Delete a session
 *     tags: [Chat]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session deleted
 */
router.delete('/sessions/:sessionId', requireAuth, syncUser, chatController.deleteSession);

module.exports = router;