import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Search, Filter, Plus, Bot } from "lucide-react";
import OrderTile from "@/components/OrderTile";
import ChatModal from "@/components/ChatModal";
import StatsOverview from "@/components/StatsOverview";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Order } from "@shared/schema";

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Fetch orders
  const { data: orders = [], refetch: refetchOrders } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // WebSocket for real-time updates
  useWebSocket({
    onMessage: (data) => {
      if (data.type === 'orderCreated' || data.type === 'orderUpdated' || data.type === 'paymentProofReceived') {
        refetchOrders();
      }
    }
  });

  // Filter orders based on search and status
  const filteredOrders = orders.filter((order) => {
    const matchesSearch = searchQuery === "" || 
      order.telegramUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.id.toString().includes(searchQuery) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "" || statusFilter === "all" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleChatOpen = (orderId: number) => {
    setSelectedOrderId(orderId);
    setIsChatOpen(true);
  };

  const handleChatClose = () => {
    setIsChatOpen(false);
    setSelectedOrderId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-effect sticky top-0 z-50 border-b border-primary/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-primary to-secondary p-2 flex items-center justify-center">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-xl font-bold gradient-text">TeleOrder Dashboard</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" className="neon-border-teal text-secondary">
                <Bell className="h-4 w-4 mr-2" />
                <Badge variant="destructive" className="ml-1">3</Badge>
              </Button>
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-secondary"></div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Overview */}
        <StatsOverview />

        {/* Search and Filters */}
        <Card className="glass-effect border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary h-4 w-4" />
                <Input
                  placeholder="Search by Telegram username, order ID, or customer name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted border-primary/30 focus:border-secondary text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 bg-muted border-primary/30 focus:border-secondary">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="preparing">Preparing</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="delivering">Delivering</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  onClick={() => refetchOrders()}
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/80 hover:to-primary text-primary-foreground border-0"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredOrders.length === 0 ? (
            <Card className="col-span-full glass-effect border-primary/20">
              <CardContent className="pt-6 text-center py-12">
                <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Orders Found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter ? 
                    "No orders match your current filters." : 
                    "No orders have been placed yet. Orders will appear here when customers use the Telegram bot."
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredOrders.map((order) => (
              <OrderTile
                key={order.id}
                order={order}
                onChatOpen={() => handleChatOpen(order.id)}
                onOrderUpdate={refetchOrders}
              />
            ))
          )}
        </div>
      </div>

      {/* Chat Modal */}
      {selectedOrderId && (
        <ChatModal
          orderId={selectedOrderId}
          isOpen={isChatOpen}
          onClose={handleChatClose}
        />
      )}

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6">
        <Button 
          size="lg"
          className="w-14 h-14 rounded-full bg-gradient-to-r from-primary to-secondary hover:scale-110 transition-transform shadow-lg"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
