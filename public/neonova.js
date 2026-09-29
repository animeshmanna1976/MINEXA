// NEONOVA Platform JavaScript
class NeonovaApp {
    constructor() {
        this.currentPage = 'login';
        this.currentUser = null;
        this.init();
    }

    init() {
        this.render();
    }

    // Navigation Functions
    login(role) {
        this.currentPage = role;
        this.currentUser = role;
        this.showToast(`Welcome ${role.charAt(0).toUpperCase() + role.slice(1)}!`, 'success');
        this.render();
    }

    logout() {
        this.currentPage = 'login';
        this.currentUser = null;
        this.showToast('Logged out successfully', 'info');
        this.render();
    }

    // Toast Notification System
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fas ${this.getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => container.removeChild(toast), 300);
        }, 3000);
    }

    getToastIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };
        return icons[type] || icons.info;
    }

    // Page Rendering
    render() {
        const app = document.getElementById('app');
        app.innerHTML = this.getPageContent();
        this.attachEventListeners();
    }

    getPageContent() {
        switch (this.currentPage) {
            case 'login':
                return this.renderLoginPage();
            case 'worker':
                return this.renderWorkerDashboard();
            case 'supervisor':
                return this.renderSupervisorDashboard();
            case 'dgms':
                return this.renderDGMSDashboard();
            default:
                return this.renderLoginPage();
        }
    }

    renderLoginPage() {
        return `
            <div class="login-page">
                <div class="login-container animate-fade-in">
                    <div class="logo">
                        <i class="fas fa-hard-hat"></i>
                    </div>
                    <h1 class="title text-gradient">NEONOVA</h1>
                    <p class="subtitle">Smart Mine Safety & Productivity Management Platform</p>
                    <p class="text-center mb-6" style="color: hsl(var(--text-muted)); max-width: 600px; margin: 0 auto 2rem;">
                        Digital transformation for coal mine operations with real-time safety monitoring, 
                        compliance tracking, and intelligent reporting.
                    </p>
                    
                    <div class="login-grid">
                        <div class="card animate-slide-in" style="animation-delay: 0.1s">
                            <div class="card-header">
                                <div class="card-icon" style="background: rgba(74, 222, 128, 0.1); color: hsl(var(--safety-success));">
                                    <i class="fas fa-hard-hat"></i>
                                </div>
                                <h3 class="card-title">Mine Worker</h3>
                                <p class="card-description">Report hazards, complete tasks, and access safety protocols</p>
                            </div>
                            <ul class="list mb-4">
                                <li class="mb-2 flex items-center gap-2">
                                    <i class="fas fa-shield-alt" style="color: hsl(var(--safety-success));"></i>
                                    <span style="font-size: 0.9rem;">Submit hazard reports</span>
                                </li>
                                <li class="mb-2 flex items-center gap-2">
                                    <i class="fas fa-tasks" style="color: hsl(var(--safety-success));"></i>
                                    <span style="font-size: 0.9rem;">Track daily tasks</span>
                                </li>
                                <li class="mb-2 flex items-center gap-2">
                                    <i class="fas fa-book" style="color: hsl(var(--safety-success));"></i>
                                    <span style="font-size: 0.9rem;">Access safety guidelines</span>
                                </li>
                            </ul>
                            <button class="btn btn-worker w-full" data-role="worker">
                                <i class="fas fa-sign-in-alt"></i>
                                Login as Worker
                            </button>
                        </div>

                        <div class="card animate-slide-in" style="animation-delay: 0.2s">
                            <div class="card-header">
                                <div class="card-icon" style="background: rgba(251, 191, 36, 0.1); color: hsl(var(--safety-warning));">
                                    <i class="fas fa-users"></i>
                                </div>
                                <h3 class="card-title">Supervisor</h3>
                                <p class="card-description">Validate reports, monitor teams, and manage shift operations</p>
                            </div>
                            <ul class="list mb-4">
                                <li class="mb-2 flex items-center gap-2">
                                    <i class="fas fa-check-circle" style="color: hsl(var(--safety-warning));"></i>
                                    <span style="font-size: 0.9rem;">Validate worker reports</span>
                                </li>
                                <li class="mb-2 flex items-center gap-2">
                                    <i class="fas fa-eye" style="color: hsl(var(--safety-warning));"></i>
                                    <span style="font-size: 0.9rem;">Monitor team activities</span>
                                </li>
                                <li class="mb-2 flex items-center gap-2">
                                    <i class="fas fa-clipboard-list" style="color: hsl(var(--safety-warning));"></i>
                                    <span style="font-size: 0.9rem;">Generate shift logs</span>
                                </li>
                            </ul>
                            <button class="btn btn-supervisor w-full" data-role="supervisor">
                                <i class="fas fa-sign-in-alt"></i>
                                Login as Supervisor
                            </button>
                        </div>

                        <div class="card animate-slide-in" style="animation-delay: 0.3s">
                            <div class="card-header">
                                <div class="card-icon" style="background: rgba(59, 130, 246, 0.1); color: hsl(var(--safety-info));">
                                    <i class="fas fa-eye"></i>
                                </div>
                                <h3 class="card-title">DGMS Official</h3>
                                <p class="card-description">Monitor compliance, view analytics, and access comprehensive reports</p>
                            </div>
                            <ul class="list mb-4">
                                <li class="mb-2 flex items-center gap-2">
                                    <i class="fas fa-chart-line" style="color: hsl(var(--safety-info));"></i>
                                    <span style="font-size: 0.9rem;">View analytics dashboard</span>
                                </li>
                                <li class="mb-2 flex items-center gap-2">
                                    <i class="fas fa-clipboard-check" style="color: hsl(var(--safety-info));"></i>
                                    <span style="font-size: 0.9rem;">Monitor compliance</span>
                                </li>
                                <li class="mb-2 flex items-center gap-2">
                                    <i class="fas fa-file-alt" style="color: hsl(var(--safety-info));"></i>
                                    <span style="font-size: 0.9rem;">Generate reports</span>
                                </li>
                            </ul>
                            <button class="btn btn-dgms w-full" data-role="dgms">
                                <i class="fas fa-sign-in-alt"></i>
                                Login as DGMS
                            </button>
                        </div>
                    </div>

                    <div class="text-center" style="margin-top: 3rem; color: hsl(var(--text-muted)); font-size: 0.9rem;">
                        Secure • Compliant • Real-time • Intelligent
                    </div>
                </div>
            </div>
        `;
    }

    renderWorkerDashboard() {
        return `
            <div class="dashboard container">
                <div class="dashboard-header animate-fade-in">
                    <h1 class="dashboard-title">
                        <i class="fas fa-hard-hat" style="color: hsl(var(--safety-success));"></i>
                        Worker Dashboard
                    </h1>
                    <button class="btn btn-danger" id="logout-btn">
                        <i class="fas fa-sign-out-alt"></i>
                        Logout
                    </button>
                </div>

                <div class="dashboard-grid animate-slide-in">
                    <div class="card">
                        <h2 class="card-title mb-4">
                            <i class="fas fa-tasks"></i>
                            Your Tasks
                        </h2>
                        <div class="list">
                            <div class="list-item">
                                <div class="list-item-content">
                                    <div class="list-item-title">Complete daily safety check</div>
                                    <div class="list-item-meta">Due: Today, 2:00 PM</div>
                                </div>
                                <span class="badge badge-warning">Pending</span>
                            </div>
                            <div class="list-item">
                                <div class="list-item-content">
                                    <div class="list-item-title">Equipment inspection - Sector A</div>
                                    <div class="list-item-meta">Completed: Today, 9:30 AM</div>
                                </div>
                                <span class="badge badge-success">Completed</span>
                            </div>
                            <div class="list-item">
                                <div class="list-item-content">
                                    <div class="list-item-title">Safety briefing attendance</div>
                                    <div class="list-item-meta">Due: Tomorrow, 8:00 AM</div>
                                </div>
                                <span class="badge badge-info">Scheduled</span>
                            </div>
                            <div class="list-item">
                                <div class="list-item-content">
                                    <div class="list-item-title">Monthly safety training</div>
                                    <div class="list-item-meta">Completed: 3 days ago</div>
                                </div>
                                <span class="badge badge-success">Completed</span>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <h2 class="card-title mb-4">
                            <i class="fas fa-exclamation-triangle"></i>
                            Submit Hazard Report
                        </h2>
                        <form id="hazard-form">
                            <div class="form-group">
                                <label class="form-label" for="hazard-type">Hazard Type</label>
                                <select class="form-select" id="hazard-type" required>
                                    <option value="">Select hazard type</option>
                                    <option value="structural">Structural Damage</option>
                                    <option value="equipment">Equipment Malfunction</option>
                                    <option value="environmental">Environmental Hazard</option>
                                    <option value="safety">Safety Violation</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="hazard-location">Location</label>
                                <input type="text" class="form-input" id="hazard-location" placeholder="e.g., Sector B, Level 2" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="hazard-description">Description</label>
                                <textarea class="form-textarea" id="hazard-description" placeholder="Describe the hazard in detail..." required></textarea>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="hazard-severity">Severity Level</label>
                                <select class="form-select" id="hazard-severity" required>
                                    <option value="">Select severity</option>
                                    <option value="low">Low - Minor issue</option>
                                    <option value="medium">Medium - Moderate risk</option>
                                    <option value="high">High - Immediate attention required</option>
                                    <option value="critical">Critical - Emergency</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="hazard-photo">Photo/Video (Optional)</label>
                                <input type="file" class="form-input" id="hazard-photo" accept="image/*,video/*">
                            </div>
                            <button type="submit" class="btn btn-danger w-full">
                                <i class="fas fa-exclamation-triangle"></i>
                                Submit Report
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    renderSupervisorDashboard() {
        return `
            <div class="dashboard container">
                <div class="dashboard-header animate-fade-in">
                    <h1 class="dashboard-title">
                        <i class="fas fa-users" style="color: hsl(var(--safety-warning));"></i>
                        Supervisor Dashboard
                    </h1>
                    <button class="btn btn-danger" id="logout-btn">
                        <i class="fas fa-sign-out-alt"></i>
                        Logout
                    </button>
                </div>

                <div class="metrics-grid animate-slide-in">
                    <div class="metric-card">
                        <div class="metric-value" style="color: hsl(var(--safety-success));">24</div>
                        <div class="metric-label">Completed Tasks</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value" style="color: hsl(var(--safety-warning));">7</div>
                        <div class="metric-label">Pending Reports</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value" style="color: hsl(var(--safety-danger));">3</div>
                        <div class="metric-label">Safety Issues</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value" style="color: hsl(var(--safety-info));">15</div>
                        <div class="metric-label">Active Workers</div>
                    </div>
                </div>

                <div class="dashboard-grid animate-slide-in">
                    <div class="card">
                        <h2 class="card-title mb-4">
                            <i class="fas fa-clipboard-check"></i>
                            Pending Validations
                        </h2>
                        <div class="list">
                            <div class="list-item">
                                <div class="list-item-content">
                                    <div class="list-item-title">Equipment Malfunction - Sector A</div>
                                    <div class="list-item-meta">Reported by: John Doe • 2 hours ago</div>
                                </div>
                                <div class="list-item-actions">
                                    <button class="btn btn-worker" data-action="validate" data-id="1">
                                        <i class="fas fa-check"></i>
                                        Validate
                                    </button>
                                    <button class="btn btn-danger" data-action="reject" data-id="1">
                                        <i class="fas fa-times"></i>
                                        Reject
                                    </button>
                                </div>
                            </div>
                            <div class="list-item">
                                <div class="list-item-content">
                                    <div class="list-item-title">Structural Damage - Level 3</div>
                                    <div class="list-item-meta">Reported by: Jane Smith • 4 hours ago</div>
                                </div>
                                <div class="list-item-actions">
                                    <button class="btn btn-worker" data-action="validate" data-id="2">
                                        <i class="fas fa-check"></i>
                                        Validate
                                    </button>
                                    <button class="btn btn-danger" data-action="reject" data-id="2">
                                        <i class="fas fa-times"></i>
                                        Reject
                                    </button>
                                </div>
                            </div>
                            <div class="list-item">
                                <div class="list-item-content">
                                    <div class="list-item-title">Safety Protocol Violation</div>
                                    <div class="list-item-meta">Reported by: Mike Johnson • 6 hours ago</div>
                                </div>
                                <div class="list-item-actions">
                                    <button class="btn btn-worker" data-action="validate" data-id="3">
                                        <i class="fas fa-check"></i>
                                        Validate
                                    </button>
                                    <button class="btn btn-danger" data-action="reject" data-id="3">
                                        <i class="fas fa-times"></i>
                                        Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <h2 class="card-title mb-4">
                            <i class="fas fa-chart-bar"></i>
                            Shift Activity Overview
                        </h2>
                        <div class="list">
                            <div class="list-item">
                                <div class="list-item-content">
                                    <div class="list-item-title">Team Alpha - Morning Shift</div>
                                    <div class="list-item-meta">8 workers • 95% task completion</div>
                                </div>
                                <span class="badge badge-success">Active</span>
                            </div>
                            <div class="list-item">
                                <div class="list-item-content">
                                    <div class="list-item-title">Team Beta - Afternoon Shift</div>
                                    <div class="list-item-meta">7 workers • 87% task completion</div>
                                </div>
                                <span class="badge badge-warning">Active</span>
                            </div>
                            <div class="list-item">
                                <div class="list-item-content">
                                    <div class="list-item-title">Night Shift Preparation</div>
                                    <div class="list-item-meta">Starting in 2 hours</div>
                                </div>
                                <span class="badge badge-info">Scheduled</span>
                            </div>
                        </div>

                        <div style="margin-top: 2rem;">
                            <button class="btn btn-supervisor w-full">
                                <i class="fas fa-file-alt"></i>
                                Generate Shift Report
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderDGMSDashboard() {
        return `
            <div class="dashboard container">
                <div class="dashboard-header animate-fade-in">
                    <h1 class="dashboard-title">
                        <i class="fas fa-eye" style="color: hsl(var(--safety-info));"></i>
                        DGMS Dashboard
                    </h1>
                    <button class="btn btn-danger" id="logout-btn">
                        <i class="fas fa-sign-out-alt"></i>
                        Logout
                    </button>
                </div>

                <div class="metrics-grid animate-slide-in">
                    <div class="metric-card">
                        <div class="metric-value" style="color: hsl(var(--safety-success));">98.5%</div>
                        <div class="metric-label">Safety Compliance</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value" style="color: hsl(var(--safety-info));">156</div>
                        <div class="metric-label">Active Workers</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value" style="color: hsl(var(--safety-warning));">23</div>
                        <div class="metric-label">Reports This Week</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value" style="color: hsl(var(--safety-success));">847</div>
                        <div class="metric-label">Tasks Completed</div>
                    </div>
                </div>

                <div class="dashboard-grid animate-slide-in">
                    <div class="card">
                        <h2 class="card-title mb-4">
                            <i class="fas fa-chart-line"></i>
                            Site-wide Analytics
                        </h2>
                        <div style="background: hsl(var(--surface-light)); border-radius: 8px; padding: 2rem; margin-bottom: 1rem; text-align: center; border: 2px dashed hsl(220, 13%, 20%);">
                            <i class="fas fa-chart-area" style="font-size: 3rem; color: hsl(var(--text-muted)); margin-bottom: 1rem;"></i>
                            <h3 style="color: hsl(var(--text-secondary)); margin-bottom: 0.5rem;">Hazard Report Trend</h3>
                            <p style="color: hsl(var(--text-muted)); font-size: 0.9rem;">Interactive chart showing hazard reports over time</p>
                        </div>
                        <div style="background: hsl(var(--surface-light)); border-radius: 8px; padding: 2rem; text-align: center; border: 2px dashed hsl(220, 13%, 20%);">
                            <i class="fas fa-chart-bar" style="font-size: 3rem; color: hsl(var(--text-muted)); margin-bottom: 1rem;"></i>
                            <h3 style="color: hsl(var(--text-secondary)); margin-bottom: 0.5rem;">Productivity Metrics</h3>
                            <p style="color: hsl(var(--text-muted)); font-size: 0.9rem;">Real-time productivity and efficiency data</p>
                        </div>
                    </div>

                    <div class="card">
                        <h2 class="card-title mb-4">
                            <i class="fas fa-file-alt"></i>
                            Compliance & Reports
                        </h2>
                        <div class="list">
                            <div class="list-item">
                                <div class="list-item-content">
                                    <div class="list-item-title">Quarterly Safety Report</div>
                                    <div class="list-item-meta">Generated: September 2024 • 45 pages</div>
                                </div>
                                <button class="btn btn-dgms" data-report="quarterly">
                                    <i class="fas fa-download"></i>
                                    Download
                                </button>
                            </div>
                            <div class="list-item">
                                <div class="list-item-content">
                                    <div class="list-item-title">Monthly Compliance Report</div>
                                    <div class="list-item-meta">Generated: September 2024 • 28 pages</div>
                                </div>
                                <button class="btn btn-dgms" data-report="monthly">
                                    <i class="fas fa-download"></i>
                                    Download
                                </button>
                            </div>
                            <div class="list-item">
                                <div class="list-item-content">
                                    <div class="list-item-title">Incident Analysis Report</div>
                                    <div class="list-item-meta">Generated: August 2024 • 32 pages</div>
                                </div>
                                <button class="btn btn-dgms" data-report="incident">
                                    <i class="fas fa-download"></i>
                                    Download
                                </button>
                            </div>
                            <div class="list-item">
                                <div class="list-item-content">
                                    <div class="list-item-title">Environmental Impact Assessment</div>
                                    <div class="list-item-meta">Generated: July 2024 • 67 pages</div>
                                </div>
                                <button class="btn btn-dgms" data-report="environmental">
                                    <i class="fas fa-download"></i>
                                    Download
                                </button>
                            </div>
                        </div>

                        <div style="margin-top: 2rem;">
                            <button class="btn btn-info w-full">
                                <i class="fas fa-plus"></i>
                                Generate Custom Report
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Event Handling
    attachEventListeners() {
        // Login buttons
        document.querySelectorAll('[data-role]').forEach(button => {
            button.addEventListener('click', (e) => {
                const role = e.currentTarget.getAttribute('data-role');
                this.login(role);
            });
        });

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Hazard form submission
        const hazardForm = document.getElementById('hazard-form');
        if (hazardForm) {
            hazardForm.addEventListener('submit', (e) => this.handleHazardSubmit(e));
        }

        // Validation buttons
        document.querySelectorAll('[data-action="validate"]').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                this.handleValidation(id, 'validate');
            });
        });

        document.querySelectorAll('[data-action="reject"]').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                this.handleValidation(id, 'reject');
            });
        });

        // Report download buttons
        document.querySelectorAll('[data-report]').forEach(button => {
            button.addEventListener('click', (e) => {
                const reportType = e.currentTarget.getAttribute('data-report');
                this.handleReportDownload(reportType);
            });
        });
    }

    // Action Handlers
    handleHazardSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const hazardType = document.getElementById('hazard-type').value;
        const location = document.getElementById('hazard-location').value;
        const description = document.getElementById('hazard-description').value;
        const severity = document.getElementById('hazard-severity').value;

        if (!hazardType || !location || !description || !severity) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        // Simulate form submission
        this.showToast('Hazard report submitted successfully!', 'success');
        e.target.reset();
    }

    handleValidation(id, action) {
        const actionText = action === 'validate' ? 'validated' : 'rejected';
        this.showToast(`Report #${id} has been ${actionText}`, 'success');
        
        // Remove the item from the list (simulate database update)
        const listItem = document.querySelector(`[data-id="${id}"]`).closest('.list-item');
        listItem.style.opacity = '0.5';
        listItem.style.pointerEvents = 'none';
    }

    handleReportDownload(reportType) {
        this.showToast(`Downloading ${reportType} report...`, 'info');
        
        // Simulate download process
        setTimeout(() => {
            this.showToast(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report downloaded successfully!`, 'success');
        }, 2000);
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.neonovaApp = new NeonovaApp();
});