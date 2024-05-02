const AWS = require('aws-sdk');
const s3 = new AWS.S3();

// Configure AWS SDK
AWS.config.update({
  region: process.env.PREVIEW_S3_REGION,
  accessKeyId: process.env.PREVIEW_S3_UPLOAD_ACCESS_KEY_ID,
  secretAccessKey: process.env.PREVIEW_S3_UPLOAD_SECRET_ACCESS_KEY,
});

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let {owner, repo, bookId, ref} = event.queryStringParameters;
  if (!bookId) {
    bookId = "default";
  }
  if (!ref) {
    ref = "master";
  }

  console.log(owner, repo, bookId, ref)

  const absoluteKey = `u/${owner}/${repo}/${ref}/${bookId}.json.gzip`;

  try {
    await s3.headObject({
      Bucket: process.env.VITE_PREVIEW_S3_BUCKET_NAME,
      Key: absoluteKey,
    }).promise();

    // If the object exists, headObject will succeed and we can return the download link
    const downloadLink = `https://s3.us-west-2.amazonaws.com/${process.env.VITE_PREVIEW_S3_BUCKET_NAME}/${absoluteKey}`;
    console.log("HERE1", downloadLink)
    return {
      statusCode: 200,
      body: downloadLink,
    };
  } catch (error) {
    // Pass
  }

  const params = {
    Bucket: process.env.VITE_PREVIEW_S3_BUCKET_NAME, // replace with your bucket name
    Prefix: `u/${owner}/${repo}/`,
  };

  try {
    const data = await s3.listObjectsV2(params).promise();
    const versions = new Set(data.Contents.filter(item => item.Key.endsWith(`/${bookId}.json.gzip`)).map(item => item.Key.split('/')[3])); // get the version part of the key
    console.log("VERSIONS", versions)
    if (versions.size === 0) {
      return {
        statusCode: 404,
        body: 'No versions found',
      };
    }

    const latestVersions = Array.from(versions).sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));
    console.log("LATEST VERSIONS", latestVersions)
    const index = latestVersions.findIndex(version => version.localeCompare(ref, undefined, {numeric: true}) < 0);
    console.log("INDEX", index)
    const previousVersion = index !== -1 ? latestVersions[index] : latestVersions.includes('master') ? 'master' : latestVersions[0];
    const downloadLink = `https://s3.us-west-2.amazonaws.com/${process.env.VITE_PREVIEW_S3_BUCKET_NAME}/u/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(previousVersion)}/${bookId}.json.gzip`;
    console.log("HERE2", downloadLink)
    return {
      statusCode: 200,
      body: downloadLink,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: 'Failed to list objects: ' + error.message,
    };
  }
};