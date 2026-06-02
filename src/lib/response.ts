export function successResponse<T>(data: T, statusCode = 200) {
  return { success: true, data };
}

export function paginatedResponse<T>(
  data: T[],
  meta: { total: number; page: number; limit: number },
) {
  return {
    success: true,
    data,
    meta: {
      total: meta.total,
      page: meta.page,
      limit: meta.limit,
      pages: Math.ceil(meta.total / meta.limit),
    },
  };
}
