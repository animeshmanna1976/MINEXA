import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { 
  LogOut, 
  Eye, 
  BarChart3, 
  TrendingUp,
  TrendingDown,
  Download,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Activity
} from 'lucide-react';

interface DGMSDashboardProps {
  onLogout: () => void;
}

const DGMSDashboard: React.FC<DGMSDashboardProps> = ({ onLogout }) => {
  const analytics = [
    { 
      title: 'Total Active Sites', 
      value: '12', 
      change: '+2', 
      trend: 'up',
      color: 'text-safety-info' 
    },
    { 
      title: 'Safety Incidents (30d)', 
      value: '3', 
      change: '-8', 
      trend: 'down',
      color: 'text-safety-danger' 
    },
    { 
      title: 'Compliance Score', 
      value: '96%', 
      change: '+4%', 
      trend: 'up',
      color: 'text-safety-success' 
    },
    { 
      title: 'Productivity Index', 
      value: '92%', 
      change: '+7%', 
      trend: 'up',
      color: 'text-safety-warning' 
    },
  ];

  const reports = [
    { 
      id: 1, 
      title: 'Quarterly Safety Report Q3 2024',
      type: 'Safety Compliance',
      date: '2024-09-20',
      status: 'completed',
      size: '2.4 MB'
    },
    { 
      id: 2, 
      title: 'Monthly Productivity Analysis',
      type: 'Productivity',
      date: '2024-09-15',
      status: 'completed',
      size: '1.8 MB'
    },
    { 
      id: 3, 
      title: 'Hazard Trend Analysis Report',
      type: 'Risk Assessment',
      date: '2024-09-10',
      status: 'pending',
      size: '3.1 MB'
    },
    { 
      id: 4, 
      title: 'Environmental Impact Assessment',
      type: 'Environmental',
      date: '2024-09-05',
      status: 'completed',
      size: '4.2 MB'
    },
  ];

  const recentActivities = [
    { 
      id: 1,
      type: 'incident',
      message: 'Critical safety incident reported at Site A-3',
      time: '2 hours ago',
      status: 'critical'
    },
    { 
      id: 2,
      type: 'compliance',
      message: 'Site B-7 compliance check completed successfully',
      time: '4 hours ago',
      status: 'success'
    },
    { 
      id: 3,
      type: 'report',
      message: 'Weekly productivity report generated',
      time: '6 hours ago',
      status: 'info'
    },
    { 
      id: 4,
      type: 'alert',
      message: 'Equipment maintenance required at Site C-2',
      time: '8 hours ago',
      status: 'warning'
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-safety-danger" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-safety-success" />;
      case 'warning': return <Clock className="w-4 h-4 text-safety-warning" />;
      case 'info': return <Activity className="w-4 h-4 text-safety-info" />;
      default: return <Activity className="w-4 h-4 text-foreground-muted" />;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 p-6 neonova-surface-gradient rounded-xl neonova-animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-safety-info/20 rounded-full">
            <Eye className="w-8 h-8 text-safety-info" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gradient">DGMS Dashboard</h1>
            <p className="text-foreground-muted">Government oversight and compliance monitoring</p>
          </div>
        </div>
        <Button variant="ghost" onClick={onLogout} className="gap-2">
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </header>

      <div className="grid lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {/* Site-wide Analytics */}
        <div className="lg:col-span-4">
          <Card className="neonova-animate-slide-up mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-neonova-blue" />
                Site-wide Analytics
              </CardTitle>
              <CardDescription>
                Real-time overview of all mining operations and compliance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-6">
                {analytics.map((metric, index) => (
                  <div 
                    key={metric.title}
                    className={`p-6 rounded-lg bg-surface/30 border border-border/50 neonova-animate-scale-in hover:neonova-glow transition-all duration-300`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-sm text-foreground-muted">{metric.title}</p>
                        <p className={`text-3xl font-bold ${metric.color}`}>{metric.value}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {metric.trend === 'up' ? (
                          <TrendingUp className="w-5 h-5 text-safety-success" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-safety-danger" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-sm font-medium ${
                        metric.trend === 'up' ? 'text-safety-success' : 'text-safety-danger'
                      }`}>
                        {metric.change}
                      </span>
                      <span className="text-sm text-foreground-muted">vs last period</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compliance & Reports */}
        <div className="lg:col-span-2">
          <Card className="neonova-animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-neonova-blue" />
                Compliance & Reports
              </CardTitle>
              <CardDescription>
                Download and review compliance reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reports.map((report, index) => (
                  <div 
                    key={report.id}
                    className={`p-4 rounded-lg bg-surface/30 border border-border/50 hover:bg-surface/50 transition-all duration-200 neonova-animate-fade-in`}
                    style={{ animationDelay: `${0.4 + index * 0.1}s` }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{report.title}</h4>
                        <p className="text-sm text-foreground-muted">
                          {report.type} • {report.date} • {report.size}
                        </p>
                      </div>
                      <Badge 
                        variant={report.status === 'completed' ? 'default' : 'secondary'}
                        className={report.status === 'completed' ? 'bg-safety-success' : 'bg-safety-warning'}
                      >
                        {report.status}
                      </Badge>
                    </div>
                    <Button size="sm" variant="glass" className="w-full mt-2">
                      <Download className="w-4 h-4 mr-2" />
                      View/Download
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities */}
        <div className="lg:col-span-2">
          <Card className="neonova-animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-neonova-blue" />
                Recent Activities
              </CardTitle>
              <CardDescription>
                Latest updates from all mining sites
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivities.map((activity, index) => (
                  <div 
                    key={activity.id}
                    className={`p-4 rounded-lg bg-surface/30 border border-border/50 hover:bg-surface/50 transition-all duration-200 neonova-animate-fade-in`}
                    style={{ animationDelay: `${0.6 + index * 0.1}s` }}
                  >
                    <div className="flex items-start gap-3">
                      {getStatusIcon(activity.status)}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{activity.message}</p>
                        <p className="text-xs text-foreground-muted mt-1">{activity.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="neonova-animate-slide-up mt-6" style={{ animationDelay: '0.6s' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-neonova-blue" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="glass" className="w-full justify-start" size="lg">
                <BarChart3 className="w-4 h-4 mr-2" />
                Generate Analytics Report
              </Button>
              <Button variant="glass" className="w-full justify-start" size="lg">
                <AlertTriangle className="w-4 h-4 mr-2" />
                View All Incidents
              </Button>
              <Button variant="glass" className="w-full justify-start" size="lg">
                <CheckCircle className="w-4 h-4 mr-2" />
                Compliance Overview
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DGMSDashboard;