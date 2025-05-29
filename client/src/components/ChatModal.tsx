import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MessageCircle, Send, X } from "lucide-react";
import type { Order, Message } from "@shared/schema";

interface ChatModalProps {
  orderId: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatModal({ orderId, isOpen, onClose }: ChatModalProps) {
  const [messageInput, setMessageInput] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch order details
  const { data: order } = useQuery<Order>({
    queryKey: ['/api/orders', orderId],
    enabled: isOpen,
  });

  // Fetch messages
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/orders', orderId, 'messages'],
    enabled: isOpen,
    refetchInterval: 2000, // Refresh every 2 seconds for real-time feel
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest('POST', `/api/orders/${orderId}/messages`, { message });
    },
    onSuccess: () => {
      setMessageInput("");
      toast({ title: "Message sent to customer via Telegram" });
      queryClient.invalidateQueries({ queryKey: ['/api/orders', orderId, 'messages'] });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
  });

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      sendMessageMutation.mutate(messageInput.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col glass-effect border-primary/20 text-foreground">
        <DialogHeader className="border-b border-primary/30 pb-4">
          <DialogTitle className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-secondary to-primary rounded-full flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-secondary neon-glow">{order.telegramUsername}</div>
              <div className="text-sm text-muted-foreground">Order #{order.id}</div>
            </div>
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* Chat Messages */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'admin' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.sender === 'admin'
                        ? 'bg-secondary/20 border border-secondary/30 text-foreground'
                        : 'bg-primary/20 border border-primary/30 text-foreground'
                    }`}
                  >
                    <div className="text-sm">{message.message}</div>
                    <div className={`text-xs mt-1 ${
                      message.sender === 'admin' ? 'text-secondary' : 'text-primary'
                    }`}>
                      {message.sender === 'admin' ? 'You' : order.telegramUsername} • {' '}
                      {message.createdAt ? new Date(message.createdAt).toLocaleTimeString() : ''}
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {sendMessageMutation.isPending && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-lg p-3 bg-secondary/10 border border-secondary/20 text-muted-foreground">
                  <div className="text-sm">Sending...</div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="border-t border-primary/30 pt-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Type your message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1 bg-muted border-primary/30 focus:border-secondary text-foreground placeholder:text-muted-foreground"
              disabled={sendMessageMutation.isPending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || sendMessageMutation.isPending}
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/80 hover:to-primary text-primary-foreground"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Messages will be sent directly to the customer via Telegram bot
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
