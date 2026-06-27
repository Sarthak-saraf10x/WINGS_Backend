const cron = require('node-cron');
const axios = require('axios');
const Review = require('../models/Review');

const DEFAULT_MOCK_REVIEWS = [
  {
    authorName: "Anjali Sharma",
    authorPhotoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150",
    rating: 5,
    text: "Wings Travels provided an absolute 5-star service for our family trip to Goa! The Ertiga cab was spotless, the driver Satish was polite, and his navigation skills were excellent. Highly recommended for family outings.",
    relativeTimeDescription: "2 weeks ago",
    tripType: "Mumbai to Goa (Family Trip)",
    isGoogleReview: true
  },
  {
    authorName: "Rohan Deshmukh",
    authorPhotoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150",
    rating: 5,
    text: "We booked a 17-seater Tempo Traveller for a corporate weekend picnic to Lonavala. The booking process was seamless, rates were very transparent, and the vehicle was extremely spacious and comfortable.",
    relativeTimeDescription: "1 month ago",
    tripType: "Pune to Lonavala (Corporate Trip)",
    isGoogleReview: true
  },
  {
    authorName: "Vikram Mehta",
    authorPhotoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150",
    rating: 5,
    text: "Every time I fly down for work, Wings is my default airport pick-up and local rental choice. Reliable, clean sedans, punctual drivers who understand corporate requirements perfectly.",
    relativeTimeDescription: "3 months ago",
    tripType: "Airport Transfers & Rental",
    isGoogleReview: true
  },
  {
    authorName: "Sunita Rao",
    authorPhotoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=150",
    rating: 5,
    text: "Our spiritual journey to Shirdi was incredibly peaceful. The driver drove very carefully, took care of my senior citizen parents, and suggested the best routes and restaurants on the way.",
    relativeTimeDescription: "4 months ago",
    tripType: "Mumbai to Shirdi (Devotional Trip)",
    isGoogleReview: true
  },
  {
    authorName: "Abhishek Pathak",
    authorPhotoUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=150",
    rating: 5,
    text: "Organized a customized Konkan tour package through Wings. The custom itinerary was well planned. High-end hotels, reliable transport, zero stress. Highly professional services!",
    relativeTimeDescription: "5 months ago",
    tripType: "Konkan Coastal Explorer",
    isGoogleReview: true
  },
  {
    authorName: "Prisha Patil",
    authorPhotoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150",
    rating: 5,
    text: "Prompt reply on WhatsApp, quick quotation, and immediate booking. The Mahabaleshwar tour was an absolute breeze. Very good quality SUVs at reasonable packages. Definite recommendation.",
    relativeTimeDescription: "6 months ago",
    tripType: "Thane to Mahabaleshwar",
    isGoogleReview: true
  }
];

/**
 * Fetches reviews from Google Places API and updates the local cache.
 * If Places API is not configured, seeds local database with high-quality mock reviews.
 */
const fetchGoogleReviews = async () => {
  console.log('🔄 Checking Google Places API for updated reviews...');
  
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  
  const isApiConfigured = apiKey && apiKey !== 'mock' && placeId && placeId !== 'mock';

  if (!isApiConfigured) {
    console.log('⚠️ Places API is not configured or in mock mode. Seeding cached mock reviews...');
    try {
      const count = await Review.countDocuments({ isGoogleReview: true });
      if (count === 0) {
        await Review.insertMany(DEFAULT_MOCK_REVIEWS);
        console.log(`✅ Successfully seeded ${DEFAULT_MOCK_REVIEWS.length} mock reviews.`);
      } else {
        console.log('ℹ️ Reviews already cached in database. Skipping seed.');
      }
    } catch (err) {
      console.error(`Error seeding mock reviews: ${err.message}`);
    }
    return;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${apiKey}`;
    const response = await axios.get(url);
    
    if (response.data.status !== 'OK') {
      throw new Error(`Google API returned status: ${response.data.status}. Msg: ${response.data.error_message || 'Unknown error'}`);
    }

    const reviews = response.data.result.reviews || [];
    console.log(`Found ${reviews.length} reviews from Google Places API.`);

    // Extract, format, and save 5-star reviews
    const fiveStarReviews = reviews
      .filter(rev => rev.rating === 5)
      .map(rev => ({
        authorName: rev.author_name,
        authorPhotoUrl: rev.profile_photo_url,
        rating: rev.rating,
        text: rev.text,
        relativeTimeDescription: rev.relative_time_description,
        time: rev.time,
        isGoogleReview: true,
        tripType: 'Verified Customer'
      }));

    if (fiveStarReviews.length > 0) {
      // Overwrite cached reviews in MongoDB
      // First, delete old Google reviews
      await Review.deleteMany({ isGoogleReview: true });
      // Insert new ones
      await Review.insertMany(fiveStarReviews);
      console.log(`✅ Successfully cached ${fiveStarReviews.length} 5-star reviews from Google Places API.`);
    } else {
      console.log('ℹ️ No 5-star reviews found in the latest fetch. Retaining current database cache.');
    }
  } catch (error) {
    console.error(`❌ Error fetching reviews from Google Places API: ${error.message}`);
    
    // Safety check: ensure at least mock reviews exist if connection fails
    const count = await Review.countDocuments({});
    if (count === 0) {
      await Review.insertMany(DEFAULT_MOCK_REVIEWS);
      console.log(`✅ Connection failed. Seeded fallback reviews.`);
    }
  }
};

/**
 * Initializes and schedules the review update cron job.
 */
const initCronJobs = () => {
  // Schedule to run once every 24 hours (at midnight)
  cron.schedule('0 0 * * *', () => {
    console.log('⏰ Cron Triggered: Fetching Google Places reviews...');
    fetchGoogleReviews();
  });
  console.log('⏰ Scheduled Google Reviews Cron Job (runs once every 24 hours)');

  // Run once immediately on startup to populate database
  fetchGoogleReviews();
};

module.exports = {
  initCronJobs,
  fetchGoogleReviews
};
