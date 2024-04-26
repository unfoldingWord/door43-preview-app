// Netlify function: save2s3.js
const AWS = require('aws-sdk');
const multer = require('multer');
const JSZip = require('jszip');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const req = multer().any()(event, context, (error) => {
    if (error instanceof multer.MulterError) {
      // A Multer error occurred when uploading.
      console.error('Multer error:', error);
    } else if (error) {
      // An unknown error occurred when uploading.
      console.error('Unknown error:', error);
    }
  });

  const file = req.files.find((f) => f.fieldname === 'file');
  const verification = req.body.verification;
  const path = req.body.path;
  
  if (verification !== process.env.VITE_SAVE2S3_VERIFICATION_KEY) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const accessKeyId = process.env.PREVIEW_S3_UPLOAD_ACCESS_KEY_ID;
  const secretAccessKey = process.env.PREVIEW_S3_UPLOAD_SECRET_ACCESS_KEY;

  // Configure AWS SDK
  AWS.config.update({
    accessKeyId,
    secretAccessKey,
    region: process.env.PREVIEW_S3_REGION,
  });

  // Create an S3 instance
  const s3 = new AWS.S3();

  // Unzip the file
  const zip = new JSZip();
  const contents = await zip.loadAsync(file.buffer);
  const dataJson = await contents.file('data.json').async('string');

  // Upload to S3
  const params = {
    Bucket: process.env.PREVIEW_S3_BUCKET_NAME,
    Key: path,
    Body: dataJson,
  };

  try {
    const data = await s3.upload(params).promise();
    console.log('Upload Success', data);
  } catch (err) {
    console.error('Error:', err);
  }

};
