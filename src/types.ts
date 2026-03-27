/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PaymentMethod = 'credit_card' | 'cash' | 'pix';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  uid?: string; // Optional for default categories
}

export interface Card {
  id: string;
  bank: string;
  brand: string;
  dueDay: number;
  closingDay: number;
  limit: number;
  uid: string;
}

export type TransactionType = 'expense' | 'income';
export type Frequency = 'none' | 'monthly' | 'weekly' | 'yearly';

export interface Expense {
  id: string;
  amount: number;
  category: string;
  date: string;
  paymentMethod: PaymentMethod;
  description: string;
  photoUrl?: string;
  cardId?: string; // Reference to Card
  pixBank?: string; // Bank for PIX payments
  cardBillId?: string;
  uid: string;
  createdAt: string;
  type: TransactionType;
  isRecurring: boolean;
  frequency?: Frequency;
}

export interface CardBill {
  id: string;
  month: number;
  year: number;
  dueDate: string;
  totalAmount: number;
  status: 'open' | 'paid';
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  initialBalance?: number;
  updatedAt?: any;
}
