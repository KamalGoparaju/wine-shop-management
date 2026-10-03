const axios = require('axios');

const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:5002';

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

module.exports = {
  lookupBottleBySerial,
  updateBottleStatus
};
