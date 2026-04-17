function normalizePublicKey(value) {
  var key = String(value || '').trim();
  if (!key) return '';
  return /^pk_(live|test)_[A-Za-z0-9]+$/.test(key) ? key : '';
}

export default function handler(req, res) {
  var paystackPublicKey = normalizePublicKey(
    process.env.BSF_PAYSTACK_PUBLIC_KEY ||
    process.env.PAYSTACK_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
  );

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  return res.status(200).json({
    paystackPublicKey: paystackPublicKey
  });
}
