// Netlify function: cache-html.js
const AWS = require('aws-sdk');
const Buffer = require('buffer').Buffer;

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.PREVIEW_S3_UPLOAD_ACCESS_KEY_ID,
  secretAccessKey: process.env.PREVIEW_S3_UPLOAD_SECRET_ACCESS_KEY,
  region: process.env.PREVIEW_S3_REGION,
});

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 400,
      message: 'Bad Request',
    };
  }

  const verification = event.queryStringParameters.verification;

  if (verification != process.env.VITE_PREVIEW_VERIFICATION_KEY) {
    return {
      statusCode: 401,
      message: 'Unauthorized',
    };
  }

  const path = event.queryStringParameters.path;

  if (!path || !path.startsWith('u/') || !path.endsWith('.json.gz')) {
    return {
      statusCode: 400,
      message: 'Invalid Parameters',
    };
  }

  // Create an S3 instance
  const s3 = new AWS.S3();

  // Upload to S3
  const params = {
    Bucket: process.env.VITE_PREVIEW_S3_BUCKET_NAME,
    Key: path,
    Body: Buffer.from(event.body, 'base64'),
    ContentType: 'application/zip',
    CacheControl: 'max-age=60',
  };

  try {
    const data = await s3.upload(params).promise();
    const response = {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Upload Success',
        data,
      }),
    };
    console.log('Upload Success: ', response);
    return response;
  } catch (err) {
    const response = {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Upload Failed',
        error: err.message,
      }),
    };
    console.log('Upload Failed: ', response);
    return response;
  }
};
