/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Camera, 
  CreditCard, 
  Banknote, 
  PieChart as PieChartIcon, 
  List, 
  Calendar, 
  Settings,
  Tag,
  Info,
  Edit2,
  Save,
  PlusCircle,
  Minus,
  CreditCard as CreditCardIcon,
  LogOut,
  Trash2,
  Loader2,
  X,
  AlertCircle,
  QrCode,
  TrendingUp
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  deleteDoc, 
  doc, 
  Timestamp,
  setDoc
} from 'firebase/firestore';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { Expense, CardBill, PaymentMethod, Category, Card, UserProfile } from './types';
import { CATEGORIES, PAYMENT_METHODS } from './constants';
import { analyzeReceipt } from './services/geminiService';
import { ErrorBoundary } from './components/ErrorBoundary';

const googleProvider = new GoogleAuthProvider();

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cardBills, setCardBills] = useState<CardBill[]>([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'expenses' | 'bills' | 'cashflow' | 'settings'>('dashboard');
  const [userCategories, setUserCategories] = useState<Category[]>([]);
  const [userCards, setUserCards] = useState<Card[]>([]);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  
  // New Expense Form State
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].name);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [description, setDescription] = useState('');
  const [cardId, setCardId] = useState('');
  const [pixBank, setPixBank] = useState('');
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'none' | 'monthly' | 'weekly' | 'yearly'>('monthly');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Settings State
  const [isEditingCategories, setIsEditingCategories] = useState(false);
  const [isEditingCards, setIsEditingCards] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCardBank, setNewCardBank] = useState('');
  const [newCardBrand, setNewCardBrand] = useState('');
  const [newCardDueDay, setNewCardDueDay] = useState('10');
  const [newCardClosingDay, setNewCardClosingDay] = useState('3');
  const [newCardLimit, setNewCardLimit] = useState('');
  const [initialBalanceInput, setInitialBalanceInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Create/Update user profile
        const userRef = doc(db, 'users', currentUser.uid);
        setDoc(userRef, {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          updatedAt: Timestamp.now()
        }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`));
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isAuthReady) return;

    const expensesQuery = query(
      collection(db, 'expenses'),
      where('uid', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const expenseData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      setExpenses(expenseData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'expenses'));

    const userRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as UserProfile;
        setUserProfile(data);
        setInitialBalanceInput(data.initialBalance?.toString() || '');
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}`));

    const billsQuery = query(
      collection(db, 'cardBills'),
      where('uid', '==', user.uid),
      orderBy('year', 'desc'),
      orderBy('month', 'desc')
    );

    const unsubscribeBills = onSnapshot(billsQuery, (snapshot) => {
      const billData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CardBill[];
      setCardBills(billData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'cardBills'));

    const categoriesQuery = query(
      collection(db, 'categories'),
      where('uid', '==', user.uid)
    );

    const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
      const catData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setUserCategories(catData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'categories'));

    const cardsQuery = query(
      collection(db, 'cards'),
      where('uid', '==', user.uid)
    );

    const unsubscribeCards = onSnapshot(cardsQuery, (snapshot) => {
      const cardData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Card[];
      setUserCards(cardData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'cards'));

    return () => {
      unsubscribeExpenses();
      unsubscribeUser();
      unsubscribeBills();
      unsubscribeCategories();
      unsubscribeCards();
    };
  }, [user, isAuthReady]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-blocked') {
        setLoginError("O popup de login foi bloqueado pelo navegador. Por favor, permita popups para este site.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Ignore this one as it's usually a side effect of multiple attempts
      } else {
        setLoginError("Erro ao entrar com Google. Tente novamente.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const newExpense = {
        amount: parseFloat(amount),
        category,
        date,
        paymentMethod,
        description,
        cardId: paymentMethod === 'credit_card' ? cardId : null,
        pixBank: paymentMethod === 'pix' ? pixBank : null,
        uid: user.uid,
        createdAt: new Date().toISOString(),
        type: transactionType,
        isRecurring,
        frequency: isRecurring ? frequency : 'none'
      };

      await addDoc(collection(db, 'expenses'), newExpense);
      setIsAddingExpense(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
    }
  };

  const handleAddCategory = async () => {
    if (!user || !newCategoryName) return;
    try {
      await addDoc(collection(db, 'categories'), {
        name: newCategoryName,
        icon: 'Tag',
        color: '#10b981',
        uid: user.uid
      });
      setNewCategoryName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'categories');
    }
  };

  const handleAddCard = async () => {
    if (!user || !newCardBank || !newCardBrand) return;
    try {
      await addDoc(collection(db, 'cards'), {
        bank: newCardBank,
        brand: newCardBrand,
        dueDay: parseInt(newCardDueDay),
        closingDay: parseInt(newCardClosingDay),
        limit: parseFloat(newCardLimit) || 0,
        uid: user.uid
      });
      setNewCardBank('');
      setNewCardBrand('');
      setNewCardLimit('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'cards');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
    }
  };

  const handleDeleteCard = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'cards', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `cards/${id}`);
    }
  };

  const [isSavingBalance, setIsSavingBalance] = useState(false);

  const handleUpdateInitialBalance = async () => {
    if (!user) return;
    setIsSavingBalance(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        initialBalance: parseFloat(initialBalanceInput) || 0,
        updatedAt: Timestamp.now()
      }, { merge: true });
      // Optional: show a toast or success state
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setIsSavingBalance(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setCategory(CATEGORIES[0].name);
    setDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('cash');
    setDescription('');
    setCardId('');
    setPixBank('');
    setTransactionType('expense');
    setIsRecurring(false);
    setFrequency('monthly');
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setIsAddingExpense(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = (reader.result as string).split(',')[1];
      const info = await analyzeReceipt(base64String);
      
      if (info) {
        setAmount(info.amount.toString());
        setDate(info.date);
        setCategory(info.category);
        setDescription(info.description);
        setPaymentMethod(info.paymentMethod);
      }
      setIsAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

  const getCashFlowData = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const actualTransactions = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const actualIncome = actualTransactions.filter(e => e.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
    
    // Cash out this month: Non-card expenses (money that already left the account)
    const actualExpenses = actualTransactions
      .filter(e => (e.type === 'expense' || !e.type) && e.paymentMethod !== 'credit_card')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const recurringItems = expenses.filter(e => e.isRecurring);
    let projectedIncome = 0;
    let projectedExpenses = 0;

    recurringItems.forEach(item => {
      const alreadyHappened = actualTransactions.some(t => 
        t.description === item.description && 
        t.category === item.category && 
        t.amount === item.amount &&
        t.type === item.type
      );

      if (!alreadyHappened) {
        if (item.type === 'income') projectedIncome += item.amount;
        else projectedExpenses += item.amount;
      }
    });

    // Calculate Credit Card Bills due this month
    let totalCardBills = 0;
    const cardBillDetails = userCards.map(card => {
      const { dueDay, closingDay } = card;
      
      let closingMonth = currentMonth;
      let closingYear = currentYear;
      
      // If closing day is after or equal to due day, the bill closing was in the previous month
      if (closingDay >= dueDay) {
        closingMonth--;
        if (closingMonth < 0) {
          closingMonth = 11;
          closingYear--;
        }
      }
      
      const closingDate = new Date(closingYear, closingMonth, closingDay, 23, 59, 59);
      const startDate = new Date(closingDate);
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(0, 0, 0, 0);
      
      const billAmount = expenses
        .filter(e => e.cardId === card.id && e.paymentMethod === 'credit_card')
        .filter(e => {
          const d = new Date(e.date);
          return d >= startDate && d <= closingDate;
        })
        .reduce((acc, curr) => acc + curr.amount, 0);
        
      totalCardBills += billAmount;
      return { card, amount: billAmount };
    });

    const initialBalance = userProfile?.initialBalance || 0;
    
    return {
      actualIncome,
      actualExpenses,
      projectedIncome,
      projectedExpenses,
      totalCardBills,
      cardBillDetails,
      initialBalance,
      totalProjectedIncome: actualIncome + projectedIncome,
      totalProjectedExpenses: actualExpenses + projectedExpenses + totalCardBills,
      finalBalance: initialBalance + (actualIncome + projectedIncome) - (actualExpenses + projectedExpenses + totalCardBills)
    };
  };

  const getCategoryData = () => {
    const data: { [key: string]: number } = {};
    const allCategories = [...CATEGORIES, ...userCategories];
    expenses.filter(e => e.type === 'expense' || !e.type).forEach(exp => {
      data[exp.category] = (data[exp.category] || 0) + exp.amount;
    });
    return Object.keys(data).map(name => ({
      name,
      value: data[name],
      color: allCategories.find(c => c.name === name)?.color || '#999'
    }));
  };

  const getMonthlyData = () => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const data = months.map(m => ({ name: m, total: 0 }));
    
    expenses.filter(e => e.type === 'expense' || !e.type).forEach(exp => {
      const date = new Date(exp.date);
      if (date.getFullYear() === new Date().getFullYear()) {
        data[date.getMonth()].total += exp.amount;
      }
    });
    return data;
  };

  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center border border-neutral-100"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Banknote className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Finanças Pro</h1>
          <p className="text-neutral-500 mb-8">Organize sua vida financeira de forma simples e inteligente.</p>
          
          {loginError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm flex items-start gap-3 text-left">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{loginError}</p>
            </div>
          )}

          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-semibold flex items-center justify-center gap-3 hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoggingIn ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5 brightness-0 invert" alt="Google" />
            )}
            {isLoggingIn ? 'Entrando...' : 'Entrar com Google'}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-neutral-50 pb-24">
        {/* Header */}
        <header className="bg-white border-b border-neutral-100 sticky top-0 z-30">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                <Banknote className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-neutral-900">Finanças Pro</h1>
            </div>
            <div className="flex items-center gap-4">
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                className="w-8 h-8 rounded-full border border-neutral-200"
                alt="Profile"
              />
              <button 
                onClick={handleLogout}
                className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-neutral-400 mb-1">Recebido</p>
                    <p className="text-xl font-bold text-emerald-600">
                      R$ {expenses
                        .filter(e => e.type === 'income' && new Date(e.date).getMonth() === new Date().getMonth() && new Date(e.date).getFullYear() === new Date().getFullYear())
                        .reduce((acc, curr) => acc + curr.amount, 0)
                        .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-neutral-400 mb-1">Lançamento</p>
                    <p className="text-xl font-bold text-red-600">
                      R$ {expenses
                        .filter(e => (e.type === 'expense' || !e.type) && new Date(e.date).getMonth() === new Date().getMonth() && new Date(e.date).getFullYear() === new Date().getFullYear())
                        .reduce((acc, curr) => acc + curr.amount, 0)
                        .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-neutral-400 mb-1">Saldo Mês</p>
                    <p className={`text-xl font-bold ${
                      (expenses.filter(e => e.type === 'income' && new Date(e.date).getMonth() === new Date().getMonth() && new Date(e.date).getFullYear() === new Date().getFullYear()).reduce((acc, curr) => acc + curr.amount, 0) - 
                       expenses.filter(e => (e.type === 'expense' || !e.type) && new Date(e.date).getMonth() === new Date().getMonth() && new Date(e.date).getFullYear() === new Date().getFullYear()).reduce((acc, curr) => acc + curr.amount, 0)) >= 0 
                      ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      R$ {(expenses.filter(e => e.type === 'income' && new Date(e.date).getMonth() === new Date().getMonth() && new Date(e.date).getFullYear() === new Date().getFullYear()).reduce((acc, curr) => acc + curr.amount, 0) - 
                           expenses.filter(e => (e.type === 'expense' || !e.type) && new Date(e.date).getMonth() === new Date().getMonth() && new Date(e.date).getFullYear() === new Date().getFullYear()).reduce((acc, curr) => acc + curr.amount, 0))
                        .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-neutral-400 mb-1">Saldo Total</p>
                    <p className={`text-xl font-bold ${
                      ((userProfile?.initialBalance || 0) + 
                       expenses.filter(e => e.type === 'income' && new Date(e.date).getMonth() === new Date().getMonth() && new Date(e.date).getFullYear() === new Date().getFullYear()).reduce((acc, curr) => acc + curr.amount, 0) - 
                       expenses.filter(e => (e.type === 'expense' || !e.type) && new Date(e.date).getMonth() === new Date().getMonth() && new Date(e.date).getFullYear() === new Date().getFullYear()).reduce((acc, curr) => acc + curr.amount, 0)) >= 0 
                      ? 'text-emerald-600' : 'text-red-600'
                    }`}>
                      R$ {((userProfile?.initialBalance || 0) + 
                           expenses.filter(e => e.type === 'income' && new Date(e.date).getMonth() === new Date().getMonth() && new Date(e.date).getFullYear() === new Date().getFullYear()).reduce((acc, curr) => acc + curr.amount, 0) - 
                           expenses.filter(e => (e.type === 'expense' || !e.type) && new Date(e.date).getMonth() === new Date().getMonth() && new Date(e.date).getFullYear() === new Date().getFullYear()).reduce((acc, curr) => acc + curr.amount, 0))
                        .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-neutral-400 mb-1">No Cartão</p>
                    <p className="text-xl font-bold text-neutral-900">
                      R$ {expenses
                        .filter(e => e.paymentMethod === 'credit_card' && new Date(e.date).getMonth() === new Date().getMonth() && new Date(e.date).getFullYear() === new Date().getFullYear())
                        .reduce((acc, curr) => acc + curr.amount, 0)
                        .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
                    <h3 className="text-lg font-semibold mb-6">Lançamentos por Categoria</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getCategoryData()}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {getCategoryData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {getCategoryData().map((cat, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-neutral-500">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="truncate">{cat.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
                    <h3 className="text-lg font-semibold mb-6">Evolução Mensal</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getMonthlyData()}>
                          <XAxis dataKey="name" axisLine={false} tickLine={false} />
                          <YAxis hide />
                          <Tooltip cursor={{ fill: '#f5f5f5' }} />
                          <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'expenses' && (
              <motion.div 
                key="expenses"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Lançamentos</h2>
                  <button 
                    onClick={() => setIsAddingExpense(true)}
                    className="p-2 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
                
                {expenses.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-neutral-200">
                    <List className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                    <p className="text-neutral-500">Nenhum lançamento registrado ainda.</p>
                  </div>
                ) : (
                  expenses.map((expense) => (
                    <div 
                      key={expense.id}
                      onClick={() => setSelectedExpense(expense)}
                      className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between group cursor-pointer hover:border-emerald-200 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div 
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            expense.type === 'income' ? 'bg-emerald-50' : 'bg-red-50'
                          }`}
                        >
                          {expense.type === 'income' ? (
                            <PlusCircle className="w-6 h-6 text-emerald-600" />
                          ) : (
                            <Minus className="w-6 h-6 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-neutral-900">{expense.description || expense.category}</p>
                          <div className="flex items-center gap-2 text-xs text-neutral-400">
                            <span>{new Date(expense.date).toLocaleDateString('pt-BR')}</span>
                            <span>•</span>
                            <span>{expense.category}</span>
                            {expense.isRecurring && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Recorrente
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className={`font-bold ${expense.type === 'income' ? 'text-emerald-600' : 'text-neutral-900'}`}>
                          {expense.type === 'income' ? '+' : '-'} R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteExpense(expense.id);
                          }}
                          className="p-2 text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'bills' && (
              <motion.div 
                key="bills"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <h2 className="text-2xl font-bold mb-4">Faturas de Cartão</h2>
                <div className="bg-emerald-600 p-6 rounded-3xl text-white shadow-lg shadow-emerald-200 mb-6">
                  <p className="text-emerald-100 text-sm mb-1">Total em Faturas Abertas</p>
                  <p className="text-3xl font-bold">
                    R$ {expenses.filter(e => e.paymentMethod === 'credit_card').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                
                <div className="space-y-4">
                  {userCards.map(card => (
                    <div key={card.id} className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="font-bold text-lg">{card.bank} - {card.brand}</p>
                          <p className="text-sm text-neutral-500">Vencimento: Dia {card.dueDay}</p>
                        </div>
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">Aberta</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-neutral-500">Lançamento Atual</span>
                        <span className="font-bold text-neutral-900">
                          R$ {expenses.filter(e => e.cardId === card.id).reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                  {userCards.length === 0 && (
                    <div className="text-center py-10 bg-white rounded-3xl border border-dashed border-neutral-200">
                      <CreditCardIcon className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                      <p className="text-neutral-500 text-sm">Nenhum cartão cadastrado.</p>
                      <button 
                        onClick={() => setActiveTab('settings')}
                        className="text-emerald-600 text-xs font-bold mt-2"
                      >
                        Cadastrar Cartão
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'cashflow' && (() => {
              const cashFlow = getCashFlowData();
              return (
                <motion.div 
                  key="cashflow"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <h2 className="text-2xl font-bold mb-4">Fluxo de Caixa</h2>
                  
                  <div className="bg-white p-6 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Projeção Final do Mês</p>
                        <p className={`text-3xl font-bold ${cashFlow.finalBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          R$ {cashFlow.finalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${cashFlow.finalBalance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        <TrendingUp className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-6 border-t border-neutral-100">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Saldo Inicial</p>
                        <p className="text-lg font-bold text-neutral-900">R$ {cashFlow.initialBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Total Recebimentos</p>
                        <p className="text-lg font-bold text-emerald-600">R$ {cashFlow.totalProjectedIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase">Total Saídas</p>
                        <p className="text-lg font-bold text-red-600">R$ {cashFlow.totalProjectedExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>

                  {/* Credit Card Bills Projection */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold px-2">Faturas de Cartão (Previstas)</h3>
                    {cashFlow.cardBillDetails.length === 0 ? (
                      <div className="text-center py-10 bg-neutral-50 rounded-3xl border border-dashed border-neutral-200">
                        <CreditCardIcon className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                        <p className="text-neutral-500 text-sm">Nenhum cartão cadastrado.</p>
                      </div>
                    ) : (
                      cashFlow.cardBillDetails.map(({ card, amount }) => (
                        <div key={card.id} className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-neutral-50 rounded-xl flex items-center justify-center text-neutral-400">
                              <CreditCardIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-sm">{card.bank} - {card.brand}</p>
                              <p className="text-[10px] text-neutral-400 uppercase font-bold">Vence dia {card.dueDay}</p>
                            </div>
                          </div>
                          <p className="font-bold text-red-600">
                            R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-bold px-2">Itens Recorrentes</h3>
                    {expenses.filter(e => e.isRecurring).length === 0 ? (
                      <div className="text-center py-10 bg-neutral-50 rounded-3xl border border-dashed border-neutral-200">
                        <Calendar className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                        <p className="text-neutral-500 text-sm">Nenhum item recorrente cadastrado.</p>
                      </div>
                    ) : (
                      expenses.filter(e => e.isRecurring).map(item => (
                        <div 
                          key={item.id} 
                          onClick={() => setSelectedExpense(item)}
                          className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm flex items-center justify-between group cursor-pointer hover:border-emerald-200 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                              {item.type === 'income' ? <PlusCircle className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{item.description || item.category}</p>
                              <p className="text-[10px] text-neutral-400 uppercase font-bold">{item.frequency === 'monthly' ? 'Mensal' : item.frequency === 'weekly' ? 'Semanal' : 'Anual'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className={`font-bold ${item.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                              {item.type === 'income' ? '+' : '-'} R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteExpense(item.id);
                              }}
                              className="p-1 text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                    <div className="flex gap-3">
                      <Info className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-emerald-900">Como funciona o Fluxo?</p>
                        <p className="text-xs text-emerald-700 leading-relaxed">
                          O fluxo de caixa soma seus recebimentos e despesas já realizados no mês atual e adiciona os itens recorrentes que ainda não foram lançados, dando uma visão real de como suas contas terminarão o mês.
                        </p>
                        <p className="text-xs text-emerald-700 leading-relaxed mt-2">
                          As faturas de cartão são calculadas automaticamente com base no ciclo de fechamento e vencimento de cada cartão cadastrado.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })()}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
              >
                <h2 className="text-2xl font-bold mb-4">Configurações</h2>
                
                {/* Initial Balance Section */}
                <section className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <TrendingUp className="w-6 h-6 text-emerald-600" />
                    <h3 className="text-lg font-bold">Saldo Inicial</h3>
                  </div>
                  <div className="space-y-4">
                    <p className="text-xs text-neutral-500">Defina o saldo que você já possui em conta para que o fluxo de caixa seja mais preciso.</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">R$</span>
                        <input 
                          type="number" 
                          step="0.01"
                          value={initialBalanceInput}
                          onChange={(e) => setInitialBalanceInput(e.target.value)}
                          placeholder="0,00"
                          className="w-full pl-10 pr-4 py-3 bg-neutral-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500 font-bold"
                        />
                      </div>
                      <button 
                        onClick={handleUpdateInitialBalance}
                        disabled={isSavingBalance}
                        className="px-6 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSavingBalance ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                      </button>
                    </div>
                  </div>
                </section>

                {/* Scan Receipt Section */}
                <section className="bg-emerald-600 p-6 rounded-3xl text-white shadow-lg shadow-emerald-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Escanear Recibo</h3>
                    <p className="text-emerald-100 text-xs">Use IA para ler seus comprovantes</p>
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center hover:bg-white/30 transition-all"
                  >
                    <Camera className="w-6 h-6" />
                  </button>
                </section>

                {/* Categories Section */}
                <section className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Tag className="w-6 h-6 text-emerald-600" />
                      <h3 className="text-lg font-bold">Categorias</h3>
                    </div>
                    <button 
                      onClick={() => setIsEditingCategories(!isEditingCategories)}
                      className="text-emerald-600 text-sm font-bold"
                    >
                      {isEditingCategories ? 'Fechar' : 'Gerenciar'}
                    </button>
                  </div>

                  {isEditingCategories && (
                    <div className="space-y-4 mb-6">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Nova categoria"
                          className="flex-1 px-4 py-2 bg-neutral-50 rounded-xl border-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button 
                          onClick={handleAddCategory}
                          className="p-2 bg-emerald-600 text-white rounded-xl"
                        >
                          <Plus className="w-6 h-6" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {userCategories.map(cat => (
                          <div key={cat.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                            <span className="text-sm">{cat.name}</span>
                            <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-400">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {[...CATEGORIES, ...userCategories].map(cat => (
                      <span key={cat.id} className="px-3 py-1 bg-neutral-50 text-neutral-600 rounded-full text-xs">
                        {cat.name}
                      </span>
                    ))}
                  </div>
                </section>

                {/* Cards Section */}
                <section className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <CreditCardIcon className="w-6 h-6 text-emerald-600" />
                      <h3 className="text-lg font-bold">Meus Cartões</h3>
                    </div>
                    <button 
                      onClick={() => setIsEditingCards(!isEditingCards)}
                      className="text-emerald-600 text-sm font-bold"
                    >
                      {isEditingCards ? 'Fechar' : 'Adicionar'}
                    </button>
                  </div>

                  {isEditingCards && (
                    <div className="space-y-4 mb-6 p-4 bg-neutral-50 rounded-2xl">
                      <div className="grid grid-cols-2 gap-2">
                        <input 
                          type="text" 
                          value={newCardBank}
                          onChange={(e) => setNewCardBank(e.target.value)}
                          placeholder="Banco (ex: Nubank)"
                          className="px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <input 
                          type="text" 
                          value={newCardBrand}
                          onChange={(e) => setNewCardBrand(e.target.value)}
                          placeholder="Bandeira (ex: Visa)"
                          className="px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-neutral-400">Vencimento (Dia)</label>
                          <input 
                            type="number" 
                            value={newCardDueDay}
                            onChange={(e) => setNewCardDueDay(e.target.value)}
                            className="w-full px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-neutral-400">Fechamento (Dia)</label>
                          <input 
                            type="number" 
                            value={newCardClosingDay}
                            onChange={(e) => setNewCardClosingDay(e.target.value)}
                            className="w-full px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                      <input 
                        type="number" 
                        value={newCardLimit}
                        onChange={(e) => setNewCardLimit(e.target.value)}
                        placeholder="Limite (opcional)"
                        className="w-full px-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button 
                        onClick={handleAddCard}
                        className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold"
                      >
                        Salvar Cartão
                      </button>
                    </div>
                  )}

                  <div className="space-y-3">
                    {userCards.map(card => (
                      <div key={card.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl">
                        <div>
                          <p className="font-bold text-neutral-900">{card.bank}</p>
                          <p className="text-xs text-neutral-500">{card.brand} • Vence dia {card.dueDay}</p>
                        </div>
                        <button onClick={() => handleDeleteCard(card.id)} className="text-red-400 p-2">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-100 px-6 py-4 flex items-center justify-around z-40">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'dashboard' ? 'text-emerald-600' : 'text-neutral-400'}`}
          >
            <PieChartIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium">Início</span>
          </button>
          <button 
            onClick={() => setActiveTab('expenses')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'expenses' ? 'text-emerald-600' : 'text-neutral-400'}`}
          >
            <List className="w-6 h-6" />
            <span className="text-[10px] font-medium">Lançamentos</span>
          </button>
          <div className="relative -top-8">
            <button 
              onClick={() => setIsAddingExpense(true)}
              className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-emerald-200 active:scale-90 transition-all"
            >
              <Plus className="w-8 h-8" />
            </button>
          </div>
          <button 
            onClick={() => setActiveTab('bills')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'bills' ? 'text-emerald-600' : 'text-neutral-400'}`}
          >
            <CreditCard className="w-6 h-6" />
            <span className="text-[10px] font-medium">Cartão</span>
          </button>
          <button 
            onClick={() => setActiveTab('cashflow')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'cashflow' ? 'text-emerald-600' : 'text-neutral-400'}`}
          >
            <TrendingUp className="w-6 h-6" />
            <span className="text-[10px] font-medium">Fluxo</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'settings' ? 'text-emerald-600' : 'text-neutral-400'}`}
          >
            <Settings className="w-6 h-6" />
            <span className="text-[10px] font-medium">Mais</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileUpload}
          />
        </nav>

        {/* Add Expense Modal */}
        <AnimatePresence>
          {isAddingExpense && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAddingExpense(false)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="relative w-full max-w-lg bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold">{transactionType === 'expense' ? 'Novo Lançamento' : 'Novo Recebimento'}</h2>
                  <button 
                    onClick={() => setIsAddingExpense(false)}
                    className="p-2 bg-neutral-100 rounded-full text-neutral-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {isAnalyzing ? (
                  <div className="py-20 text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto" />
                    <p className="text-neutral-600 font-medium">Analisando recibo com IA...</p>
                    <p className="text-xs text-neutral-400">Extraindo valores, data e categoria automaticamente.</p>
                  </div>
                ) : (
                  <form onSubmit={handleAddExpense} className="space-y-6">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTransactionType('expense')}
                        className={`py-3 rounded-2xl text-xs font-bold transition-all border-2 ${
                          transactionType === 'expense' 
                            ? 'bg-red-50 border-red-500 text-red-700' 
                            : 'bg-neutral-50 border-transparent text-neutral-400'
                        }`}
                      >
                        Despesa
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransactionType('income')}
                        className={`py-3 rounded-2xl text-xs font-bold transition-all border-2 ${
                          transactionType === 'income' 
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                            : 'bg-neutral-50 border-transparent text-neutral-400'
                        }`}
                      >
                        Recebimento
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Valor</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-neutral-400">R$</span>
                        <input 
                          type="number" 
                          step="0.01"
                          required
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-neutral-50 border-none rounded-2xl text-2xl font-bold focus:ring-2 focus:ring-emerald-500 transition-all"
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Data</label>
                        <input 
                          type="date" 
                          required
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full px-4 py-3 bg-neutral-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Categoria</label>
                        <select 
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full px-4 py-3 bg-neutral-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all appearance-none"
                        >
                          {[...CATEGORIES, ...userCategories].map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Forma de Pagamento</label>
                      <div className="grid grid-cols-3 gap-2">
                        {PAYMENT_METHODS.map(method => (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => setPaymentMethod(method.id as PaymentMethod)}
                            className={`py-3 rounded-2xl text-xs font-bold transition-all border-2 ${
                              paymentMethod === method.id 
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                                : 'bg-neutral-50 border-transparent text-neutral-400'
                            }`}
                          >
                            {method.name.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {paymentMethod === 'credit_card' && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Selecionar Cartão</label>
                        <select 
                          value={cardId}
                          onChange={(e) => setCardId(e.target.value)}
                          required
                          className="w-full px-4 py-3 bg-neutral-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all appearance-none"
                        >
                          <option value="">Selecione um cartão</option>
                          {userCards.map(card => (
                            <option key={card.id} value={card.id}>{card.bank} ({card.brand})</option>
                          ))}
                        </select>
                        {userCards.length === 0 && (
                          <p className="text-[10px] text-red-500 mt-1">Você precisa cadastrar um cartão nas configurações primeiro.</p>
                        )}
                      </div>
                    )}

                    {paymentMethod === 'pix' && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Instituição Bancária</label>
                        <input 
                          type="text" 
                          value={pixBank}
                          onChange={(e) => setPixBank(e.target.value)}
                          placeholder="Ex: Nubank, Itaú..."
                          required
                          className="w-full px-4 py-3 bg-neutral-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Descrição</label>
                      <input 
                        type="text" 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-4 py-3 bg-neutral-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all"
                        placeholder={transactionType === 'expense' ? "Ex: Almoço no shopping" : "Ex: Salário Mensal"}
                      />
                    </div>

                    <div className="bg-neutral-50 p-4 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-neutral-400" />
                          <span className="text-sm font-semibold text-neutral-700">Lançamento Recorrente?</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsRecurring(!isRecurring)}
                          className={`w-12 h-6 rounded-full transition-all relative ${isRecurring ? 'bg-emerald-500' : 'bg-neutral-300'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isRecurring ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>

                      {isRecurring && (
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-200">
                          {(['weekly', 'monthly', 'yearly'] as const).map((freq) => (
                            <button
                              key={freq}
                              type="button"
                              onClick={() => setFrequency(freq)}
                              className={`py-2 rounded-xl text-[10px] font-bold uppercase transition-all border-2 ${
                                frequency === freq 
                                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                                  : 'bg-white border-transparent text-neutral-400'
                              }`}
                            >
                              {freq === 'weekly' ? 'Semanal' : freq === 'monthly' ? 'Mensal' : 'Anual'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button 
                      type="submit"
                      className={`w-full py-4 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all ${
                        transactionType === 'expense' ? 'bg-red-600 shadow-red-200 hover:bg-red-700' : 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700'
                      }`}
                    >
                      Salvar {transactionType === 'expense' ? 'Lançamento' : 'Recebimento'}
                    </button>
                  </form>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Detailed Expense Modal */}
        <AnimatePresence>
          {selectedExpense && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedExpense(null)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div 
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        selectedExpense.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {selectedExpense.type === 'income' ? <PlusCircle className="w-6 h-6" /> : <Minus className="w-6 h-6" />}
                    </div>
                    <h2 className="text-xl font-bold">{selectedExpense.type === 'income' ? 'Detalhes do Recebimento' : 'Detalhes do Lançamento'}</h2>
                  </div>
                  <button 
                    onClick={() => setSelectedExpense(null)}
                    className="p-2 bg-neutral-100 rounded-full text-neutral-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className={`text-center py-6 rounded-3xl ${selectedExpense.type === 'income' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <p className={`text-sm mb-1 ${selectedExpense.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>Valor Total</p>
                    <p className={`text-4xl font-bold ${selectedExpense.type === 'income' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {selectedExpense.type === 'income' ? '+' : '-'} R$ {selectedExpense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-neutral-50 rounded-2xl">
                      <p className="text-[10px] uppercase font-bold text-neutral-400 mb-1">Data</p>
                      <p className="text-sm font-semibold">{new Date(selectedExpense.date).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="p-4 bg-neutral-50 rounded-2xl">
                      <p className="text-[10px] uppercase font-bold text-neutral-400 mb-1">Categoria</p>
                      <p className="text-sm font-semibold">{selectedExpense.category}</p>
                    </div>
                    <div className="p-4 bg-neutral-50 rounded-2xl">
                      <p className="text-[10px] uppercase font-bold text-neutral-400 mb-1">Tipo</p>
                      <p className="text-sm font-semibold">{selectedExpense.type === 'income' ? 'Recebimento' : 'Despesa'}</p>
                    </div>
                    <div className="p-4 bg-neutral-50 rounded-2xl">
                      <p className="text-[10px] uppercase font-bold text-neutral-400 mb-1">Recorrência</p>
                      <p className="text-sm font-semibold">
                        {selectedExpense.isRecurring 
                          ? (selectedExpense.frequency === 'monthly' ? 'Mensal' : selectedExpense.frequency === 'weekly' ? 'Semanal' : 'Anual')
                          : 'Nenhuma'}
                      </p>
                    </div>
                    <div className="p-4 bg-neutral-50 rounded-2xl">
                      <p className="text-[10px] uppercase font-bold text-neutral-400 mb-1">Pagamento</p>
                      <p className="text-sm font-semibold">
                        {PAYMENT_METHODS.find(m => m.id === selectedExpense.paymentMethod)?.name}
                      </p>
                    </div>
                    <div className="p-4 bg-neutral-50 rounded-2xl">
                      <p className="text-[10px] uppercase font-bold text-neutral-400 mb-1">
                        {selectedExpense.paymentMethod === 'credit_card' ? 'Cartão' : selectedExpense.paymentMethod === 'pix' ? 'Banco PIX' : 'Info'}
                      </p>
                      <p className="text-sm font-semibold">
                        {selectedExpense.paymentMethod === 'credit_card' 
                          ? (selectedExpense.cardId ? userCards.find(c => c.id === selectedExpense.cardId)?.bank || 'Cartão' : 'N/A')
                          : selectedExpense.paymentMethod === 'pix'
                            ? selectedExpense.pixBank || 'N/A'
                            : 'N/A'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-neutral-50 rounded-2xl">
                    <p className="text-[10px] uppercase font-bold text-neutral-400 mb-1">Descrição</p>
                    <p className="text-sm">{selectedExpense.description || 'Sem descrição'}</p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-neutral-400 px-2">
                    <span>Criado em: {new Date(selectedExpense.createdAt).toLocaleString('pt-BR')}</span>
                    <span>ID: {selectedExpense.id.slice(0, 8)}</span>
                  </div>

                  <button 
                    onClick={() => {
                      handleDeleteExpense(selectedExpense.id);
                      setSelectedExpense(null);
                    }}
                    className="w-full py-4 text-red-500 font-bold hover:bg-red-50 rounded-2xl transition-all"
                  >
                    Excluir Lançamento
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
