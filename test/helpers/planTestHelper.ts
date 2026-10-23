export function formatPlanDbRow(row: any) {
  const limits = typeof row.limits === 'object' && row.limits !== null
    ? row.limits
    : (typeof row.limits === 'string' ? JSON.parse(row.limits) : {});

  const features = Array.isArray(row.features)
    ? row.features
    : (typeof row.features === 'string' ? JSON.parse(row.features) : []);

  const priceMonthly = Number(row.priceMonthly ?? row.price_monthly ?? 0);
  const priceYearly = Number(row.priceYearly ?? row.price_yearly ?? 0);

  return {
    id: String(row.id),
    name: row.name,
    slug: row.slug || '',
    tagline: row.tagline || '',
    description: row.description || '',
    priceMonthly,
    priceYearly,
    currency: row.currency || 'INR',
    features,
    limits,
    printLimitMonthly: limits.printLimitMonthly !== undefined ? Number(limits.printLimitMonthly) : (row.printLimit ? Number(row.printLimit) : 500),
    printLimit: limits.printLimitMonthly !== undefined ? Number(limits.printLimitMonthly) : (row.printLimit ? Number(row.printLimit) : 500),
    printerLimit: limits.printerLimit !== undefined ? Number(limits.printerLimit) : (row.printerLimit ? Number(row.printerLimit) : 2),
    storageLimitMb: limits.storageLimitMb !== undefined ? Number(limits.storageLimitMb) : (row.storageLimitGb ? Number(row.storageLimitGb) * 1024 : 5120),
    storageLimitGb: limits.storageLimitMb ? Math.round(Number(limits.storageLimitMb) / 1024) : (row.storageLimitGb ? Number(row.storageLimitGb) : 5),
    staffLimit: limits.staffLimit !== undefined ? Number(limits.staffLimit) : 2,
    maxUploadSizeMb: limits.maxUploadSizeMb !== undefined ? Number(limits.maxUploadSizeMb) : 35,
    fileRetentionHours: limits.fileRetentionHours !== undefined ? Number(limits.fileRetentionHours) : 48,
    isUnlimitedPrintJobs: Boolean(limits.isUnlimitedPrintJobs),
    isUnlimitedPrinters: Boolean(limits.isUnlimitedPrinters),
    isUnlimitedStorage: Boolean(limits.isUnlimitedStorage),
    isActive: Boolean(row.isActive ?? row.is_active),
    isPublic: row.isPublic !== undefined ? Boolean(row.isPublic) : Boolean(row.is_public ?? true),
    isPopular: Boolean(row.isPopular ?? row.is_popular),
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? 1),
    status: (row.isActive ?? row.is_active) ? 'ACTIVE' : 'DRAFT',
    version: 1,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : (row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : (row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString())
  };
}
