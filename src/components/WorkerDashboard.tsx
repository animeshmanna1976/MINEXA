import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

import { 
  LogOut, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Upload,
  Camera,
  FileText,
  HardHat,
  Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WorkerDashboardProps {
  onLogout: () => void;
}

const WorkerDashboard: React.FC<WorkerDashboardProps> = ({ onLogout }) => {
  const [hazardDescription, setHazardDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const tasks = [
    { id: 1, title: 'Complete daily safety check', status: 'pending', priority: 'high' },
    { id: 2, title: 'Inspect mining equipment', status: 'completed', priority: 'medium' },
    { id: 3, title: 'Submit shift handover report', status: 'pending', priority: 'high' },
    { id: 4, title: 'Attend safety briefing', status: 'completed', priority: 'low' },
    { id: 5, title: 'Check gas levels in sector 3', status: 'pending', priority: 'critical' },
  ];

  const handleHazardSubmit = () => {
    if (!hazardDescription.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide a hazard description.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Hazard Report Submitted",
      description: "Your hazard report has been successfully submitted and sent to supervisors for review.",
    });

    setHazardDescription('');
    setSelectedFile(null);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
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
          <div className="p-3 bg-safety-success/20 rounded-full">
            <HardHat className="w-8 h-8 text-safety-success" />
             
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gradient">Worker Dashboard</h1>
            <p className="text-foreground-muted">Manage your tasks and report safety hazards</p>
          </div>
        </div>
        <Button variant="ghost" onClick={onLogout} className="gap-2">
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </header>

      <div className="grid lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
        {/* Tasks Section */}
        <div className="space-y-6">
          <Card className="neonova-animate-slide-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-neonova-blue" />
                Your Tasks
              </CardTitle>
              <CardDescription>
                Complete your assigned tasks for today's shift
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tasks.map((task, index) => (
                  <div 
                    key={task.id} 
                    className={`p-4 rounded-lg border border-border/50 bg-surface/50 hover:bg-surface/70 transition-all duration-200 neonova-animate-fade-in`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {task.status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-safety-success" />
                        ) : (
                          <Clock className="w-5 h-5 text-safety-warning" />
                        )}
                        <span className={task.status === 'completed' ? 'line-through text-muted-foreground' : ''}>
                          {task.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={`${getPriorityColor(task.priority)} text-background text-xs`}
                        >
                          {task.priority}
                        </Badge>
                        <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                          {task.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Hazard Reporting Section */}
        <div className="space-y-6">
          <Card className="neonova-animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-safety-danger" />
                Submit Hazard Report
              </CardTitle>
              <CardDescription>
                Report any safety hazards immediately for prompt action
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Hazard Description *
                </label>
                <Textarea
                  placeholder="Describe the hazard in detail including location, severity, and immediate risks..."
                  value={hazardDescription}
                  onChange={(e) => setHazardDescription(e.target.value)}
                  className="min-h-32 bg-surface border-border/50 focus:border-neonova-blue/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Upload Evidence (Photo/Video)
                </label>
                <div className="relative">
                  <Input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="bg-surface border-border/50 focus:border-neonova-blue/50"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Camera className="w-4 h-4 text-foreground-muted" />
                  </div>
                </div>
                {selectedFile && (
                  <p className="text-sm text-safety-success mt-2 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>

              <div className="bg-safety-warning/10 border border-safety-warning/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-safety-warning mt-0.5" />
                  <div>
                    <h4 className="font-medium text-safety-warning">Safety Reminder</h4>
                    <p className="text-sm text-foreground-muted mt-1">
                      If this is an immediate danger, evacuate the area and contact emergency services. 
                      This form is for non-critical hazard documentation.
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleHazardSubmit}
                variant="danger"
                size="lg"
                className="w-full"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Submit Hazard Report
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
     
    </div>
  );
};

export default WorkerDashboard;