// Provides client configuration from server environment variables
export default function configRoute(req, res) {
  res.json({
    dcsReadOnlyToken: process.env.DCS_READ_ONLY_TOKEN || '',
    previewVerificationKey: process.env.PREVIEW_VERIFICATION_KEY || '',
  });
}
