/**
 * Alert Management Interface
 * Frontend JavaScript for alert system management
 */

class AlertManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.currentFilters = {};
        this.socket = null;
        
        this.init();
    }

    async init() {
        console.log('Initializing Alert Manager...');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Connect to Socket.IO for real-time updates
        this.connectSocket();
        
        // Load initial data
        await this.loadActiveAlerts();
        await this.loadPreferences();
        
        console.log('Alert Manager initialized');
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Refresh buttons
        document.getElementById('refreshActiveAlerts')?.addEventListener('click', () => {
            this.loadActiveAlerts();
        });
        
        document.getElementById('refreshHistory')?.addEventListener('click', () => {
            this.loadAlertHistory();
        });

        // History filters
        document.getElementById('applyFilters')?.addEventListener('click', () => {
            this.applyHistoryFilters();
        });

        // Pagination
        document.getElementById('prevPage')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadAlertHistory();
            }
        });
        
        document.getElementById('nextPage')?.addEventListener('click', () => {
            this.currentPage++;
            this.loadAlertHistory();
        });

        // Export history
        document.getElementById('exportHistory')?.addEventListener('click', () => {
            this.exportHistory();
        });

        // Preferences
        document.getElementById('savePreferences')?.addEventListener('click', () => {
            this.savePreferences();
        });
        
        document.getElementById('cancelPreferences')?.addEventListener('click', () => {
            this.loadPreferences();
        });
        
        document.getElementById('resetPreferences')?.addEventListener('click', () => {
            this.resetPreferences();
        });

        // Test buttons
        document.getElementById('testPush')?.addEventListener('click', () => {
            this.testNotificationChannel('push');
        });
        
        document.getElementById('testEmail')?.addEventListener('click', () => {
            this.testNotificationChannel('email');
        });
        
        document.getElementById('testSms')?.addEventListener('click', () => {
            this.testNotificationChannel('sms');
        });

        // Test alert creation
        document.getElementById('createTestAlert')?.addEventListener('click', () => {
            this.createTestAlert();
        });

        // System tests
        document.getElementById('testAllChannels')?.addEventListener('click', () => {
            this.runSystemTest('all-channels');
        });
        
        document.getElementById('validateConfig')?.addEventListener('click', () => {
            this.runSystemTest('validate-config');
        });
        
        document.getElementById('testEscalation')?.addEventListener('click', () => {
            this.runSystemTest('escalation');
        });
        
        document.getElementById('runFullTest')?.addEventListener('click', () => {
            this.runSystemTest('full-test');
        });

        // Clear test results
        document.getElementById('clearResults')?.addEventListener('click', () => {
            this.clearTestResults();
        });

        // Modal
        document.getElementById('closeModal')?.addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('alertDetailsModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'alertDetailsModal') {
                this.closeModal();
            }
        });
    }

    connectSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to alert system');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from alert system');
        });
        
        // Real-time alert updates
        this.socket.on('alert:created', (alert) => {
            this.handleNewAlert(alert);
        });
        
        this.socket.on('alert:updated', (alert) => {
            this.handleAlertUpdate(alert);
        });
        
        this.socket.on('alert:resolved', (alert) => {
            this.handleAlertResolved(alert);
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
        
        // Load tab-specific data
        switch(tabName) {
            case 'active-alerts':
                this.loadActiveAlerts();
                break;
            case 'history':
                this.loadAlertHistory();
                break;
            case 'preferences':
                this.loadPreferences();
                break;
        }
    }

    async loadActiveAlerts() {
        try {
            this.showLoading('activeAlertsList');
            
            const response = await fetch('/api/alerts/active');
            const result = await response.json();
            
            if (result.success) {
                this.displayActiveAlerts(result.data.alerts);
                this.updateAlertStats(result.data.alerts);
            } else {
                this.showError('Failed to load active alerts');
            }
        } catch (error) {
            console.error('Error loading active alerts:', error);
            this.showError('Failed to load active alerts');
        }
    }

    displayActiveAlerts(alerts) {
        const container = document.getElementById('activeAlertsList');
        
        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="no-alerts">
                    <i class="fas fa-check-circle"></i>
                    <h3>No Active Alerts</h3>
                    <p>All systems are operating normally</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = alerts.map(alert => `
            <div class="alert-item ${alert.priority}" onclick="alertManager.showAlertDetails('${alert.id}')">
                <div class="alert-header">
                    <h4 class="alert-title">${alert.title}</h4>
                    <span class="alert-badge ${alert.priority}">${alert.priority}</span>
                </div>
                <div class="alert-meta">
                    <span><i class="fas fa-clock"></i> ${this.formatDate(alert.createdAt)}</span>
                    <span><i class="fas fa-tag"></i> ${alert.type}</span>
                    ${alert.acknowledgedAt ? '<span><i class="fas fa-check"></i> Acknowledged</span>' : ''}
                </div>
                <div class="alert-message">${alert.message}</div>
                <div class="alert-actions" onclick="event.stopPropagation()">
                    ${!alert.acknowledgedAt ? 
                        `<button class="btn success" onclick="alertManager.acknowledgeAlert('${alert.id}')">
                            <i class="fas fa-check"></i> Acknowledge
                        </button>` : ''
                    }
                    <button class="btn" onclick="alertManager.resolveAlert('${alert.id}')">
                        <i class="fas fa-times"></i> Resolve
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateAlertStats(alerts) {
        const activeCount = alerts.length;
        const criticalCount = alerts.filter(a => a.priority === 'critical').length;
        const unackCount = alerts.filter(a => !a.acknowledgedAt).length;
        
        document.getElementById('activeCount').textContent = activeCount;
        document.getElementById('criticalCount').textContent = criticalCount;
        document.getElementById('unackCount').textContent = unackCount;
    }

    async loadAlertHistory() {
        try {
            this.showLoading('historyList');
            
            const queryParams = new URLSearchParams({
                limit: this.itemsPerPage,
                offset: (this.currentPage - 1) * this.itemsPerPage,
                ...this.currentFilters
            });
            
            const response = await fetch(`/api/alerts/history?${queryParams}`);
            const result = await response.json();
            
            if (result.success) {
                this.displayAlertHistory(result.data.alerts);
                this.updatePagination(result.data.count);
                await this.loadHistoryStats();
            } else {
                this.showError('Failed to load alert history');
            }
        } catch (error) {
            console.error('Error loading alert history:', error);
            this.showError('Failed to load alert history');
        }
    }

    displayAlertHistory(alerts) {
        const container = document.getElementById('historyList');
        
        if (alerts.length === 0) {
            container.innerHTML = `
                <div class="no-alerts">
                    <i class="fas fa-history"></i>
                    <h3>No Alerts Found</h3>
                    <p>No alerts match your current filters</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = alerts.map(alert => `
            <div class="alert-item ${alert.priority}" onclick="alertManager.showAlertDetails('${alert.id}')">
                <div class="alert-header">
                    <h4 class="alert-title">${alert.title}</h4>
                    <span class="alert-badge ${alert.status}">${alert.status}</span>
                </div>
                <div class="alert-meta">
                    <span><i class="fas fa-clock"></i> ${this.formatDate(alert.createdAt)}</span>
                    <span><i class="fas fa-tag"></i> ${alert.type}</span>
                    <span><i class="fas fa-flag"></i> ${alert.priority}</span>
                    ${alert.resolvedAt ? `<span><i class="fas fa-check"></i> ${this.formatDate(alert.resolvedAt)}</span>` : ''}
                </div>
                <div class="alert-message">${alert.message}</div>
            </div>
        `).join('');
    }

    async loadHistoryStats() {
        try {
            const response = await fetch('/api/alerts/history/stats');
            const result = await response.json();
            
            if (result.success) {
                document.getElementById('totalAlertsCount').textContent = result.data.totalAlerts || 0;
                document.getElementById('avgResolutionTime').textContent = 
                    result.data.averageResolutionTime ? 
                    `${Math.round(result.data.averageResolutionTime)} min` : 'N/A';
            }
        } catch (error) {
            console.error('Error loading history stats:', error);
        }
    }

    applyHistoryFilters() {
        const types = Array.from(document.getElementById('typeFilter').selectedOptions)
            .map(option => option.value);
        const priorities = Array.from(document.getElementById('priorityFilter').selectedOptions)
            .map(option => option.value);
        const statuses = Array.from(document.getElementById('statusFilter').selectedOptions)
            .map(option => option.value);
        const dateFrom = document.getElementById('dateFrom').value;
        const dateTo = document.getElementById('dateTo').value;
        
        this.currentFilters = {
            ...(types.length > 0 && { types: types.join(',') }),
            ...(priorities.length > 0 && { priorities: priorities.join(',') }),
            ...(statuses.length > 0 && { statuses: statuses.join(',') }),
            ...(dateFrom && { dateFrom }),
            ...(dateTo && { dateTo })
        };
        
        this.currentPage = 1;
        this.loadAlertHistory();
    }

    updatePagination(totalCount) {
        const totalPages = Math.ceil(totalCount / this.itemsPerPage);
        
        document.getElementById('paginationInfo').textContent = 
            `Page ${this.currentPage} of ${totalPages}`;
        
        document.getElementById('prevPage').disabled = this.currentPage === 1;
        document.getElementById('nextPage').disabled = this.currentPage >= totalPages;
    }

    async exportHistory() {
        try {
            const queryParams = new URLSearchParams(this.currentFilters);
            const response = await fetch(`/api/alerts/history/export?${queryParams}`);
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `alert-history-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                window.URL.revokeObjectURL(url);
                this.showMessage('History exported successfully', 'success');
            } else {
                this.showError('Failed to export history');
            }
        } catch (error) {
            console.error('Error exporting history:', error);
            this.showError('Failed to export history');
        }
    }

    async loadPreferences() {
        try {
            const response = await fetch('/api/alerts/preferences');
            const result = await response.json();
            
            if (result.success) {
                const prefs = result.data;
                
                // Do Not Disturb
                document.getElementById('dndEnabled').checked = prefs.doNotDisturb?.enabled || false;
                document.getElementById('dndStartTime').value = prefs.doNotDisturb?.startTime || '22:00';
                document.getElementById('dndEndTime').value = prefs.doNotDisturb?.endTime || '07:00';
                
                // Alert Types
                const alertTypes = prefs.alertTypes || {};
                Object.keys(alertTypes).forEach(type => {
                    const enabledEl = document.getElementById(`${type}Enabled`);
                    const priorityEl = document.getElementById(`${type}Priority`);
                    
                    if (enabledEl) enabledEl.checked = alertTypes[type].enabled;
                    if (priorityEl) priorityEl.value = alertTypes[type].priority;
                });
                
                // Notification Channels
                const channels = prefs.channels || {};
                Object.keys(channels).forEach(channel => {
                    const enabledEl = document.getElementById(`${channel}Enabled`);
                    if (enabledEl) enabledEl.checked = channels[channel].enabled;
                    
                    if (channel === 'email' && channels[channel].address) {
                        document.getElementById('emailAddress').value = channels[channel].address;
                    }
                    if (channel === 'sms' && channels[channel].phoneNumber) {
                        document.getElementById('phoneNumber').value = channels[channel].phoneNumber;
                    }
                });
                
                // Escalation
                document.getElementById('escalationEnabled').checked = prefs.escalation?.enabled || false;
                document.getElementById('escalationTimeout').value = prefs.escalation?.timeoutMinutes || 15;
                
                this.showMessage('Preferences loaded', 'success');
            } else {
                this.showError('Failed to load preferences');
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
            this.showError('Failed to load preferences');
        }
    }

    async savePreferences() {
        try {
            const preferences = {
                doNotDisturb: {
                    enabled: document.getElementById('dndEnabled').checked,
                    startTime: document.getElementById('dndStartTime').value,
                    endTime: document.getElementById('dndEndTime').value
                },
                alertTypes: {
                    motion: {
                        enabled: document.getElementById('motionEnabled').checked,
                        priority: document.getElementById('motionPriority').value
                    },
                    sound: {
                        enabled: document.getElementById('soundEnabled').checked,
                        priority: document.getElementById('soundPriority').value
                    },
                    temperature: {
                        enabled: document.getElementById('temperatureEnabled').checked,
                        priority: document.getElementById('temperaturePriority').value
                    },
                    system: {
                        enabled: document.getElementById('systemEnabled').checked,
                        priority: document.getElementById('systemPriority').value
                    }
                },
                channels: {
                    push: {
                        enabled: document.getElementById('pushEnabled').checked
                    },
                    email: {
                        enabled: document.getElementById('emailEnabled').checked,
                        address: document.getElementById('emailAddress').value
                    },
                    sms: {
                        enabled: document.getElementById('smsEnabled').checked,
                        phoneNumber: document.getElementById('phoneNumber').value
                    }
                },
                escalation: {
                    enabled: document.getElementById('escalationEnabled').checked,
                    timeoutMinutes: parseInt(document.getElementById('escalationTimeout').value)
                }
            };
            
            const response = await fetch('/api/alerts/preferences', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(preferences)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showMessage('Preferences saved successfully', 'success');
            } else {
                this.showError(result.error || 'Failed to save preferences');
            }
        } catch (error) {
            console.error('Error saving preferences:', error);
            this.showError('Failed to save preferences');
        }
    }

    async resetPreferences() {
        if (confirm('Are you sure you want to reset all preferences to defaults?')) {
            try {
                const response = await fetch('/api/alerts/preferences/reset', {
                    method: 'POST'
                });
                
                const result = await response.json();
                
                if (result.success) {
                    await this.loadPreferences();
                    this.showMessage('Preferences reset to defaults', 'success');
                } else {
                    this.showError('Failed to reset preferences');
                }
            } catch (error) {
                console.error('Error resetting preferences:', error);
                this.showError('Failed to reset preferences');
            }
        }
    }

    async testNotificationChannel(channel) {
        try {
            const button = document.getElementById(`test${channel.charAt(0).toUpperCase() + channel.slice(1)}`);
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Testing...';
            button.disabled = true;
            
            const response = await fetch(`/api/alerts/test/${channel}`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showMessage(`${channel.toUpperCase()} notification sent successfully`, 'success');
            } else {
                this.showError(`Failed to send ${channel} notification`);
            }
        } catch (error) {
            console.error(`Error testing ${channel}:`, error);
            this.showError(`Failed to test ${channel} notifications`);
        } finally {
            const button = document.getElementById(`test${channel.charAt(0).toUpperCase() + channel.slice(1)}`);
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    async createTestAlert() {
        try {
            const button = document.getElementById('createTestAlert');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Creating...';
            button.disabled = true;
            
            const alertData = {
                type: document.getElementById('testAlertType').value,
                priority: document.getElementById('testAlertPriority').value,
                title: document.getElementById('testAlertTitle').value || 'Test Alert',
                message: document.getElementById('testAlertMessage').value || 'This is a test alert'
            };
            
            const response = await fetch('/api/alerts/test/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(alertData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showMessage(result.message || 'Test alert created successfully', 'success');
                
                // Clear form
                document.getElementById('testAlertTitle').value = '';
                document.getElementById('testAlertMessage').value = '';
                
                // Refresh active alerts if on that tab
                if (document.getElementById('active-alerts').classList.contains('active')) {
                    setTimeout(() => this.loadActiveAlerts(), 1000);
                }
            } else {
                this.showError(result.error || 'Failed to create test alert');
            }
        } catch (error) {
            console.error('Error creating test alert:', error);
            this.showError('Failed to create test alert');
        } finally {
            const button = document.getElementById('createTestAlert');
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    async runSystemTest(testType) {
        try {
            const button = document.getElementById(this.getTestButtonId(testType));
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Running...';
            button.disabled = true;
            
            let endpoint;
            let method = 'POST';
            
            switch(testType) {
                case 'all-channels':
                    endpoint = '/api/alerts/test/run';
                    break;
                case 'validate-config':
                    endpoint = '/api/alerts/validate/configuration';
                    method = 'GET';
                    break;
                case 'escalation':
                    endpoint = '/api/alerts/test/scenario/escalation';
                    break;
                case 'full-test':
                    endpoint = '/api/alerts/test/run';
                    break;
            }
            
            const response = await fetch(endpoint, { method });
            const result = await response.json();
            
            this.displayTestResults(result, testType);
            
        } catch (error) {
            console.error('Error running system test:', error);
            this.displayTestResults({ 
                success: false, 
                error: error.message 
            }, testType);
        } finally {
            const button = document.getElementById(this.getTestButtonId(testType));
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    getTestButtonId(testType) {
        const idMap = {
            'all-channels': 'testAllChannels',
            'validate-config': 'validateConfig',
            'escalation': 'testEscalation',
            'full-test': 'runFullTest'
        };
        return idMap[testType];
    }

    displayTestResults(result, testType) {
        const container = document.querySelector('.test-result-content');
        const timestamp = new Date().toLocaleString();
        
        let resultHtml = `<div class="test-result-item ${result.success ? 'success' : 'error'}">
            <strong>${testType.toUpperCase()} Test - ${timestamp}</strong><br>
            Status: ${result.success ? 'PASSED' : 'FAILED'}
        `;
        
        if (result.data) {
            if (Array.isArray(result.data)) {
                resultHtml += '<br>Results:<ul>';
                result.data.forEach(item => {
                    resultHtml += `<li>${item.name}: ${item.success ? 'PASS' : 'FAIL'}`;
                    if (item.error) resultHtml += ` - ${item.error}`;
                    resultHtml += '</li>';
                });
                resultHtml += '</ul>';
            } else {
                resultHtml += `<br>Details: ${JSON.stringify(result.data, null, 2)}`;
            }
        }
        
        if (result.error) {
            resultHtml += `<br>Error: ${result.error}`;
        }
        
        resultHtml += '</div>';
        
        container.innerHTML = resultHtml + container.innerHTML;
    }

    clearTestResults() {
        document.querySelector('.test-result-content').innerHTML = 
            '<p>No test results yet. Run a test to see results here.</p>';
    }

    async showAlertDetails(alertId) {
        try {
            const response = await fetch(`/api/alerts/history/${alertId}`);
            const result = await response.json();
            
            if (result.success) {
                const alert = result.data;
                
                const content = `
                    <div class="detail-field">
                        <div class="detail-label">Alert ID</div>
                        <div class="detail-value">${alert.id}</div>
                    </div>
                    <div class="detail-field">
                        <div class="detail-label">Type</div>
                        <div class="detail-value">${alert.type}</div>
                    </div>
                    <div class="detail-field">
                        <div class="detail-label">Priority</div>
                        <div class="detail-value">
                            <span class="alert-badge ${alert.priority}">${alert.priority}</span>
                        </div>
                    </div>
                    <div class="detail-field">
                        <div class="detail-label">Status</div>
                        <div class="detail-value">${alert.status}</div>
                    </div>
                    <div class="detail-field">
                        <div class="detail-label">Created</div>
                        <div class="detail-value">${this.formatDate(alert.createdAt)}</div>
                    </div>
                    ${alert.acknowledgedAt ? `
                        <div class="detail-field">
                            <div class="detail-label">Acknowledged</div>
                            <div class="detail-value">${this.formatDate(alert.acknowledgedAt)}</div>
                        </div>
                    ` : ''}
                    ${alert.resolvedAt ? `
                        <div class="detail-field">
                            <div class="detail-label">Resolved</div>
                            <div class="detail-value">${this.formatDate(alert.resolvedAt)}</div>
                        </div>
                    ` : ''}
                    <div class="detail-field">
                        <div class="detail-label">Title</div>
                        <div class="detail-value">${alert.title}</div>
                    </div>
                    <div class="detail-field">
                        <div class="detail-label">Message</div>
                        <div class="detail-value">${alert.message}</div>
                    </div>
                    ${alert.metadata ? `
                        <div class="detail-field">
                            <div class="detail-label">Metadata</div>
                            <div class="detail-value">
                                <pre>${JSON.stringify(alert.metadata, null, 2)}</pre>
                            </div>
                        </div>
                    ` : ''}
                `;
                
                const actions = alert.status === 'active' ? `
                    ${!alert.acknowledgedAt ? 
                        `<button class="btn success" onclick="alertManager.acknowledgeAlert('${alert.id}')">
                            <i class="fas fa-check"></i> Acknowledge
                        </button>` : ''
                    }
                    <button class="btn" onclick="alertManager.resolveAlert('${alert.id}')">
                        <i class="fas fa-times"></i> Resolve
                    </button>
                ` : '';
                
                document.getElementById('alertDetailsContent').innerHTML = content;
                document.getElementById('alertDetailsActions').innerHTML = actions;
                document.getElementById('alertDetailsModal').style.display = 'block';
                
            } else {
                this.showError('Failed to load alert details');
            }
        } catch (error) {
            console.error('Error loading alert details:', error);
            this.showError('Failed to load alert details');
        }
    }

    async acknowledgeAlert(alertId) {
        try {
            const response = await fetch(`/api/alerts/${alertId}/acknowledge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: 'web-user' })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showMessage('Alert acknowledged', 'success');
                this.loadActiveAlerts();
                this.closeModal();
            } else {
                this.showError(result.error || 'Failed to acknowledge alert');
            }
        } catch (error) {
            console.error('Error acknowledging alert:', error);
            this.showError('Failed to acknowledge alert');
        }
    }

    async resolveAlert(alertId) {
        try {
            const response = await fetch(`/api/alerts/${alertId}/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: 'web-user' })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showMessage('Alert resolved', 'success');
                this.loadActiveAlerts();
                this.closeModal();
            } else {
                this.showError(result.error || 'Failed to resolve alert');
            }
        } catch (error) {
            console.error('Error resolving alert:', error);
            this.showError('Failed to resolve alert');
        }
    }

    closeModal() {
        document.getElementById('alertDetailsModal').style.display = 'none';
    }

    handleNewAlert(alert) {
        // Refresh active alerts view if currently active
        if (document.getElementById('active-alerts').classList.contains('active')) {
            this.loadActiveAlerts();
        }
        
        // Show browser notification if supported
        if (Notification.permission === 'granted') {
            new Notification(`${alert.priority.toUpperCase()} Alert`, {
                body: alert.message,
                icon: '/favicon.ico'
            });
        }
    }

    handleAlertUpdate(alert) {
        if (document.getElementById('active-alerts').classList.contains('active')) {
            this.loadActiveAlerts();
        }
    }

    handleAlertResolved(alert) {
        if (document.getElementById('active-alerts').classList.contains('active')) {
            this.loadActiveAlerts();
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }

    showLoading(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="loading-indicator">
                <i class="fas fa-spinner fa-pulse"></i> Loading...
            </div>
        `;
    }

    showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        messageEl.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
        
        // Insert at top of current tab
        const activeTab = document.querySelector('.tab-content.active');
        activeTab.insertBefore(messageEl, activeTab.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            messageEl.remove();
        }, 5000);
    }

    showError(message) {
        this.showMessage(message, 'error');
    }
}

// Initialize the alert manager when the page loads
let alertManager;
document.addEventListener('DOMContentLoaded', () => {
    alertManager = new AlertManager();
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});
