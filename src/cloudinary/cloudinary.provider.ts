import { v2 as cloudinary } from 'cloudinary';

// Validate Cloudinary configuration on startup
const cloudName = process.env.CLOUD_NAME;
const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.warn('⚠️  Cloudinary credentials are not fully configured!');
  console.warn('   Missing:', {
    CLOUD_NAME: !cloudName,
    API_KEY: !apiKey,
    API_SECRET: !apiSecret,
  });
  console.warn('   Image uploads will fail until these are set in your .env file');
} else {
  console.log('✅ Cloudinary credentials found:', {
    cloud_name: cloudName,
    api_key: apiKey ? `${apiKey.substring(0, 4)}...` : 'missing',
  });
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  timeout: 60000, // 60 seconds timeout for all Cloudinary operations
  upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET, // Optional upload preset
  secure: true, // Use HTTPS
});

// Test Cloudinary connection on startup (non-blocking)
if (cloudName && apiKey && apiSecret) {
  cloudinary.api
    .ping()
    .then((result) => {
      console.log('✅ Cloudinary connection test successful:', result.status);
    })
    .catch((error) => {
      console.error('❌ Cloudinary connection test failed:', {
        message: error.message,
        http_code: error.http_code,
        name: error.name,
      });
      console.error(
        '   This usually means:',
        '\n   1. Incorrect Cloudinary credentials',
        '\n   2. Network connectivity issues',
        '\n   3. Firewall/proxy blocking the connection',
        '\n   4. Cloudinary service is down',
      );
    });
}

export { cloudinary };
