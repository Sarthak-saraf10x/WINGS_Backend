const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Company = require('../models/Company');
const Vendor = require('../models/Vendor');
const AggregatorBooking = require('../models/AggregatorBooking');
const BrokerProfile = require('../models/BrokerProfile');
const mockStore = require('../config/aggregatorMockStore');

async function seedAggregatorData() {
  const uri = process.env.MONGO_URI || process.env.LOCAL_MONGO_URI || 'mongodb://127.0.0.1:27017/wing_tours_travels';

  console.log('Connecting to MongoDB at:', uri);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log('Connected to MongoDB successfully.');

    // 1. Broker Profile
    const profileCount = await BrokerProfile.countDocuments();
    if (profileCount === 0) {
      const p = { ...mockStore.mockBrokerProfile };
      delete p._id;
      await BrokerProfile.create(p);
      console.log('Seeded Broker Profile.');
    }

    // 2. Companies
    console.log(`Seeding ${mockStore.mockCompanies.length} Corporate Companies with Rate Cards...`);
    const companyIdMap = {};
    for (const c of mockStore.mockCompanies) {
      const compData = { ...c };
      const originalMockId = compData._id;
      delete compData._id;
      if (compData.rateCards) {
        compData.rateCards = compData.rateCards.map(rc => {
          const r = { ...rc };
          delete r._id;
          return r;
        });
      }
      const savedComp = await Company.findOneAndUpdate(
        { companyName: compData.companyName },
        compData,
        { upsert: true, new: true }
      );
      companyIdMap[originalMockId] = String(savedComp._id);
      companyIdMap[compData.companyName] = String(savedComp._id);
    }
    console.log('Companies seeded successfully.');

    // 3. Vendors
    console.log(`Seeding ${mockStore.mockVendors.length} Vendors and Fleet...`);
    const vendorIdMap = {};
    for (const v of mockStore.mockVendors) {
      const vData = { ...v };
      const originalMockId = vData._id;
      delete vData._id;
      if (vData.vehicles) {
        vData.vehicles = vData.vehicles.map(vh => {
          const vObj = { ...vh };
          delete vObj._id;
          return vObj;
        });
      }
      if (vData.drivers) {
        vData.drivers = vData.drivers.map(dr => {
          const dObj = { ...dr };
          delete dObj._id;
          return dObj;
        });
      }
      const savedVen = await Vendor.findOneAndUpdate(
        { vendorName: vData.vendorName },
        vData,
        { upsert: true, new: true }
      );
      vendorIdMap[originalMockId] = String(savedVen._id);
      vendorIdMap[vData.vendorName] = String(savedVen._id);
    }
    console.log('Vendors seeded successfully.');

    // 4. Bookings
    console.log(`Seeding ${mockStore.mockBookings.length} Bookings with various statuses...`);
    for (const b of mockStore.mockBookings) {
      const bData = { ...b };
      delete bData._id;
      // Map to real ObjectIds
      if (bData.clientId) {
        bData.clientId = companyIdMap[bData.clientId] || companyIdMap[bData.clientName] || bData.clientId;
      }
      if (bData.vendorId) {
        bData.vendorId = vendorIdMap[bData.vendorId] || vendorIdMap[bData.vendorName] || bData.vendorId;
      }
      await AggregatorBooking.findOneAndUpdate(
        { bookingNo: bData.bookingNo },
        bData,
        { upsert: true, new: true }
      );
    }
    console.log('Bookings seeded successfully.');

    console.log('--- ALL AGGREGATOR TEST DATA SEEDED SUCCESSFULLY ---');
    process.exit(0);
  } catch (err) {
    console.warn('Could not seed directly into MongoDB:', err.message);
    console.log('Note: aggregatorMockStore.js is already fully loaded with all test data for offline/mock mode!');
    process.exit(0);
  }
}

seedAggregatorData();
