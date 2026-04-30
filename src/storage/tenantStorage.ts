let cachedBaseUrl: string | null = null;

export const saveBaseUrl = async (url: string) => {
  cachedBaseUrl = url;
};

export const getBaseUrl = async () => cachedBaseUrl;
