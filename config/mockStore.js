let mockBookings = [
  {
    _id: 'mock_b1',
    name: 'Sarthak Sharma',
    phone: '9876543210',
    pickup: 'Mumbai Airport T2',
    destination: 'Goa',
    travelDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    people: 4,
    service: 'Tour Packages',
    message: 'Interested in Goa Tour Package. Please send details.',
    status: 'Pending',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000)
  },
  {
    _id: 'mock_b2',
    name: 'Rahul Verma',
    phone: '8877665544',
    pickup: 'Pune Station',
    destination: 'Mahabaleshwar',
    travelDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    people: 6,
    service: 'Outstation Trips',
    message: 'Need a comfortable SUV for family trip.',
    status: 'Confirmed',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000)
  },
  {
    _id: 'mock_b3',
    name: 'Pooja Patel',
    phone: '9988776655',
    pickup: 'Lonavala',
    destination: 'Lonavala Local',
    travelDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    people: 2,
    service: 'Hourly Rentals',
    message: 'Lonavala Package details needed.',
    status: 'Completed',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  }
];

let mockEnquiries = [
  {
    _id: 'mock_e1',
    name: 'Anjali Gupta',
    phone: '9123456789',
    email: 'anjali@example.com',
    message: 'Do you provide airport transfers from Shirdi?',
    status: 'Pending',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
  },
  {
    _id: 'mock_e2',
    name: 'Vikram Singh',
    phone: '9812763450',
    email: 'vikram@example.com',
    message: 'What are the charges for 12 hours rental in Pune?',
    status: 'Read',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
  }
];

let mockPackages = [
  {
    _id: 'mock_p1',
    title: 'Goa Tour Package',
    duration: '3 Nights / 4 Days',
    rating: 4.8,
    price: '₹7,999 per person',
    description: 'Explore the beautiful beaches, vibrant nightlife, and historical churches of Goa with our premium package.',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=600',
    isFeatured: true,
    isActive: true,
    badge: 'Popular',
    category: 'custom'
  },
  {
    _id: 'mock_p2',
    title: 'Mahabaleshwar Tour Package',
    duration: '2 Nights / 3 Days',
    rating: 4.7,
    price: '₹5,499 per person',
    description: 'Enjoy the scenic viewpoints, strawberry farms, and pleasant climate of Mahabaleshwar and Panchgani.',
    imageUrl: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=600',
    isFeatured: true,
    isActive: true,
    badge: 'Best Seller',
    category: 'custom'
  }
];

let mockGallery = [
  {
    _id: 'mock_g1',
    title: 'Luxury SUV Ertiga',
    category: 'cars',
    imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=600',
    description: 'Our premium Ertiga ready for outstation trips.'
  },
  {
    _id: 'mock_g2',
    title: 'Tempo Traveller 17 Seater',
    category: 'buses',
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=600',
    description: 'Spacious passenger van for group travel.'
  }
];

let mockReviews = [
  {
    _id: 'mock_r1',
    authorName: "Anjali Sharma",
    authorPhotoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150",
    rating: 5,
    text: "Wings Travels provided an absolute 5-star service for our family trip to Goa! The Ertiga cab was spotless, the driver Satish was polite, and his navigation skills were excellent. Highly recommended for family outings.",
    relativeTimeDescription: "2 weeks ago",
    tripType: "Mumbai to Goa (Family Trip)"
  },
  {
    _id: 'mock_r2',
    authorName: "Rohan Deshmukh",
    authorPhotoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150",
    rating: 5,
    text: "We booked a 17-seater Tempo Traveller for a corporate weekend picnic to Lonavala. The booking process was seamless, rates were very transparent, and the vehicle was extremely spacious and comfortable.",
    relativeTimeDescription: "1 month ago",
    tripType: "Pune to Lonavala (Corporate Trip)"
  },
  {
    _id: 'mock_r3',
    authorName: "Vikram Mehta",
    authorPhotoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150",
    rating: 5,
    text: "Every time I fly down for work, Wings is my default airport pick-up and local rental choice. Reliable, clean sedans, punctual drivers who understand corporate requirements perfectly.",
    relativeTimeDescription: "3 months ago",
    tripType: "Airport Transfers & Rental"
  },
  {
    _id: 'mock_r4',
    authorName: "Sunita Rao",
    authorPhotoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=150",
    rating: 5,
    text: "Our spiritual journey to Shirdi was incredibly peaceful. The driver drove very carefully, took care of my senior citizen parents, and suggested the best routes and restaurants on the way.",
    relativeTimeDescription: "4 months ago",
    tripType: "Mumbai to Shirdi (Devotional Trip)"
  },
  {
    _id: 'mock_r5',
    authorName: "Abhishek Pathak",
    authorPhotoUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=150",
    rating: 5,
    text: "Organized a customized Konkan tour package through Wings. The custom itinerary was well planned. High-end hotels, reliable transport, zero stress. Highly professional services!",
    relativeTimeDescription: "5 months ago",
    tripType: "Konkan Coastal Explorer"
  },
  {
    _id: 'mock_r6',
    authorName: "Prisha Patil",
    authorPhotoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150",
    rating: 5,
    text: "Prompt reply on WhatsApp, quick quotation, and immediate booking. The Mahabaleshwar tour was an absolute breeze. Very good quality SUVs at reasonable packages. Definite recommendation.",
    relativeTimeDescription: "6 months ago",
    tripType: "Thane to Mahabaleshwar"
  }
];

let mockVehicles = [
  {
    _id: 'mock_v1',
    name: 'Toyota Innova Crysta',
    type: 'Innova',
    capacity: 7,
    fuelType: 'Diesel',
    transmission: 'Manual',
    ac: true,
    features: 'GPS Tracking, Spacious Legroom, Charging Ports',
    pricePerKm: '₹14/km',
    imageUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=600',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'mock_v2',
    name: 'Maruti Suzuki Ertiga',
    type: 'Ertiga',
    capacity: 7,
    fuelType: 'CNG',
    transmission: 'Manual',
    ac: true,
    features: 'Music System, Comfortable Seats, Family Friendly',
    pricePerKm: '₹12/km',
    imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=600',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'mock_v3',
    name: 'Force Tempo Traveller 17',
    type: 'Tempo Traveller',
    capacity: 17,
    fuelType: 'Diesel',
    transmission: 'Manual',
    ac: true,
    features: 'Push-back Seats, Luggage Rack, Large Windows',
    pricePerKm: '₹22/km',
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=600',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

let mockRentals = [
  {
    _id: 'mock_rent1',
    name: 'Swift Dzire Sedan',
    type: 'Sedan',
    capacity: 4,
    ac: true,
    ratePerKm: '₹11/km',
    ratePerDay: '₹2,500/day',
    ratePerHour: '₹300/hr',
    minFare: '₹500 minimum',
    features: 'Fuel Efficient, Comfortable, Airport Transfers',
    imageUrl: 'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?q=80&w=600',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'mock_rent2',
    name: 'Toyota Innova Crysta',
    type: 'Innova',
    capacity: 7,
    ac: true,
    ratePerKm: '₹14/km',
    ratePerDay: '₹4,000/day',
    ratePerHour: '₹450/hr',
    minFare: '₹700 minimum',
    features: 'Spacious, GPS Tracking, Charging Ports',
    imageUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=600',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'mock_rent3',
    name: 'Maruti Suzuki Ertiga',
    type: 'Ertiga',
    capacity: 7,
    ac: true,
    ratePerKm: '₹12/km',
    ratePerDay: '₹3,200/day',
    ratePerHour: '₹380/hr',
    minFare: '₹600 minimum',
    features: 'Family Friendly, CNG, Music System',
    imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=600',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'mock_rent4',
    name: 'Toyota Fortuner',
    type: 'SUV',
    capacity: 7,
    ac: true,
    ratePerKm: '₹18/km',
    ratePerDay: '₹6,500/day',
    ratePerHour: '₹750/hr',
    minFare: '₹1,200 minimum',
    features: 'Luxury Interior, 4x4 Drive, Premium Audio',
    imageUrl: 'https://images.unsplash.com/photo-1533106418989-88406c7cc8ca?q=80&w=600',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'mock_rent5',
    name: 'Force Tempo Traveller',
    type: 'Tempo Traveller',
    capacity: 17,
    ac: true,
    ratePerKm: '₹22/km',
    ratePerDay: '₹8,000/day',
    ratePerHour: '₹900/hr',
    minFare: '₹2,000 minimum',
    features: 'Push-back Seats, Luggage Rack, Group Travel',
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=600',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'mock_rent6',
    name: 'Volvo AC Bus 45-Seater',
    type: 'Luxury Bus',
    capacity: 45,
    ac: true,
    ratePerKm: '₹45/km',
    ratePerDay: '₹18,000/day',
    ratePerHour: '',
    minFare: '₹5,000 minimum',
    features: 'Recliner Seats, Infotainment, Events & Weddings',
    imageUrl: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?q=80&w=600',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

module.exports = {
  mockBookings,
  mockEnquiries,
  mockPackages,
  mockGallery,
  mockReviews,
  mockVehicles,
  mockRentals
};
