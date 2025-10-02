import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { schemaAPI, subscriptionAPI, deliveryAPI } from '../lib/api';
import type { Schema, Subscription, DeliveryLog } from '../lib/api';
import {
  Webhook,
  Activity,
  Copy,
  Check,
  LogOut,
  Plus,
  X,
  RefreshCw,
  TrendingUp,
  Search,
  Eye,
  Settings,
  Database,
  Clock,
  AlertCircle,
  ShoppingCart,
  Bell,
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const SubscriberDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { clearAuth, userName } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'marketplace' | 'subscriptions' | 'deliveries'>('marketplace');
  const [marketplaceSchemas, setMarketplaceSchemas] = useState<Schema[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryLog[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [selectedSchema, setSelectedSchema] = useState<Schema | null>(null);

  const [subscribeForm, setSubscribeForm] = useState({
    webhookUrl: '',
    maxRetries: 3,
    backoffStrategy: 'exponential',
  });

  const [stats, setStats] = useState({
    activeSubscriptions: 0,
    totalDeliveries: 0,
    successRate: 0,
    avgLatency: 0,
  });

  const [deliveryStatusData, setDeliveryStatusData] = useState([
    { name: 'Success', value: 0, color: '#10b981' },
    { name: 'Failed', value: 0, color: '#ef4444' },
    { name: 'Retrying', value: 0, color: '#f59e0b' },
    { name: 'Pending', value: 0, color: '#6366f1' },
  ]);

  // Mock data for events by type chart
  const [eventTypeData] = useState([
    { eventType: 'user.login', count: 450 },
    { eventType: 'user.signup', count: 230 },
    { eventType: 'order.created', count: 670 },
    { eventType: 'payment.success', count: 540 },
  ]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load marketplace schemas
      const marketplaceData = await schemaAPI.listMarketplace({ page: 1, limit: 100 });
      setMarketplaceSchemas(marketplaceData.schemas || []);

      // Load subscriptions
      const subsData = await subscriptionAPI.list({ page: 1, limit: 100 });
      setSubscriptions(subsData.subscriptions || []);

      // Load deliveries
      const deliveriesData = await deliveryAPI.list({ page: 1, limit: 100 });
      setDeliveries(deliveriesData.deliveries || []);

      // Load delivery stats
      const deliveryStats = await deliveryAPI.stats();

      setStats({
        activeSubscriptions: subsData.subscriptions?.filter(s => s.enabled).length || 0,
        totalDeliveries: deliveryStats.total || 0,
        successRate: deliveryStats.successRate || 0,
        avgLatency: deliveryStats.avgLatencyMs || 0,
      });

      setDeliveryStatusData([
        { name: 'Success', value: deliveryStats.success || 0, color: '#10b981' },
        { name: 'Failed', value: deliveryStats.failed || 0, color: '#ef4444' },
        { name: 'Retrying', value: deliveryStats.retrying || 0, color: '#f59e0b' },
        { name: 'Pending', value: deliveryStats.pending || 0, color: '#6366f1' },
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubscribe = async (schema: Schema) => {
    setSelectedSchema(schema);
    setShowSubscribeModal(true);
  };

  const handleSubscribeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchema) return;

    try {
      await subscriptionAPI.subscribe({
        schemaId: selectedSchema.id,
        webhookUrl: subscribeForm.webhookUrl,
        maxRetries: subscribeForm.maxRetries,
        backoffStrategy: subscribeForm.backoffStrategy,
      });

      toast.success('Successfully subscribed!');
      setShowSubscribeModal(false);
      setSubscribeForm({
        webhookUrl: '',
        maxRetries: 3,
        backoffStrategy: 'exponential',
      });
      loadDashboardData();
    } catch (error) {
      toast.error('Failed to subscribe');
    }
  };

  const handleUpdateSubscription = async (subscriptionId: string, enabled: boolean) => {
    try {
      await subscriptionAPI.update(subscriptionId, { enabled });
      toast.success(enabled ? 'Subscription enabled' : 'Subscription disabled');
      loadDashboardData();
    } catch (error) {
      toast.error('Failed to update subscription');
    }
  };

  const handleDeleteSubscription = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to delete this subscription?')) return;

    try {
      await subscriptionAPI.delete(subscriptionId);
      toast.success('Subscription deleted');
      loadDashboardData();
    } catch (error) {
      toast.error('Failed to delete subscription');
    }
  };

  const filteredSchemas = marketplaceSchemas.filter(
    (schema) =>
      schema.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      schema.eventType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Subscriber Dashboard</h1>
          <p className="text-gray-400">Welcome back, {userName}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg text-white hover:bg-white/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600/20 backdrop-blur-xl border border-red-500/50 rounded-lg text-red-300 hover:bg-red-600/30 transition-all flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Webhook className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-green-400 text-sm font-medium flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              +12%
            </span>
          </div>
          <h3 className="text-gray-400 text-sm mb-1">Active Subscriptions</h3>
          <p className="text-3xl font-bold text-white">{stats.activeSubscriptions}</p>
          <p className="text-gray-500 text-xs mt-2">Currently enabled webhooks</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-purple-400" />
            </div>
            <span className="text-green-400 text-sm font-medium flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              +18%
            </span>
          </div>
          <h3 className="text-gray-400 text-sm mb-1">Total Deliveries</h3>
          <p className="text-3xl font-bold text-white">{stats.totalDeliveries}</p>
          <p className="text-gray-500 text-xs mt-2">Events received</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <span className={`text-sm font-medium ${stats.successRate >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
              {stats.successRate.toFixed(1)}%
            </span>
          </div>
          <h3 className="text-gray-400 text-sm mb-1">Success Rate</h3>
          <p className="text-3xl font-bold text-white">{stats.successRate.toFixed(1)}%</p>
          <p className="text-gray-500 text-xs mt-2">Successful webhook calls</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6 text-yellow-400" />
            </div>
            <span className="text-gray-400 text-sm">ms</span>
          </div>
          <h3 className="text-gray-400 text-sm mb-1">Avg Latency</h3>
          <p className="text-3xl font-bold text-white">{stats.avgLatency.toFixed(0)}</p>
          <p className="text-gray-500 text-xs mt-2">Response time</p>
        </div>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Delivery Status Chart */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
          <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-violet-400" />
            Delivery Status
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={deliveryStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {deliveryStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #ffffff20',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Event Types Chart */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
          <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-violet-400" />
            Events by Type
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={eventTypeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis dataKey="eventType" stroke="#9ca3af" angle={-45} textAnchor="end" height={100} />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #ffffff20',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="count" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
            activeTab === 'marketplace'
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/50'
              : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white backdrop-blur-xl border border-white/20'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Schema Marketplace
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
            activeTab === 'subscriptions'
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/50'
              : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white backdrop-blur-xl border border-white/20'
          }`}
        >
          <Webhook className="w-4 h-4" />
          My Subscriptions
        </button>
        <button
          onClick={() => setActiveTab('deliveries')}
          className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
            activeTab === 'deliveries'
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/50'
              : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white backdrop-blur-xl border border-white/20'
          }`}
        >
          <Activity className="w-4 h-4" />
          Delivery Monitoring
        </button>
      </div>

      {/* Marketplace Tab */}
      {activeTab === 'marketplace' && (
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Search schemas by name or event type..."
              />
            </div>
          </div>

          {/* Schema Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredSchemas.map((schema) => (
              <div key={schema.id} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-white text-xl font-bold mb-2">{schema.name}</h3>
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
                      {schema.eventType}
                    </span>
                  </div>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm">
                    v{schema.version}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {schema.subscriptionCount} subscribers
                    </span>
                    <span>{format(new Date(schema.createdAt), 'PP')}</span>
                  </div>
                </div>

                <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-gray-400 text-sm font-mono overflow-hidden">
                    {JSON.stringify(schema.schemaDefinition, null, 2).substring(0, 150)}...
                  </p>
                </div>

                <button
                  onClick={() => handleSubscribe(schema)}
                  className="w-full px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:from-violet-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  Subscribe
                </button>
              </div>
            ))}
            {filteredSchemas.length === 0 && (
              <div className="col-span-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-12 text-center">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">No schemas found matching your search</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          {subscriptions.map((subscription) => (
            <div key={subscription.id} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${subscription.enabled ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                  <div>
                    <h3 className="text-white text-lg font-semibold">
                      {subscription.schema?.name || 'Schema'}
                    </h3>
                    <p className="text-gray-400 text-sm">{subscription.schema?.eventType}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${subscription.enabled ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>
                    {subscription.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateSubscription(subscription.id, !subscription.enabled)}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 ${
                      subscription.enabled
                        ? 'bg-yellow-600/20 text-yellow-300 hover:bg-yellow-600/30'
                        : 'bg-green-600/20 text-green-300 hover:bg-green-600/30'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    {subscription.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDeleteSubscription(subscription.id)}
                    className="px-3 py-1.5 bg-red-600/20 text-red-300 rounded-lg hover:bg-red-600/30 transition-all flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-gray-400 text-sm mb-1">Webhook URL</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm truncate flex-1">{subscription.webhookUrl}</p>
                    <button
                      onClick={() => copyToClipboard(subscription.webhookUrl, subscription.id)}
                      className="p-1.5 hover:bg-white/10 rounded transition-all"
                    >
                      {copiedId === subscription.id ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-gray-400 text-sm mb-1">Max Retries</p>
                  <p className="text-white font-semibold">{subscription.maxRetries}</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-gray-400 text-sm mb-1">Backoff Strategy</p>
                  <p className="text-white font-semibold capitalize">{subscription.backoffStrategy}</p>
                </div>
              </div>

              <div className="text-gray-400 text-sm flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Created {format(new Date(subscription.createdAt), 'PPp')}
              </div>
            </div>
          ))}
          {subscriptions.length === 0 && (
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-12 text-center">
              <Webhook className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">No subscriptions yet</p>
              <p className="text-gray-500 text-sm mt-2">Browse the marketplace to subscribe to event schemas</p>
            </div>
          )}
        </div>
      )}

      {/* Deliveries Tab */}
      {activeTab === 'deliveries' && (
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
          <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-violet-400" />
            Live Delivery Logs
          </h3>
          <div className="space-y-3">
            {deliveries.map((delivery) => (
              <div key={delivery.id} className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      delivery.status === 'success' ? 'bg-green-500/20' :
                      delivery.status === 'failed' ? 'bg-red-500/20' :
                      delivery.status === 'retrying' ? 'bg-yellow-500/20' :
                      'bg-blue-500/20'
                    }`}>
                      {delivery.status === 'success' ? (
                        <Check className="w-5 h-5 text-green-400" />
                      ) : delivery.status === 'failed' ? (
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      ) : delivery.status === 'retrying' ? (
                        <RefreshCw className="w-5 h-5 text-yellow-400" />
                      ) : (
                        <Activity className="w-5 h-5 text-blue-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          delivery.status === 'success' ? 'bg-green-500/20 text-green-300' :
                          delivery.status === 'failed' ? 'bg-red-500/20 text-red-300' :
                          delivery.status === 'retrying' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {delivery.status.toUpperCase()}
                        </span>
                        {delivery.retryAttempt > 0 && (
                          <span className="text-gray-400 text-xs">
                            Attempt {delivery.retryAttempt}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">{format(new Date(delivery.createdAt), 'PPpp')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {delivery.responseStatusCode && (
                      <div className="text-center">
                        <p className="text-gray-400 text-xs">Status Code</p>
                        <p className="text-white font-semibold">{delivery.responseStatusCode}</p>
                      </div>
                    )}
                    {delivery.latencyMs && (
                      <div className="text-center">
                        <p className="text-gray-400 text-xs">Latency</p>
                        <p className="text-white font-semibold">{delivery.latencyMs}ms</p>
                      </div>
                    )}
                    {delivery.errorMessage && (
                      <div className="max-w-xs">
                        <p className="text-red-400 text-sm truncate">{delivery.errorMessage}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {deliveries.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No delivery logs yet</p>
                <p className="text-gray-500 text-sm mt-2">Webhook deliveries will appear here</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subscribe Modal */}
      {showSubscribeModal && selectedSchema && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/20 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Subscribe to {selectedSchema.name}</h2>
              <button
                onClick={() => setShowSubscribeModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubscribeSubmit} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Webhook URL</label>
                <input
                  type="url"
                  value={subscribeForm.webhookUrl}
                  onChange={(e) => setSubscribeForm({ ...subscribeForm, webhookUrl: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="https://your-domain.com/webhook"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Max Retries</label>
                  <input
                    type="number"
                    value={subscribeForm.maxRetries}
                    onChange={(e) => setSubscribeForm({ ...subscribeForm, maxRetries: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    min="0"
                    max="10"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Backoff Strategy</label>
                  <select
                    value={subscribeForm.backoffStrategy}
                    onChange={(e) => setSubscribeForm({ ...subscribeForm, backoffStrategy: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    required
                  >
                    <option value="exponential" className="bg-slate-800">Exponential</option>
                    <option value="linear" className="bg-slate-800">Linear</option>
                    <option value="constant" className="bg-slate-800">Constant</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-300 text-sm">
                  <strong>Event Type:</strong> {selectedSchema.eventType}
                </p>
                <p className="text-blue-300 text-sm mt-1">
                  <strong>Schema Version:</strong> {selectedSchema.version}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:from-violet-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <Check className="w-5 h-5" />
                  Subscribe
                </button>
                <button
                  type="button"
                  onClick={() => setShowSubscribeModal(false)}
                  className="px-4 py-3 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriberDashboard;
