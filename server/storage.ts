import { 
  users, orders, messages, timelineEvents,
  type User, type InsertUser,
  type Order, type InsertOrder,
  type Message, type InsertMessage,
  type TimelineEvent, type InsertTimelineEvent
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Order operations
  getOrder(id: number): Promise<Order | undefined>;
  getOrderByChatId(chatId: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  getOrdersByStatus(status: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, updates: Partial<Order>): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<boolean>;

  // Message operations
  getMessagesByOrderId(orderId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Timeline operations
  getTimelineByOrderId(orderId: number): Promise<TimelineEvent[]>;
  createTimelineEvent(event: InsertTimelineEvent): Promise<TimelineEvent>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private orders: Map<number, Order>;
  private messages: Map<number, Message>;
  private timelineEvents: Map<number, TimelineEvent>;
  private currentUserId: number;
  private currentOrderId: number;
  private currentMessageId: number;
  private currentTimelineId: number;

  constructor() {
    this.users = new Map();
    this.orders = new Map();
    this.messages = new Map();
    this.timelineEvents = new Map();
    this.currentUserId = 1;
    this.currentOrderId = 1;
    this.currentMessageId = 1;
    this.currentTimelineId = 1;
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Order operations
  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrderByChatId(chatId: string): Promise<Order | undefined> {
    return Array.from(this.orders.values()).find(
      (order) => order.telegramChatId === chatId
    );
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getOrdersByStatus(status: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      (order) => order.status === status
    );
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = this.currentOrderId++;
    const now = new Date();
    const order: Order = { 
      ...insertOrder, 
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.orders.set(id, order);
    return order;
  }

  async updateOrder(id: number, updates: Partial<Order>): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    
    const updatedOrder = { 
      ...order, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  async deleteOrder(id: number): Promise<boolean> {
    return this.orders.delete(id);
  }

  // Message operations
  async getMessagesByOrderId(orderId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((message) => message.orderId === orderId)
      .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const message: Message = { 
      ...insertMessage, 
      id, 
      createdAt: new Date() 
    };
    this.messages.set(id, message);
    return message;
  }

  // Timeline operations
  async getTimelineByOrderId(orderId: number): Promise<TimelineEvent[]> {
    return Array.from(this.timelineEvents.values())
      .filter((event) => event.orderId === orderId)
      .sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());
  }

  async createTimelineEvent(insertEvent: InsertTimelineEvent): Promise<TimelineEvent> {
    const id = this.currentTimelineId++;
    const event: TimelineEvent = { 
      ...insertEvent, 
      id, 
      timestamp: new Date() 
    };
    this.timelineEvents.set(id, event);
    return event;
  }
}

export const storage = new MemStorage();
