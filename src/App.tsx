import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Settings, 
  History, 
  QrCode, 
  Gift, 
  Bell, 
  LogOut, 
  Plus, 
  Search, 
  Download, 
  TrendingUp,
  ChevronRight,
  Target,
  Zap,
  Calendar,
  Megaphone,
  Trash2,
  BarChart3,
  Share2,
  User,
  Phone,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Lock,
  Camera,
  Clock,
  Upload,
  Send,
  Filter,
  X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  getDocFromServer,
  runTransaction,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { Login } from './components/Login';
import { INITIAL_DATA } from './constants';
import { AppData, Customer, Product, Transaction, Reward, ReminderSettings, Shop, UserProfile, Campaign } from './types';
import { cn } from './lib/utils';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In a real app, we might show a toast or error boundary
}

// --- Helpers ---

const downloadQRCode = (id: string, name: string) => {
  const svg = document.getElementById(id);
  if (!svg) return;
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx?.drawImage(img, 0, 0);
    const pngFile = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.download = `${name}-QR.png`;
    downloadLink.href = pngFile;
    downloadLink.click();
  };
  img.src = "data:image/svg+xml;base64," + btoa(svgData);
};

// --- Components ---

const Html5QrcodePlugin = (props: any) => {
  useEffect(() => {
    const config = {
      fps: props.fps || 10,
      qrbox: props.qrbox || 250,
      aspectRatio: props.aspectRatio || 1.0,
      disableFlip: props.disableFlip || false,
    };
    const verbose = props.verbose || false;

    if (!(props.qrCodeSuccessCallback)) {
      throw "qrCodeSuccessCallback is required callback.";
    }

    const html5QrcodeScanner = new Html5QrcodeScanner(props.id, config, verbose);
    html5QrcodeScanner.render(props.qrCodeSuccessCallback, props.qrCodeErrorCallback);

    return () => {
      html5QrcodeScanner.clear().catch(error => {
        console.error("Failed to clear html5QrcodeScanner. ", error);
      });
    };
  }, []);

  return <div id={props.id} className="w-full overflow-hidden rounded-2xl border-2 border-emerald-100 shadow-inner" />;
};

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center w-full gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg",
      active 
        ? "bg-zinc-900 text-white" 
        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
    )}
  >
    <Icon size={18} />
    {label}
  </button>
);

const Card = ({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void, key?: React.Key }) => (
  <div 
    onClick={onClick}
    className={cn("bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden", className)}
  >
    {children}
  </div>
);

const Badge = ({ children, variant = 'default', className }: { children: React.ReactNode, variant?: 'default' | 'success' | 'warning', className?: string }) => {
  const variants = {
    default: "bg-zinc-100 text-zinc-600",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border border-amber-100",
  };
  return (
    <span className={cn("px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full", variants[variant], className)}>
      {children}
    </span>
  );
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'client' | 'admin' | 'superadmin'>('client');
  const [activeTab, setActiveTab] = useState('home');
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeShopPoints, setActiveShopPoints] = useState(0);
  const [activeShopTransactions, setActiveShopTransactions] = useState<any[]>([]);
  const [adminData, setAdminData] = useState<{
    customers: any[],
    products: any[],
    transactions: any[],
    checkIns: any[],
    campaigns: Campaign[]
  }>({ customers: [], products: [], transactions: [], checkIns: [], campaigns: [] });
  
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [activeClientShop, setActiveClientShop] = useState<Shop | null>(null);
  const [clientShopProducts, setClientShopProducts] = useState<Product[]>([]);
  const [clientCampaigns, setClientCampaigns] = useState<Campaign[]>([]);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<{[key: string]: number}>({});
  const [notifications, setNotifications] = useState<{id: string, message: string}[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAddingShop, setIsAddingShop] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [isAddingCampaign, setIsAddingCampaign] = useState(false);
  const [currentCheckIn, setCurrentCheckIn] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [adminTargetCheckIn, setAdminTargetCheckIn] = useState<any>(null);
  const [regForm, setRegForm] = useState({ name: '', phone: '' });
  const [shopForm, setShopForm] = useState({ name: '', location: '', ownerName: '', ownerEmail: '', ownerPhone: '', logoUrl: '' });
  const [productForm, setProductForm] = useState({ name: '', category: '', price: 0, pointsValue: 0 });
  const [campaignForm, setCampaignForm] = useState({ 
    title: '', 
    description: '', 
    type: 'double_points' as Campaign['type'],
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  const [showPortal, setShowPortal] = useState(false);
  const [minPointsFilter, setMinPointsFilter] = useState<number>(0);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [isBulkNotifModalOpen, setIsBulkNotifModalOpen] = useState(false);
  const [bulkNotifMessage, setBulkNotifMessage] = useState('');
  const [promoForm, setPromoForm] = useState({ 
    title: '', 
    description: '', 
    minPoints: 0,
    type: 'gift' as 'gift' | 'discount',
    discountPercent: 0
  });
  const [allPromotions, setAllPromotions] = useState<any[]>([]);
  const [userBalances, setUserBalances] = useState<{[shopId: string]: { points: number, activeDiscount?: number }}>({});
  const [userRedemptions, setUserRedemptions] = useState<any[]>([]);
  const [selectedCustomerForDetails, setSelectedCustomerForDetails] = useState<Customer | null>(null);
  const [activeDiscount, setActiveDiscount] = useState<number>(0);

  // Test Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        // Fetch user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setCurrentUser(userDoc.data() as UserProfile);
        } else {
          // New user, need to register
          setIsRegistering(true);
        }
      } else {
        setCurrentUser(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Data Sync
  useEffect(() => {
    if (!isAuthReady) return;

    // Sync Shops
    const unsubscribeShops = onSnapshot(collection(db, 'shops'), (snapshot) => {
      const shops = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
      setData(prev => ({ ...prev, shops }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'shops'));

    // Sync Point Balances for current user (all shops)
    let unsubscribeAllBalances = () => {};
    if (firebaseUser) {
      const q = query(collection(db, 'pointBalances'), where('userId', '==', firebaseUser.uid));
      unsubscribeAllBalances = onSnapshot(q, (snapshot) => {
        const balances: {[shopId: string]: { points: number, activeDiscount?: number }} = {};
        snapshot.docs.forEach(doc => {
          balances[doc.data().shopId] = { 
            points: doc.data().balance,
            activeDiscount: doc.data().activeDiscount 
          };
        });
        setUserBalances(balances);
      });
    }

    // Sync All Promotions
    const unsubscribePromotions = onSnapshot(collection(db, 'promotions'), (snapshot) => {
      const promos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllPromotions(promos);
    });

    // Sync Redemptions for current user
    let unsubscribeRedemptions = () => {};
    if (firebaseUser) {
      const q = query(collection(db, 'redemptions'), where('userId', '==', firebaseUser.uid));
      unsubscribeRedemptions = onSnapshot(q, (snapshot) => {
        const redemptions = snapshot.docs.map(doc => doc.data());
        setUserRedemptions(redemptions);
      });
    }

    // Sync Notifications for current user
    let unsubscribeNotifs = () => {};
    if (firebaseUser) {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', firebaseUser.uid),
        where('read', '==', false),
        orderBy('createdAt', 'desc')
      );
      unsubscribeNotifs = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const notif = change.doc.data();
            addNotification(notif.message);
            // Mark as read
            updateDoc(doc(db, 'notifications', change.doc.id), { read: true });
          }
        });
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'notifications'));
    }

    return () => {
      unsubscribeShops();
      unsubscribeAllBalances();
      unsubscribePromotions();
      unsubscribeRedemptions();
      unsubscribeNotifs();
    };
  }, [isAuthReady, firebaseUser, activeClientShop]);

  // Sync Rewards for active shop
  useEffect(() => {
    if (!activeClientShop) return;
    const unsubscribeRewards = onSnapshot(collection(db, `shops/${activeClientShop.id}/rewards`), (snapshot) => {
      const rewards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reward));
      setData(prev => ({ ...prev, rewards }));
    });
    return () => unsubscribeRewards();
  }, [activeClientShop]);

    // Sync Products for active client shop
    useEffect(() => {
      if (!activeClientShop) return;
      const unsubscribeProducts = onSnapshot(collection(db, `shops/${activeClientShop.id}/products`), (snapshot) => {
        const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setClientShopProducts(products);
      });
      return () => unsubscribeProducts();
    }, [activeClientShop]);

    // Sync Campaigns for active client shop
    useEffect(() => {
      if (!activeClientShop) return;
      const unsubscribeCampaigns = onSnapshot(collection(db, `shops/${activeClientShop.id}/campaigns`), (snapshot) => {
        const campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
        setClientCampaigns(campaigns.filter(c => c.isActive));
      });
      return () => unsubscribeCampaigns();
    }, [activeClientShop]);

  // Sync Transactions for active shop and user
  useEffect(() => {
    if (!firebaseUser || !activeClientShop) return;
    const q = query(
      collection(db, 'transactions'), 
      where('userId', '==', firebaseUser.uid),
      where('shopId', '==', activeClientShop.id),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeTransactions = onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveShopTransactions(transactions);
    });
    return () => unsubscribeTransactions();
  }, [firebaseUser, activeClientShop]);

  // Sync Admin Data for selected shop
  useEffect(() => {
    if (!selectedShop) return;

    // Sync Products
    const unsubscribeProducts = onSnapshot(collection(db, `shops/${selectedShop.id}/products`), (snapshot) => {
      const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdminData(prev => ({ ...prev, products }));
    });

    // Sync Transactions
    const qTransactions = query(collection(db, 'transactions'), where('shopId', '==', selectedShop.id), orderBy('createdAt', 'desc'));
    const unsubscribeTransactions = onSnapshot(qTransactions, (snapshot) => {
      const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdminData(prev => ({ ...prev, transactions }));
    });

    // Sync Check-ins (Recent scans)
    const qCheckIns = query(
      collection(db, 'checkIns'), 
      where('shopId', '==', selectedShop.id), 
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsubscribeCheckIns = onSnapshot(qCheckIns, (snapshot) => {
      const checkIns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdminData(prev => ({ ...prev, checkIns }));
    });

    // Sync Customers (via pointBalances)
    const qBalances = query(collection(db, 'pointBalances'), where('shopId', '==', selectedShop.id));
    const unsubscribeBalances = onSnapshot(qBalances, async (snapshot) => {
      const balances = snapshot.docs.map(doc => doc.data());
      const customerList = await Promise.all(balances.map(async (b) => {
        const userDoc = await getDoc(doc(db, 'users', b.userId));
        return { 
          id: b.userId, 
          ...(userDoc.exists() ? userDoc.data() : { name: 'Utilisateur Inconnu' }),
          totalPoints: b.balance,
          lastVisit: b.lastUpdated
        };
      }));
      setAdminData(prev => ({ ...prev, customers: customerList }));
    });

    // Sync Campaigns
    const unsubscribeCampaigns = onSnapshot(collection(db, `shops/${selectedShop.id}/campaigns`), (snapshot) => {
      const campaigns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
      setAdminData(prev => ({ ...prev, campaigns }));
    });

    return () => {
      unsubscribeProducts();
      unsubscribeTransactions();
      unsubscribeCheckIns();
      unsubscribeBalances();
      unsubscribeCampaigns();
    };
  }, [selectedShop]);

  // Auto-select shop for shop_owner
  useEffect(() => {
    if (currentUser?.role === 'shop_owner' && data.shops.length > 0) {
      const myShop = data.shops.find(s => s.ownerEmail === firebaseUser?.email);
      if (myShop) {
        setSelectedShop(myShop);
        if (view === 'client') {
          setView('admin');
          setActiveTab('dashboard');
        }
      }
    }
  }, [currentUser, data.shops, firebaseUser]);

  const handleLogout = async () => {
    await signOut(auth);
    addNotification("Déconnexion réussie.");
  };

  const addNotification = (message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 6000);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;

    const isSuperAdmin = firebaseUser.email === "sawadogobi2l225@gmail.com";
    const isShopOwner = data.shops.some(s => s.ownerEmail === firebaseUser.email);

    const profile: UserProfile = {
      uid: firebaseUser.uid,
      name: regForm.name,
      email: firebaseUser.email || '',
      phone: regForm.phone,
      role: isSuperAdmin ? 'superadmin' : isShopOwner ? 'shop_owner' : 'client',
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'users', firebaseUser.uid), profile);
      setCurrentUser(profile);
      setIsRegistering(false);
      addNotification(`Bienvenue ${regForm.name} ! Votre carte est prête.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
    }
  };

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.role !== 'superadmin') {
      // In a real app, only superadmins can do this
      // For demo, we might allow it if they are the designated admin email
    }

    const newShopData = {
      name: shopForm.name,
      location: shopForm.location,
      logoUrl: shopForm.logoUrl,
      ownerName: shopForm.ownerName,
      ownerEmail: shopForm.ownerEmail,
      ownerPhone: shopForm.ownerPhone,
      ownerId: firebaseUser?.uid || 'demo-owner',
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, 'shops'), newShopData);
      setIsAddingShop(false);
      setShopForm({ name: '', location: '', ownerName: '', ownerEmail: '', ownerPhone: '', logoUrl: '' });
      addNotification(`Boutique "${newShopData.name}" créée avec succès.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shops');
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop) return;

    try {
      await addDoc(collection(db, `shops/${selectedShop.id}/products`), {
        ...productForm,
        createdAt: new Date().toISOString()
      });
      setIsAddingProduct(false);
      setProductForm({ name: '', category: '', price: 0, pointsValue: 0 });
      addNotification(`Produit "${productForm.name}" ajouté.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `shops/${selectedShop.id}/products`);
    }
  };

  const handleAddCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop) return;

    try {
      await addDoc(collection(db, `shops/${selectedShop.id}/campaigns`), {
        ...campaignForm,
        isActive: true,
        createdAt: new Date().toISOString()
      });
      setIsAddingCampaign(false);
      setCampaignForm({ 
        title: '', 
        description: '', 
        type: 'double_points',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
      addNotification(`Campagne "${campaignForm.title}" lancée !`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `shops/${selectedShop.id}/campaigns`);
    }
  };

  useEffect(() => {
    if (!currentCheckIn || Object.keys(selectedProducts).length === 0) return;

    const updateCheckIn = async () => {
      try {
        const checkInRef = doc(db, 'checkIns', currentCheckIn.id);
        await updateDoc(checkInRef, { selectedProducts });
      } catch (err) {
        console.error("Error updating check-in with products:", err);
      }
    };

    const timeout = setTimeout(updateCheckIn, 500);
    return () => clearTimeout(timeout);
  }, [selectedProducts, currentCheckIn]);

  useEffect(() => {
    if (adminTargetCheckIn?.selectedProducts) {
      setSelectedProducts(adminTargetCheckIn.selectedProducts);
    } else {
      setSelectedProducts({});
    }
  }, [adminTargetCheckIn]);

  const handleCheckIn = async (shop: Shop) => {
    if (!currentUser || !firebaseUser) return;

    try {
      const shopBalance = userBalances[shop.id];
      const checkInData = {
        userId: firebaseUser.uid,
        shopId: shop.id,
        userName: currentUser.name,
        userPhone: currentUser.phone || '',
        timestamp: new Date().toISOString(),
        status: 'pending',
        activeDiscount: shopBalance?.activeDiscount || 0
      };
      const docRef = await addDoc(collection(db, 'checkIns'), checkInData);
      setCurrentCheckIn({ id: docRef.id, ...checkInData });
    } catch (err) {
      console.error("Error during check-in:", err);
    }
  };

  useEffect(() => {
    if (!currentCheckIn) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const checkInTime = new Date(currentCheckIn.timestamp).getTime();
      const now = new Date().getTime();
      const diff = 60000 - (now - checkInTime);
      
      if (diff <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
      } else {
        setTimeLeft(Math.floor(diff / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentCheckIn]);

  const calculateTotalPoints = () => {
    let total = 0;
    const discount = adminTargetCheckIn?.activeDiscount || activeDiscount || 0;
    (Object.entries(selectedProducts) as [string, number][]).forEach(([productId, quantity]) => {
      const product = (clientShopProducts.length > 0 ? clientShopProducts : adminData.products).find(p => p.id === productId);
      if (product) {
        let points = (product.pointsValue as number) * quantity;
        if (discount > 0) {
          points = Math.floor(points * (1 - discount / 100));
        }
        total += points;
      }
    });
    return total;
  };

  const handleSendBulkNotification = async () => {
    if (!selectedShop || selectedCustomerIds.length === 0 || !bulkNotifMessage.trim()) return;

    try {
      const promises = selectedCustomerIds.map(userId => 
        addDoc(collection(db, 'notifications'), {
          userId,
          shopId: selectedShop.id,
          shopName: selectedShop.name,
          message: bulkNotifMessage,
          type: 'info',
          read: false,
          createdAt: new Date().toISOString()
        })
      );

      await Promise.all(promises);
      addNotification(`${selectedCustomerIds.length} notifications envoyées !`);
      setIsBulkNotifModalOpen(false);
      setBulkNotifMessage('');
      setSelectedCustomerIds([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'notifications');
    }
  };

  const handleCreatePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop || !promoForm.title || !promoForm.description) return;

    try {
      // 1. Create the promotion record
      await addDoc(collection(db, 'promotions'), {
        shopId: selectedShop.id,
        shopName: selectedShop.name,
        ...promoForm,
        createdAt: new Date().toISOString()
      });

      // 2. Find eligible customers
      const eligibleCustomers = adminData.customers.filter(c => c.totalPoints >= promoForm.minPoints);

      if (eligibleCustomers.length > 0) {
        // 3. Send notifications
        const promises = eligibleCustomers.map(customer => 
          addDoc(collection(db, 'notifications'), {
            userId: customer.id,
            shopId: selectedShop.id,
            shopName: selectedShop.name,
            message: `Offre ${promoForm.type === 'gift' ? 'Cadeau' : 'Réduction'} : ${promoForm.title}. ${promoForm.description}`,
            type: 'promo',
            read: false,
            createdAt: new Date().toISOString()
          })
        );
        await Promise.all(promises);
        addNotification(`Promotion lancée ! ${eligibleCustomers.length} clients notifiés.`);
      } else {
        addNotification(`Promotion enregistrée, mais aucun client ne correspond aux critères (${promoForm.minPoints} pts).`);
      }

      setPromoForm({ title: '', description: '', minPoints: 0, type: 'gift', discountPercent: 0 });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'promotions');
    }
  };

  const handleRedeemPromotion = async (userId: string, promo: any) => {
    if (!selectedShop) return;

    try {
      const balanceId = `${userId}_${selectedShop.id}`;
      const balanceRef = doc(db, 'pointBalances', balanceId);
      
      await runTransaction(db, async (transaction) => {
        const balanceDoc = await transaction.get(balanceRef);
        const currentBalance = balanceDoc.exists() ? (balanceDoc.data()?.balance as number || 0) : 0;
        
        if (currentBalance < promo.minPoints) {
          throw new Error("Points insuffisants pour cette offre.");
        }

        // 1. Deduct points
        const updateData: any = {
          balance: currentBalance - promo.minPoints,
          lastUpdated: new Date().toISOString()
        };
        if (promo.type === 'discount') {
          updateData.activeDiscount = promo.discountPercent;
        }
        transaction.update(balanceRef, updateData);

        // 2. Record transaction
        const transRef = doc(collection(db, 'transactions'));
        transaction.set(transRef, {
          userId: userId,
          shopId: selectedShop.id,
          points: -promo.minPoints,
          type: 'redeem',
          description: `Utilisation de l'offre : ${promo.title}`,
          createdAt: new Date().toISOString()
        });

        // 3. Mark as redeemed for this user
        const redemptionRef = doc(db, 'redemptions', `${userId}_${promo.id}`);
        transaction.set(redemptionRef, {
          userId,
          promoId: promo.id,
          shopId: selectedShop.id,
          redeemedAt: new Date().toISOString()
        });

        // 4. Notify client
        const notifRef = doc(collection(db, 'notifications'));
        transaction.set(notifRef, {
          userId: userId,
          shopId: selectedShop.id,
          message: `Votre offre "${promo.title}" a été validée chez ${selectedShop.name} ! -${promo.minPoints} points.`,
          type: 'success',
          read: false,
          createdAt: new Date().toISOString()
        });
      });

      addNotification("Offre validée avec succès !");
    } catch (err: any) {
      if (err.message === "Points insuffisants pour cette offre.") {
        addNotification(err.message);
      } else {
        handleFirestoreError(err, OperationType.WRITE, 'redemptions');
      }
    }
  };

  const handleDeletePromotion = async (promoId: string) => {
    try {
      await deleteDoc(doc(db, 'promotions', promoId));
      addNotification("Promotion supprimée avec succès.");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `promotions/${promoId}`);
    }
  };

  const handleRecordPurchase = async (targetUserId?: string) => {
    const userId = targetUserId || firebaseUser?.uid;
    const shopId = activeClientShop?.id || selectedShop?.id;
    
    if (!userId || !shopId) return;

    const discount = adminTargetCheckIn?.activeDiscount || activeDiscount || 0;
    let totalPoints = 0;
    let description = "Achat de : ";
    const items: string[] = [];

    (Object.entries(selectedProducts) as [string, number][]).forEach(([productId, quantity]) => {
      if (quantity > 0) {
        const product = (clientShopProducts.length > 0 ? clientShopProducts : adminData.products).find(p => p.id === productId);
        if (product) {
          let points = (product.pointsValue as number) * quantity;
          // Apply discount if active
          if (discount > 0) {
            points = Math.floor(points * (1 - discount / 100));
          }
          totalPoints += points;
          items.push(`${quantity}x ${product.name}`);
        }
      }
    });

    if (totalPoints === 0) {
      addNotification("Veuillez sélectionner au moins un produit.");
      return;
    }

    if (discount > 0) {
      description += ` (Réduction de ${discount}%) `;
    }
    description += items.join(", ");

    try {
      const balanceId = `${userId}_${shopId}`;
      const balanceRef = doc(db, 'pointBalances', balanceId);
      
      await runTransaction(db, async (transaction) => {
        const balanceDoc = await transaction.get(balanceRef);
        const currentBalance = balanceDoc.exists() ? (balanceDoc.data()?.balance as number || 0) : 0;
        
        transaction.set(balanceRef, {
          userId: userId,
          shopId: shopId,
          balance: currentBalance + totalPoints,
          lastUpdated: new Date().toISOString(),
          activeDiscount: 0 // Reset after purchase
        }, { merge: true });

        const transRef = doc(collection(db, 'transactions'));
        transaction.set(transRef, {
          userId: userId,
          shopId: shopId,
          points: totalPoints,
          type: 'earn',
          description,
          createdAt: new Date().toISOString()
        });

        // If admin is doing it, mark check-in as completed and notify client
        if (adminTargetCheckIn) {
          const checkInRef = doc(db, 'checkIns', adminTargetCheckIn.id);
          transaction.update(checkInRef, { status: 'completed' });
          
          const notifRef = doc(collection(db, 'notifications'));
          transaction.set(notifRef, {
            userId: userId,
            shopId: shopId,
            message: `Votre achat chez ${selectedShop?.name} a été validé ! +${totalPoints} points.${activeDiscount > 0 ? ` (Réduction de ${activeDiscount}% appliquée)` : ''}`,
            type: 'success',
            read: false,
            createdAt: new Date().toISOString()
          });
        } else if (currentCheckIn) {
          const checkInRef = doc(db, 'checkIns', currentCheckIn.id);
          transaction.update(checkInRef, { status: 'completed' });
        }
      });

      setIsPurchaseModalOpen(false);
      setAdminTargetCheckIn(null);
      setSelectedProducts({});
      setActiveDiscount(0); // Reset discount after purchase
      addNotification(`Achat enregistré ! +${totalPoints} points.`);
      if (!targetUserId) {
        setCurrentCheckIn(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'transactions');
    }
  };

  const handleRedeemReward = async (reward: Reward) => {
    if (!firebaseUser || !activeClientShop) return;
    if (activeShopPoints < reward.pointsCost) {
      addNotification("Points insuffisants !");
      return;
    }

    const balanceId = `${firebaseUser.uid}_${activeClientShop.id}`;
    const newBalance = activeShopPoints - reward.pointsCost;

    try {
      await setDoc(doc(db, 'pointBalances', balanceId), {
        userId: firebaseUser.uid,
        shopId: activeClientShop.id,
        balance: newBalance,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      // Add transaction
      await addDoc(collection(db, 'transactions'), {
        userId: firebaseUser.uid,
        shopId: activeClientShop.id,
        points: reward.pointsCost,
        type: 'redeem',
        description: `Récompense: ${reward.title}`,
        createdAt: new Date().toISOString()
      });

      addNotification(`Récompense "${reward.title}" débloquée !`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `pointBalances/${balanceId}`);
    }
  };

  // --- SuperAdmin View ---

const SuperAdminView = ({ 
  data, 
  db, 
  addNotification, 
  setIsAddingShop, 
  setView, 
  setActiveTab, 
  setActiveClientShop, 
  setSelectedShop, 
  isAddingShop, 
  shopForm, 
  setShopForm, 
  handleAddShop 
}: { 
  data: AppData, 
  db: any, 
  addNotification: (msg: string) => void, 
  setIsAddingShop: (val: boolean) => void, 
  setView: (val: 'client' | 'admin' | 'superadmin') => void, 
  setActiveTab: (val: string) => void, 
  setActiveClientShop: (val: Shop | null) => void, 
  setSelectedShop: (val: Shop | null) => void, 
  isAddingShop: boolean, 
  shopForm: any, 
  setShopForm: React.Dispatch<React.SetStateAction<any>>, 
  handleAddShop: (e: React.FormEvent) => Promise<void> 
}) => (
  <div className="space-y-6 animate-in fade-in duration-500">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900">Gestion des Boutiques</h2>
        <p className="text-zinc-500">Interface SuperAdmin pour gérer le réseau Fidelo.</p>
      </div>
      <div className="flex gap-3">
        <button 
          onClick={async () => {
            if (data.shops.length > 0) {
              const shopId = data.shops[0].id;
              const demoProducts = [
                { name: 'Café Espresso', category: 'Boissons', price: 1500, pointsValue: 10 },
                { name: 'Croissant', category: 'Viennoiserie', price: 1000, pointsValue: 5 },
                { name: 'Menu Midi', category: 'Plats', price: 7500, pointsValue: 50 }
              ];
              for (const p of demoProducts) {
                await addDoc(collection(db, `shops/${shopId}/products`), { ...p, createdAt: new Date().toISOString() });
              }
              addNotification("Produits démo ajoutés à la première boutique.");
            }
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100"
        >
          <Plus size={16} />
          Seed Produits Démo
        </button>
        <button 
          onClick={() => setIsAddingShop(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
        >
          <Plus size={16} />
          Nouvelle Boutique
        </button>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {data.shops.map((shop) => (
        <Card key={shop.id} className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex gap-4">
              {shop.logoUrl ? (
                <img src={shop.logoUrl} alt={shop.name} className="w-16 h-16 rounded-xl object-cover border border-zinc-100" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-16 h-16 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400">
                  <QrCode size={24} />
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold">{shop.name}</h3>
                <p className="text-sm text-zinc-500">{shop.location}</p>
                <div className="mt-2 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-zinc-400" />
                    <span className="text-xs font-medium">{shop.ownerName}</span>
                  </div>
                  {shop.ownerEmail && (
                    <div className="flex items-center gap-2">
                      <Bell size={12} className="text-zinc-400" />
                      <span className="text-[10px] text-zinc-500">{shop.ownerEmail}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-white rounded-2xl border border-zinc-100 shadow-sm group relative">
                <QRCodeSVG id={`qr-${shop.id}`} value={`FIDELO-SHOP-${shop.id}`} size={80} />
                <div className="absolute inset-0 bg-zinc-900/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center rounded-2xl gap-1">
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
                  >
                    <Download size={14} />
                    <span className="text-[8px] font-bold uppercase">Imprimer</span>
                  </button>
                  <button 
                    onClick={() => downloadQRCode(`qr-${shop.id}`, shop.name)}
                    className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
                  >
                    <Download size={14} />
                    <span className="text-[8px] font-bold uppercase">Télécharger</span>
                  </button>
                </div>
              </div>
              <button 
                onClick={() => {
                  setView('client');
                  setActiveTab('home');
                  setActiveClientShop(shop);
                  addNotification(`Scan simulé : Bienvenue chez ${shop.name}`);
                }}
                className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest hover:underline"
              >
                Simuler Scan
              </button>
            </div>
          </div>
          
          <div className="pt-4 border-t border-zinc-100 flex justify-between items-center">
            <p className="text-[10px] text-zinc-400 uppercase font-bold">ID: {shop.id}</p>
            <button 
              onClick={() => {
                setSelectedShop(shop);
                setView('admin');
                setActiveTab('dashboard');
              }}
              className="text-sm font-bold text-emerald-600 hover:underline flex items-center gap-1"
            >
              Gérer <ChevronRight size={14} />
            </button>
          </div>
        </Card>
      ))}
    </div>

    {/* Add Shop Modal */}
    <AnimatePresence>
      {isAddingShop && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">Nouvelle Boutique</h3>
              <button onClick={() => setIsAddingShop(false)} className="p-2 text-zinc-400"><X size={24} /></button>
            </div>
            <form onSubmit={handleAddShop} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Nom de la boutique</label>
                <input 
                  required
                  value={shopForm.name}
                  onChange={e => setShopForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Ex: Maquis du Plateau"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Localisation</label>
                <input 
                  required
                  value={shopForm.location}
                  onChange={e => setShopForm(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Ex: Abidjan, Plateau"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Logo de la boutique</label>
                <div className="relative">
                  <input 
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 200000) {
                          addNotification("L'image est trop lourde (max 200KB)");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setShopForm(prev => ({ ...prev, logoUrl: reader.result as string }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                    id="logo-upload-superadmin"
                  />
                  <label 
                    htmlFor="logo-upload-superadmin"
                    className="flex items-center justify-center w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl cursor-pointer hover:bg-zinc-100 transition-all text-sm text-zinc-600 font-medium"
                  >
                    <Upload size={18} className="mr-2" />
                    {shopForm.logoUrl ? "Changer le logo" : "Choisir un fichier"}
                  </label>
                </div>
                {shopForm.logoUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={shopForm.logoUrl} alt="Preview" className="w-10 h-10 rounded-lg object-cover" />
                    <span className="text-[10px] text-emerald-600 font-bold uppercase">Image sélectionnée</span>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Propriétaire</label>
                <input 
                  required
                  value={shopForm.ownerName}
                  onChange={e => setShopForm(prev => ({ ...prev, ownerName: e.target.value }))}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Nom du gérant"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Email Propriétaire</label>
                  <input 
                    required
                    type="email"
                    value={shopForm.ownerEmail}
                    onChange={e => setShopForm(prev => ({ ...prev, ownerEmail: e.target.value }))}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="email@exemple.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Téléphone Propriétaire</label>
                  <input 
                    required
                    type="tel"
                    value={shopForm.ownerPhone}
                    onChange={e => setShopForm(prev => ({ ...prev, ownerPhone: e.target.value }))}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="01 02 03 04 05"
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full py-4 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 transition-all mt-4"
              >
                Créer la boutique
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);


  // --- Admin Views ---

const AdminDashboard = ({ 
  adminData, 
  selectedShop, 
  setAdminTargetCheckIn, 
  setIsPurchaseModalOpen 
}: { 
  adminData: any, 
  selectedShop: Shop | null, 
  setAdminTargetCheckIn: (val: any) => void, 
  setIsPurchaseModalOpen: (val: boolean) => void 
}) => {
  const totalSales = adminData.transactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0);
  const topCustomers = [...adminData.customers].sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 3);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Tableau de bord</h2>
          <p className="text-zinc-500">Gestion de : <span className="font-bold text-zinc-900">{selectedShop?.name}</span></p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50">
            <Download size={16} />
            Exporter PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 md:col-span-1 flex flex-col items-center justify-center text-center bg-zinc-900 text-white">
          <div className="p-4 bg-white rounded-3xl mb-4 shadow-xl group relative">
            <QRCodeSVG id="shop-qr-admin" value={`FIDELO-SHOP-${selectedShop?.id}`} size={160} />
            <div className="absolute inset-0 bg-zinc-900/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center rounded-2xl gap-2">
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 hover:text-emerald-400 transition-colors"
              >
                <Download size={18} />
                <span className="text-xs font-bold uppercase">Imprimer</span>
              </button>
              <button 
                onClick={() => downloadQRCode('shop-qr-admin', selectedShop?.name || 'Shop')}
                className="flex items-center gap-2 hover:text-emerald-400 transition-colors"
              >
                <Download size={18} />
                <span className="text-xs font-bold uppercase">Télécharger</span>
              </button>
            </div>
          </div>
          <h3 className="font-bold text-lg mb-1">Votre Code QR</h3>
          <p className="text-xs text-zinc-400 mb-4 px-4">Faites scanner ce code par vos clients pour enregistrer leur visite.</p>
          <div className="flex gap-2">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-white/10 rounded-full hover:bg-white/20 transition-colors uppercase tracking-widest"
            >
              <Download size={14} />
              Imprimer
            </button>
          </div>
        </Card>

        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <TrendingUp size={20} />
              </div>
              <Badge variant="success">+12%</Badge>
            </div>
            <p className="text-sm text-zinc-500">Ventes Totales</p>
            <p className="text-3xl font-bold mt-1">{totalSales.toLocaleString()} FCFA</p>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Users size={20} />
              </div>
              <Badge>+{adminData.customers.length}</Badge>
            </div>
            <p className="text-sm text-zinc-500">Clients Actifs</p>
            <p className="text-3xl font-bold mt-1">{adminData.customers.length}</p>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <Gift size={20} />
              </div>
              <Badge variant="warning">Actif</Badge>
            </div>
            <p className="text-sm text-zinc-500">Récompenses Distribuées</p>
            <p className="text-3xl font-bold mt-1">{adminData.transactions.filter((t: any) => t.type === 'redeem').length}</p>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg">Scans Récents (Clients en Boutique)</h3>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              EN DIRECT
            </div>
          </div>
          <div className="space-y-4">
            {adminData.checkIns.map((checkIn: any) => {
              const checkInTime = new Date(checkIn.timestamp).getTime();
              const now = new Date().getTime();
              const isExpired = now - checkInTime > 60000;
              
              return (
                <div key={checkIn.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-zinc-200 shadow-sm">
                      <User size={20} className="text-zinc-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold">{checkIn.userName}</p>
                        {checkIn.activeDiscount > 0 && (
                          <Badge variant="warning" className="text-[8px] px-1 py-0 h-4">-{checkIn.activeDiscount}%</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500">{checkIn.userPhone}</p>
                      {checkIn.selectedProducts && Object.keys(checkIn.selectedProducts).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Object.entries(checkIn.selectedProducts).map(([prodId, qty]) => {
                            const product = adminData.products.find((p: any) => p.id === prodId);
                            if (!product || (qty as number) === 0) return null;
                            return (
                              <span key={prodId} className="text-[8px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-md border border-emerald-100">
                                {qty}x {product.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Scanné à</p>
                      <p className="text-xs font-medium">{new Date(checkIn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    {checkIn.status === 'pending' && (
                      <button 
                        onClick={() => {
                          setAdminTargetCheckIn(checkIn);
                          setIsPurchaseModalOpen(true);
                        }}
                        className={cn(
                          "px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors",
                          isExpired
                            ? "bg-emerald-600 text-white hover:bg-emerald-700"
                            : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                        )}
                        disabled={!isExpired}
                      >
                        {isExpired ? "Prendre en charge" : "En attente..."}
                      </button>
                    )}
                    {checkIn.status === 'completed' && (
                      <Badge variant="success">Terminé</Badge>
                    )}
                  </div>
                </div>
              );
            })}
            {adminData.checkIns.length === 0 && (
              <div className="text-center py-8 text-zinc-400">
                <QrCode size={40} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">Aucun scan récent.</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-lg mb-6">Marketing Insights</h3>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Target size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Taux de Rétention</p>
                <p className="text-xl font-bold">68%</p>
                <p className="text-[10px] text-emerald-600 font-bold mt-1">↑ +5% ce mois</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                <Zap size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Heure de Pointe</p>
                <p className="text-xl font-bold">18:00 - 20:00</p>
                <p className="text-[10px] text-zinc-500 font-bold mt-1">Basé sur {adminData.transactions.length} scans</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <BarChart3 size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Produit Phare</p>
                <p className="text-xl font-bold">Bière Bock</p>
                <p className="text-[10px] text-zinc-500 font-bold mt-1">42% des ventes</p>
              </div>
            </div>
            <div className="pt-4 border-t border-zinc-100">
              <button className="w-full py-3 bg-zinc-100 text-zinc-900 font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-zinc-200 transition-colors">
                Voir Analyse Complète
              </button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-4">Dernières Ventes</h3>
          <div className="space-y-4">
            {adminData.transactions.slice(0, 4).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{t.description}</p>
                  <p className="text-xs text-zinc-500">{new Date(t.createdAt).toLocaleDateString()}</p>
                </div>
                <p className={cn(
                  "text-sm font-bold",
                  t.type === 'earn' ? "text-emerald-600" : "text-amber-600"
                )}>
                  {t.type === 'earn' ? '+' : '-'}{t.points} pts
                </p>
              </div>
            ))}
            {adminData.transactions.length === 0 && <p className="text-sm text-zinc-400 text-center py-4">Aucune transaction.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
};

const AdminProducts = ({ 
  adminData, 
  setIsAddingProduct 
}: { 
  adminData: any, 
  setIsAddingProduct: (val: boolean) => void 
}) => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-bold">Produits</h2>
      <button 
        onClick={() => setIsAddingProduct(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800"
      >
        <Plus size={16} />
        Nouveau Produit
      </button>
    </div>
    <Card>
      <table className="w-full text-left">
        <thead className="bg-zinc-50 border-b border-zinc-200">
          <tr>
            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Nom</th>
            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Catégorie</th>
            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Prix</th>
            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Points</th>
            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {adminData.products.map((p: any) => (
            <tr key={p.id} className="hover:bg-zinc-50">
              <td className="px-6 py-4 text-sm font-medium">{p.name}</td>
              <td className="px-6 py-4 text-sm text-zinc-500">{p.category}</td>
              <td className="px-6 py-4 text-sm font-bold">{p.price.toLocaleString()} FCFA</td>
              <td className="px-6 py-4 text-sm text-emerald-600 font-bold">{p.pointsValue}</td>
              <td className="px-6 py-4 text-sm">
                <button className="text-zinc-400 hover:text-zinc-900">Modifier</button>
              </td>
            </tr>
          ))}
          {adminData.products.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-8 text-center text-zinc-400">Aucun produit configuré.</td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  </div>
);

const AdminCampaigns = ({ 
  adminData, 
  setIsAddingCampaign 
}: { 
  adminData: any, 
  setIsAddingCampaign: (val: boolean) => void 
}) => (
  <div className="space-y-6 animate-in fade-in duration-500">
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-bold">Stratégies Marketing</h2>
      <button 
        onClick={() => setIsAddingCampaign(true)}
        className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 transition-all"
      >
        <Plus size={20} />
        Nouvelle Campagne
      </button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {adminData.campaigns.map((c: any) => (
        <Card key={c.id} className="p-6 overflow-hidden relative">
          <div className="flex justify-between items-start mb-4">
            <div className={cn(
              "p-3 rounded-2xl",
              c.type === 'double_points' ? "bg-purple-50 text-purple-600" :
              c.type === 'flash_sale' ? "bg-orange-50 text-orange-600" :
              c.type === 'new_arrival' ? "bg-blue-50 text-blue-600" :
              "bg-emerald-50 text-emerald-600"
            )}>
              {c.type === 'double_points' ? <Zap size={24} /> :
               c.type === 'flash_sale' ? <TrendingUp size={24} /> :
               c.type === 'new_arrival' ? <Package size={24} /> :
               <Calendar size={24} />}
            </div>
            <Badge variant={c.isActive ? "success" : "default"}>
              {c.isActive ? "Active" : "Terminée"}
            </Badge>
          </div>
          <h3 className="text-xl font-bold mb-2">{c.title}</h3>
          <p className="text-sm text-zinc-500 mb-6 line-clamp-2">{c.description}</p>
          
          <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
              <Calendar size={14} />
              {new Date(c.startDate).toLocaleDateString()} - {new Date(c.endDate).toLocaleDateString()}
            </div>
            <button className="text-sm font-bold text-zinc-900 hover:underline">Modifier</button>
          </div>
        </Card>
      ))}
      {adminData.campaigns.length === 0 && (
        <div className="md:col-span-2 text-center py-20 bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
          <Target size={48} className="mx-auto mb-4 text-zinc-300" />
          <p className="text-zinc-500 font-medium">Aucune campagne marketing active.</p>
          <button 
            onClick={() => setIsAddingCampaign(true)}
            className="mt-4 text-emerald-600 font-bold hover:underline"
          >
            Lancer votre première campagne
          </button>
        </div>
      )}
    </div>
  </div>
);

const AdminSettings = ({ 
  selectedShop, 
  db, 
  setSelectedShop, 
  addNotification, 
  data, 
  setData 
}: { 
  selectedShop: Shop | null, 
  db: any, 
  setSelectedShop: React.Dispatch<React.SetStateAction<Shop | null>>, 
  addNotification: (msg: string) => void, 
  data: AppData, 
  setData: React.Dispatch<React.SetStateAction<AppData>> 
}) => {
  const [shopSettings, setShopSettings] = useState({
    name: selectedShop?.name || '',
    location: selectedShop?.location || '',
    logoUrl: selectedShop?.logoUrl || '',
    ownerName: selectedShop?.ownerName || '',
    ownerEmail: selectedShop?.ownerEmail || '',
    ownerPhone: selectedShop?.ownerPhone || ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'shops', selectedShop.id), {
        ...shopSettings,
        updatedAt: new Date().toISOString()
      });
      setSelectedShop(prev => prev ? { ...prev, ...shopSettings } : null);
      addNotification("Boutique mise à jour avec succès !");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shops/${selectedShop.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-10 max-w-2xl animate-in fade-in duration-500">
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Paramètres de la Boutique</h2>
        <Card className="p-8">
          <form onSubmit={handleUpdateShop} className="space-y-6">
            <div className="flex items-center gap-6 mb-4">
              {shopSettings.logoUrl ? (
                <img src={shopSettings.logoUrl} alt="Logo" className="w-20 h-20 rounded-2xl object-cover border border-zinc-100" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-20 h-20 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-400">
                  <QrCode size={32} />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Logo de la Boutique</label>
                <div className="relative">
                  <input 
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 200000) {
                          addNotification("L'image est trop lourde (max 200KB)");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setShopSettings(prev => ({ ...prev, logoUrl: reader.result as string }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                    id="logo-upload-admin"
                  />
                  <label 
                    htmlFor="logo-upload-admin"
                    className="flex items-center justify-center w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl cursor-pointer hover:bg-zinc-100 transition-all text-sm text-zinc-600 font-medium"
                  >
                    <Upload size={18} className="mr-2" />
                    Choisir un fichier
                  </label>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1 px-1 italic">Format recommandé: Carré, max 200KB</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Nom</label>
                <input 
                  required
                  value={shopSettings.name}
                  onChange={e => setShopSettings(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Localisation</label>
                <input 
                  required
                  value={shopSettings.location}
                  onChange={e => setShopSettings(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Propriétaire</label>
                <input 
                  required
                  value={shopSettings.ownerName}
                  onChange={e => setShopSettings(prev => ({ ...prev, ownerName: e.target.value }))}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Email Propriétaire</label>
                <input 
                  required
                  type="email"
                  value={shopSettings.ownerEmail}
                  onChange={e => setShopSettings(prev => ({ ...prev, ownerEmail: e.target.value }))}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Téléphone Propriétaire</label>
                <input 
                  required
                  type="tel"
                  value={shopSettings.ownerPhone}
                  onChange={e => setShopSettings(prev => ({ ...prev, ownerPhone: e.target.value }))}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={isSaving}
              className="w-full py-4 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 transition-all disabled:opacity-50"
            >
              {isSaving ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>
          </form>
        </Card>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Paramètres de Rappel</h2>
        <Card className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold">Activer les rappels automatiques</p>
          <p className="text-sm text-zinc-500">Envoie des notifications selon vos règles.</p>
        </div>
        <button 
          onClick={() => setData(prev => ({ ...prev, settings: { ...prev.settings, enabled: !prev.settings.enabled } }))}
          className={cn(
            "w-12 h-6 rounded-full transition-colors relative",
            data.settings.enabled ? "bg-emerald-500" : "bg-zinc-200"
          )}
        >
          <div className={cn(
            "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
            data.settings.enabled ? "left-7" : "left-1"
          )} />
        </button>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-bold text-zinc-700">Fréquence</span>
          <select 
            value={data.settings.frequency}
            onChange={(e) => setData(prev => ({ ...prev, settings: { ...prev.settings, frequency: e.target.value as any } }))}
            className="mt-1 block w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm"
          >
            <option value="weekly">Hebdomadaire</option>
            <option value="monthly">Mensuelle</option>
            <option value="before_expiry">Avant expiration</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-bold text-zinc-700">Canal de communication</span>
          <div className="mt-2 flex gap-4">
            {['sms', 'email', 'push'].map((c) => (
              <button
                key={c}
                onClick={() => setData(prev => ({ ...prev, settings: { ...prev.settings, channel: c as any } }))}
                className={cn(
                  "px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg border",
                  data.settings.channel === c 
                    ? "bg-zinc-900 text-white border-zinc-900" 
                    : "bg-white text-zinc-500 border-zinc-200"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-bold text-zinc-700">Message personnalisé</span>
          <textarea 
            value={data.settings.messageTemplate}
            onChange={(e) => setData(prev => ({ ...prev, settings: { ...prev.settings, messageTemplate: e.target.value } }))}
            rows={4}
            className="mt-1 block w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm"
            placeholder="Utilisez {name} et {points} pour personnaliser..."
          />
        </label>
      </div>

      <div className="pt-4">
        <button 
          onClick={() => addNotification("Paramètres enregistrés avec succès.")}
          className="w-full py-3 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 transition-colors"
        >
          Enregistrer les modifications
        </button>
      </div>
    </Card>
  </div>
</div>
  );
};


  // --- Client Views ---

  const ClientHome = () => {
    const onNewScanResult = (decodedText: string) => {
      // Format: FIDELO-SHOP-ID
      if (decodedText.startsWith('FIDELO-SHOP-')) {
        const shopId = decodedText.replace('FIDELO-SHOP-', '');
        const shop = data.shops.find(s => s.id === shopId);
        if (shop) {
          setActiveClientShop(shop);
          handleCheckIn(shop);
          setIsScanning(false);
          addNotification(`Bienvenue chez ${shop.name} !`);
        } else {
          addNotification("Boutique non reconnue.");
        }
      }
    };

    if (!activeClientShop) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 animate-in fade-in zoom-in-95 duration-500">
          {!isScanning ? (
            <>
              <div className="relative mb-8">
                <div className="w-32 h-32 bg-emerald-50 text-emerald-600 rounded-[2.5rem] flex items-center justify-center border-2 border-emerald-100 shadow-inner">
                  <QrCode size={56} className="animate-pulse" />
                </div>
                {/* Scanner corners */}
                <div className="absolute -top-2 -left-2 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
                <div className="absolute -top-2 -right-2 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
                <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
                <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />
              </div>
              
              <h2 className="text-2xl font-black tracking-tight mb-2">Prêt à scanner ?</h2>
              <p className="text-zinc-500 mb-10 max-w-[240px] text-sm leading-relaxed">
                Scannez le code QR en magasin pour cumuler des points et débloquer vos cadeaux.
              </p>
              
              <button 
                onClick={() => setIsScanning(true)}
                className="w-full max-w-sm py-5 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-3 text-lg"
              >
                <Camera size={24} />
                Scanner un Code QR
              </button>

              <div className="mt-12 p-6 bg-zinc-50 rounded-2xl border border-zinc-100 max-w-sm">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Comment ça marche ?</p>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Présentez votre téléphone devant le code QR affiché en boutique. Vos points seront automatiquement crédités sur votre compte Fidelo.
                </p>
              </div>
            </>
          ) : (
            <div className="w-full max-w-sm space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-black tracking-tight">Scanner le QR Code</h3>
                <button onClick={() => setIsScanning(false)} className="p-2 text-zinc-400 hover:text-zinc-900 bg-zinc-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="relative">
                <Html5QrcodePlugin
                  id="qr-scanner"
                  fps={10}
                  qrbox={250}
                  disableFlip={false}
                  qrCodeSuccessCallback={onNewScanResult}
                />
                {/* Scanner overlay */}
                <div className="absolute inset-0 pointer-events-none border-[40px] border-black/20" />
              </div>
              <p className="text-sm font-medium text-zinc-500">Placez le code QR au centre du cadre</p>
            </div>
          )}
        </div>
      );
    }

    if (!currentUser) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mb-6">
            <QrCode size={40} />
          </div>
          <h2 className="text-3xl font-bold mb-2">Fidélité @ {activeClientShop.name}</h2>
          <p className="text-zinc-500 mb-8 max-w-xs">Rejoignez notre programme à {activeClientShop.location} et profitez de cadeaux exclusifs.</p>
          
          <div className="w-full max-w-sm space-y-4">
            <button 
              onClick={() => setIsRegistering(true)}
              className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
            >
              Créer ma carte digitale
            </button>
            <button 
              onClick={() => setCurrentUser(data.customers[0])}
              className="w-full py-4 bg-white text-zinc-900 font-bold rounded-2xl border border-zinc-200 hover:bg-zinc-50 transition-all"
            >
              Se connecter (Démo)
            </button>
            <button 
              onClick={() => setActiveClientShop(null)}
              className="w-full py-2 text-zinc-400 text-xs font-bold uppercase tracking-widest hover:text-zinc-600"
            >
              Changer de boutique
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            {activeClientShop.logoUrl ? (
              <img src={activeClientShop.logoUrl} alt={activeClientShop.name} className="w-10 h-10 rounded-xl object-cover border border-zinc-100" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <QrCode size={20} />
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">Connecté chez</p>
              <p className="text-sm font-bold text-emerald-600">{activeClientShop.name}</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveClientShop(null)}
            className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest hover:text-zinc-900"
          >
            Changer
          </button>
        </div>

        {timeLeft !== null && (
          <div className={cn(
            "p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-2 duration-300",
            timeLeft > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100"
          )}>
            <div className="flex items-center gap-2">
              <Clock size={18} className={cn(timeLeft > 0 && timeLeft <= 10 && "animate-bounce text-amber-500")} />
              <p className="text-sm font-bold">
                {timeLeft > 0 ? `Temps restant : ${timeLeft}s` : "Temps écoulé"}
              </p>
            </div>
            {timeLeft === 0 && (
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Le commerçant va valider</p>
            )}
          </div>
        )}

        <div className="relative overflow-hidden bg-zinc-900 text-white p-8 rounded-[2.5rem] shadow-2xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/20 rounded-full -mr-20 -mt-20 blur-3xl" />
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-12">
              <div>
                <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">Ma Carte Fidelo</p>
                <h3 className="text-2xl font-bold">{currentUser.name}</h3>
              </div>
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                <QrCode size={24} />
              </div>
            </div>
            
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold mb-1">{activeShopPoints}</p>
                <p className="text-zinc-400 text-sm">Points cumulés</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-400 mb-1">Dernière visite</p>
                <p className="text-sm font-medium">Aujourd'hui</p>
              </div>
            </div>
          </div>
        </div>

        <button 
          disabled={timeLeft === 0}
          onClick={() => setIsPurchaseModalOpen(true)}
          className={cn(
            "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg",
            timeLeft === 0 
              ? "bg-zinc-100 text-zinc-400 cursor-not-allowed shadow-none" 
              : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100"
          )}
        >
          <Plus size={18} />
          Nouvel Achat
        </button>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => setActiveTab('rewards')}
            className="text-left transition-transform active:scale-95"
          >
            <Card className="p-5 flex flex-col items-center text-center gap-2 border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50 transition-colors cursor-pointer w-full">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <Gift size={20} />
              </div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Récompenses</p>
              <p className="text-lg font-bold">3 Disponibles</p>
            </Card>
          </button>
          
          <button 
            onClick={() => setActiveTab('history')}
            className="text-left transition-transform active:scale-95"
          >
            <Card className="p-5 flex flex-col items-center text-center gap-2 hover:bg-zinc-50 transition-colors cursor-pointer w-full">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                <History size={20} />
              </div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Historique</p>
              <p className="text-lg font-bold">12 Achats</p>
            </Card>
          </button>
        </div>

        {clientCampaigns.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Promotions en cours</h4>
              <Badge variant="warning" className="text-[10px]">OFFRES FLASH</Badge>
            </div>
            <div className="space-y-3">
              {clientCampaigns.map((c) => (
                <Card key={c.id} className="p-4 bg-gradient-to-br from-emerald-50 to-white border-emerald-100 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 text-emerald-600 opacity-10 group-hover:opacity-20 transition-opacity">
                    {c.type === 'double_points' ? <Zap size={64} /> :
                     c.type === 'flash_sale' ? <TrendingUp size={64} /> :
                     <Calendar size={64} />}
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
                        {c.type === 'double_points' ? <Zap size={14} /> : <TrendingUp size={14} />}
                      </div>
                      <h5 className="font-bold text-emerald-900">{c.title}</h5>
                    </div>
                    <p className="text-xs text-emerald-700 mb-3">{c.description}</p>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                      <Clock size={12} />
                      Expire le {new Date(c.endDate).toLocaleDateString()}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="bg-zinc-900 text-white p-6 rounded-[2rem] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 text-white/10 group-hover:scale-110 transition-transform">
            <Share2 size={80} />
          </div>
          <div className="relative z-10">
            <h4 className="text-lg font-bold mb-1">Parrainez un ami</h4>
            <p className="text-zinc-400 text-xs mb-4">Gagnez 50 points pour chaque ami qui rejoint {activeClientShop.name} !</p>
            <button 
              onClick={() => addNotification("Lien de parrainage copié !")}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors"
            >
              <Share2 size={14} />
              Partager mon lien
            </button>
          </div>
        </div>

        <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold">Mon QR Code</h4>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Présentez à la caisse</span>
          </div>
          <div className="flex justify-center p-4 bg-white rounded-2xl shadow-sm">
            <QRCodeSVG value={`FIDELO-USER-${currentUser.id}`} size={180} />
          </div>
        </div>
      </div>
    );
  };

  const ClientRewards = () => (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black tracking-tight">Cadeaux & Offres</h2>
        <p className="text-zinc-500 text-sm">Découvrez toutes les offres disponibles dans vos boutiques préférées.</p>
      </div>

      {/* Global Promotions */}
      {allPromotions.filter(p => userBalances[p.shopId] !== undefined && !userRedemptions.some(r => r.promoId === p.id)).length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Offres Spéciales des Boutiques</h3>
          <div className="space-y-4">
            {allPromotions
              .filter(p => userBalances[p.shopId] !== undefined && !userRedemptions.some(r => r.promoId === p.id))
              .map((p) => {
              const shopBalance = userBalances[p.shopId]?.points || 0;
              const isUnlocked = shopBalance >= p.minPoints;
              const progress = Math.min(100, (shopBalance / p.minPoints) * 100);

              return (
                <Card key={p.id} className="overflow-hidden border-none shadow-lg shadow-zinc-100">
                  <div className="bg-zinc-900 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-white/10 rounded flex items-center justify-center text-white">
                        <MapPin size={12} />
                      </div>
                      <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{p.shopName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[8px] px-2 py-1 rounded-full font-black uppercase tracking-tighter",
                        p.type === 'gift' ? "bg-blue-500/20 text-blue-400" : "bg-orange-500/20 text-orange-400"
                      )}>
                        {p.type === 'gift' ? 'Cadeau' : `-${p.discountPercent}% Réduction`}
                      </span>
                      {isUnlocked && (
                        <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter">
                          <Zap size={8} /> Débloqué
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-6 flex gap-4">
                    <div className={cn(
                      "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0",
                      isUnlocked ? "bg-emerald-50 text-emerald-600" : "bg-zinc-50 text-zinc-400"
                    )}>
                      <Gift size={32} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-zinc-900 truncate">{p.title}</h4>
                      <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{p.description}</p>
                      
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between items-end">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">Progression</span>
                          <span className="text-xs font-black text-zinc-900">{shopBalance} / {p.minPoints} <span className="text-[10px] text-zinc-400">PTS</span></span>
                        </div>
                        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className={cn("h-full transition-all", isUnlocked ? "bg-emerald-500" : "bg-zinc-300")}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {isUnlocked && (
                    <div className="px-6 pb-6">
                      <button className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-100">
                        Récupérer mon cadeau
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Regular Rewards (Active Shop) */}
      {activeClientShop && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Récompenses chez {activeClientShop.name}</h3>
          <div className="space-y-4">
            {data.rewards.map((r) => {
              const shopBalance = userBalances[activeClientShop.id]?.points || 0;
              const isUnlocked = shopBalance >= r.pointsCost;
              return (
                <Card key={r.id} className={cn("p-4 flex items-center gap-4", !isUnlocked && "opacity-60 grayscale")}>
                  <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-600">
                    <Gift size={32} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold">{r.title}</h4>
                    <p className="text-xs text-zinc-500">{r.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500" 
                          style={{ width: `${Math.min(100, (shopBalance / r.pointsCost) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400">{r.pointsCost} pts</span>
                    </div>
                  </div>
                  {isUnlocked && (
                    <button 
                      onClick={() => handleRedeemReward(r)}
                      className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
                    >
                      <ArrowRight size={20} />
                    </button>
                  )}
                </Card>
              );
            })}
            {data.rewards.length === 0 && (
              <p className="text-center text-zinc-400 text-sm py-10">Aucune récompense standard pour cette boutique.</p>
            )}
          </div>
        </div>
      )}

      {!activeClientShop && allPromotions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-300">
            <Gift size={40} />
          </div>
          <p className="text-zinc-500 max-w-[200px]">Aucune offre disponible pour le moment. Scannez une boutique pour commencer !</p>
        </div>
      )}
    </div>
  );

  const ClientProfile = () => {
    const [profileForm, setProfileForm] = useState({
      name: currentUser?.name || '',
      phone: currentUser?.phone || ''
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleUpdateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!firebaseUser) return;
      setIsSaving(true);
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          ...profileForm,
          updatedAt: new Date().toISOString()
        });
        setCurrentUser(prev => prev ? { ...prev, ...profileForm } : null);
        addNotification("Profil mis à jour avec succès !");
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center">
          <div className="w-24 h-24 bg-zinc-100 rounded-full mx-auto flex items-center justify-center mb-4 border-4 border-white shadow-xl">
            <User size={48} className="text-zinc-400" />
          </div>
          <h2 className="text-2xl font-bold">{currentUser?.name}</h2>
          <p className="text-zinc-500 text-sm">{currentUser?.email}</p>
          <Badge className="mt-2" variant="success">{currentUser?.role === 'client' ? 'Client Fidèle' : currentUser?.role}</Badge>
        </div>

        <Card className="p-6">
          <h3 className="font-bold text-lg mb-6">Informations Personnelles</h3>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Nom Complet</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  required
                  value={profileForm.name}
                  onChange={e => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="Votre nom"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Téléphone</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  required
                  value={profileForm.phone}
                  onChange={e => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="Votre numéro"
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={isSaving}
              className="w-full py-4 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 disabled:opacity-50"
            >
              {isSaving ? "Enregistrement..." : "Mettre à jour mon profil"}
            </button>
          </form>
        </Card>

        <div className="space-y-4">
          <h3 className="font-bold text-sm text-zinc-400 uppercase tracking-widest px-2">Compte</h3>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 font-bold hover:bg-red-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <LogOut size={20} />
              <span>Déconnexion</span>
            </div>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  const ClientHistory = () => {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Historique</h2>
        {activeShopTransactions.length > 0 ? (
          <div className="space-y-3">
            {activeShopTransactions.map((t) => (
              <Card key={t.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    t.type === 'earn' ? "bg-emerald-50 text-emerald-600" : 
                    t.type === 'redeem' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                  )}>
                    {t.type === 'earn' ? <TrendingUp size={20} /> : 
                     t.type === 'redeem' ? <Zap size={20} /> : <Gift size={20} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t.description}</p>
                    <p className="text-xs text-zinc-500">{new Date(t.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-sm font-bold",
                    t.type === 'earn' ? "text-emerald-600" : 
                    t.type === 'redeem' ? "text-blue-600" : "text-amber-600"
                  )}>
                    {t.type === 'earn' ? '+' : '-'}{t.points} pts
                  </p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-zinc-400">
            <History size={48} className="mx-auto mb-4 opacity-20" />
            <p>Aucun achat enregistré pour le moment.</p>
          </div>
        )}
      </div>
    );
  };

  const SystemPortal = () => {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full space-y-10">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-emerald-100">
              <QrCode size={32} />
            </div>
            <h1 className="text-4xl font-black tracking-tighter">FIDELO Ecosystem</h1>
            <p className="text-zinc-500 font-medium">3 systèmes synchronisés pour votre fidélité.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* SuperAdmin System */}
            <Card 
              className={cn(
                "p-8 space-y-6 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-2xl border-2",
                view === 'superadmin' ? "border-emerald-500 bg-emerald-50/30" : "border-transparent"
              )}
              onClick={() => {
                if (currentUser?.role === 'superadmin') {
                  setView('superadmin');
                  setActiveTab('shops');
                  setShowPortal(false);
                } else {
                  addNotification("Accès restreint au SuperAdmin.");
                }
              }}
            >
              <div className="w-12 h-12 bg-zinc-900 text-white rounded-xl flex items-center justify-center">
                <Settings size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold">FIDELO Platform</h3>
                <p className="text-sm text-zinc-500 mt-2">Gestion globale du réseau, création de boutiques et analytique.</p>
              </div>
              <div className="pt-4 flex items-center text-xs font-bold text-zinc-400 uppercase tracking-widest">
                {currentUser?.role === 'superadmin' ? (
                  <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={14} /> Accès Autorisé</span>
                ) : (
                  <span className="flex items-center gap-1"><Lock size={14} /> Accès Restreint</span>
                )}
              </div>
            </Card>

            {/* Shop Owner System */}
            <Card 
              className={cn(
                "p-8 space-y-6 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-2xl border-2",
                view === 'admin' ? "border-emerald-500 bg-emerald-50/30" : "border-transparent"
              )}
              onClick={() => {
                if (currentUser?.role === 'shop_owner' || currentUser?.role === 'superadmin') {
                  setView('admin');
                  setActiveTab('dashboard');
                  setShowPortal(false);
                } else {
                  addNotification("Accès réservé aux propriétaires de boutiques.");
                }
              }}
            >
              <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center">
                <LayoutDashboard size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold">FIDELO Business</h3>
                <p className="text-sm text-zinc-500 mt-2">Gestion de boutique, marketing, clients et produits.</p>
              </div>
              <div className="pt-4 flex items-center text-xs font-bold text-zinc-400 uppercase tracking-widest">
                {(currentUser?.role === 'shop_owner' || currentUser?.role === 'superadmin') ? (
                  <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 size={14} /> Accès Autorisé</span>
                ) : (
                  <span className="flex items-center gap-1"><Lock size={14} /> Accès Restreint</span>
                )}
              </div>
            </Card>

            {/* Client System */}
            <Card 
              className={cn(
                "p-8 space-y-6 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-2xl border-2",
                view === 'client' ? "border-emerald-500 bg-emerald-50/30" : "border-transparent"
              )}
              onClick={() => {
                setView('client');
                setActiveTab('home');
                setShowPortal(false);
              }}
            >
              <div className="w-12 h-12 bg-amber-500 text-white rounded-xl flex items-center justify-center">
                <User size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold">FIDELO Client</h3>
                <p className="text-sm text-zinc-500 mt-2">Carte de fidélité, cadeaux, historique et profil.</p>
              </div>
              <div className="pt-4 flex items-center text-xs font-bold text-emerald-600 uppercase tracking-widest">
                <span className="flex items-center gap-1"><CheckCircle2 size={14} /> Accès Public</span>
              </div>
            </Card>
          </div>

          <div className="text-center pt-10">
            <button 
              onClick={handleLogout}
              className="text-sm font-bold text-red-600 hover:underline flex items-center gap-2 mx-auto"
            >
              <LogOut size={16} /> Déconnexion
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- Render ---

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!firebaseUser) {
    return <Login onSuccess={() => {}} />;
  }

  if (showPortal) {
    return <SystemPortal />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-xs pointer-events-auto"
            >
              <Bell size={18} className="text-emerald-400 shrink-0" />
              <p className="text-sm font-medium">{n.message}</p>
              <button onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))} className="ml-2 text-zinc-500 hover:text-white">
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* System Switcher */}
      <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 items-end">
        <button 
          onClick={() => setShowPortal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-full shadow-2xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all"
        >
          <LayoutDashboard size={14} />
          Changer de Système
        </button>
      </div>

      {view === 'superadmin' ? (
        <div className="flex min-h-screen">
          <aside className="w-64 bg-white border-r border-zinc-200 p-6 hidden lg:flex flex-col">
            <div className="flex items-center gap-2 mb-10 px-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
                <QrCode size={18} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tighter leading-none">FIDELO</h1>
                <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Platform</p>
              </div>
            </div>
            <nav className="space-y-1 flex-1">
              <SidebarItem icon={Settings} label="Boutiques" active={activeTab === 'shops'} onClick={() => setActiveTab('shops')} />
              <SidebarItem icon={TrendingUp} label="Analytique Réseau" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
            </nav>
          </aside>
          <main className="flex-1 p-8 overflow-y-auto">
            <SuperAdminView 
              data={data}
              db={db}
              addNotification={addNotification}
              setIsAddingShop={setIsAddingShop}
              setView={setView}
              setActiveTab={setActiveTab}
              setActiveClientShop={setActiveClientShop}
              setSelectedShop={setSelectedShop}
              isAddingShop={isAddingShop}
              shopForm={shopForm}
              setShopForm={setShopForm}
              handleAddShop={handleAddShop}
            />
          </main>
        </div>
      ) : view === 'admin' ? (
        <div className="flex min-h-screen">
          {/* Admin Sidebar */}
          <aside className="w-64 bg-white border-r border-zinc-200 p-6 hidden lg:flex flex-col">
            <div className="flex items-center gap-2 mb-10 px-2">
              <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white">
                <QrCode size={18} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tighter leading-none">FIDELO</h1>
                <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Business</p>
              </div>
            </div>
            
            <nav className="space-y-1 flex-1">
              <SidebarItem icon={LayoutDashboard} label="Tableau de bord" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
              <SidebarItem icon={Megaphone} label="Promotions" active={activeTab === 'promotions'} onClick={() => setActiveTab('promotions')} />
              <SidebarItem icon={Target} label="Marketing" active={activeTab === 'campaigns'} onClick={() => setActiveTab('campaigns')} />
              <SidebarItem icon={Users} label="Clients" active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} />
              <SidebarItem icon={Package} label="Produits" active={activeTab === 'products'} onClick={() => setActiveTab('products')} />
              <SidebarItem icon={Settings} label="Rappels" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
              <SidebarItem icon={User} label="Mon Profil" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
            </nav>

            <div className="pt-6 border-t border-zinc-100">
              <button 
                onClick={() => setView('superadmin')}
                className="flex items-center w-full gap-3 px-4 py-3 text-sm font-medium text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <ArrowRight size={18} />
                Retour SuperAdmin
              </button>
            </div>
          </aside>

          {/* Admin Content */}
          <main className="flex-1 p-8 overflow-y-auto">
            {activeTab === 'dashboard' && (
              <AdminDashboard 
                adminData={adminData}
                selectedShop={selectedShop}
                setAdminTargetCheckIn={setAdminTargetCheckIn}
                setIsPurchaseModalOpen={setIsPurchaseModalOpen}
              />
            )}
            {activeTab === 'promotions' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex flex-col gap-2">
                  <h2 className="text-3xl font-black tracking-tight">Promotions & Offres</h2>
                  <p className="text-zinc-500">Créez une offre et notifiez automatiquement les clients éligibles selon leurs points.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <Card className="p-8">
                      <form onSubmit={handleCreatePromotion} className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Titre de l'offre</label>
                          <input 
                            required
                            value={promoForm.title}
                            onChange={e => setPromoForm(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            placeholder="Ex: Cadeau de Fidélité Or"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Type d'offre</label>
                            <div className="flex gap-2 p-1 bg-zinc-100 rounded-xl">
                              <button 
                                type="button"
                                onClick={() => setPromoForm(prev => ({ ...prev, type: 'gift' }))}
                                className={cn(
                                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                                  promoForm.type === 'gift' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                                )}
                              >
                                Cadeau
                              </button>
                              <button 
                                type="button"
                                onClick={() => setPromoForm(prev => ({ ...prev, type: 'discount' }))}
                                className={cn(
                                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                                  promoForm.type === 'discount' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                                )}
                              >
                                Réduction
                              </button>
                            </div>
                          </div>

                          {promoForm.type === 'discount' && (
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Pourcentage (%)</label>
                              <input 
                                type="number"
                                required
                                min="1"
                                max="100"
                                value={promoForm.discountPercent}
                                onChange={e => setPromoForm(prev => ({ ...prev, discountPercent: parseInt(e.target.value) || 0 }))}
                                className="w-full px-5 py-2 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold"
                              />
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Description de l'offre</label>
                          <textarea 
                            required
                            value={promoForm.description}
                            onChange={e => setPromoForm(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                            placeholder="Décrivez ce que le client reçoit..."
                            rows={4}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Points Minimum Requis</label>
                          <div className="relative">
                            <input 
                              type="number"
                              required
                              min="0"
                              value={promoForm.minPoints}
                              onChange={e => setPromoForm(prev => ({ ...prev, minPoints: parseInt(e.target.value) || 0 }))}
                              className="w-full px-5 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-xl"
                            />
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">PTS</div>
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-2 italic">
                            * Tous les clients ayant au moins ce nombre de points recevront une notification immédiate.
                          </p>
                        </div>

                        <button 
                          type="submit"
                          className="w-full py-5 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all shadow-xl flex items-center justify-center gap-3 group"
                        >
                          <Megaphone size={20} className="group-hover:rotate-12 transition-transform" />
                          Lancer l'offre et notifier les clients
                        </button>
                      </form>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-emerald-50 rounded-[2.5rem] p-8 border border-emerald-100">
                      <h4 className="text-emerald-900 font-bold mb-4 flex items-center gap-2">
                        <Users size={18} />
                        Impact Estimé
                      </h4>
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <span className="text-sm text-emerald-700">Clients éligibles</span>
                          <span className="text-3xl font-black text-emerald-900">
                            {adminData.customers.filter(c => c.totalPoints >= promoForm.minPoints).length}
                          </span>
                        </div>
                        <div className="h-2 bg-emerald-200 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(adminData.customers.filter(c => c.totalPoints >= promoForm.minPoints).length / (adminData.customers.length || 1)) * 100}%` }}
                            className="h-full bg-emerald-600"
                          />
                        </div>
                        <p className="text-xs text-emerald-600 leading-relaxed">
                          Ciblez vos clients les plus fidèles pour augmenter vos ventes et récompenser leur engagement.
                        </p>
                      </div>
                    </div>

                    <div className="bg-zinc-900 rounded-[2.5rem] p-8 text-white">
                      <h4 className="font-bold mb-4 flex items-center gap-2">
                        <Zap size={18} className="text-yellow-400" />
                        Conseil Pro
                      </h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        Les offres avec un seuil de points élevé (ex: 1000 pts) créent un sentiment d'exclusivité. Les offres à seuil bas (ex: 100 pts) encouragent les visites fréquentes.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Existing Promotions List */}
                <div className="mt-12 space-y-6">
                  <h3 className="text-xl font-bold">Promotions Actives</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allPromotions.filter(p => p.shopId === selectedShop?.id).map(p => (
                      <Card key={p.id} className="p-6 relative group">
                        <button 
                          onClick={() => handleDeletePromotion(p.id)}
                          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <Megaphone size={20} />
                          </div>
                          <div>
                            <h4 className="font-bold">{p.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{p.minPoints} Points Requis</p>
                              <span className={cn(
                                "text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter",
                                p.type === 'gift' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
                              )}>
                                {p.type === 'gift' ? 'Cadeau' : `-${p.discountPercent}% Promo`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-zinc-500 line-clamp-2">{p.description}</p>
                      </Card>
                    ))}
                    {allPromotions.filter(p => p.shopId === selectedShop?.id).length === 0 && (
                      <div className="col-span-full py-12 text-center bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
                        <p className="text-zinc-400 text-sm">Aucune promotion active pour le moment.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'campaigns' && (
              <AdminCampaigns 
                adminData={adminData}
                setIsAddingCampaign={setIsAddingCampaign}
              />
            )}
            {activeTab === 'products' && (
              <AdminProducts 
                adminData={adminData}
                setIsAddingProduct={setIsAddingProduct}
              />
            )}
            {activeTab === 'settings' && (
              <AdminSettings 
                selectedShop={selectedShop}
                db={db}
                setSelectedShop={setSelectedShop}
                addNotification={addNotification}
                data={data}
                setData={setData}
              />
            )}
            {activeTab === 'profile' && <ClientProfile />}
            {activeTab === 'customers' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Clients</h2>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-4 py-2">
                      <Filter size={16} className="text-zinc-400" />
                      <span className="text-xs font-bold text-zinc-500 uppercase">Points min:</span>
                      <input 
                        type="number" 
                        value={minPointsFilter}
                        onChange={(e) => setMinPointsFilter(parseInt(e.target.value) || 0)}
                        className="w-16 text-sm font-bold outline-none"
                      />
                    </div>
                    {selectedCustomerIds.length > 0 && (
                      <button 
                        onClick={() => setIsBulkNotifModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all"
                      >
                        <Send size={16} />
                        Notifier ({selectedCustomerIds.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card className="lg:col-span-2 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-50 border-b border-zinc-200">
                        <tr>
                          <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">
                            <input 
                              type="checkbox" 
                              className="rounded border-zinc-300"
                              checked={selectedCustomerIds.length === adminData.customers.filter(c => c.totalPoints >= minPointsFilter).length && adminData.customers.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCustomerIds(adminData.customers.filter(c => c.totalPoints >= minPointsFilter).map(c => c.id));
                                } else {
                                  setSelectedCustomerIds([]);
                                }
                              }}
                            />
                          </th>
                          <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Client</th>
                          <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Téléphone</th>
                          <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase">Points</th>
                          <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {adminData.customers
                          .filter(c => c.totalPoints >= minPointsFilter)
                          .map((c) => (
                          <tr 
                            key={c.id} 
                            className={cn(
                              "hover:bg-zinc-50 transition-colors cursor-pointer",
                              selectedCustomerForDetails?.id === c.id && "bg-emerald-50/50"
                            )}
                            onClick={() => setSelectedCustomerForDetails(c)}
                          >
                            <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                className="rounded border-zinc-300"
                                checked={selectedCustomerIds.includes(c.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCustomerIds(prev => [...prev, c.id]);
                                  } else {
                                    setSelectedCustomerIds(prev => prev.filter(id => id !== c.id));
                                  }
                                }}
                              />
                            </td>
                            <td className="px-6 py-4 text-sm font-medium">{c.name}</td>
                            <td className="px-6 py-4 text-sm text-zinc-500">{c.phone}</td>
                            <td className="px-6 py-4 text-sm font-bold text-emerald-600">{c.totalPoints}</td>
                            <td className="px-6 py-4 text-right">
                              <ChevronRight size={18} className="text-zinc-300 inline" />
                            </td>
                          </tr>
                        ))}
                        {adminData.customers.filter(c => c.totalPoints >= minPointsFilter).length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-zinc-400">Aucun client ne correspond à ce filtre.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </Card>

                  <div className="space-y-6">
                    {selectedCustomerForDetails ? (
                      <Card className="p-6 space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold">Détails Client</h3>
                          <button onClick={() => setSelectedCustomerForDetails(null)} className="text-zinc-400 hover:text-zinc-900">
                            <X size={16} />
                          </button>
                        </div>
                        
                        <div className="text-center pb-6 border-b border-zinc-100">
                          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 font-bold text-2xl mx-auto mb-3">
                            {selectedCustomerForDetails.name.charAt(0)}
                          </div>
                          <h4 className="text-lg font-black">{selectedCustomerForDetails.name}</h4>
                          <p className="text-xs text-zinc-400">{selectedCustomerForDetails.email}</p>
                          <div className="mt-4 inline-block px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-black text-xl">
                            {selectedCustomerForDetails.totalPoints} <span className="text-[10px] uppercase tracking-widest">pts</span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Offres Disponibles</h5>
                          <div className="space-y-3">
                            {allPromotions
                              .filter(p => p.shopId === selectedShop?.id && selectedCustomerForDetails.totalPoints >= p.minPoints)
                              .map(p => (
                                <div key={p.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-3">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="text-sm font-bold">{p.title}</p>
                                      <p className="text-[10px] text-zinc-400">{p.minPoints} pts requis</p>
                                    </div>
                                    <span className={cn(
                                      "text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter",
                                      p.type === 'gift' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
                                    )}>
                                      {p.type === 'gift' ? 'Cadeau' : `-${p.discountPercent}% Promo`}
                                    </span>
                                  </div>
                                  
                                  <button 
                                    onClick={() => {
                                      if (p.type === 'discount') {
                                        setActiveDiscount(p.discountPercent);
                                        setAdminTargetCheckIn({ id: 'manual', userId: selectedCustomerForDetails.id } as any);
                                        setActiveTab('dashboard');
                                        addNotification(`Réduction de ${p.discountPercent}% prête à être appliquée.`);
                                      } else {
                                        handleRedeemPromotion(selectedCustomerForDetails.id, p);
                                      }
                                    }}
                                    className="w-full py-2 bg-zinc-900 text-white text-xs font-bold rounded-xl hover:bg-zinc-800 transition-all"
                                  >
                                    {p.type === 'gift' ? 'Valider le Cadeau' : 'Appliquer la Réduction'}
                                  </button>
                                </div>
                              ))}
                            {allPromotions.filter(p => p.shopId === selectedShop?.id && selectedCustomerForDetails.totalPoints >= p.minPoints).length === 0 && (
                              <p className="text-xs text-zinc-400 text-center py-4 italic">Aucune offre disponible pour ce client.</p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-12 bg-zinc-50 rounded-[2.5rem] border border-dashed border-zinc-200 text-center">
                        <Users size={48} className="text-zinc-200 mb-4" />
                        <p className="text-sm text-zinc-400 font-medium">Sélectionnez un client pour voir ses offres et gérer ses points.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      ) : (
        <div className="max-w-md mx-auto bg-white min-h-screen flex flex-col shadow-xl">
          {/* Client Header */}
          <header className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
                <QrCode size={18} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tighter leading-none">FIDELO</h1>
                <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Client</p>
              </div>
            </div>
            {currentUser && (
              <button onClick={() => setCurrentUser(null)} className="p-2 text-zinc-400 hover:text-zinc-900">
                <LogOut size={20} />
              </button>
            )}
          </header>

          {/* Client Content */}
          <main className="flex-1 p-6 pb-24">
            {activeTab === 'home' && <ClientHome />}
            {activeTab === 'rewards' && <ClientRewards />}
            {activeTab === 'history' && <ClientHistory />}
            {activeTab === 'profile' && <ClientProfile />}
          </main>

          {/* Client Bottom Nav */}
          {currentUser && (
            <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-lg border-t border-zinc-100 flex justify-around p-4 z-30">
              <button 
                onClick={() => setActiveTab('home')}
                className={cn("flex flex-col items-center gap-1", activeTab === 'home' ? "text-emerald-600" : "text-zinc-400")}
              >
                <QrCode size={20} />
                <span className="text-[10px] font-bold uppercase">Accueil</span>
              </button>
              <button 
                onClick={() => setActiveTab('rewards')}
                className={cn("flex flex-col items-center gap-1", activeTab === 'rewards' ? "text-emerald-600" : "text-zinc-400")}
              >
                <Gift size={20} />
                <span className="text-[10px] font-bold uppercase">Cadeaux</span>
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={cn("flex flex-col items-center gap-1", activeTab === 'history' ? "text-emerald-600" : "text-zinc-400")}
              >
                <History size={20} />
                <span className="text-[10px] font-bold uppercase">Achats</span>
              </button>
              <button 
                onClick={() => setActiveTab('profile')}
                className={cn("flex flex-col items-center gap-1", activeTab === 'profile' ? "text-emerald-600" : "text-zinc-400")}
              >
                <User size={20} />
                <span className="text-[10px] font-bold uppercase">Profil</span>
              </button>
            </nav>
          )}

          {/* Registration Modal */}
          <AnimatePresence>
            {isRegistering && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
              >
                <motion.div 
                  initial={{ y: 100 }}
                  animate={{ y: 0 }}
                  exit={{ y: 100 }}
                  className="w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold">Rejoindre Fidelo</h3>
                    {currentUser && (
                      <button onClick={() => setIsRegistering(false)} className="p-2 text-zinc-400"><X size={24} /></button>
                    )}
                  </div>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Nom complet</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input 
                          required
                          value={regForm.name}
                          onChange={e => setRegForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="Ex: Jean Dupont"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Téléphone</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input 
                          required
                          type="tel"
                          value={regForm.phone}
                          onChange={e => setRegForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                          placeholder="06 00 00 00 00"
                        />
                      </div>
                    </div>
                    <button 
                      type="submit"
                      className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all mt-4"
                    >
                      Activer ma carte
                    </button>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {/* Add Product Modal */}
      <AnimatePresence>
        {isAddingProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-zinc-900">Nouveau Produit</h3>
                <button onClick={() => setIsAddingProduct(false)} className="p-2 text-zinc-400 hover:text-zinc-900">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleAddProduct} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Nom du produit</label>
                  <input 
                    required
                    value={productForm.name}
                    onChange={e => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Ex: Café Espresso"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Catégorie</label>
                  <input 
                    required
                    value={productForm.category}
                    onChange={e => setProductForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Ex: Boissons"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Prix (FCFA)</label>
                    <input 
                      required
                      type="number"
                      value={productForm.price}
                      onChange={e => setProductForm(prev => ({ ...prev, price: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Points offerts</label>
                    <input 
                      required
                      type="number"
                      value={productForm.pointsValue}
                      onChange={e => setProductForm(prev => ({ ...prev, pointsValue: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
                
                <button 
                  type="submit"
                  className="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all shadow-lg mt-4"
                >
                  Ajouter le produit
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Campaign Modal */}
      <AnimatePresence>
        {isAddingCampaign && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">Nouvelle Campagne</h3>
                <button onClick={() => setIsAddingCampaign(false)} className="p-2 text-zinc-400"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddCampaign} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Titre de la campagne</label>
                  <input 
                    required
                    value={campaignForm.title}
                    onChange={e => setCampaignForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Ex: Weekend Double Points"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Description</label>
                  <textarea 
                    required
                    value={campaignForm.description}
                    onChange={e => setCampaignForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Détails de l'offre..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Type</label>
                    <select 
                      value={campaignForm.type}
                      onChange={e => setCampaignForm(prev => ({ ...prev, type: e.target.value as any }))}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="double_points">Points Doubles</option>
                      <option value="flash_sale">Vente Flash</option>
                      <option value="new_arrival">Nouveauté</option>
                      <option value="event">Événement</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest px-1">Date de fin</label>
                    <input 
                      type="date"
                      required
                      value={campaignForm.endDate}
                      onChange={e => setCampaignForm(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 transition-all mt-4"
                >
                  Lancer la campagne
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Notification Modal */}
      <AnimatePresence>
        {isBulkNotifModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Envoyer un message</h3>
                <button onClick={() => setIsBulkNotifModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-900">
                  <X size={20} />
                </button>
              </div>
              
              <div className="mb-6 p-4 bg-emerald-50 rounded-2xl">
                <p className="text-sm text-emerald-700 font-medium">
                  Ce message sera envoyé à {selectedCustomerIds.length} client(s) ayant au moins {minPointsFilter} points.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Votre message (cadeau, promo, lot...)</label>
                  <textarea 
                    required
                    value={bulkNotifMessage}
                    onChange={e => setBulkNotifMessage(e.target.value)}
                    className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Ex: Félicitations ! Vous avez gagné un lot spécial. Passez en boutique pour le récupérer."
                    rows={4}
                  />
                </div>
                
                <button 
                  onClick={handleSendBulkNotification}
                  disabled={!bulkNotifMessage.trim()}
                  className="w-full py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all shadow-lg disabled:opacity-50"
                >
                  Envoyer maintenant
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Modal */}
      <AnimatePresence>
        {isPurchaseModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold">
                    {adminTargetCheckIn ? `Achat pour ${adminTargetCheckIn.userName}` : "Nouvel Achat"}
                  </h3>
                  <div className="flex items-center gap-2">
                    <p className="text-emerald-600 font-bold">+{calculateTotalPoints()} points à gagner</p>
                    {adminTargetCheckIn?.activeDiscount > 0 && (
                      <Badge variant="warning" className="text-[10px] px-2 py-1">-{adminTargetCheckIn.activeDiscount}% Appliqué</Badge>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsPurchaseModalOpen(false);
                    setAdminTargetCheckIn(null);
                  }} 
                  className="p-2 text-zinc-400 hover:text-zinc-900"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 mb-8">
                {(clientShopProducts.length > 0 ? clientShopProducts : adminData.products).map(product => (
                  <div key={product.id} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl">
                    <div>
                      <p className="font-bold">{product.name}</p>
                      <p className="text-xs text-zinc-500">{product.price.toLocaleString()} FCFA • {product.pointsValue} pts</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setSelectedProducts(prev => ({ ...prev, [product.id]: Math.max(0, (prev[product.id] || 0) - 1) }))}
                        className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-50"
                      >
                        -
                      </button>
                      <span className="font-bold w-4 text-center">{selectedProducts[product.id] || 0}</span>
                      <button 
                        onClick={() => setSelectedProducts(prev => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }))}
                        className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 hover:bg-zinc-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
                {(clientShopProducts.length > 0 ? clientShopProducts : adminData.products).length === 0 && (
                  <div className="text-center py-8 text-zinc-400">
                    <Package size={40} className="mx-auto mb-2 opacity-20" />
                    <p>Aucun produit disponible dans cette boutique.</p>
                  </div>
                )}
              </div>

              <button 
                onClick={() => handleRecordPurchase(adminTargetCheckIn?.userId)}
                disabled={Object.values(selectedProducts).every(v => v === 0)}
                className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:grayscale"
              >
                Confirmer l'achat
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Registration Modal */}
      <AnimatePresence>
        {isRegistering && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <User size={32} />
                </div>
                <h3 className="text-2xl font-bold">Complétez votre profil</h3>
                <p className="text-zinc-500 text-sm mt-1">Juste quelques détails pour commencer.</p>
              </div>
              
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Nom complet</label>
                  <input 
                    required
                    value={regForm.name}
                    onChange={e => setRegForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Ex: Jean Dupont"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Téléphone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input 
                      required
                      type="tel"
                      value={regForm.phone}
                      onChange={e => setRegForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="01 02 03 04 05"
                    />
                  </div>
                </div>
                
                <button 
                  type="submit"
                  className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 mt-4 flex items-center justify-center gap-2"
                >
                  Créer ma carte <ArrowRight size={18} />
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
