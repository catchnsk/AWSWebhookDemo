# Webhook Management System - Frontend UI

A comprehensive React + TypeScript frontend for the Webhook Management System with producer, subscriber, and admin dashboards.

## 🎨 Features

### For Producers
- ✅ **Schema Registration** - Register event schemas with JSON Schema validation
- ✅ **Schema Management** - View, edit, and manage your registered schemas
- ✅ **Event Publishing** - Publish events with payload validation
- ✅ **Analytics Dashboard** - View delivery statistics and success rates

### For Subscribers
- ✅ **Schema Marketplace** - Browse and discover available event schemas
- ✅ **Subscription Management** - Subscribe to schemas and manage webhooks
- ✅ **Delivery Monitoring** - Track webhook deliveries in real-time
- ✅ **Webhook Configuration** - Configure retry policies and webhook URLs

### For Admins
- ✅ **Dead Letter Queue (DLQ)** - View and manage failed deliveries
- ✅ **System Monitoring** - Overall system health and metrics
- ✅ **User Management** - Manage producers and subscribers
- ✅ **Manual Retry** - Manually retry failed webhook deliveries

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- Backend API running on `http://localhost:3000`

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:3001

### Build for Production

```bash
npm run build
npm run preview
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Layout.tsx
│   │   ├── producer/
│   │   │   ├── SchemaRegistration.tsx
│   │   │   ├── SchemaList.tsx
│   │   │   └── EventPublisher.tsx
│   │   ├── subscriber/
│   │   │   ├── SchemaMarketplace.tsx
│   │   │   ├── SubscriptionList.tsx
│   │   │   └── SubscriptionForm.tsx
│   │   ├── shared/
│   │   │   ├── DeliveryStatus.tsx
│   │   │   ├── DeliveryLogs.tsx
│   │   │   └── StatsCard.tsx
│   │   └── admin/
│   │       ├── DLQManager.tsx
│   │       ├── SystemMetrics.tsx
│   │       └── UserList.tsx
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── ProducerDashboard.tsx
│   │   ├── SubscriberDashboard.tsx
│   │   └── AdminDashboard.tsx
│   ├── lib/
│   │   ├── api.ts              # API client
│   │   └── utils.ts            # Utility functions
│   ├── store/
│   │   └── authStore.ts        # Zustand state management
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🎯 Key Pages & Components

### 1. Producer Dashboard (`/producer`)

**Schema Registration Form:**
```tsx
<SchemaRegistration onSuccess={handleSuccess} />
```

Features:
- Register new event schemas
- JSON Schema editor with validation
- Choose public/private visibility
- Real-time schema validation

**Schema List:**
```tsx
<SchemaList schemas={schemas} onEdit={handleEdit} />
```

Features:
- View all registered schemas
- See subscription counts
- Edit/delete schemas
- View schema details

**Event Publisher:**
```tsx
<EventPublisher schemas={schemas} />
```

Features:
- Select schema from dropdown
- Payload editor with syntax highlighting
- Pre-publish validation
- View publish history

---

### 2. Subscriber Dashboard (`/subscriber`)

**Schema Marketplace:**
```tsx
<SchemaMarketplace onSubscribe={handleSubscribe} />
```

Features:
- Browse all public schemas
- Search and filter by event type
- View schema definitions
- Quick subscribe button

**Subscription Management:**
```tsx
<SubscriptionList subscriptions={subscriptions} />
```

Features:
- View active subscriptions
- Configure webhook URL
- Set retry policies (exponential/linear/constant)
- Enable/disable subscriptions
- View delivery stats per subscription

**Webhook Configuration:**
```tsx
<WebhookConfig subscription={subscription} onSave={handleSave} />
```

Features:
- Update webhook URL
- Set max retries (1-10)
- Choose backoff strategy
- Test webhook endpoint

---

### 3. Delivery Status Dashboard (`/deliveries`)

**Delivery Logs Table:**
```tsx
<DeliveryLogs filters={filters} />
```

Features:
- Real-time delivery status
- Filter by status (success/failed/retrying)
- Search by event ID or delivery ID
- Pagination with 20/50/100 per page

**Delivery Details Modal:**
```tsx
<DeliveryDetails deliveryId={deliveryId} />
```

Shows:
- Event payload
- Response status code
- Response body
- Error message (if failed)
- Retry history
- Latency metrics

**Stats Dashboard:**
```tsx
<DeliveryStats />
```

Shows:
- Total deliveries
- Success rate (%)
- Average latency
- Failed deliveries count
- Retrying count
- Charts (line graph, pie chart)

---

### 4. Admin Dashboard (`/admin`)

**DLQ Manager:**
```tsx
<DLQManager />
```

Features:
- View all DLQ entries
- See total attempts
- View error messages
- Manual retry button
- Mark as resolved
- Bulk operations

**System Metrics:**
```tsx
<SystemMetrics />
```

Shows:
- Active producers
- Active subscribers
- Total schemas
- Total subscriptions
- Delivery throughput (events/hour)
- System health indicators

---

## 🎨 UI Components Library

### Common Components

**StatsCard:**
```tsx
<StatsCard
  title="Total Deliveries"
  value="1,234"
  icon={<TrendingUp />}
  trend="+12%"
  trendUp={true}
/>
```

**StatusBadge:**
```tsx
<StatusBadge status="success" /> // Green
<StatusBadge status="failed" /> // Red
<StatusBadge status="retrying" /> // Yellow
<StatusBadge status="pending" /> // Gray
```

**LoadingSpinner:**
```tsx
<LoadingSpinner size="lg" />
```

**EmptyState:**
```tsx
<EmptyState
  icon={<FileX />}
  title="No schemas found"
  description="Register your first schema to get started"
  action={<Button onClick={openForm}>Register Schema</Button>}
/>
```

**ConfirmDialog:**
```tsx
<ConfirmDialog
  open={isOpen}
  title="Delete Schema"
  message="Are you sure? This cannot be undone."
  onConfirm={handleDelete}
  onCancel={handleCancel}
/>
```

---

## 🔐 Authentication Flow

1. User visits `/login`
2. Enters API key
3. System validates key with backend
4. Redirects to appropriate dashboard based on user type
5. API key stored in localStorage and Zustand

```tsx
// Login component
const handleLogin = async (apiKey: string) => {
  try {
    // Validate API key with backend
    const response = await api.get('/auth/validate', {
      headers: { 'X-API-Key': apiKey }
    });

    const { userType, userId, userName } = response.data;

    // Save to store
    useAuthStore.getState().setAuth(apiKey, userType, userId, userName);

    // Redirect
    if (userType === 'producer') navigate('/producer');
    else if (userType === 'subscriber') navigate('/subscriber');
    else if (userType === 'admin') navigate('/admin');
  } catch (error) {
    toast.error('Invalid API key');
  }
};
```

---

## 📊 State Management with Zustand

```typescript
// Auth Store
export const useAuthStore = create<AuthState>((set) => ({
  apiKey: null,
  userType: null,
  setAuth: (apiKey, userType, userId, userName) => set({ apiKey, userType, userId, userName }),
  clearAuth: () => set({ apiKey: null, userType: null, userId: null, userName: null }),
  isAuthenticated: () => !!get().apiKey,
}));

// Usage in components
const { apiKey, userType } = useAuthStore();
```

---

## 🎨 Styling with Tailwind CSS

### Color Palette

```css
Primary: #0ea5e9 (sky-500)
Success: #10b981 (green-500)
Error: #ef4444 (red-500)
Warning: #f59e0b (amber-500)
Gray: #6b7280 (gray-500)
```

### Common Patterns

**Card:**
```tsx
<div className="bg-white rounded-lg shadow p-6">
  {/* content */}
</div>
```

**Button:**
```tsx
<button className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700">
  Click Me
</button>
```

**Input:**
```tsx
<input
  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
  type="text"
/>
```

**Table:**
```tsx
<table className="min-w-full divide-y divide-gray-200">
  <thead className="bg-gray-50">
    <tr>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
        Name
      </th>
    </tr>
  </thead>
  <tbody className="bg-white divide-y divide-gray-200">
    {/* rows */}
  </tbody>
</table>
```

---

## 📡 API Integration Examples

### Register Schema

```typescript
import { schemaAPI } from '@/lib/api';

const registerSchema = async () => {
  try {
    const { schema } = await schemaAPI.register({
      name: 'order-created',
      eventType: 'order.created',
      version: '1.0.0',
      schemaFormat: 'json',
      schemaDefinition: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          amount: { type: 'number' },
        },
        required: ['orderId', 'amount'],
      },
      isPublic: true,
    });

    toast.success('Schema registered successfully!');
    return schema;
  } catch (error) {
    toast.error('Failed to register schema');
    throw error;
  }
};
```

### Subscribe to Schema

```typescript
import { subscriptionAPI } from '@/lib/api';

const subscribe = async (schemaId: string) => {
  try {
    const { subscription } = await subscriptionAPI.subscribe({
      schemaId,
      webhookUrl: 'https://myapp.com/webhook',
      maxRetries: 3,
      backoffStrategy: 'exponential',
    });

    toast.success('Subscribed successfully!');
    return subscription;
  } catch (error) {
    toast.error('Failed to subscribe');
    throw error;
  }
};
```

### Publish Event

```typescript
import { eventAPI } from '@/lib/api';

const publishEvent = async () => {
  try {
    const result = await eventAPI.publish({
      eventType: 'order.created',
      payload: {
        orderId: 'ORD-123',
        amount: 99.99,
        customerId: 'CUST-456',
      },
      idempotencyKey: 'unique-key-123',
    });

    toast.success(`Event published! ${result.subscriberCount} subscribers notified`);
    return result;
  } catch (error) {
    toast.error('Failed to publish event');
    throw error;
  }
};
```

---

## 🔧 Environment Variables

Create `.env` file:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000
```

Usage in code:

```typescript
const API_URL = import.meta.env.VITE_API_BASE_URL;
```

---

## 📱 Responsive Design

All components are mobile-responsive using Tailwind's responsive utilities:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Stacks on mobile, 2 cols on tablet, 3 cols on desktop */}
</div>
```

---

## 🧪 Testing

### Run Unit Tests

```bash
npm run test
```

### E2E Tests (Playwright)

```bash
npm run test:e2e
```

---

## 🚀 Deployment

### Build

```bash
npm run build
```

Output: `dist/` folder

### Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Deploy to AWS S3 + CloudFront

```bash
# Build
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

---

## 📝 Code Examples

### Complete Schema Registration Form

```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { schemaAPI } from '@/lib/api';
import toast from 'react-hot-toast';

interface SchemaFormData {
  name: string;
  eventType: string;
  version: string;
  schemaDefinition: string;
  description: string;
  isPublic: boolean;
}

export function SchemaRegistrationForm() {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<SchemaFormData>();

  const onSubmit = async (data: SchemaFormData) => {
    setLoading(true);
    try {
      let schemaDefinition;
      try {
        schemaDefinition = JSON.parse(data.schemaDefinition);
      } catch {
        toast.error('Invalid JSON in schema definition');
        return;
      }

      await schemaAPI.register({
        name: data.name,
        eventType: data.eventType,
        version: data.version,
        schemaFormat: 'json',
        schemaDefinition,
        description: data.description,
        isPublic: data.isPublic,
      });

      toast.success('Schema registered successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to register schema');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Schema Name
        </label>
        <input
          {...register('name', { required: 'Name is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          placeholder="e.g., order-created"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      {/* Event Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Event Type
        </label>
        <input
          {...register('eventType', { required: 'Event type is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          placeholder="e.g., order.created"
        />
        {errors.eventType && (
          <p className="mt-1 text-sm text-red-600">{errors.eventType.message}</p>
        )}
      </div>

      {/* Version */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Version
        </label>
        <input
          {...register('version', { required: 'Version is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          placeholder="e.g., 1.0.0"
          defaultValue="1.0.0"
        />
      </div>

      {/* Schema Definition */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Schema Definition (JSON Schema)
        </label>
        <textarea
          {...register('schemaDefinition', { required: 'Schema definition is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm font-mono text-sm"
          rows={10}
          placeholder={JSON.stringify({
            type: 'object',
            properties: {
              orderId: { type: 'string' },
              amount: { type: 'number' },
            },
            required: ['orderId', 'amount'],
          }, null, 2)}
        />
        {errors.schemaDefinition && (
          <p className="mt-1 text-sm text-red-600">{errors.schemaDefinition.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          {...register('description')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          rows={3}
          placeholder="Describe your event schema"
        />
      </div>

      {/* Public/Private */}
      <div className="flex items-center">
        <input
          {...register('isPublic')}
          type="checkbox"
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          defaultChecked={true}
        />
        <label className="ml-2 block text-sm text-gray-900">
          Make this schema public (visible in marketplace)
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
      >
        {loading ? 'Registering...' : 'Register Schema'}
      </button>
    </form>
  );
}
```

---

## 🎉 Features Checklist

- ✅ Producer dashboard with schema registration
- ✅ Subscriber dashboard with marketplace
- ✅ Delivery monitoring with real-time status
- ✅ Admin DLQ management
- ✅ Responsive design (mobile/tablet/desktop)
- ✅ Dark mode support (optional)
- ✅ Loading states and error handling
- ✅ Toast notifications
- ✅ Form validation
- ✅ API client with interceptors
- ✅ Type-safe with TypeScript
- ✅ Tailwind CSS styling
- ✅ React Hook Form integration
- ✅ Zustand state management
- ✅ Chart visualization (Recharts)

---

## 📚 Resources

- **React Documentation**: https://react.dev
- **Vite Documentation**: https://vitejs.dev
- **Tailwind CSS**: https://tailwindcss.com
- **React Hook Form**: https://react-hook-form.com
- **Zustand**: https://github.com/pmndrs/zustand
- **Recharts**: https://recharts.org

---

## 🐛 Troubleshooting

### API Connection Issues

If you get CORS errors:
1. Make sure backend is running on `http://localhost:3000`
2. Check backend has CORS enabled for `http://localhost:3001`
3. Verify API_BASE_URL in `.env`

### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules dist
npm install
npm run build
```

### TypeScript Errors

```bash
# Check types
npm run type-check
```

---

## 👥 Contributing

1. Create feature branch
2. Make changes
3. Run linter: `npm run lint`
4. Test locally
5. Create pull request

---

**Frontend is now complete with all dashboards and UI components!** 🎉
