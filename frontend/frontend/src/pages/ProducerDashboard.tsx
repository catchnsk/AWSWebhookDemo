import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { schemaAPI, eventAPI } from '../lib/api';
import type { Schema, EventMessage } from '../lib/api';
import {
  FileCode,
  TrendingUp,
  Send,
  LogOut,
  Plus,
  Check,
  RefreshCw,
  Zap,
  Database,
  Eye,
  EyeOff,
  X,
  Code,
  Clock,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface PublishFormData {
  eventType: string;
  payload: string;
  idempotencyKey: string;
}

const ProducerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { clearAuth, userName } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [events, setEvents] = useState<EventMessage[]>([]);
  const [showSchemaForm, setShowSchemaForm] = useState(false);

  const [schemaForm, setSchemaForm] = useState({
    name: '',
    eventType: '',
    version: '1.0.0',
    schemaFormat: 'JSON_SCHEMA',
    schemaDefinition: '',
    description: '',
    isPublic: false,
  });

  const [publishForm, setPublishForm] = useState<PublishFormData>({
    eventType: '',
    payload: '',
    idempotencyKey: '',
  });

  const [stats, setStats] = useState({
    totalSchemas: 0,
    totalEvents: 0,
    successRate: 95.8,
    avgDeliveryTime: 234,
  });

  // Mock data for analytics chart
  const [publishHistory] = useState([
    { date: 'Jan', published: 1200, delivered: 1150 },
    { date: 'Feb', published: 1800, delivered: 1750 },
    { date: 'Mar', published: 2500, delivered: 2425 },
    { date: 'Apr', published: 3200, delivered: 3100 },
    { date: 'May', published: 2800, delivered: 2730 },
    { date: 'Jun', published: 4000, delivered: 3880 },
  ]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const schemasData = await schemaAPI.list({ page: 1, limit: 100 });
      setSchemas(schemasData.schemas || []);

      const eventsData = await eventAPI.list({ page: 1, limit: 100 });
      setEvents(eventsData.events || []);

      setStats({
        totalSchemas: schemasData.total || schemasData.schemas?.length || 0,
        totalEvents: eventsData.total || eventsData.events?.length || 0,
        successRate: 95.8,
        avgDeliveryTime: 234,
      });
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

  const handleSchemaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let schemaDefinition;
      try {
        schemaDefinition = JSON.parse(schemaForm.schemaDefinition);
      } catch (error) {
        toast.error('Invalid JSON schema definition');
        return;
      }

      await schemaAPI.register({
        ...schemaForm,
        schemaDefinition,
      });

      toast.success('Schema registered successfully!');
      setShowSchemaForm(false);
      setSchemaForm({
        name: '',
        eventType: '',
        version: '1.0.0',
        schemaFormat: 'JSON_SCHEMA',
        schemaDefinition: '',
        description: '',
        isPublic: false,
      });
      loadDashboardData();
    } catch (error) {
      toast.error('Failed to register schema');
    }
  };

  const handlePublishEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let payload;
      try {
        payload = JSON.parse(publishForm.payload);
      } catch (error) {
        toast.error('Invalid JSON payload');
        return;
      }

      const result = await eventAPI.publish({
        eventType: publishForm.eventType,
        payload,
        idempotencyKey: publishForm.idempotencyKey || undefined,
      });

      toast.success(
        `Event published! ${result.deliveriesQueued} deliveries queued for ${result.subscriberCount} subscribers`
      );
      setPublishForm({
        eventType: '',
        payload: '',
        idempotencyKey: '',
      });
      loadDashboardData();
    } catch (error) {
      toast.error('Failed to publish event');
    }
  };

  const getSampleSchema = () => {
    return JSON.stringify(
      {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          action: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
          metadata: {
            type: 'object',
            properties: {
              ip: { type: 'string' },
              userAgent: { type: 'string' },
            },
          },
        },
        required: ['userId', 'action', 'timestamp'],
      },
      null,
      2
    );
  };

  const getSamplePayload = () => {
    return JSON.stringify(
      {
        userId: 'user_123',
        action: 'login',
        timestamp: new Date().toISOString(),
        metadata: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
      },
      null,
      2
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Producer Dashboard</h1>
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
              <FileCode className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-green-400 text-sm font-medium flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              +15%
            </span>
          </div>
          <h3 className="text-gray-400 text-sm mb-1">Registered Schemas</h3>
          <p className="text-3xl font-bold text-white">{stats.totalSchemas}</p>
          <p className="text-gray-500 text-xs mt-2">Event type definitions</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-purple-400" />
            </div>
            <span className="text-green-400 text-sm font-medium flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              +23%
            </span>
          </div>
          <h3 className="text-gray-400 text-sm mb-1">Events Published</h3>
          <p className="text-3xl font-bold text-white">{stats.totalEvents}</p>
          <p className="text-gray-500 text-xs mt-2">This month</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <span className="text-green-400 text-sm font-medium">{stats.successRate}%</span>
          </div>
          <h3 className="text-gray-400 text-sm mb-1">Delivery Success Rate</h3>
          <p className="text-3xl font-bold text-white">{stats.successRate}%</p>
          <p className="text-gray-500 text-xs mt-2">Successful deliveries</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6 text-yellow-400" />
            </div>
            <span className="text-gray-400 text-sm">ms</span>
          </div>
          <h3 className="text-gray-400 text-sm mb-1">Avg Latency</h3>
          <p className="text-3xl font-bold text-white">{stats.avgDeliveryTime}</p>
          <p className="text-gray-500 text-xs mt-2">Average delivery time</p>
        </div>
      </div>

      {/* Analytics Chart */}
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl mb-8">
        <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-violet-400" />
          Publishing Analytics
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={publishHistory}>
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
            <Line type="monotone" dataKey="published" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} name="Published" />
            <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} name="Delivered" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Schema Management */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Code className="w-6 h-6 text-violet-400" />
              My Schemas
            </h2>
            <button
              onClick={() => setShowSchemaForm(!showSchemaForm)}
              className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:from-violet-700 hover:to-purple-700 transition-all flex items-center gap-2 shadow-lg"
            >
              {showSchemaForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showSchemaForm ? 'Cancel' : 'Register Schema'}
            </button>
          </div>

          {/* Schema Registration Form */}
          {showSchemaForm && (
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
              <h3 className="text-white text-lg font-semibold mb-4">Register New Schema</h3>
              <form onSubmit={handleSchemaSubmit} className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Schema Name</label>
                  <input
                    type="text"
                    value={schemaForm.name}
                    onChange={(e) => setSchemaForm({ ...schemaForm, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="User Activity Schema"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">Event Type</label>
                    <input
                      type="text"
                      value={schemaForm.eventType}
                      onChange={(e) => setSchemaForm({ ...schemaForm, eventType: e.target.value })}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="user.activity"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">Version</label>
                    <input
                      type="text"
                      value={schemaForm.version}
                      onChange={(e) => setSchemaForm({ ...schemaForm, version: e.target.value })}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="1.0.0"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Description</label>
                  <input
                    type="text"
                    value={schemaForm.description}
                    onChange={(e) => setSchemaForm({ ...schemaForm, description: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="Schema for user activity events"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-gray-300 text-sm font-medium">Schema Definition (JSON Schema)</label>
                    <button
                      type="button"
                      onClick={() => setSchemaForm({ ...schemaForm, schemaDefinition: getSampleSchema() })}
                      className="text-violet-400 text-sm hover:text-violet-300 flex items-center gap-1"
                    >
                      <Code className="w-3 h-3" />
                      Use Sample
                    </button>
                  </div>
                  <textarea
                    value={schemaForm.schemaDefinition}
                    onChange={(e) => setSchemaForm({ ...schemaForm, schemaDefinition: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono text-sm"
                    rows={10}
                    placeholder={getSampleSchema()}
                    required
                  />
                </div>

                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={schemaForm.isPublic}
                    onChange={(e) => setSchemaForm({ ...schemaForm, isPublic: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-violet-600 focus:ring-violet-500"
                  />
                  <label htmlFor="isPublic" className="text-gray-300 text-sm flex items-center gap-2 flex-1">
                    {schemaForm.isPublic ? <Eye className="w-4 h-4 text-green-400" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                    Make this schema public for others to subscribe
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:from-violet-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <Check className="w-5 h-5" />
                  Register Schema
                </button>
              </form>
            </div>
          )}

          {/* Schema List */}
          <div className="space-y-3">
            {schemas.map((schema) => (
              <div key={schema.id} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-4 shadow-xl hover:shadow-2xl transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold text-lg">{schema.name}</h3>
                    <p className="text-gray-400 text-sm">{schema.eventType}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs">
                      v{schema.version}
                    </span>
                    {schema.isPublic ? (
                      <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        Public
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-gray-500/20 text-gray-300 rounded-full text-xs flex items-center gap-1">
                        <EyeOff className="w-3 h-3" />
                        Private
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400">
                      <span className="text-white font-semibold">{schema.subscriptionCount}</span> subscriptions
                    </span>
                    <span className="text-gray-400">
                      Created {format(new Date(schema.createdAt), 'PP')}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setPublishForm({ ...publishForm, eventType: schema.eventType });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-3 py-1.5 bg-violet-600/20 text-violet-300 rounded-lg hover:bg-violet-600/30 transition-all flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Publish Event
                  </button>
                </div>
              </div>
            ))}
            {schemas.length === 0 && (
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-12 text-center">
                <FileCode className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">No schemas registered yet</p>
                <p className="text-gray-500 text-sm mt-2">Click "Register Schema" to create your first event schema</p>
              </div>
            )}
          </div>
        </div>

        {/* Event Publishing */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Send className="w-6 h-6 text-violet-400" />
              Publish Event
            </h2>
          </div>

          {/* Event Publishing Form */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
            <form onSubmit={handlePublishEvent} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Event Type</label>
                <select
                  value={publishForm.eventType}
                  onChange={(e) => setPublishForm({ ...publishForm, eventType: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                >
                  <option value="" className="bg-slate-800">Select an event type</option>
                  {schemas.map((schema) => (
                    <option key={schema.id} value={schema.eventType} className="bg-slate-800">
                      {schema.eventType} ({schema.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-gray-300 text-sm font-medium">Event Payload (JSON)</label>
                  <button
                    type="button"
                    onClick={() => setPublishForm({ ...publishForm, payload: getSamplePayload() })}
                    className="text-violet-400 text-sm hover:text-violet-300 flex items-center gap-1"
                  >
                    <Code className="w-3 h-3" />
                    Use Sample
                  </button>
                </div>
                <textarea
                  value={publishForm.payload}
                  onChange={(e) => setPublishForm({ ...publishForm, payload: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono text-sm"
                  rows={14}
                  placeholder={getSamplePayload()}
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Idempotency Key (Optional)
                </label>
                <input
                  type="text"
                  value={publishForm.idempotencyKey}
                  onChange={(e) => setPublishForm({ ...publishForm, idempotencyKey: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="unique-key-123"
                />
              </div>

              <button
                type="submit"
                className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:from-violet-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Send className="w-5 h-5" />
                Publish Event
              </button>
            </form>
          </div>

          {/* Recent Events */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-xl">
            <h3 className="text-white text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-violet-400" />
              Recent Events
            </h3>
            <div className="space-y-3">
              {events.slice(0, 5).map((event) => (
                <div key={event.eventId} className="p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-violet-400 font-medium">{event.eventType}</span>
                    <span className="text-gray-400 text-xs">{format(new Date(event.createdAt), 'PPp')}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400">
                      <span className="text-blue-400 font-semibold">{event.deliveriesQueued}</span> queued
                    </span>
                    <span className="text-gray-400">
                      <span className="text-green-400 font-semibold">{event.deliveriesCompleted}</span> delivered
                    </span>
                    <span className="text-gray-400">
                      <span className="text-red-400 font-semibold">{event.deliveriesFailed}</span> failed
                    </span>
                  </div>
                </div>
              ))}
              {events.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No events published yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProducerDashboard;
