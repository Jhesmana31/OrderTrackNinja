import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { insertOrderSchema, insertMessageSchema, insertTimelineEventSchema } from "@shared/schema";
import { z } from "zod";
import { initTelegramBot } from "./telegram-bot";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('WebSocket client connected');

    ws.on('close', () => {
      clients.delete(ws);
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Broadcast function for real-time updates
  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Initialize Telegram bot
  const telegramBot = initTelegramBot(storage, broadcast);

  // Serve uploaded files
  app.use('/uploads', (req, res, next) => {
    // Add security headers
    res.setHeader('Cache-Control', 'public, max-age=86400');
    next();
  }, (req, res, next) => {
    const filePath = path.join(uploadDir, req.path);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  });

  // Get all orders
  app.get('/api/orders', async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  // Get order by ID
  app.get('/api/orders/:id', async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      res.json(order);
    } catch (error) {
      console.error('Error fetching order:', error);
      res.status(500).json({ error: 'Failed to fetch order' });
    }
  });

  // Create new order
  app.post('/api/orders', async (req, res) => {
    try {
      const orderData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(orderData);
      
      // Create initial timeline event
      await storage.createTimelineEvent({
        orderId: order.id,
        event: 'confirmed'
      });
      
      broadcast({ type: 'orderCreated', order });
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid order data', details: error.errors });
      }
      console.error('Error creating order:', error);
      res.status(500).json({ error: 'Failed to create order' });
    }
  });

  // Update order
  app.patch('/api/orders/:id', async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const updates = req.body;
      
      const updatedOrder = await storage.updateOrder(orderId, updates);
      
      if (!updatedOrder) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // If status changed, create timeline event
      if (updates.status) {
        await storage.createTimelineEvent({
          orderId: orderId,
          event: updates.status
        });
      }
      
      broadcast({ type: 'orderUpdated', order: updatedOrder });
      res.json(updatedOrder);
    } catch (error) {
      console.error('Error updating order:', error);
      res.status(500).json({ error: 'Failed to update order' });
    }
  });

  // Get messages for an order
  app.get('/api/orders/:id/messages', async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const messages = await storage.getMessagesByOrderId(orderId);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // Send message to customer
  app.post('/api/orders/:id/messages', async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Save message to database
      const savedMessage = await storage.createMessage({
        orderId,
        sender: 'admin',
        message
      });
      
      // Send message via Telegram bot
      await telegramBot.telegram.sendMessage(order.telegramChatId, message);
      
      broadcast({ type: 'messageCreated', message: savedMessage });
      res.status(201).json(savedMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // Upload QR code for payment
  app.post('/api/orders/:id/qr', upload.single('qr'), async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: 'QR code file is required' });
      }
      
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Send QR code via Telegram bot
      const filePath = path.join(uploadDir, file.filename);
      await telegramBot.telegram.sendPhoto(order.telegramChatId, { source: filePath }, {
        caption: `Payment QR Code for Order #${order.id}\nTotal: ₱${(order.total / 100).toFixed(2)}\nPlease scan and upload your payment proof after paying.`
      });
      
      // Update order to mark QR as sent
      await storage.updateOrder(orderId, { qrCodeSent: true });
      
      broadcast({ type: 'qrCodeSent', orderId });
      res.json({ success: true, message: 'QR code sent to customer' });
    } catch (error) {
      console.error('Error sending QR code:', error);
      res.status(500).json({ error: 'Failed to send QR code' });
    }
  });

  // Get timeline for an order
  app.get('/api/orders/:id/timeline', async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const timeline = await storage.getTimelineByOrderId(orderId);
      res.json(timeline);
    } catch (error) {
      console.error('Error fetching timeline:', error);
      res.status(500).json({ error: 'Failed to fetch timeline' });
    }
  });

  // Get dashboard stats
  app.get('/api/stats', async (req, res) => {
    try {
      const allOrders = await storage.getAllOrders();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todaysOrders = allOrders.filter(order => 
        order.createdAt && new Date(order.createdAt) >= today
      );
      
      const stats = {
        activeOrders: allOrders.filter(order => 
          ['pending', 'confirmed', 'preparing', 'ready', 'delivering'].includes(order.status)
        ).length,
        pendingPayments: allOrders.filter(order => order.status === 'pending').length,
        completedToday: todaysOrders.filter(order => order.status === 'delivered').length,
        revenue: todaysOrders
          .filter(order => order.status === 'delivered')
          .reduce((sum, order) => sum + order.total, 0)
      };
      
      res.json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  return httpServer;
}
