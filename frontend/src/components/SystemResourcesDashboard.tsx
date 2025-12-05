import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HardDrive, Cpu, MemoryStick, Users, TrendingUp, Activity } from 'lucide-react';
import { useApp } from '../store';
import * as api from '../api';
import { formatFileSize, cn } from '../utils';

export default function SystemResourcesDashboard() {
  const { showToast } = useApp();
  const [resources, setResources] = useState<api.SystemResources | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    loadResources();
    // Refresh every 5 seconds
    const interval = setInterval(() => {
      loadResources();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadResources = async () => {
    try {
      const data = await api.getSystemResources();
      setResources(data);
      setLastUpdate(new Date());
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load system resources', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted">Loading system resources...</div>
      </div>
    );
  }

  if (!resources) {
    return null;
  }

  const statCards = [
    {
      icon: HardDrive,
      label: 'Disk Space',
      value: formatFileSize(resources.disk.used),
      subValue: `of ${formatFileSize(resources.disk.total)}`,
      percent: resources.disk.usedPercent,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      barColor: 'bg-blue-500',
    },
    {
      icon: MemoryStick,
      label: 'Memory',
      value: formatFileSize(resources.memory.used),
      subValue: `of ${formatFileSize(resources.memory.total)}`,
      percent: resources.memory.usedPercent,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      barColor: 'bg-green-500',
    },
    {
      icon: Cpu,
      label: 'CPU',
      value: `${resources.cpu.cores} Core${resources.cpu.cores !== 1 ? 's' : ''}`,
      subValue: resources.cpu.model.split(' ').slice(0, 3).join(' '),
      percent: resources.cpu.usagePercent || 0,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
      barColor: 'bg-purple-500',
    },
    {
      icon: Users,
      label: 'Active Sessions',
      value: resources.sessions.active.toString(),
      subValue: 'users online',
      percent: 0,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
      barColor: 'bg-orange-500',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">System Resources</h1>
            <p className="text-sm text-muted">Real-time monitoring of server resources</p>
          </div>
          <div className="text-xs text-muted">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-6 bg-surface border border-border rounded-lg"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 ${stat.bgColor} rounded-lg`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground mb-1">{stat.value}</div>
                <div className="text-sm text-muted mb-3">{stat.subValue}</div>
                
                {stat.percent > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted">
                      <span>Usage</span>
                      <span>{stat.percent.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-surface-secondary overflow-hidden">
                      <motion.div
                        className={cn('h-full', stat.barColor)}
                        initial={{ width: 0 }}
                        animate={{ width: `${stat.percent}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Disk Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-6 bg-surface border border-border rounded-lg"
          >
            <div className="flex items-center gap-2 mb-4">
              <HardDrive className="w-5 h-5 text-muted" />
              <h2 className="text-lg font-semibold text-foreground">Disk Storage</h2>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted">Used</span>
                  <span className="font-medium text-foreground">{formatFileSize(resources.disk.used)}</span>
                </div>
                <div className="h-3 bg-surface-secondary overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${resources.disk.usedPercent}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <div className="text-xs text-muted mb-1">Total</div>
                  <div className="text-sm font-medium text-foreground">{formatFileSize(resources.disk.total)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted mb-1">Available</div>
                  <div className="text-sm font-medium text-foreground">{formatFileSize(resources.disk.available)}</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Memory Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="p-6 bg-surface border border-border rounded-lg"
          >
            <div className="flex items-center gap-2 mb-4">
              <MemoryStick className="w-5 h-5 text-muted" />
              <h2 className="text-lg font-semibold text-foreground">Memory (RAM)</h2>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted">Used</span>
                  <span className="font-medium text-foreground">{formatFileSize(resources.memory.used)}</span>
                </div>
                <div className="h-3 bg-surface-secondary overflow-hidden">
                  <motion.div
                    className="h-full bg-green-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${resources.memory.usedPercent}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <div className="text-xs text-muted mb-1">Total</div>
                  <div className="text-sm font-medium text-foreground">{formatFileSize(resources.memory.total)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted mb-1">Available</div>
                  <div className="text-sm font-medium text-foreground">{formatFileSize(resources.memory.available)}</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* System Info & Storage Growth */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="p-6 bg-surface border border-border rounded-lg"
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-muted" />
              <h2 className="text-lg font-semibold text-foreground">System Information</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Platform</span>
                <span className="text-sm font-medium text-foreground">{resources.system.platform}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Node.js Version</span>
                <span className="text-sm font-medium text-foreground">{resources.system.nodeVersion}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Uptime</span>
                <span className="text-sm font-medium text-foreground">{formatUptime(resources.system.uptime)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">CPU Cores</span>
                <span className="text-sm font-medium text-foreground">{resources.cpu.cores}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">CPU Model</span>
                <span className="text-sm font-medium text-foreground truncate ml-2" title={resources.cpu.model}>
                  {resources.cpu.model.length > 30 ? resources.cpu.model.substring(0, 30) + '...' : resources.cpu.model}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Storage Growth */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="p-6 bg-surface border border-border rounded-lg"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-muted" />
              <h2 className="text-lg font-semibold text-foreground">Storage Analytics</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Total Used</span>
                <span className="text-sm font-medium text-foreground">{formatFileSize(resources.storage.totalUsed)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">Growth Rate</span>
                <span className="text-sm font-medium text-foreground">
                  {resources.storage.growthRate > 0
                    ? `${formatFileSize(resources.storage.growthRate)}/hour`
                    : 'N/A (tracking...)'}
                </span>
              </div>
              <div className="pt-3 border-t border-border">
                <div className="text-xs text-muted">
                  Storage growth rate is calculated based on historical data and helps forecast future storage needs.
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
