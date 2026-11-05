// Legacy maintenance utilities are never part of automated verification.
exports.databaseUrl = () => {
  const value = process.env.DATABASE_URL;
  if (!value) throw Error('Explicit maintenance database configuration is required');
  const url = new URL(value);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw Error('Legacy maintenance scripts are restricted to local disposable databases; use a separately reviewed migration for hosted systems');
  return value;
};
