import { createClient } from "@supabase/supabase-js";
import {
  users, orders, messages, timelineEvents,
  type User, type InsertUser,
  type Order, type InsertOrder,
  type Message, type InsertMessage,
  type TimelineEvent, type InsertTimelineEvent
} from "@shared/schema";
import { supabase } from './supabase';

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getOrder(id: number): Promise<Order | undefined>;
  getOrderByChatId(chatId: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  getOrdersByStatus(status: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, updates: Partial<Order>): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<boolean>;

  getMessagesByOrderId(orderId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  getTimelineByOrderId(orderId: number): Promise<TimelineEvent[]>;
  createTimelineEvent(event: InsertTimelineEvent): Promise<TimelineEvent>;
}

export class SupabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const { data } = await supabase.from("users").select("*").eq("id", id).single();
    return data ?? undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { data } = await supabase.from("users").select("*").eq("username", username).single();
    return data ?? undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const { data, error } = await supabase.from("users").insert(user).select().single();
    if (error) throw error;
    return data;
  }

  // Orders
  async getOrder(id: number): Promise<Order | undefined> {
    const { data } = await supabase.from("orders").select("*").eq("id", id).single();
    return data ?? undefined;
  }

  async getOrderByChatId(chatId: string): Promise<Order | undefined> {
    const { data } = await supabase.from("orders").select("*").eq("telegramChatId", chatId).order("createdAt", { ascending: false }).limit(1).single();
    return data ?? undefined;
  }

  async getAllOrders(): Promise<Order[]> {
    const { data } = await supabase.from("orders").select("*").order("createdAt", { ascending: false });
    return data ?? [];
  }

  async getOrdersByStatus(status: string): Promise<Order[]> {
    const { data } = await supabase.from("orders").select("*").eq("status", status).order("createdAt", { ascending: false });
    return data ?? [];
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const { data, error } = await supabase.from("orders").insert(order).select().single();
    if (error) throw error;
    return data;
  }

  async updateOrder(id: number, updates: Partial<Order>): Promise<Order | undefined> {
    const { data, error } = await supabase.from("orders").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return data ?? undefined;
  }

  async deleteOrder(id: number): Promise<boolean> {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) return false;
    return true;
  }

  // Messages
  async getMessagesByOrderId(orderId: number): Promise<Message[]> {
    const { data } = await supabase.from("messages").select("*").eq("orderId", orderId).order("createdAt", { ascending: true });
    return data ?? [];
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const { data, error } = await supabase.from("messages").insert(message).select().single();
    if (error) throw error;
    return data;
  }

  // Timeline Events
  async getTimelineByOrderId(orderId: number): Promise<TimelineEvent[]> {
    const { data } = await supabase.from("timelineEvents").select("*").eq("orderId", orderId).order("timestamp", { ascending: true });
    return data ?? [];
  }

  async createTimelineEvent(event: InsertTimelineEvent): Promise<TimelineEvent> {
    const { data, error } = await supabase.from("timelineEvents").insert(event).select().single();
    if (error) throw error;
    return data;
  }
}

// 👇 this is your main storage instance used in bot/backend
export const storage = new SupabaseStorage();
