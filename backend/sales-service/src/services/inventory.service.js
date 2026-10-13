const axios = require('axios');

const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || `http://127.0.0.1:${process.env.INVENTORY_PORT || 5002}`;

// Fetch bottle details & validate stock status via Inventory Service API
const lookupBottleBySerial = async (serialNumber) => {
  try {
    const response = await axios.get(`${INVENTORY_SERVICE_URL}/stock/bottles/${encodeURIComponent(serialNumber)}`);
    if (response.data && response.data.success) {
      return response.data.data.bottle;
    }
    return null;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return null;
    }
    throw new Error(`Inventory Service Communication Error: ${error.message}`);
  }
};

// Update bottle status to SOLD or ADJUSTED via Inventory Service API (Rule 4 & 9)
const updateBottleStatus = async (serialNumber, newStatus, reason, adjustedBy) => {
  try {
    const response = await axios.post(`${INVENTORY_SERVICE_URL}/adjustments`, {
      serialNumber,
      newStatus,
      reason,
      adjustedBy
    });
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    throw new Error(`Failed to update bottle status in Inventory Service: ${errorMsg}`);
  }
};

// Fetch authoritative daily stock records and summary from Inventory Service
const getDailyStockTotals = async (shopId, businessDate) => {
  try {
    const response = await axios.get(`${INVENTORY_SERVICE_URL}/daily-stock`, {
      params: { date: businessDate, shopId },
      headers: { 'x-shop-id': shopId }
    });

    if (response.data && response.data.success) {
      const records = response.data.data.records || [];
      const isNewDay = response.data.data.isNewDay;
      const isCompleted = response.data.data.isCompleted;

      const totalBusiness = records.reduce((acc, r) => acc + (parseFloat(r.saleAmount) || 0), 0);
      const totalBottlesSold = records.reduce((acc, r) => acc + (parseInt(r.saleCount, 10) || 0), 0);
      const totalBottlesRemaining = records.reduce((acc, r) => acc + (parseInt(r.closingStock, 10) || 0), 0);

      return {
        success: true,
        isNewDay,
        isCompleted,
        records,
        totalBusiness,
        totalBottlesSold,
        totalBottlesRemaining
      };
    }
    return null;
  } catch (error) {
    console.warn(`[Inventory Stock Fetch Warning]: Failed to fetch stock for ${shopId} on ${businessDate}:`, error.message);
    return null;
  }
};

// Lock daily stock records for a shop and business date upon closing
const lockDailyStock = async (shopId, businessDate) => {
  try {
    const response = await axios.post(
      `${INVENTORY_SERVICE_URL}/daily-stock/lock`,
      { businessDate },
      { headers: { 'x-shop-id': shopId } }
    );
    return response.data;
  } catch (error) {
    console.warn(`[Inventory Lock Warning]: Failed to lock stock for ${shopId} on ${businessDate}:`, error.message);
    return null;
  }
};

// Unlock daily stock records for a shop and business date upon authorized reopening
const unlockDailyStock = async (shopId, businessDate) => {
  try {
    const response = await axios.post(
      `${INVENTORY_SERVICE_URL}/daily-stock/unlock`,
      { businessDate },
      { headers: { 'x-shop-id': shopId } }
    );
    return response.data;
  } catch (error) {
    console.warn(`[Inventory Unlock Warning]: Failed to unlock stock for ${shopId} on ${businessDate}:`, error.message);
    return null;
  }
};

module.exports = {
  lookupBottleBySerial,
  updateBottleStatus,
  lockDailyStock,
  unlockDailyStock,
  getDailyStockTotals
};
