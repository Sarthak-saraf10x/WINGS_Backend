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
    authorName: 'Amit Shah',
    authorPhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150',
    rating: 5,
    text: 'Excellent service! Driver was very polite and punctual. Highly recommend Wings Tours.',
    tripType: 'Verified Customer',
    relativeTimeDescription: '2 days ago'
  }
];

module.exports = {
  mockBookings,
  mockEnquiries,
  mockPackages,
  mockGallery,
  mockReviews
};
