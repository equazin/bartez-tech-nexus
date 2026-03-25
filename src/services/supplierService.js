// Supplier Service Layer
// This file abstracts supplier-related operations for future API integration.
// For now, it uses local data, but the UI should only use these functions.

import { products } from "@/models/products";

/**
 * Get all products from supplier (local for now)
 * @returns {Promise<Array>} List of products
 */
export async function getProducts() {
  // Simulate async fetch
  return Promise.resolve(products);
}

/**
 * Update stock for a product (local for now)
 * @param {number} productId
 * @param {number} newStock
 * @returns {Promise<boolean>} Success
 */
export async function updateStock(productId, newStock) {
  // Find and update locally (simulate API)
  const product = products.find(p => p.id === productId);
  if (product) {
    product.stock = newStock;
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}

/**
 * Update prices for a product (local for now)
 * @param {number} productId
 * @param {number} newPrice
 * @returns {Promise<boolean>} Success
 */
export async function updatePrices(productId, newPrice) {
  // Find and update locally (simulate API)
  const product = products.find(p => p.id === productId);
  if (product) {
    product.cost_price = newPrice;
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}

// In the future, replace the above logic with real API calls.
// The UI should only use these functions for supplier operations.
