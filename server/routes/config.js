// Provides client configuration from server environment variables + app/DCS info
// the client needs before any resource is loaded (the "Built with" tray footer on a
// non-resource page): the resolved DCS server and the app version.
import { getVerificationKey } from '../verificationKey.js';
import { dcsApiUrlFromReq, dcsOrigin, dcsHostKeyword } from '../lib/dcs-host.js';
import pkg from '../../package.json' with { type: 'json' };

export default function configRoute(req, res) {
  const api = dcsApiUrlFromReq(req);
  res.json({
    dcsReadOnlyToken: process.env.DCS_READ_ONLY_TOKEN || '',
    previewVerificationKey: getVerificationKey(),
    server: { apiUrl: api, host: dcsOrigin(api), label: dcsHostKeyword(api) },
    appVersion: pkg.version,
  });
}
