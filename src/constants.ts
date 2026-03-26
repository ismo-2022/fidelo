import { AppData, Product, Reward } from "./types";

export const INITIAL_DATA: AppData = {
  shops: [
    { id: "s1", name: "Boulangerie Abidjan", location: "Cocody, Abidjan", logoUrl: "https://picsum.photos/seed/bakery/200", ownerName: "Koffi Kouassi", ownerId: "demo-owner-1", createdAt: "2024-01-01" },
    { id: "s2", name: "Café de San Pédro", location: "Centre-ville, San Pédro", logoUrl: "https://picsum.photos/seed/cafe/200", ownerName: "Awa Traoré", ownerId: "demo-owner-2", createdAt: "2024-02-15" },
  ],
  customers: [
    { id: "1", name: "Jean Dupont", phone: "06 12 34 56 78", totalPoints: 450, joinDate: "2024-01-15", lastVisit: "2024-03-10" },
    { id: "2", name: "Marie Curie", phone: "07 89 01 23 45", totalPoints: 1200, joinDate: "2023-11-20", lastVisit: "2024-03-15" },
    { id: "3", name: "Lucas Martin", phone: "06 55 44 33 22", totalPoints: 150, joinDate: "2024-02-05", lastVisit: "2024-03-01" },
  ],
  products: [
    { id: "p1", name: "Café Espresso", category: "Boissons", price: 1500, pointsValue: 10 },
    { id: "p2", name: "Croissant", category: "Viennoiserie", price: 1000, pointsValue: 5 },
    { id: "p3", name: "Menu Midi", category: "Plats", price: 7500, pointsValue: 50 },
    { id: "p4", name: "Thé Vert", category: "Boissons", price: 2000, pointsValue: 12 },
  ],
  transactions: [
    { id: "t1", customerId: "1", productId: "p3", productName: "Menu Midi", amount: 7500, pointsEarned: 50, date: "2024-03-10T12:30:00Z" },
    { id: "t2", customerId: "2", productId: "p1", productName: "Café Espresso", amount: 1500, pointsEarned: 10, date: "2024-03-15T08:45:00Z" },
    { id: "t3", customerId: "2", productId: "p3", productName: "Menu Midi", amount: 7500, pointsEarned: 50, date: "2024-03-15T13:00:00Z" },
  ],
  rewards: [
    { id: "r1", title: "Café Offert", pointsCost: 100, description: "Un café au choix offert", icon: "Coffee" },
    { id: "r2", title: "Réduction 3000 FCFA", pointsCost: 500, description: "3000 FCFA de remise sur votre prochain achat", icon: "Ticket" },
    { id: "r3", title: "Menu Gratuit", pointsCost: 1000, description: "Un menu midi complet offert", icon: "Utensils" },
  ],
  settings: {
    frequency: 'weekly',
    channel: 'email',
    messageTemplate: "Bonjour {name}, vous avez {points} points disponibles ! Profitez-en vite.",
    enabled: true
  },
  campaigns: []
};
