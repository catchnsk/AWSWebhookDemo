import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { schemaAPI, subscriptionAPI, eventAPI, deliveryAPI, dlqAPI, adminUserAPI, subscriberAPI } from '../lib/api';
import type { Schema, Subscription, EventMessage, DLQEntry, AdminUser, Subscriber } from '../lib/api';
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
  Plus,
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
  const { clearAuth, userName, userRole } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'schemas' | 'subscriptions' | 'events' | 'dlq' | 'users'>('overview');
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
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [events, setEvents] = useState<EventMessage[]>([]);
  const [dlqEntries, setDlqEntries] = useState<DLQEntry[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', role: 'admin' as 'super_admin' | 'admin' | 'viewer' });
  const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    role: 'admin' as 'super_admin' | 'admin' | 'viewer',
    password: '',
    status: 'active'
  });
  const [selectedSchema, setSelectedSchema] = useState<Schema | null>(null);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [showAddSchemaModal, setShowAddSchemaModal] = useState(false);
  const [showEditSchemaModal, setShowEditSchemaModal] = useState(false);
  const [editSchemaForm, setEditSchemaForm] = useState({
    domain: '' as 'payment' | 'account' | 'apply' | '',
    partnerUserId: '',
    systemUserId: '',
    status: 'active' as 'active' | 'deprecated' | 'disabled',
    schemaDefinition: '',
    examplePayload: ''
  });
  const [newSchemaForm, setNewSchemaForm] = useState({
    name: '',
    eventType: '',
    version: '1.0.0',
    schemaFormat: 'json',
    schemaDefinition: '{\n  "type": "object",\n  "properties": {\n    \n  }\n}',
    description: '',
    isPublic: true,
    examplePayload: '',
    schemaId: '',
    domain: '' as 'payment' | 'account' | 'apply' | '',
    partnerUserId: '',
    systemUserId: ''
  });
  const [showAddSubscriptionModal, setShowAddSubscriptionModal] = useState(false);
  const [newSubscriptionForm, setNewSubscriptionForm] = useState({
    subscriberId: '',
    schemaId: '',
    webhookUrl: '',
    maxRetries: 3,
    backoffStrategy: 'exponential'
  });

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

  // Role-based permission helpers
  const canEdit = () => {
    return userRole === 'super_admin' || userRole === 'admin' || userRole === 'tester';
  };

  const canAccessTab = (tab: string) => {
    // RTB: Only Dashboard, Events, and DLQ
    if (userRole === 'rtb') {
      return ['overview', 'events', 'dlq'].includes(tab);
    }
    // Users tab: Only super_admin and admin
    if (tab === 'users') {
      return userRole === 'super_admin' || userRole === 'admin';
    }
    // All other tabs: accessible to all roles
    return true;
  };

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

      // Load admin users
      try {
        const usersData = await adminUserAPI.list({ page: 1, limit: 100 });
        setAdminUsers(usersData.admins || []);
      } catch (error) {
        console.error('Failed to load admin users:', error);
        setAdminUsers([]);
      }

      // Load subscribers
      try {
        const subscribersData = await subscriberAPI.list();
        setSubscribers(subscribersData.subscribers || []);
      } catch (error) {
        console.error('Failed to load subscribers:', error);
        setSubscribers([]);
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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await adminUserAPI.create(newUserForm);
      setGeneratedApiKey(result.apiKey);
      const roleLabel = newUserForm.role === 'super_admin' ? 'Super Admin' :
                        newUserForm.role === 'viewer' ? 'Viewer' : 'Admin';
      toast.success(`${roleLabel} user created successfully!`);
      setNewUserForm({ name: '', email: '', password: '', role: 'admin' });
      setShowAddUserModal(false);
      loadDashboardData();
    } catch (error) {
      toast.error('Failed to create admin user');
    }
  };

  const handleCloseApiKeyModal = () => {
    setGeneratedApiKey(null);
    setShowAddUserModal(false);
  };

  const handleAddSchema = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Parse JSON fields
      let schemaDefinition;
      let examplePayload = null;

      try {
        schemaDefinition = JSON.parse(newSchemaForm.schemaDefinition);
      } catch (error) {
        toast.error('Invalid JSON in Schema Definition');
        return;
      }

      if (newSchemaForm.examplePayload.trim()) {
        try {
          examplePayload = JSON.parse(newSchemaForm.examplePayload);
        } catch (error) {
          toast.error('Invalid JSON in Example Payload');
          return;
        }
      }

      await schemaAPI.register({
        name: newSchemaForm.name,
        eventType: newSchemaForm.eventType,
        version: newSchemaForm.version,
        schemaFormat: newSchemaForm.schemaFormat,
        schemaDefinition,
        description: newSchemaForm.description || undefined,
        isPublic: newSchemaForm.isPublic,
        domain: newSchemaForm.domain || undefined,
        systemUserId: newSchemaForm.systemUserId || undefined,
        ...(examplePayload && { examplePayload })
      });

      toast.success('Schema created successfully!');
      setNewSchemaForm({
        name: '',
        eventType: '',
        version: '1.0.0',
        schemaFormat: 'json',
        schemaDefinition: '{\n  "type": "object",\n  "properties": {\n    \n  }\n}',
        description: '',
        isPublic: true,
        examplePayload: ''
      });
      setShowAddSchemaModal(false);
      loadDashboardData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to create schema');
    }
  };

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await subscriptionAPI.subscribe({
        subscriberId: newSubscriptionForm.subscriberId,
        schemaId: newSubscriptionForm.schemaId,
        webhookUrl: newSubscriptionForm.webhookUrl || undefined,
        maxRetries: newSubscriptionForm.maxRetries,
        backoffStrategy: newSubscriptionForm.backoffStrategy
      });

      toast.success('Subscription created successfully!');
      setNewSubscriptionForm({
        subscriberId: '',
        schemaId: '',
        webhookUrl: '',
        maxRetries: 3,
        backoffStrategy: 'exponential'
      });
      setShowAddSubscriptionModal(false);
      loadDashboardData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to create subscription');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await adminUserAPI.delete(userId);
      toast.success('User deleted successfully');
      loadDashboardData();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-blue-600 to-blue-700 border-r border-blue-800 p-6 z-10 shadow-xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">Webhook Hub</h1>
            <p className="text-blue-100 text-xs">Webhook Management</p>
          </div>
        </div>

        <nav className="space-y-2">
          {canAccessTab('overview') && (
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                activeTab === 'overview'
                  ? 'bg-white text-blue-700 shadow-lg font-semibold'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span className="font-medium">Dashboard</span>
              {activeTab === 'overview' && <ChevronRight className="w-4 h-4 ml-auto" />}
            </button>
          )}
          {canAccessTab('schemas') && (
            <button
              onClick={() => setActiveTab('schemas')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                activeTab === 'schemas'
                  ? 'bg-white text-blue-700 shadow-lg font-semibold'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <FileCode className="w-5 h-5" />
              <span className="font-medium">Schemas</span>
              {activeTab === 'schemas' && <ChevronRight className="w-4 h-4 ml-auto" />}
            </button>
          )}
          {canAccessTab('subscriptions') && (
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                activeTab === 'subscriptions'
                  ? 'bg-white text-blue-700 shadow-lg font-semibold'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Webhook className="w-5 h-5" />
              <span className="font-medium">Subscribers</span>
              {activeTab === 'subscriptions' && <ChevronRight className="w-4 h-4 ml-auto" />}
            </button>
          )}
          {canAccessTab('events') && (
            <button
              onClick={() => setActiveTab('events')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                activeTab === 'events'
                  ? 'bg-white text-blue-700 shadow-lg font-semibold'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Activity className="w-5 h-5" />
              <span className="font-medium">Events</span>
              {activeTab === 'events' && <ChevronRight className="w-4 h-4 ml-auto" />}
            </button>
          )}
          {canAccessTab('dlq') && (
            <button
              onClick={() => setActiveTab('dlq')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                activeTab === 'dlq'
                  ? 'bg-white text-blue-700 shadow-lg font-semibold'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
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
          )}
          {canAccessTab('users') && (
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                activeTab === 'users'
                  ? 'bg-white text-blue-700 shadow-lg font-semibold'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">Users</span>
              {activeTab === 'users' && <ChevronRight className="w-4 h-4 ml-auto" />}
            </button>
          )}
        </nav>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {activeTab === 'overview' && 'Dashboard'}
              {activeTab === 'schemas' && 'Schemas'}
              {activeTab === 'subscriptions' && 'Subscribers'}
              {activeTab === 'events' && 'Events'}
              {activeTab === 'dlq' && 'Dead Letter Queue'}
              {activeTab === 'users' && 'Users'}
            </h2>
            <p className="text-gray-600">Welcome back, {userName}</p>
          </div>
          <div className="flex items-center gap-4">
            {activeTab === 'schemas' && (
              <button
                onClick={() => setShowAddSchemaModal(true)}
                className="px-4 py-2 bg-blue-600 border border-blue-600 rounded-lg text-white hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Schema
              </button>
            )}
            {activeTab === 'subscriptions' && (
              <button
                onClick={() => setShowAddSubscriptionModal(true)}
                className="px-4 py-2 bg-blue-600 border border-blue-600 rounded-lg text-white hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Subscription
              </button>
            )}
            <button
              onClick={loadDashboardData}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 border border-red-600 rounded-lg text-white hover:bg-red-700 transition-all flex items-center gap-2 shadow-sm"
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
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <FileCode className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    +12%
                  </span>
                </div>
                <h3 className="text-gray-600 text-sm mb-1">Total Schemas</h3>
                <p className="text-3xl font-bold text-gray-900">{stats.totalSchemas}</p>
                <p className="text-gray-500 text-xs mt-2">Active event schemas</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                  <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    +8%
                  </span>
                </div>
                <h3 className="text-gray-600 text-sm mb-1">Subscriptions</h3>
                <p className="text-3xl font-bold text-gray-900">{stats.totalSubscriptions}</p>
                <p className="text-gray-500 text-xs mt-2">Active webhook subscriptions</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-green-600" />
                  </div>
                  <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    +25%
                  </span>
                </div>
                <h3 className="text-gray-600 text-sm mb-1">Total Events</h3>
                <p className="text-3xl font-bold text-gray-900">{stats.totalEvents}</p>
                <p className="text-gray-500 text-xs mt-2">Events published this month</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                    <Database className="w-6 h-6 text-yellow-600" />
                  </div>
                  <span className={`text-sm font-medium flex items-center gap-1 ${stats.successRate >= 90 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {stats.successRate.toFixed(1)}%
                  </span>
                </div>
                <h3 className="text-gray-600 text-sm mb-1">Success Rate</h3>
                <p className="text-3xl font-bold text-gray-900">{stats.totalDeliveries}</p>
                <p className="text-gray-500 text-xs mt-2">Total deliveries processed</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Events Over Time Chart */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg">
                <h3 className="text-gray-900 text-lg font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  Events Over Time
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={eventsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="events" stroke="#2563eb" strokeWidth={2} dot={{ fill: '#2563eb' }} name="Published" />
                    <Line type="monotone" dataKey="successful" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} name="Successful" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Delivery Status Pie Chart */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg">
                <h3 className="text-gray-900 text-lg font-semibold mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" />
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
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg">
              <h3 className="text-gray-900 text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Recent Events
              </h3>
              <div className="space-y-3">
                {events.slice(0, 5).map((event) => (
                  <div key={event.eventId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <div>
                        <p className="text-gray-900 font-medium">{event.eventType}</p>
                        <p className="text-gray-600 text-sm">{format(new Date(event.createdAt), 'PPpp')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-gray-600 text-xs">Subscribers</p>
                        <p className="text-gray-900 font-semibold">{event.subscriberCount}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600 text-xs">Completed</p>
                        <p className="text-green-600 font-semibold">{event.deliveriesCompleted}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600 text-xs">Failed</p>
                        <p className="text-red-600 font-semibold">{event.deliveriesFailed}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {events.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
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
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Schema ID</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Schema Name</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Domain</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Event Type</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Partner User ID</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">System User ID</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Version</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Status</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schemas.map((schema) => (
                      <tr key={schema.id} className="border-b border-gray-100 hover:bg-gray-50 transition-all">
                        <td className="py-4 px-4">
                          <span className="text-gray-700 font-mono text-sm">{schema.schemaId || '-'}</span>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-gray-900 font-medium">{schema.name}</p>
                        </td>
                        <td className="py-4 px-4">
                          {schema.domain ? (
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              schema.domain === 'payment' ? 'bg-green-100 text-green-700' :
                              schema.domain === 'account' ? 'bg-blue-100 text-blue-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {schema.domain}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                            {schema.eventType}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-gray-700 font-mono text-sm">{schema.partnerUserId || '-'}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-gray-700 font-mono text-sm">{schema.systemUserId || '-'}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-gray-700">{schema.version}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${schema.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {schema.status}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  // Fetch full schema details
                                  const response = await fetch(`http://localhost:3000/api/v1/schemas/${schema.id}`, {
                                    headers: {
                                      'X-API-Key': localStorage.getItem('apiKey') || ''
                                    }
                                  });
                                  const result = await response.json();
                                  console.log('Schema API response:', result);

                                  // The API returns data in the root level or nested in 'data'
                                  const schemaData = result.data || result;
                                  console.log('Schema data:', schemaData);

                                  setSelectedSchema(schemaData);
                                  setShowSchemaModal(true);
                                } catch (error) {
                                  console.error('Error fetching schema:', error);
                                  toast.error('Failed to load schema details');
                                }
                              }}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm flex items-center gap-2"
                            >
                              <FileCode className="w-4 h-4" />
                              View
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  // Fetch full schema details for editing
                                  const response = await fetch(`http://localhost:3000/api/v1/schemas/${schema.id}`, {
                                    headers: {
                                      'X-API-Key': localStorage.getItem('apiKey') || ''
                                    }
                                  });
                                  const result = await response.json();
                                  const schemaData = result.data || result;

                                  setSelectedSchema(schemaData);
                                  setEditSchemaForm({
                                    domain: schemaData.domain || '',
                                    partnerUserId: schemaData.partnerUserId || '',
                                    systemUserId: schemaData.systemUserId || '',
                                    status: schemaData.status || 'active',
                                    schemaDefinition: typeof schemaData.schemaDefinition === 'string'
                                      ? schemaData.schemaDefinition
                                      : JSON.stringify(schemaData.schemaDefinition, null, 2),
                                    examplePayload: schemaData.examplePayload
                                      ? (typeof schemaData.examplePayload === 'string'
                                          ? schemaData.examplePayload
                                          : JSON.stringify(schemaData.examplePayload, null, 2))
                                      : ''
                                  });
                                  setShowEditSchemaModal(true);
                                } catch (error) {
                                  console.error('Error fetching schema for edit:', error);
                                  toast.error('Failed to load schema details');
                                }
                              }}
                              className="px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all text-sm"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {schemas.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
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
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg">
              <div className="space-y-4">
                {subscriptions.map((subscription) => (
                  <div key={subscription.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${subscription.enabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                        <h4 className="text-gray-900 font-semibold">
                          {subscription.schema?.name || 'Schema'}
                        </h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${subscription.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {subscription.status}
                        </span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(subscription.webhookUrl, subscription.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm"
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
                        <p className="text-gray-600 font-medium">Webhook URL</p>
                        <p className="text-gray-900 truncate font-medium">{subscription.webhookUrl}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium">Max Retries</p>
                        <p className="text-gray-900 font-medium">{subscription.maxRetries}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium">Backoff Strategy</p>
                        <p className="text-gray-900 capitalize font-medium">{subscription.backoffStrategy}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {subscriptions.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
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

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowAddUserModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm"
              >
                <Users className="w-4 h-4" />
                Add User
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Name</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Email</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Role</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Status</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Last Login</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Created</th>
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-all">
                        <td className="py-4 px-4">
                          <p className="text-gray-900 font-semibold">{user.name}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-gray-700 font-medium">{user.email}</p>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            user.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                            user.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {user.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            user.status === 'active' ? 'bg-green-100 text-green-700' :
                            user.status === 'suspended' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-gray-600 text-sm font-medium">
                            {user.lastLoginAt ? format(new Date(user.lastLoginAt), 'PP') : 'Never'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-gray-600 text-sm font-medium">{format(new Date(user.createdAt), 'PP')}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setEditUserForm({
                                  role: user.role,
                                  password: '',
                                  status: user.status
                                });
                                setShowEditUserModal(true);
                              }}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {adminUsers.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No users found
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUserModal && !generatedApiKey && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/20 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Add New Admin User</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Name</label>
                <input
                  type="text"
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Email</label>
                <input
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Password</label>
                <input
                  type="password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                  minLength={6}
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-2 block">Role</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as 'super_admin' | 'admin' | 'viewer' })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUserModal(false);
                    setNewUserForm({ name: '', email: '', password: '', role: 'admin' });
                  }}
                  className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-all"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* API Key Display Modal */}
      {generatedApiKey && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/20 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">User Created Successfully!</h3>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
              <p className="text-yellow-300 text-sm mb-2">
                <strong>Important:</strong> Save this API key securely. It will not be shown again.
              </p>
            </div>
            <div className="bg-white/10 border border-white/20 rounded-lg p-4 mb-4">
              <p className="text-gray-400 text-xs mb-2">API Key:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-white font-mono text-sm break-all">{generatedApiKey}</code>
                <button
                  onClick={() => {
                    copyToClipboard(generatedApiKey, 'api-key');
                    toast.success('API Key copied!');
                  }}
                  className="p-2 bg-violet-600/20 text-violet-300 rounded-lg hover:bg-violet-600/30 transition-all"
                >
                  {copiedId === 'api-key' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              onClick={handleCloseApiKeyModal}
              className="w-full px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-all"
            >
              I've Saved the API Key
            </button>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Edit User</h3>
              <button
                onClick={() => {
                  setShowEditUserModal(false);
                  setSelectedUser(null);
                  setEditUserForm({ role: 'admin', password: '', status: 'active' });
                }}
                className="text-gray-400 hover:text-gray-900 transition-all text-2xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedUser) return;

              try {
                const updateData: any = {
                  role: editUserForm.role,
                  status: editUserForm.status
                };

                // Only include password if it's been changed
                if (editUserForm.password) {
                  updateData.password = editUserForm.password;
                }

                const response = await fetch(`http://localhost:3000/api/v1/admin/users/${selectedUser.id}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': localStorage.getItem('apiKey') || ''
                  },
                  body: JSON.stringify(updateData)
                });

                if (response.ok) {
                  toast.success('User updated successfully!');
                  setShowEditUserModal(false);
                  setSelectedUser(null);
                  setEditUserForm({ role: 'admin', password: '', status: 'active' });
                  loadDashboardData();
                } else {
                  const error = await response.json();
                  toast.error(error.message || 'Failed to update user');
                }
              } catch (error) {
                console.error('Error updating user:', error);
                toast.error('Failed to update user');
              }
            }} className="space-y-4">
              {/* User Info - Read Only */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  defaultValue={selectedUser.name}
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed"
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="text"
                  defaultValue={selectedUser.email}
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed"
                  disabled
                />
              </div>

              {/* Role - Editable */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={editUserForm.role}
                  onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value as 'super_admin' | 'admin' | 'viewer' })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              {/* Status - Editable */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={editUserForm.status}
                  onChange={(e) => setEditUserForm({ ...editUserForm, status: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Password - Optional */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password <span className="text-gray-400 text-xs">(Leave empty to keep current)</span>
                </label>
                <input
                  type="password"
                  value={editUserForm.password}
                  onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Min 6 characters"
                  minLength={6}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-sm"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditUserModal(false);
                    setSelectedUser(null);
                    setEditUserForm({ role: 'admin', password: '', status: 'active' });
                  }}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Schema Modal */}
      {showAddSchemaModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-900 to-blue-900 border border-white/20 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Add New Schema</h3>
              <button
                onClick={() => {
                  setShowAddSchemaModal(false);
                  setNewSchemaForm({
                    name: '',
                    eventType: '',
                    version: '1.0.0',
                    schemaFormat: 'json',
                    schemaDefinition: '{\n  "type": "object",\n  "properties": {\n    \n  }\n}',
                    description: '',
                    isPublic: true,
                    examplePayload: '',
                    schemaId: '',
                    domain: '',
                    partnerUserId: '',
                    systemUserId: ''
                  });
                }}
                className="text-gray-400 hover:text-white transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSchema} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Schema Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSchemaForm.name}
                    onChange={(e) => setNewSchemaForm({ ...newSchemaForm, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="user.created"
                  />
                </div>

                {/* Event Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Event Type *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSchemaForm.eventType}
                    onChange={(e) => setNewSchemaForm({ ...newSchemaForm, eventType: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="user.created"
                  />
                </div>

                {/* Version */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Version *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSchemaForm.version}
                    onChange={(e) => setNewSchemaForm({ ...newSchemaForm, version: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="1.0.0"
                  />
                </div>

                {/* Schema Format */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Schema Format *
                  </label>
                  <select
                    value={newSchemaForm.schemaFormat}
                    onChange={(e) => setNewSchemaForm({ ...newSchemaForm, schemaFormat: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="json">JSON</option>
                    <option value="avro">Avro</option>
                    <option value="protobuf">Protobuf</option>
                  </select>
                </div>

                {/* Domain */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Domain
                  </label>
                  <select
                    value={newSchemaForm.domain}
                    onChange={(e) => setNewSchemaForm({ ...newSchemaForm, domain: e.target.value as 'payment' | 'account' | 'apply' | '' })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select domain</option>
                    <option value="payment">Payment</option>
                    <option value="account">Account</option>
                    <option value="apply">Apply</option>
                  </select>
                </div>

                {/* System User ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    System User ID
                  </label>
                  <input
                    type="text"
                    value={newSchemaForm.systemUserId}
                    onChange={(e) => setNewSchemaForm({ ...newSchemaForm, systemUserId: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="system_67890"
                  />
                </div>
              </div>

              {/* Info about auto-generated fields */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-300 text-sm">
                  <strong>Note:</strong> Schema ID and Partner User ID will be auto-generated when you create the schema.
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={newSchemaForm.description}
                  onChange={(e) => setNewSchemaForm({ ...newSchemaForm, description: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Brief description of the schema"
                />
              </div>

              {/* Schema Definition */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Schema Definition (JSON) *
                </label>
                <textarea
                  required
                  value={newSchemaForm.schemaDefinition}
                  onChange={(e) => setNewSchemaForm({ ...newSchemaForm, schemaDefinition: e.target.value })}
                  rows={12}
                  className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder='{\n  "type": "object",\n  "properties": {\n    "userId": { "type": "string" }\n  }\n}'
                />
              </div>

              {/* Example Payload */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Example Payload (JSON)
                </label>
                <textarea
                  value={newSchemaForm.examplePayload}
                  onChange={(e) => setNewSchemaForm({ ...newSchemaForm, examplePayload: e.target.value })}
                  rows={8}
                  className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder='{\n  "userId": "12345",\n  "email": "user@example.com"\n}'
                />
              </div>

              {/* Is Public */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={newSchemaForm.isPublic}
                  onChange={(e) => setNewSchemaForm({ ...newSchemaForm, isPublic: e.target.checked })}
                  className="w-5 h-5 bg-white/10 border border-white/20 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="isPublic" className="text-sm font-medium text-gray-300">
                  Make this schema public (visible in marketplace)
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-4 pt-4 border-t border-white/10">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium"
                >
                  Create Schema
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSchemaModal(false);
                    setNewSchemaForm({
                      name: '',
                      eventType: '',
                      version: '1.0.0',
                      schemaFormat: 'json',
                      schemaDefinition: '{\n  "type": "object",\n  "properties": {\n    \n  }\n}',
                      description: '',
                      isPublic: true,
                      examplePayload: ''
                    });
                  }}
                  className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Subscription Modal */}
      {showAddSubscriptionModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-900 to-violet-900 border border-white/20 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Add New Subscription</h3>
              <button
                onClick={() => {
                  setShowAddSubscriptionModal(false);
                  setNewSubscriptionForm({
                    subscriberId: '',
                    schemaId: '',
                    webhookUrl: '',
                    maxRetries: 3,
                    backoffStrategy: 'exponential'
                  });
                }}
                className="text-gray-400 hover:text-white transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubscription} className="space-y-6">
              {/* Subscriber Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Subscriber *
                </label>
                <select
                  required
                  value={newSubscriptionForm.subscriberId}
                  onChange={(e) => setNewSubscriptionForm({ ...newSubscriptionForm, subscriberId: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Select a subscriber</option>
                  {subscribers.map((subscriber) => (
                    <option key={subscriber.id} value={subscriber.id} className="bg-gray-900">
                      {subscriber.name} ({subscriber.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Schema Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Schema *
                </label>
                <select
                  required
                  value={newSubscriptionForm.schemaId}
                  onChange={(e) => setNewSubscriptionForm({ ...newSubscriptionForm, schemaId: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Select a schema</option>
                  {schemas.map((schema) => (
                    <option key={schema.id} value={schema.id} className="bg-gray-900">
                      {schema.name} (v{schema.version})
                    </option>
                  ))}
                </select>
              </div>

              {/* Webhook URL */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Webhook URL (Optional)
                </label>
                <input
                  type="url"
                  value={newSubscriptionForm.webhookUrl}
                  onChange={(e) => setNewSubscriptionForm({ ...newSubscriptionForm, webhookUrl: e.target.value })}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="https://api.example.com/webhook"
                />
                <p className="text-sm text-gray-400 mt-1">Leave empty to use default subscriber webhook URL</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Max Retries */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Max Retries
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={newSubscriptionForm.maxRetries}
                    onChange={(e) => setNewSubscriptionForm({ ...newSubscriptionForm, maxRetries: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                {/* Backoff Strategy */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Backoff Strategy
                  </label>
                  <select
                    value={newSubscriptionForm.backoffStrategy}
                    onChange={(e) => setNewSubscriptionForm({ ...newSubscriptionForm, backoffStrategy: e.target.value })}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="exponential">Exponential</option>
                    <option value="linear">Linear</option>
                    <option value="constant">Constant</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-4 pt-4 border-t border-white/10">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-all font-medium"
                >
                  Create Subscription
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSubscriptionModal(false);
                    setNewSubscriptionForm({
                      subscriberId: '',
                      schemaId: '',
                      webhookUrl: '',
                      maxRetries: 3,
                      backoffStrategy: 'exponential'
                    });
                  }}
                  className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schema Detail Modal */}
      {showSchemaModal && selectedSchema && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{selectedSchema.name}</h3>
                <p className="text-gray-600 mt-1">Event Type: {selectedSchema.eventType}</p>
              </div>
              <button
                onClick={() => {
                  setShowSchemaModal(false);
                  setSelectedSchema(null);
                }}
                className="text-gray-400 hover:text-gray-900 transition-all text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Schema Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-gray-600 text-sm font-medium">Version</p>
                  <p className="text-gray-900 font-semibold mt-1">{selectedSchema.version}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-gray-600 text-sm font-medium">Format</p>
                  <p className="text-gray-900 font-semibold mt-1">{selectedSchema.schemaFormat || 'json'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-gray-600 text-sm font-medium">Subscriptions</p>
                  <p className="text-gray-900 font-semibold mt-1">{selectedSchema.subscriptionCount}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-gray-600 text-sm font-medium">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${selectedSchema.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {selectedSchema.status}
                  </span>
                </div>
              </div>

              {/* Schema Definition */}
              {selectedSchema.schemaDefinition && (
                <div>
                  <h4 className="text-gray-900 font-semibold mb-3 flex items-center gap-2">
                    <FileCode className="w-5 h-5" />
                    Schema Definition
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-96 overflow-y-auto">
                    <pre className="text-sm text-gray-800 overflow-x-auto whitespace-pre-wrap">
                      {(() => {
                        try {
                          if (typeof selectedSchema.schemaDefinition === 'string') {
                            // Try to parse and prettify if it's a JSON string
                            const parsed = JSON.parse(selectedSchema.schemaDefinition);
                            return JSON.stringify(parsed, null, 2);
                          } else {
                            return JSON.stringify(selectedSchema.schemaDefinition, null, 2);
                          }
                        } catch (e) {
                          // If parsing fails, just show the string
                          return selectedSchema.schemaDefinition;
                        }
                      })()}
                    </pre>
                  </div>
                </div>
              )}

              {/* Example Payload */}
              {selectedSchema.examplePayload && (
                <div>
                  <h4 className="text-gray-900 font-semibold mb-3 flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Example Payload
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-h-96 overflow-y-auto">
                    <pre className="text-sm text-gray-800 overflow-x-auto whitespace-pre-wrap">
                      {(() => {
                        try {
                          if (typeof selectedSchema.examplePayload === 'string') {
                            // Try to parse and prettify if it's a JSON string
                            const parsed = JSON.parse(selectedSchema.examplePayload);
                            return JSON.stringify(parsed, null, 2);
                          } else {
                            return JSON.stringify(selectedSchema.examplePayload, null, 2);
                          }
                        } catch (e) {
                          // If parsing fails, just show the string
                          return selectedSchema.examplePayload;
                        }
                      })()}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowSchemaModal(false);
                  setSelectedSchema(null);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Schema Modal */}
      {showEditSchemaModal && selectedSchema && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Edit Schema</h3>
              <button
                onClick={() => {
                  setShowEditSchemaModal(false);
                  setSelectedSchema(null);
                }}
                className="text-gray-400 hover:text-gray-900 transition-all text-2xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedSchema) return;

              try {
                // Parse JSON fields before sending
                let schemaDefinition = null;
                let examplePayload = null;

                try {
                  if (editSchemaForm.schemaDefinition) {
                    schemaDefinition = JSON.parse(editSchemaForm.schemaDefinition);
                  }
                } catch (error) {
                  toast.error('Invalid JSON in Schema Definition');
                  return;
                }

                try {
                  if (editSchemaForm.examplePayload) {
                    examplePayload = JSON.parse(editSchemaForm.examplePayload);
                  }
                } catch (error) {
                  toast.error('Invalid JSON in Example Payload');
                  return;
                }

                // Update schema via direct database update
                const response = await fetch(`http://localhost:3000/api/v1/admin/schemas/${selectedSchema.id}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': localStorage.getItem('apiKey') || ''
                  },
                  body: JSON.stringify({
                    domain: editSchemaForm.domain || null,
                    partnerUserId: editSchemaForm.partnerUserId || null,
                    systemUserId: editSchemaForm.systemUserId || null,
                    status: editSchemaForm.status,
                    schemaDefinition: schemaDefinition,
                    examplePayload: examplePayload
                  })
                });

                if (response.ok) {
                  toast.success('Schema updated successfully!');
                  setShowEditSchemaModal(false);
                  setSelectedSchema(null);
                  loadDashboardData();
                } else {
                  toast.error('Failed to update schema');
                }
              } catch (error) {
                console.error('Error updating schema:', error);
                toast.error('Failed to update schema');
              }
            }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Schema ID - Read Only */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schema ID <span className="text-gray-400 text-xs">(Auto-generated)</span>
                  </label>
                  <input
                    type="text"
                    defaultValue={selectedSchema.schemaId || 'Not assigned'}
                    className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed font-mono"
                    disabled
                  />
                </div>

                {/* Schema Name - Read Only */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schema Name
                  </label>
                  <input
                    type="text"
                    defaultValue={selectedSchema.name}
                    className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed"
                    disabled
                  />
                </div>

                {/* Partner User ID - Editable */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Partner User ID
                  </label>
                  <input
                    type="text"
                    value={editSchemaForm.partnerUserId}
                    onChange={(e) => setEditSchemaForm({ ...editSchemaForm, partnerUserId: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="PARTNER-xxxxxxxx"
                  />
                </div>

                {/* Event Type - Read Only */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Type
                  </label>
                  <input
                    type="text"
                    defaultValue={selectedSchema.eventType}
                    className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed"
                    disabled
                  />
                </div>

                {/* Domain - Editable */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Domain
                  </label>
                  <select
                    value={editSchemaForm.domain}
                    onChange={(e) => setEditSchemaForm({ ...editSchemaForm, domain: e.target.value as 'payment' | 'account' | 'apply' | '' })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select domain</option>
                    <option value="payment">Payment</option>
                    <option value="account">Account</option>
                    <option value="apply">Apply</option>
                  </select>
                </div>

                {/* System User ID - Editable */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    System User ID
                  </label>
                  <input
                    type="text"
                    value={editSchemaForm.systemUserId}
                    onChange={(e) => setEditSchemaForm({ ...editSchemaForm, systemUserId: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="system_67890"
                  />
                </div>

                {/* Version */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Version
                  </label>
                  <input
                    type="text"
                    defaultValue={selectedSchema.version}
                    className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed"
                    disabled
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={editSchemaForm.status}
                    onChange={(e) => setEditSchemaForm({ ...editSchemaForm, status: e.target.value as 'active' | 'deprecated' | 'disabled' })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="deprecated">Deprecated</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                {/* Schema Definition - Full Width */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schema Definition (JSON)
                  </label>
                  <textarea
                    value={editSchemaForm.schemaDefinition}
                    onChange={(e) => setEditSchemaForm({ ...editSchemaForm, schemaDefinition: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={10}
                    placeholder='{"type": "object", "properties": {...}}'
                  />
                </div>

                {/* Example Payload - Full Width */}
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Example Payload (JSON)
                  </label>
                  <textarea
                    value={editSchemaForm.examplePayload}
                    onChange={(e) => setEditSchemaForm({ ...editSchemaForm, examplePayload: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={10}
                    placeholder='{"userId": "12345", "amount": 100}'
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-sm"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditSchemaModal(false);
                    setSelectedSchema(null);
                  }}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
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

export default AdminDashboard;
