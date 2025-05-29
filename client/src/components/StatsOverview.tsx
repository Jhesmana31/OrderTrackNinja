import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ShoppingCart, 
  Clock, 
  CheckCircle, 
  DollarSign,
  TrendingUp,
  AlertCircle
} from "lucide-react";

interface Stats {
  activeOrders: number;
  pendingPayments: number;
  completedToday: number;
  revenue: number;
}

export default function StatsOverview() {
  const { data: stats } = useQuery<Stats>({
    queryKey: ['/api/stats'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const statsCards = [
    {
      title: "Active Orders",
      value: stats?.activeOrders ?? 0,
      icon: ShoppingCart,
      color: "text-secondary",
      bgColor: "bg-secondary/20",
      description: "Currently processing"
    },
    {
      title: "Pending Payments",
      value: stats?.pendingPayments ?? 0,
      icon: AlertCircle,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/20",
      description: "Awaiting payment"
    },
    {
      title: "Completed Today",
      value: stats?.completedToday ?? 0,
      icon: CheckCircle,
      color: "text-green-400",
      bgColor: "bg-green-500/20",
      description: "Successfully delivered"
    },
    {
      title: "Today's Revenue",
      value: stats ? `₱${(stats.revenue / 100).toFixed(2)}` : "₱0.00",
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-primary/20",
      description: "Total earnings"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statsCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="glass-effect border-primary/20 hover:border-secondary/30 transition-all">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-bold ${stat.color} neon-glow`}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {stat.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
