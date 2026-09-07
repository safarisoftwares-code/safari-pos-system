class App {
    constructor() {
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupLogout();
        this.loadUserInfo();
    }

    checkAuth() {
        if (!authManager.isAuthenticated()) {
            // Clear any stored data before redirect
            sessionStorage.clear();
            localStorage.clear();
            window.location.href = '/login';
        }
    }

    loadUserInfo() {
        const user = authManager.getUser();
        if (user) {
            document.getElementById('userName').textContent = user.name;
            document.getElementById('userRole').textContent = user.role.toUpperCase();
        }
    }

    setupLogout() {
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Logout?')) {
                authManager.logout();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
