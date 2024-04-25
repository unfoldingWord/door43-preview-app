// Netlify function: save2s3.js
const AWS = require('aws-sdk');

exports.handler = async function(event, context) {
  // Check if the request method is POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 400, body: 'Bad Request' };
  }

  // Parse the JSON payload and the file path from the event body
  const { payload, path, verification } = JSON.parse(event.body);
  if (verification != process.env.VITE_SAVE2S3_VERIFICATION_KEY) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  // Convert the payload to a JSON string
  const jsonString = JSON.stringify(payload);

  const accessKeyId = process.env.PREVIEW_S3_UPLOAD_ACCESS_KEY_ID;
  const secretAccessKey = process.env.PREVIEW_S3_UPLOAD_SECRET_ACCESS_KEY;

  // Configure AWS SDK
  AWS.config.update({
    accessKeyId,
    secretAccessKey,
    region: 'us-west-2',
  });

  // Create an S3 instance
  const s3 = new AWS.S3();

  // Parameters for the S3 upload operation
  const uploadParams = {
    Bucket: 'preview.door43.org',
    Key: path,
    Body: jsonString,
    ContentType: 'application/json',
  };

  try {
    // Upload the JSON file to S3
    const data = await s3.upload(uploadParams).promise();
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, body: err.toString() };
  }
};
