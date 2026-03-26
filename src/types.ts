export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: 'client' | 'shop_owner' | 'superadmin';
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  pointsValue: number;
}

export interface Transaction {
  id: string;
  customerId: string;
  productId: string;
  productName: string;
  amount: number;
  pointsEarned: number;
  date: string;
}

export interface Reward {
  id: string;
  title: string;
  pointsCost: number;
  description: string;
  icon: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  totalPoints: number;
  joinDate: string;
  lastVisit: string;
}

export interface ReminderSettings {
  frequency: 'weekly' | 'monthly' | 'before_expiry';
  channel: 'sms' | 'email' | 'push';
  messageTemplate: string;
  enabled: boolean;
}

export interface Shop {
  id: string;
  name: string;
  location: string;
  logoUrl?: string;
  ownerId: string;
  ownerName: string;
  ownerEmail?: string;
  ownerPhone?: string;
  createdAt: string;
}

export interface CheckIn {
  id: string;
  userId: string;
  shopId: string;
  userName: string;
  userPhone: string;
  timestamp: string;
  status: 'pending' | 'completed';
}

export interface Campaign {
  id: string;
  shopId: string;
  title: string;
  description: string;
  type: 'double_points' | 'flash_sale' | 'new_arrival' | 'event';
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface MarketingInsight {
  title: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down';
  icon: string;
}

export interface AppData {
  shops: Shop[];
  customers: Customer[];
  products: Product[];
  transactions: any[];
  rewards: Reward[];
  campaigns: Campaign[];
  settings: ReminderSettings;
}
