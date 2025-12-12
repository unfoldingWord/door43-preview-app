// Provides client configuration from server environment variables
import { getVerificationKey } from '../verificationKey.js';

export default function configRoute(req, res) {
  res.json({
    dcsReadOnlyToken: process.env.DCS_READ_ONLY_TOKEN || '',
    previewVerificationKey: getVerificationKey(),
  });
}
