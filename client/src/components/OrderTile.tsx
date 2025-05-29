import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  MessageCircle, 
  Upload, 
  Check, 
  X, 
  Clock, 
  Truck, 
  CheckCircle,
  Edit,
  QrCode,
  Receipt
} from "lucide-react";
import type { Order, TimelineEvent } from "@shared/schema";

interface OrderTileProps {
  order: Order;
  onChatOpen: () => void;
  onOrderUpdate: () => void;
}

const statusConfig = {
  pending: { color: "bg-yellow-500/20 text-yellow-400", icon: Clock },
  confirmed: { color: "bg-blue-500/20 text-blue-400", icon: Check },
  preparing: { color: "bg-purple-500/20 text-purple-400", icon: Clock },
  ready: { color: "bg-green-500/20 text-green-400", icon: CheckCircle },
  delivering: { color: "bg-orange-500/20 text-orange-400", icon: Truck },
  delivered: { color: "bg-green-600/20 text-green-300", icon: CheckCircle },
  cancelled: { color: "bg-red-500/20 text-red-400", icon: X }
};

export default function OrderTile({ order, onChatOpen, onOrderUpdate }: OrderTileProps) {
  const [messageInput, setMessageInput] = useState("");
  const [qrFile, setQrFile] = useState<File | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch timeline for this order
  const { data: timeline = [] } = useQuery<TimelineEvent[]>({
    queryKey: ['/api/orders', order.id, 'timeline'],
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest('POST', `/api/orders/${order.id}/messages`, { message });
    },
    onSuccess: () => {
      setMessageInput("");
      toast({ title: "Message sent successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/orders', order.id, 'messages'] });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
  });

  // Upload QR mutation
  const uploadQRMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('qr', file);
      return fetch(`/api/orders/${order.id}/qr`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
    },
    onSuccess: () => {
      setQrFile(null);
      toast({ title: "QR code sent to customer via Telegram" });
      onOrderUpdate();
    },
    onError: () => {
      toast({ title: "Failed to send QR code", variant: "destructive" });
    }
  });

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest('PATCH', `/api/orders/${order.id}`, { status });
    },
    onSuccess: () => {
      toast({ title: "Order status updated" });
      onOrderUpdate();
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  });

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      sendMessageMutation.mutate(messageInput.trim());
    }
  };

  const handleQRUpload = () => {
    if (qrFile) {
      uploadQRMutation.mutate(qrFile);
    }
  };

  const handleApprovePayment = () => {
    updateStatusMutation.mutate('preparing');
  };

  const handleMarkReady = () => {
    updateStatusMutation.mutate('ready');
  };

  const handleMarkDelivering = () => {
    updateStatusMutation.mutate('delivering');
  };

  const handleMarkDelivered = () => {
    updateStatusMutation.mutate('delivered');
  };

  const StatusIcon = statusConfig[order.status as keyof typeof statusConfig]?.icon || Clock;
  const statusColor = statusConfig[order.status as keyof typeof statusConfig]?.color || "bg-gray-500/20 text-gray-400";

  const orderTotal = (order.total / 100).toFixed(2);

  return (
    <Card className="order-tile rounded-2xl shadow-lg overflow-hidden">
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{order.telegramUsername}</h3>
              <p className="text-sm text-muted-foreground">Order #{order.id}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={`${statusColor} font-medium`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Badge>
            <span className="text-lg font-bold text-secondary neon-glow">₱{orderTotal}</span>
          </div>
        </div>

        {/* Order Details */}
        <Card className="bg-muted/50 border-primary/20">
          <CardContent className="p-4">
            <h4 className="font-medium text-secondary mb-2">Order Details</h4>
            <div className="space-y-2 text-sm">
              {order.items.map((item, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-muted-foreground">{item}</span>
                </div>
              ))}
              <div className="border-t border-primary/20 pt-2 mt-2">
                <div className="flex justify-between font-medium">
                  <span className="text-primary">Delivery Slot:</span>
                  <span className="text-foreground">{order.deliverySlot}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Info */}
        <Card className="bg-muted/50 border-primary/20">
          <CardContent className="p-4">
            <h4 className="font-medium text-secondary mb-2">Customer Info</h4>
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                Name: <span className="text-foreground">{order.customerName}</span>
              </p>
              <p className="text-muted-foreground">
                Phone: <span className="text-foreground">{order.phone}</span>
              </p>
              <p className="text-muted-foreground">
                Address: <span className="text-foreground">{order.address}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="bg-muted/50 border-primary/20">
          <CardContent className="p-4">
            <h4 className="font-medium text-secondary mb-3">Order Timeline</h4>
            <div className="space-y-3">
              {timeline.map((event, index) => (
                <div key={event.id} className="timeline-step flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    event.event === order.status ? 'bg-secondary pulse-animation' : 
                    index < timeline.length - 1 ? 'bg-green-500' : 'bg-gray-500'
                  }`}></div>
                  <div className="text-sm">
                    <div className="text-foreground capitalize">{event.event ? event.event.replace('_', ' ') : 'Event'}</div>
                    <div className="text-muted-foreground text-xs">
                      {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions Section */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Chat Section */}
          <Card className="bg-muted/50 border-primary/20">
            <CardContent className="p-4">
              <h4 className="font-medium text-secondary mb-3 flex items-center">
                <MessageCircle className="h-4 w-4 mr-2" />
                Quick Message
              </h4>
              <div className="space-y-3">
                <Textarea
                  placeholder="Type message to customer..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className="bg-background border-primary/30 focus:border-secondary text-foreground placeholder:text-muted-foreground resize-none"
                  rows={2}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  className="w-full bg-primary hover:bg-primary/80 text-primary-foreground"
                >
                  {sendMessageMutation.isPending ? "Sending..." : "Send via Telegram"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* File Upload Section */}
          <Card className="bg-muted/50 border-primary/20">
            <CardContent className="p-4">
              <h4 className="font-medium text-secondary mb-3 flex items-center">
                <QrCode className="h-4 w-4 mr-2" />
                Payment QR
              </h4>
              <div className="space-y-3">
                <div className="upload-zone rounded-lg p-4 text-center cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setQrFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id={`qr-upload-${order.id}`}
                  />
                  <label htmlFor={`qr-upload-${order.id}`} className="cursor-pointer">
                    <QrCode className="h-8 w-8 text-secondary mx-auto mb-2" />
                    <p className="text-sm text-secondary">
                      {qrFile ? qrFile.name : "Upload QR Code"}
                    </p>
                  </label>
                </div>
                
                {qrFile && (
                  <Button
                    onClick={handleQRUpload}
                    disabled={uploadQRMutation.isPending}
                    className="w-full bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                  >
                    {uploadQRMutation.isPending ? "Sending..." : "Send to Customer"}
                  </Button>
                )}

                {/* Payment Proof Display */}
                {order.paymentProof && (
                  <div className="bg-background rounded-lg p-3 border border-secondary/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-secondary font-medium flex items-center">
                        <Receipt className="h-3 w-3 mr-1" />
                        Payment Proof
                      </span>
                    </div>
                    <img
                      src={order.paymentProof}
                      alt="Payment proof"
                      className="w-full h-24 object-cover rounded border border-secondary/30"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Actions */}
        <div className="flex flex-wrap gap-2">
          {order.status === 'pending' && order.paymentProof && (
            <Button
              onClick={handleApprovePayment}
              disabled={updateStatusMutation.isPending}
              className="flex-1 bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
            >
              <Check className="h-4 w-4 mr-2" />
              Approve Payment
            </Button>
          )}
          
          {order.status === 'preparing' && (
            <Button
              onClick={handleMarkReady}
              disabled={updateStatusMutation.isPending}
              className="flex-1 bg-secondary/20 text-secondary border border-secondary/30 hover:bg-secondary/30"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Ready
            </Button>
          )}
          
          {order.status === 'ready' && (
            <Button
              onClick={handleMarkDelivering}
              disabled={updateStatusMutation.isPending}
              className="flex-1 bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30"
            >
              <Truck className="h-4 w-4 mr-2" />
              Out for Delivery
            </Button>
          )}
          
          {order.status === 'delivering' && (
            <Button
              onClick={handleMarkDelivered}
              disabled={updateStatusMutation.isPending}
              className="flex-1 bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Delivered
            </Button>
          )}
          
          <Button
            onClick={onChatOpen}
            variant="outline"
            className="border-secondary/30 text-secondary hover:bg-secondary/10"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Chat
          </Button>
          
          <Button
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
