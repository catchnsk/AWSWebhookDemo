import axios, { AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add API key to requests
api.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem('apiKey');
  if (apiKey) {
    config.headers['X-API-Key'] = apiKey;
  }
  return config;
});

// Handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('apiKey');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface Producer {
  id: string;
  name: string;
  contactEmail: string;
  status: string;
  totalEventsPublished: number;
  totalSchemasRegistered: number;
  createdAt: string;
}

export interface Schema {
  id: string;
  producerId: string;
  name: string;
  eventType: string;
  version: string;
  schemaFormat?: string;
  schemaDefinition: any;
  examplePayload?: any;
  isPublic: boolean;
  subscriptionCount: number;
  status: string;
  createdAt: string;
  schemaId?: string;
  domain?: 'payment' | 'account' | 'apply';
  partnerUserId?: string;
  systemUserId?: string;
}

export interface Subscriber {
  id: string;
  name: string;
  email: string;
  webhookUrl?: string;
  webhook_url?: string;
  status: string;
  successCount?: number;
  createdAt: string;
}

export interface Subscription {
  id: string;
  subscriberId: string;
  schemaId: string;
  webhookUrl: string;
  maxRetries: number;
  backoffStrategy: string;
  enabled: boolean;
  status: string;
  createdAt: string;
  schema?: Schema;
}

export interface EventMessage {
  eventId: string;
  producerId: string;
  schemaId: string;
  eventType: string;
  payload: any;
  subscriberCount: number;
  deliveriesQueued: number;
  deliveriesCompleted: number;
  deliveriesFailed: number;
  createdAt: string;
}

export interface DeliveryLog {
  id: string;
  deliveryId: string;
  eventId: string;
  subscriptionId: string;
  status: string;
  responseStatusCode?: number;
  errorMessage?: string;
  errorCategory?: string;
  retryAttempt: number;
  nextRetryAt?: string;
  latencyMs?: number;
  deliveredAt?: string;
  createdAt: string;
}

export interface DLQEntry {
  id: string;
  deliveryLogId: string;
  finalError: string;
  totalAttempts: number;
  payload: any;
  movedToDlqAt: string;
  resolved: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'viewer' | 'tester' | 'rtb';
  status: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Producer APIs
export const producerAPI = {
  onboard: async (data: {
    name: string;
    contactEmail: string;
    contactName?: string;
    department?: string;
  }): Promise<{ producer: Producer; apiKey: string }> => {
    const response = await api.post('/producers/onboard', data);
    return response.data;
  },
};

// Schema APIs
export const schemaAPI = {
  register: async (data: {
    name: string;
    eventType: string;
    version: string;
    schemaFormat: string;
    schemaDefinition: any;
    description?: string;
    isPublic?: boolean;
    domain?: string;
    systemUserId?: string;
    examplePayload?: any;
  }): Promise<{ schema: Schema }> => {
    const response = await api.post('/schemas/register', data);
    return response.data;
  },

  list: async (params?: { page?: number; limit?: number }): Promise<{ schemas: Schema[]; total: number }> => {
    const response = await api.get('/schemas', { params });
    const data = response.data.data || response.data;
    return {
      schemas: data.schemas || data.data || [],
      total: data.pagination?.total || data.total || 0
    };
  },

  listMarketplace: async (params?: { page?: number; limit?: number; eventType?: string }): Promise<{ schemas: Schema[]; total: number }> => {
    const response = await api.get('/schemas/marketplace', { params });
    return response.data;
  },

  get: async (schemaId: string): Promise<{ schema: Schema }> => {
    const response = await api.get(`/schemas/${schemaId}`);
    return response.data;
  },

  validate: async (schemaId: string, payload: any): Promise<{ valid: boolean; errors: string[] }> => {
    const response = await api.post(`/schemas/${schemaId}/validate`, { payload });
    return response.data;
  },
};

// Subscriber APIs
export const subscriberAPI = {
  list: async (): Promise<{ subscribers: Subscriber[] }> => {
    const response = await api.get('/subscribers');
    return response.data;
  },

  update: async (subscriberId: string, data: {
    name?: string;
    email?: string;
    webhookUrl?: string;
    status?: string;
  }): Promise<{ subscriber: Subscriber }> => {
    const response = await api.patch(`/subscribers/${subscriberId}`, data);
    return response.data;
  },
};

// Subscription APIs
export const subscriptionAPI = {
  subscribe: async (data: {
    schemaId: string;
    subscriberId?: string;
    webhookUrl?: string;
    maxRetries?: number;
    backoffStrategy?: string;
  }): Promise<{ subscription: Subscription }> => {
    const response = await api.post('/subscriptions/subscribe', data);
    return response.data;
  },

  list: async (params?: { page?: number; limit?: number }): Promise<{ subscriptions: Subscription[]; total: number }> => {
    const response = await api.get('/subscriptions', { params });
    const data = response.data.data || response.data;
    return {
      subscriptions: data.subscriptions || data.data || [],
      total: data.pagination?.total || data.total || 0
    };
  },

  get: async (subscriptionId: string): Promise<{ subscription: Subscription }> => {
    const response = await api.get(`/subscriptions/${subscriptionId}`);
    return response.data;
  },

  update: async (subscriptionId: string, data: {
    webhookUrl?: string;
    maxRetries?: number;
    backoffStrategy?: string;
    enabled?: boolean;
  }): Promise<{ subscription: Subscription }> => {
    const response = await api.patch(`/subscriptions/${subscriptionId}`, data);
    return response.data;
  },

  delete: async (subscriptionId: string): Promise<void> => {
    await api.delete(`/subscriptions/${subscriptionId}`);
  },
};

// Event APIs
export const eventAPI = {
  publish: async (data: {
    eventType: string;
    payload: any;
    idempotencyKey?: string;
  }): Promise<{
    eventId: string;
    subscriberCount: number;
    deliveriesQueued: number;
  }> => {
    const response = await api.post('/events/publish', data);
    return response.data;
  },

  list: async (params?: { page?: number; limit?: number }): Promise<{ events: EventMessage[]; total: number }> => {
    const response = await api.get('/events', { params });
    return response.data.data || response.data;
  },

  getDeliveryLogs: async (eventId: string): Promise<{ deliveries: DeliveryLog[]; total: number }> => {
    const response = await api.get(`/events/${eventId}/deliveries`);
    return response.data;
  },
};

// Delivery APIs
export const deliveryAPI = {
  list: async (params?: { page?: number; limit?: number; status?: string }): Promise<{ deliveries: DeliveryLog[]; total: number }> => {
    const response = await api.get('/deliveries', { params });
    return response.data;
  },

  get: async (deliveryId: string): Promise<{ delivery: DeliveryLog }> => {
    const response = await api.get(`/deliveries/${deliveryId}`);
    return response.data;
  },

  stats: async (): Promise<{
    total: number;
    success: number;
    failed: number;
    retrying: number;
    pending: number;
    successRate: number;
    avgLatencyMs: number;
  }> => {
    const response = await api.get('/deliveries/stats');
    return response.data;
  },
};

// DLQ APIs (Admin)
export const dlqAPI = {
  list: async (params?: { page?: number; limit?: number }): Promise<{ entries: DLQEntry[]; total: number }> => {
    const response = await api.get('/admin/dlq', { params });
    return response.data;
  },

  get: async (id: string): Promise<{ entry: DLQEntry }> => {
    const response = await api.get(`/admin/dlq/${id}`);
    return response.data;
  },

  retry: async (id: string): Promise<void> => {
    await api.post(`/admin/dlq/${id}/retry`);
  },

  resolve: async (id: string): Promise<void> => {
    await api.post(`/admin/dlq/${id}/resolve`);
  },
};

// Admin User APIs
export const adminUserAPI = {
  create: async (data: {
    name: string;
    email: string;
    password: string;
    role?: 'super_admin' | 'admin' | 'viewer' | 'tester' | 'rtb';
  }): Promise<{ admin: AdminUser; apiKey: string; message: string }> => {
    const response = await api.post('/admin/users', data);
    return response.data;
  },

  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    role?: string;
    search?: string;
  }): Promise<{ admins: AdminUser[]; total: number }> => {
    const response = await api.get('/admin/users', { params });
    return response.data.data || response.data;
  },

  get: async (userId: string): Promise<AdminUser> => {
    const response = await api.get(`/admin/users/${userId}`);
    return response.data;
  },

  update: async (userId: string, data: {
    name?: string;
    email?: string;
    role?: 'super_admin' | 'admin' | 'viewer' | 'tester' | 'rtb';
    status?: string;
  }): Promise<{ admin: AdminUser; message: string }> => {
    const response = await api.patch(`/admin/users/${userId}`, data);
    return response.data;
  },

  delete: async (userId: string): Promise<void> => {
    await api.delete(`/admin/users/${userId}`);
  },
};

// Admin Auth APIs
export const adminAuthAPI = {
  login: async (data: {
    email: string;
    password: string;
  }): Promise<{ user: { id: string; name: string; email: string; role: string; status: string }; apiKey: string; message: string }> => {
    const response = await api.post('/admin/login', data);
    return response.data.data || response.data;
  },
};

export default api;
