// js/auth.js

// Lógica de logout común para todas las páginas que lo necesiten
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const result = await apiRequest('api/logout.php', 'POST');
            if (result.success) {
                showToast(result.message, 'info');
                // Redirigir a la página de inicio de sesión después de cerrar sesión
                window.location.href = 'index.html';
            } else {
                showToast(`Error al cerrar sesión: ${result.message}`, 'error');
            }
        });
    }
});

