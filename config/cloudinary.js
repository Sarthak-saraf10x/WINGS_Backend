const cloudinary = require('cloudinary').v2;

const isConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_CLOUD_NAME !== 'mock' &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_KEY !== 'mock' &&
  process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_API_SECRET !== 'mock';

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('Cloudinary successfully configured.');
} else {
  console.log('Cloudinary credentials missing or set to "mock". Operating in mock mode.');
}

/**
 * Uploads a file buffer or path to Cloudinary.
 * If Cloudinary is not configured, returns a mock placeholder URL.
 */
const uploadImage = async (fileBuffer, folder = 'wings_tours') => {
  if (!isConfigured) {
    // Generate a random Unsplash URL for realistic presentation
    const mockImages = [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800', // Goa
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800', // Hills
      'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800', // Devotional
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=800', // Lake
      'https://images.unsplash.com/photo-1544735716-392fe2489ffa?q=80&w=800'  // Beach
    ];
    const randomUrl = mockImages[Math.floor(Math.random() * mockImages.length)];
    return {
      secure_url: randomUrl,
      public_id: `mock_public_id_${Date.now()}`
    };
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: folder },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * Deletes an image from Cloudinary using its public ID.
 */
const deleteImage = async (publicId) => {
  if (!isConfigured || !publicId || publicId.startsWith('mock_')) {
    console.log(`Mock delete triggered for image public ID: ${publicId}`);
    return { result: 'ok' };
  }
  
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error(`Error deleting image from Cloudinary: ${error.message}`);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadImage,
  deleteImage,
  isConfigured
};
