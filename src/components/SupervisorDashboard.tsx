import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  LogOut, 
  Users, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  BarChart3,
  Clock,
  FileCheck,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SupervisorDashboardProps {
  onLogout: () => void;
}

const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({ onLogout }) => {
  const { toast } = useToast();

  const pendingReports = [
    { 
      id: 1, 
      worker: 'John Smith', 
      type: 'Hazard Report', 
      title: 'Gas leak detected in tunnel A-3',
      time: '2 hours ago',
      severity: 'critical'
    },
    { 
      id: 2, 
      worker: 'Sarah Johnson', 
      type: 'Shift Log', 
      title: 'Equipment maintenance completed',
      time: '4 hours ago',
      severity: 'low'
    },
    { 
      id: 3, 
      worker: 'Mike Wilson', 
      type: 'Hazard Report', 
      title: 'Loose scaffolding in sector 5',
      time: '6 hours ago',
      severity: 'high'
    },
    { 
      id: 4, 
      worker: 'Emily Davis', 
      type: 'Safety Check', 
      title: 'Daily safety inspection report',
      time: '8 hours ago',
      severity: 'medium'
    },
  ];

  const metrics = [
    { label: 'Completed Tasks', value: 24, change: '+12%', trend: 'up' },
    { label: 'New Hazard Reports', value: 3, change: '-25%', trend: 'down' },
    { label: 'Open Safety Issues', value: 7, change: '+2', trend: 'up' },
    { label: 'Team Productivity', value: '94%', change: '+5%', trend: 'up' },
  ];

  const handleValidate = (reportId: number, action: 'validate' | 'reject') => {
    const report = pendingReports.find(r => r.id === reportId);
    const actionText = action === 'validate' ? 'validated' : 'rejected';
    
    toast({
      title: `Report ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}`,
      description: `${report?.title} has been ${actionText} successfully.`,
      variant: action === 'validate' ? 'default' : 'destructive',
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-safety-danger';
      case 'high': return 'bg-safety-warning';
      case 'medium': return 'bg-safety-info';
      case 'low': return 'bg-safety-success';
      default: return 'bg-muted';
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 p-6 neonova-surface-gradient rounded-xl neonova-animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-safety-warning/20 rounded-full">
            <Users className="w-8 h-8 text-safety-warning" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gradient">Supervisor Dashboard</h1>
            <p className="text-foreground-muted">Validate reports and monitor team activities</p>
          </div>
        </div>
        <Button variant="ghost" onClick={onLogout} className="gap-2">
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </header>

      <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {/* Pending Validations */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="neonova-animate-slide-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-neonova-blue" />
                Pending Validations
              </CardTitle>
              <CardDescription>
                Review and validate worker reports and shift logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingReports.map((report, index) => (
                  <div 
                    key={report.id}
                    className={`p-4 rounded-lg border border-border/50 bg-surface/50 hover:bg-surface/70 transition-all duration-200 neonova-animate-fade-in`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {report.type}
                          </Badge>
                          <Badge className={`${getSeverityColor(report.severity)} text-background text-xs`}>
                            {report.severity}
                          </Badge>
                        </div>
                        <h4 className="font-medium text-foreground">{report.title}</h4>
                        <p className="text-sm text-foreground-muted">
                          Submitted by {report.worker} • {report.time}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => handleValidate(report.id, 'validate')}
                        className="bg-safety-success hover:bg-safety-success/90"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Validate
                      </Button>
                      <Button 
                        size="sm" 
                        variant="danger"
                        onClick={() => handleValidate(report.id, 'reject')}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Shift Activity Overview */}
        <div className="space-y-6">
          <Card className="neonova-animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-neonova-blue" />
                Shift Activity Overview
              </CardTitle>
              <CardDescription>
                Key metrics for current shift performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics.map((metric, index) => (
                <div 
                  key={metric.label}
                  className={`p-4 rounded-lg bg-surface/30 border border-border/50 neonova-animate-scale-in`}
                  style={{ animationDelay: `${0.4 + index * 0.1}s` }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-foreground-muted">{metric.label}</p>
                      <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {metric.trend === 'up' ? (
                        <TrendingUp className="w-4 h-4 text-safety-success" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-safety-danger" />
                      )}
                      <span className={`text-xs font-medium ${
                        metric.trend === 'up' ? 'text-safety-success' : 'text-safety-danger'
                      }`}>
                        {metric.change}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="neonova-animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-neonova-blue" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="glass" className="w-full justify-start" size="lg">
                <Clock className="w-4 h-4 mr-2" />
                Generate Shift Report
              </Button>
              <Button variant="glass" className="w-full justify-start" size="lg">
                <AlertTriangle className="w-4 h-4 mr-2" />
                View All Hazards
              </Button>
              <Button variant="glass" className="w-full justify-start" size="lg">
                <Users className="w-4 h-4 mr-2" />
                Team Performance
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SupervisorDashboard;