/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Category } from './types';

export const CATEGORIES: Category[] = [
  { id: '1', name: 'Alimentação', icon: 'Utensils', color: '#ef4444' },
  { id: '2', name: 'Transporte', icon: 'Car', color: '#3b82f6' },
  { id: '3', name: 'Moradia', icon: 'Home', color: '#10b981' },
  { id: '4', name: 'Saúde', icon: 'Heart', color: '#f59e0b' },
  { id: '5', name: 'Educação', icon: 'Book', color: '#8b5cf6' },
  { id: '6', name: 'Lazer', icon: 'Gamepad', color: '#ec4899' },
  { id: '7', name: 'Compras', icon: 'ShoppingBag', color: '#6366f1' },
  { id: '8', name: 'Outros', icon: 'MoreHorizontal', color: '#6b7280' },
];

export const PAYMENT_METHODS = [
  { id: 'credit_card', name: 'Cartão de Crédito', icon: 'CreditCard' },
  { id: 'cash', name: 'Dinheiro', icon: 'Banknote' },
  { id: 'pix', name: 'PIX', icon: 'QrCode' },
];
