/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export interface ReceiptInfo {
  amount: number;
  date: string;
  category: string;
  description: string;
  paymentMethod: 'credit_card' | 'cash' | 'pix';
}

export async function analyzeReceipt(base64Image: string): Promise<ReceiptInfo | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image,
              },
            },
            {
              text: "Analyze this receipt and extract the total amount, date, category, description, and payment method. Return the result in JSON format.",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER, description: "Total amount of the receipt." },
            date: { type: Type.STRING, description: "Date of the receipt in YYYY-MM-DD format." },
            category: { type: Type.STRING, description: "One of: Alimentação, Transporte, Moradia, Saúde, Educação, Lazer, Compras, Outros." },
            description: { type: Type.STRING, description: "Short description of the receipt." },
            paymentMethod: { type: Type.STRING, description: "One of: credit_card, cash, pix." },
          },
          required: ["amount", "date", "category", "description", "paymentMethod"],
        },
      },
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text) as ReceiptInfo;
    }
    return null;
  } catch (error) {
    console.error("Error analyzing receipt:", error);
    return null;
  }
}
