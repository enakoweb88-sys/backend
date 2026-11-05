// Server-managed marker for dedicated cash identities; never a cash permission grant.
export function isCashOnlyAccount(responsibilities?: string | null): boolean {
  try { return JSON.parse(responsibilities || '{}').cashManaged === true; }
  catch { return false; }
}
