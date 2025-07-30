// js/common.js

// Variables globales para almacenar la función de confirmación
let confirmActionCallback = null;

// --- Toast Notifications ---
function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.error("No se encontró el contenedor de toasts. Asegúrate de tener <div id='toast-container'></div> en tu HTML.");
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-message">${message}</span>`;

    toastContainer.appendChild(toast);

    // Forzar reflow para que la transición funcione
    void toast.offsetWidth;

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide'); // Añadir clase para la transición de salida
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}

// --- Funciones para manejar Modales ---
function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
    // Limpiar mensajes y estilos de error al cerrar cualquier modal de formulario
    const form = document.getElementById(modalId).querySelector('form');
    if (form) {
        clearFormErrors(form);
    }
}

// Función para abrir el modal de confirmación
function showConfirmationModal(title, message, callback) {
    const confirmationModal = document.getElementById('confirmation-modal');
    if (!confirmationModal) {
        console.error("Confirmation modal not found. Ensure 'confirmation-modal' exists in your HTML.");
        return;
    }
    document.getElementById('confirmation-modal-title').textContent = title;
    document.getElementById('confirmation-modal-message').textContent = message;
    confirmActionCallback = callback; // Almacena la función a ejecutar si se confirma
    openModal('confirmation-modal');
}

// Event listeners para cerrar modales
document.querySelectorAll('.modal-close-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        const modalId = e.target.dataset.modal;
        closeModal(modalId);
    });
});

// Cerrar modal al hacer clic fuera del contenido
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal.id);
        }
    });
});

// Event listeners para el modal de confirmación
// Estos se adjuntan en agenda.html ya que el modal de confirmación está allí
// y estas funciones deben existir antes de que se adjunten los listeners.
document.addEventListener('DOMContentLoaded', () => {
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const confirmActionBtn = document.getElementById('confirm-action-btn');

    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', () => {
            closeModal('confirmation-modal');
            confirmActionCallback = null; // Limpiar el callback
        });
    }

    if (confirmActionBtn) {
        confirmActionBtn.addEventListener('click', () => {
            closeModal('confirmation-modal');
            if (confirmActionCallback) {
                confirmActionCallback(); // Ejecutar la función almacenada
                confirmActionCallback = null; // Limpiar el callback
            }
        });
    }
});


// --- Funciones de Validación de Formularios ---
function clearFormErrors(formElement) {
    formElement.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    formElement.querySelectorAll('.error-message').forEach(el => el.textContent = '');
}

function displayError(inputElement, message) {
    inputElement.classList.add('input-error');
    const errorDiv = document.getElementById(`${inputElement.id}-error`);
    if (errorDiv) {
        errorDiv.textContent = message;
    }
}

function validateAuthForm(username, password, isRegisterMode = false) {
    let isValid = true;
    const form = isRegisterMode ? document.getElementById('register-form') : document.getElementById('auth-form');
    clearFormErrors(form);

    const usernameInput = isRegisterMode ? document.getElementById('register-username') : document.getElementById('auth-username');
    const passwordInput = isRegisterMode ? document.getElementById('register-password') : document.getElementById('auth-password');

    if (!username) {
        displayError(usernameInput, 'El nombre de usuario es obligatorio.');
        isValid = false;
    }
    if (!password) {
        displayError(passwordInput, 'La contraseña es obligatoria.');
        isValid = false;
    } else if (password.length < 6 && isRegisterMode) {
        displayError(passwordInput, 'La contraseña debe tener al menos 6 caracteres.');
        isValid = false;
    }
    return isValid;
}

function validateTaskForm(title, dueDate) {
    let isValid = true;
    const form = document.getElementById('task-form');
    clearFormErrors(form);

    const titleInput = document.getElementById('task-title');
    const dueDateInput = document.getElementById('task-due-date');

    if (!title) {
        displayError(titleInput, 'El título de la tarea es obligatorio.');
        isValid = false;
    }
    if (dueDate && isNaN(new Date(dueDate).getTime())) {
        displayError(dueDateInput, 'Formato de fecha de vencimiento inválido.');
        isValid = false;
    }
    return isValid;
}

function validateEventForm(title, startDate, endDate) {
    let isValid = true;
    const form = document.getElementById('event-form');
    clearFormErrors(form);

    const titleInput = document.getElementById('event-title');
    const startDateInput = document.getElementById('event-start-date');
    const endDateInput = document.getElementById('event-end-date');

    if (!title) {
        displayError(titleInput, 'El título del evento es obligatorio.');
        isValid = false;
    }
    if (!startDate) {
        displayError(startDateInput, 'La fecha de inicio es obligatoria.');
        isValid = false;
    }
    if (!endDate) {
        displayError(endDateInput, 'La fecha de fin es obligatoria.');
        isValid = false;
    }

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime())) {
            displayError(startDateInput, 'Formato de fecha de inicio inválido.');
            isValid = false;
        }
        if (isNaN(end.getTime())) {
            displayError(endDateInput, 'Formato de fecha de fin inválido.');
            isValid = false;
        }
        if (isValid && start >= end) {
            displayError(endDateInput, 'La fecha de fin debe ser posterior a la de inicio.');
            isValid = false;
        }
    }
    return isValid;
}

// --- Función genérica para hacer solicitudes a la API ---
async function apiRequest(url, method, data = null) {
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
        };
        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        if (response.status === 401) {
            // Forzar redirección al login si la sesión expira o no está autorizado
            showToast('Tu sesión ha expirado o no estás autorizado. Por favor, inicia sesión de nuevo.', 'error');
            setTimeout(() => {
                 // Solo redirige si no es ya la página de login
                if (window.location.pathname !== '/' && !window.location.pathname.includes('index.html')) {
                    window.location.href = 'index.html';
                }
            }, 1500);
            return { success: false, message: 'Sesión expirada o no autorizado.' };
        }
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error HTTP: ${response.status} - ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error en la solicitud a la API:', error);
        showToast(`Error: ${error.message}`, 'error');
        return { success: false, message: error.message };
    }
}

// --- Funciones de Paginación ---
function renderPaginationControls(containerId, totalItems, itemsPerPage, currentPage, fetchFunction) {
    const paginationContainer = document.getElementById(containerId);
    paginationContainer.innerHTML = ''; // Limpiar controles existentes

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) {
        return; // No mostrar paginación si solo hay una página o menos
    }

    // Botón "Anterior"
    const prevButton = document.createElement('button');
    prevButton.className = 'pagination-button';
    prevButton.textContent = 'Anterior';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => fetchFunction(currentPage - 1));
    paginationContainer.appendChild(prevButton);

    // Números de página
    const maxPageButtons = 5; // Número máximo de botones de página a mostrar
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

    // Ajustar si estamos cerca del final
    if (endPage - startPage + 1 < maxPageButtons) {
        startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = `pagination-button ${i === currentPage ? 'active' : ''}`;
        pageButton.textContent = i;
        pageButton.addEventListener('click', () => fetchFunction(i));
        paginationContainer.appendChild(pageButton);
    }

    // Botón "Siguiente"
    const nextButton = document.createElement('button');
    nextButton.className = 'pagination-button';
    nextButton.textContent = 'Siguiente';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => fetchFunction(currentPage + 1));
    paginationContainer.appendChild(nextButton);
}
