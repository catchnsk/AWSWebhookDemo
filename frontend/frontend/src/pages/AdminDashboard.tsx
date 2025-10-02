import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { schemaAPI, subscriptionAPI, eventAPI, deliveryAPI, dlqAPI } from '../lib/api';
import type { Schema, Subscription, EventMessage, DLQEntry } from '../lib/api';
import {
  BarChart3,
  Webhook,
  FileCode,
  Activity,
  AlertCircle,
  Copy,
  Check,
  LogOut,
  TrendingUp,
  Database,
  RefreshCw,
  ExternalLink,
  Shield,
  Users,
  Zap,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface Stats {
  totalSchemas: number;
  totalSubscriptions: number;
  totalEvents: number;
  totalDeliveries: number;
  successRate: number;
  avgLatency: number;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { clearAuth, userName } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'schemas' | 'subscriptions' | 'events' | 'dlq'>('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalSchemas: 0,
    totalSubscriptions: 0,
    totalEvents: 0,
    totalDeliveries: 0,
    successRate: 0,
    avgLatency: 0,
  });
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [events, setEvents] = useState<EventMessage[]>([]);
  const [dlqEntries, setDlqEntries] = useState<DLQEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Mock data for charts - with realistic trends
  const [eventsOverTime] = useState([
    { date: 'Jan', events: 1200, successful: 1150 },
    { date: 'Feb', events: 1800, successful: 1750 },
    { date: 'Mar', events: 2500, successful: 2425 },
    { date: 'Apr', events: 3200, successful: 3100 },
    { date: 'May', events: 2800, successful: 2730 },
    { date: 'Jun', events: 4000, successful: 3880 },
  ]);

  const [deliveryStatus, setDeliveryStatus] = useState([
    { name: 'Success', value: 0, color: '#10b981' },
    { name: 'Failed', value: 0, color: '#ef4444' },
    { name: 'Retrying', value: 0, color: '#f59e0b' },
    { name: 'Pending', value: 0, color: '#6366f1' },
  ]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load schemas
      const schemasData = await schemaAPI.list({ page: 1, limit: 100 });
      setSchemas(schemasData.schemas || []);

      // Load subscriptions
      const subsData = await subscriptionAPI.list({ page: 1, limit: 100 });
      setSubscriptions(subsData.subscriptions || []);

      // Load events
      const eventsData = await eventAPI.list({ page: 1, limit: 100 });
      setEvents(eventsData.events || []);

      // Load delivery stats
      const deliveryStats = await deliveryAPI.stats();

      // Load DLQ entries
      try {
        const dlqData = await dlqAPI.list({ page: 1, limit: 50 });
        setDlqEntries(dlqData.entries || []);
      } catch (error) {
        // DLQ might not be accessible, use empty array
        setDlqEntries([]);
      }

      // Update stats
      setStats({
        totalSchemas: schemasData.total || schemasData.schemas?.length || 0,
        totalSubscriptions: subsData.total || subsData.subscriptions?.length || 0,
        totalEvents: eventsData.total || eventsData.events?.length || 0,
        totalDeliveries: deliveryStats.total || 0,
        successRate: deliveryStats.successRate || 0,
        avgLatency: deliveryStats.avgLatencyMs || 0,
      });

      // Update delivery status for pie chart
      setDeliveryStatus([
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

  const handleRetryDLQ = async (id: string) => {
    try {
      await dlqAPI.retry(id);
      toast.success('Retry initiated');
      loadDashboardData();
    } catch (error) {
      toast.error('Failed to retry DLQ entry');
    }
  };

  const handleResolveDLQ = async (id: string) => {
    try {
      await dlqAPI.resolve(id);
      toast.success('DLQ entry resolved');
      loadDashboardData();
    } catch (error) {
      toast.error('Failed to resolve DLQ entry');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-slate-900/50 backdrop-blur-xl border-r border-white/20 p-6 z-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">Admin Console</h1>
            <p className="text-gray-400 text-xs">Webhook Management</p>
          </div>
        </div>

        <nav className="space-y-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'overview'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/50'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="font-medium">Overview</span>
            {activeTab === 'overview' && <ChevronRight className="w-4 h-4 ml-auto" />}
          </button>
          <button
            onClick={() => setActiveTab('schemas')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'schemas'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/50'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <FileCode className="w-5 h-5" />
            <span className="font-medium">Schemas</span>
            {activeTab === 'schemas' && <ChevronRight className="w-4 h-4 ml-auto" />}
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'subscriptions'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/50'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Webhook className="w-5 h-5" />
            <span className="font-medium">Subscriptions</span>
            {activeTab === 'subscriptions' && <ChevronRight className="w-4 h-4 ml-auto" />}
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'events'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/50'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Activity className="w-5 h-5" />
            <span className="font-medium">Events</span>
            {activeTab === 'events' && <ChevronRight className="w-4 h-4 ml-auto" />}
          </button>
          <button
            onClick={() => setActiveTab('dlq')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              activeTab === 'dlq'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/50'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Dead Letter Queue</span>
            {dlqEntries.filter(e => !e.resolved).length > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {dlqEntries.filter(e => !e.resolved).length}
              </span>
            )}
            {activeTab === 'dlq' && <ChevronRight className="w-4 h-4 ml-auto" />}
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {activeTab === 'overview' && 'Dashboard Overview'}
              {activeTab === 'schemas' && 'Schema Management'}
              {activeTab === 'subscriptions' && 'Subscription Management'}
              {activeTab === 'events' && 'Event Monitoring'}
              {activeTab === 'dlq' && 'Dead Letter Queue'}
            </h2>
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

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <FileCode className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    +12%
                  </span>
                </div>
                <h3 className="text-gray-400 text-sm mb-1">Total Schemas</h3>
                <p className="text-3xl font-bold text-white">{stats.totalSchemas}</p>
                <p className="text-gray-500 text-xs mt-2">Active event schemas</p>
              </div>

              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-400" />
                  </div>
                  <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    +8%
                  </span>
                </div>
                <h3 className="text-gray-400 text-sm mb-1">Subscriptions</h3>
                <p className="text-3xl font-bold text-white">{stats.totalSubscriptions}</p>
                <p className="text-gray-500 text-xs mt-2">Active webhook subscriptions</p>
              </div>

              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-green-400" />
                  </div>
                  <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    +25%
                  </span>
                </div>
                <h3 className="text-gray-400 text-sm mb-1">Total Events</h3>
                <p className="text-3xl font-bold text-white">{stats.totalEvents}</p>
                <p className="text-gray-500 text-xs mt-2">Events published this month</p>
              </div>

              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                    <Database className="w-6 h-6 text-yellow-400" />
                  </div>
                  <span className={`text-sm font-medium flex items-center gap-1 ${stats.successRate >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {stats.successRate.toFixed(1)}%
                  </span>
                </div>
                <h3 className="text-gray-400 text-sm mb-1">Success Rate</h3>
                <p className="text-3xl font-bold text-white">{stats.totalDeliveries}</p>
                <p className="text-gray-500 text-xs mt-2">Total deliveries processed</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Events Over Time Chart */}
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
                <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-violet-400" />
                  Events Over Time
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={eventsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                    <XAxis dataKey="date" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #ffffff20',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="events" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} name="Published" />
                    <Line type="monotone" dataKey="successful" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} name="Successful" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Delivery Status Pie Chart */}
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
                <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-violet-400" />
                  Delivery Status Distribution
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={deliveryStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {deliveryStatus.map((entry, index) => (
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
            </div>

            {/* Recent Activity */}
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
              <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-violet-400" />
                Recent Events
              </h3>
              <div className="space-y-3">
                {events.slice(0, 5).map((event) => (
                  <div key={event.eventId} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <div>
                        <p className="text-white font-medium">{event.eventType}</p>
                        <p className="text-gray-400 text-sm">{format(new Date(event.createdAt), 'PPpp')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-gray-400 text-xs">Subscribers</p>
                        <p className="text-white font-semibold">{event.subscriberCount}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-400 text-xs">Completed</p>
                        <p className="text-green-400 font-semibold">{event.deliveriesCompleted}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-400 text-xs">Failed</p>
                        <p className="text-red-400 font-semibold">{event.deliveriesFailed}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {events.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    No recent events to display
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Schemas Tab */}
        {activeTab === 'schemas' && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Schema Name</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Event Type</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Version</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Subscriptions</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Visibility</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schemas.map((schema) => (
                      <tr key={schema.id} className="border-b border-white/5 hover:bg-white/5 transition-all">
                        <td className="py-4 px-4">
                          <p className="text-white font-medium">{schema.name}</p>
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
                            {schema.eventType}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-gray-300">{schema.version}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-white font-semibold">{schema.subscriptionCount}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-sm ${schema.isPublic ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>
                            {schema.isPublic ? 'Public' : 'Private'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-sm ${schema.status === 'active' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                            {schema.status}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-gray-400 text-sm">{format(new Date(schema.createdAt), 'PP')}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {schemas.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    No schemas found
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
              <div className="space-y-4">
                {subscriptions.map((subscription) => (
                  <div key={subscription.id} className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${subscription.enabled ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                        <h4 className="text-white font-semibold">
                          {subscription.schema?.name || 'Schema'}
                        </h4>
                        <span className={`px-2 py-1 rounded text-xs ${subscription.enabled ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>
                          {subscription.status}
                        </span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(subscription.webhookUrl, subscription.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-violet-600/20 text-violet-300 rounded-lg hover:bg-violet-600/30 transition-all"
                      >
                        {copiedId === subscription.id ? (
                          <>
                            <Check className="w-4 h-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy URL
                          </>
                        )}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Webhook URL</p>
                        <p className="text-white truncate">{subscription.webhookUrl}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Max Retries</p>
                        <p className="text-white">{subscription.maxRetries}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Backoff Strategy</p>
                        <p className="text-white capitalize">{subscription.backoffStrategy}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {subscriptions.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    No subscriptions found
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.eventId} className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <Activity className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h4 className="text-white font-semibold">{event.eventType}</h4>
                          <p className="text-gray-400 text-sm">{format(new Date(event.createdAt), 'PPpp')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-gray-400 text-xs">Queued</p>
                          <p className="text-blue-400 font-semibold">{event.deliveriesQueued}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-400 text-xs">Completed</p>
                          <p className="text-green-400 font-semibold">{event.deliveriesCompleted}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-400 text-xs">Failed</p>
                          <p className="text-red-400 font-semibold">{event.deliveriesFailed}</p>
                        </div>
                        <button className="p-2 hover:bg-white/10 rounded-lg transition-all">
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {events.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    No events to display
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DLQ Tab */}
        {activeTab === 'dlq' && (
          <div className="space-y-6">
            {dlqEntries.filter(e => !e.resolved).length === 0 ? (
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-12 text-center shadow-xl">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-white text-xl font-semibold mb-2">All Clear!</h3>
                <p className="text-gray-400">No failed deliveries in the Dead Letter Queue</p>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
                <div className="space-y-4">
                  {dlqEntries.map((entry) => (
                    <div key={entry.id} className="p-4 bg-red-500/10 rounded-lg border border-red-500/30 hover:bg-red-500/20 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 text-red-400" />
                          <div>
                            <p className="text-white font-semibold">Delivery Failed</p>
                            <p className="text-gray-400 text-sm">{format(new Date(entry.movedToDlqAt), 'PPpp')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!entry.resolved && (
                            <>
                              <button
                                onClick={() => handleRetryDLQ(entry.id)}
                                className="px-3 py-1.5 bg-blue-600/20 text-blue-300 rounded-lg hover:bg-blue-600/30 transition-all flex items-center gap-2"
                              >
                                <RefreshCw className="w-4 h-4" />
                                Retry
                              </button>
                              <button
                                onClick={() => handleResolveDLQ(entry.id)}
                                className="px-3 py-1.5 bg-green-600/20 text-green-300 rounded-lg hover:bg-green-600/30 transition-all flex items-center gap-2"
                              >
                                <Check className="w-4 h-4" />
                                Resolve
                              </button>
                            </>
                          )}
                          {entry.resolved && (
                            <span className="px-3 py-1.5 bg-green-500/20 text-green-300 rounded-lg text-sm">
                              Resolved
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Error Message</p>
                          <p className="text-red-300">{entry.finalError}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Total Attempts</p>
                          <p className="text-white">{entry.totalAttempts}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
