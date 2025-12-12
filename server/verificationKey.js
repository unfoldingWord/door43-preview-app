// Generate and store a persistent verification key in server memory
function generateAlphanumericCode(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charsLength = chars.length;
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * charsLength));
  }
  
  return result;
}

// Generate once when the module is loaded
const VERIFICATION_KEY = generateAlphanumericCode(64);

console.log('Generated verification key:', VERIFICATION_KEY);

export function getVerificationKey() {
  return VERIFICATION_KEY;
}
