// Netlify function: cache-html.js
const AWS = require('aws-sdk');
const Buffer = require('buffer').Buffer;

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    console.log("BAD REQUEST", event.queryStringParameters, event.httpMethod)
    return {
      statusCode: 400,
      message: 'Bad Request',
    };
  }

  const verification = event.queryStringParameters.verification;

  console.l
  if (verification != process.env.VITE_PREVIEW_VERIFICATION_KEY) {
    console.log("UNAUTHORIZED", event.queryStringParameters, event.httpMethod)
    return {
      statusCode: 401,
      message: 'Unauthorized',
    };
  }

  const path = event.queryStringParameters.path;

  if (!path || ! path.startsWith("u/") || ! path.endsWith(".gzip")) {
    console.log("INVALID PARAMETERS", event.queryStringParameters, event.httpMethod)
    return {
      statusCode: 400,
      message: 'Invalid Parameters',
    };  
  }

  const accessKeyId = process.env.PREVIEW_S3_UPLOAD_ACCESS_KEY_ID;
  const secretAccessKey = process.env.PREVIEW_S3_UPLOAD_SECRET_ACCESS_KEY;

  // Configure AWS SDK
  AWS.config.update({
    accessKeyId,
    secretAccessKey,
    region: process.env.VITE_PREVIEW_S3_REGION,
  });

  // Create an S3 instance
  const s3 = new AWS.S3();

  // Upload to S3
  const params = {
    Bucket: process.env.VITE_PREVIEW_S3_BUCKET_NAME,
    Key: path,
    Body: Buffer.from(event.body, 'base64'),
    ContentType: 'application/zip',
  };

  console.log("S3 PARAMS", {
    Bucket: params.Bucket,
    Key: params.Key,
    Body: "<binary file>, size: " + Buffer.from(event.body, 'base64').length,
    ContentType: params.ContentType,
  });

  try {
    const data = await s3.upload(params).promise();
    const response = {
      statusCode: 200,
      body: JSON.stringify({
      message: 'Upload Success',
      data,
      }),
    };
    console.log("Upload Success: ", response);
    return response;
  } catch (err) {
    const response = {
      statusCode: 400,
      body: JSON.stringify({
      message: 'Upload Failed',
      error: err.message
      }),
    };
    console.log("Upload Failed: ", response);
    return response;
  }
};
