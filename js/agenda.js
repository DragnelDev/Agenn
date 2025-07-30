// js/agenda.js

let currentPageTasks = 1;
const itemsPerPageTasks = 5;
let totalTasks = 0;

let currentPageEvents = 1;
const itemsPerPageEvents = 5;
let totalEvents = 0;

function initializeAgenda() {
    fetchTasks();
    fetchEvents();

    // Event listeners para abrir modales de tarea/evento
    document.getElementById('add-task-btn').addEventListener('click', () => {
        document.getElementById('task-form').reset();
        document.getElementById('task-id').value = '';
        document.getElementById('task-modal-title').textContent = 'Añadir Nueva Tarea';
        clearFormErrors(document.getElementById('task-form'));
        openModal('task-modal');
    });
    document.getElementById('add-event-btn').addEventListener('click', () => {
        document.getElementById('event-form').reset();
        document.getElementById('event-id').value = '';
        document.getElementById('event-modal-title').textContent = 'Añadir Nuevo Evento';
        clearFormErrors(document.getElementById('event-form'));
        openModal('event-modal');
    });

    // Event listeners para enviar formularios de tarea/evento
    document.getElementById('task-form').addEventListener('submit', addTask);
    document.getElementById('event-form').addEventListener('submit', addEvent);

    // Event listeners para filtros, ordenación y búsqueda
    document.getElementById('task-filter').addEventListener('change', () => fetchTasks(1));
    document.getElementById('task-sort').addEventListener('change', () => fetchTasks(1));
    document.getElementById('task-search').addEventListener('input', () => fetchTasks(1));

    document.getElementById('event-sort').addEventListener('change', () => fetchEvents(1));
    document.getElementById('event-search').addEventListener('input', () => fetchEvents(1));
}


// --- Tareas ---
async function fetchTasks(page = 1) {
    currentPageTasks = page;

    const taskListDiv = document.getElementById('task-list');
    taskListDiv.innerHTML = '<p class="text-gray-500">Cargando tareas...</p>';

    const filterValue = document.getElementById('task-filter').value;
    const sortValue = document.getElementById('task-sort').value;
    const searchValue = document.getElementById('task-search').value;

    let queryParams = new URLSearchParams();
    if (filterValue === 'pending') {
        queryParams.append('completed', 'false');
    } else if (filterValue === 'completed') {
        queryParams.append('completed', 'true');
    }

    if (sortValue) {
        const [sortBy, sortOrder] = sortValue.split('_');
        queryParams.append('sortBy', sortBy);
        queryParams.append('sortOrder', sortOrder);
    }

    if (searchValue) {
        queryParams.append('search', searchValue);
    }

    queryParams.append('limit', itemsPerPageTasks);
    queryParams.append('offset', (currentPageTasks - 1) * itemsPerPageTasks);

    const queryString = queryParams.toString();
    const url = `api/tasks.php${queryString ? '?' + queryString : ''}`;

    const result = await apiRequest(url, 'GET');

    if (result.success) {
        totalTasks = result.total;
        renderTasks(result.data);
        renderPaginationControls('task-pagination', totalTasks, itemsPerPageTasks, currentPageTasks, fetchTasks);
    } else {
        taskListDiv.innerHTML = `<p class="text-red-500">Error al cargar tareas: ${result.message}</p>`;
    }
}


function renderTasks(tasks) {
    const taskListDiv = document.getElementById('task-list');
    taskListDiv.innerHTML = '';

    if (tasks.length === 0) {
        taskListDiv.innerHTML = '<p class="text-gray-500">No hay tareas que coincidan con los criterios.</p>';
        return;
    }

    tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = `bg-gray-100 p-4 rounded-lg flex flex-wrap items-center justify-between gap-2 ${task.completada == 1 ? 'task-item completed' : 'task-item'}`;
        taskItem.dataset.id = task.id;
        taskItem.setAttribute('draggable', 'true');

        const taskContent = document.createElement('span');
        taskContent.className = 'flex-grow';
        let dueDateText = '';
        if (task.fecha_vencimiento) {
            const dueDate = new Date(task.fecha_vencimiento);
            dueDateText = ` <span class="text-sm text-gray-600">(${dueDate.toLocaleDateString()} ${dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>`;
        }
        taskContent.innerHTML = `${task.titulo}${dueDateText}`;
        taskItem.appendChild(taskContent);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'flex items-center space-x-2 flex-shrink-0';

        if (task.completada != 1) {
            const completeButton = document.createElement('button');
            completeButton.className = 'button button-primary text-sm px-3 py-1';
            completeButton.textContent = 'Completar';
            completeButton.addEventListener('click', () => markTaskCompleted(task.id));
            actionsDiv.appendChild(completeButton);
        } else {
            const completedBadge = document.createElement('span');
            completedBadge.className = 'bg-green-200 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full';
            completedBadge.textContent = 'Completada';
            actionsDiv.appendChild(completedBadge);
        }

        const editButton = document.createElement('button');
        editButton.className = 'button button-secondary text-sm px-3 py-1';
        editButton.textContent = 'Editar';
        editButton.addEventListener('click', () => editTask(task));
        actionsDiv.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'button button-danger text-sm px-3 py-1';
        deleteButton.textContent = 'Eliminar';
        deleteButton.addEventListener('click', () => {
            showConfirmationModal(
                'Eliminar Tarea',
                `¿Estás seguro de que quieres eliminar la tarea "${task.titulo}"?`,
                () => deleteTask(task.id)
            );
        });
        actionsDiv.appendChild(deleteButton);

        taskItem.appendChild(actionsDiv);
        taskListDiv.appendChild(taskItem);
    });
    initializeSortable('task-list', 'tasks');
}

async function addTask(event) {
    event.preventDefault();

    const taskId = document.getElementById('task-id').value;
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-description').value;
    const dueDate = document.getElementById('task-due-date').value;

    if (!validateTaskForm(title, dueDate)) return;

    const taskData = {
        titulo: title,
        descripcion: description,
        fecha_vencimiento: dueDate || null
    };

    let result;
    if (taskId) {
        taskData.id = taskId;
        result = await apiRequest('api/tasks.php', 'PUT', taskData);
    } else {
        result = await apiRequest('api/tasks.php', 'POST', taskData);
    }

    if (result.success) {
        showToast(result.message, 'success');
        closeModal('task-modal');
        fetchTasks(currentPageTasks);
    } else {
        showToast(`Error al guardar tarea: ${result.message}`, 'error');
    }
}

function editTask(task) {
    document.getElementById('task-modal-title').textContent = 'Editar Tarea';
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-title').value = task.titulo;
    document.getElementById('task-description').value = task.descripcion;
    if (task.fecha_vencimiento) {
        const date = new Date(task.fecha_vencimiento);
        const formattedDate = date.toISOString().slice(0, 16);
        document.getElementById('task-due-date').value = formattedDate;
    } else {
        document.getElementById('task-due-date').value = '';
    }
    clearFormErrors(document.getElementById('task-form'));
    openModal('task-modal');
}

async function markTaskCompleted(id) {
    const result = await apiRequest('api/tasks.php', 'PUT', { id: id, completada: 1 });
    if (result.success) {
        showToast(result.message, 'success');
        fetchTasks(currentPageTasks);
    } else {
        showToast(`Error al marcar tarea como completada: ${result.message}`, 'error');
    }
}

async function deleteTask(id) {
    const result = await apiRequest(`api/tasks.php?id=${id}`, 'DELETE');
    if (result.success) {
        showToast(result.message, 'success');
        fetchTasks(currentPageTasks);
    } else {
        showToast(`Error al eliminar tarea: ${result.message}`, 'error');
    }
}


// --- Eventos ---
async function fetchEvents(page = 1) {
    currentPageEvents = page;

    const personalScheduleDiv = document.getElementById('personal-schedule');
    personalScheduleDiv.innerHTML = '<p class="text-gray-500">Cargando eventos...</p>';

    const sortValue = document.getElementById('event-sort').value;
    const searchValue = document.getElementById('event-search').value;

    let queryParams = new URLSearchParams();
    if (sortValue) {
        const [sortBy, sortOrder] = sortValue.split('_');
        queryParams.append('sortBy', sortBy);
        queryParams.append('sortOrder', sortOrder);
    }

    if (searchValue) {
        queryParams.append('search', searchValue);
    }

    queryParams.append('limit', itemsPerPageEvents);
    queryParams.append('offset', (currentPageEvents - 1) * itemsPerPageEvents);

    const queryString = queryParams.toString();
    const url = `api/events.php${queryString ? '?' + queryString : ''}`;

    const result = await apiRequest(url, 'GET');

    if (result.success) {
        totalEvents = result.total;
        renderEvents(result.data);
        renderPaginationControls('event-pagination', totalEvents, itemsPerPageEvents, currentPageEvents, fetchEvents);
    } else {
        personalScheduleDiv.innerHTML = `<p class="text-red-500">Error al cargar eventos: ${result.message}</p>`;
    }
}

function renderEvents(events) {
    const personalScheduleDiv = document.getElementById('personal-schedule');
    personalScheduleDiv.innerHTML = '';

    if (events.length === 0) {
        personalScheduleDiv.innerHTML = '<p class="text-gray-500">No hay eventos que coincidan con los criterios.</p>';
        return;
    }

    events.forEach(event => {
        const eventItem = document.createElement('div');
        eventItem.className = 'bg-gray-100 p-4 rounded-lg flex flex-wrap items-center justify-between gap-2';
        eventItem.dataset.id = event.id;
        eventItem.setAttribute('draggable', 'true');

        const eventContent = document.createElement('div');
        eventContent.className = 'flex-grow';
        const startDate = new Date(event.fecha_inicio);
        const endDate = new Date(event.fecha_fin);
        eventContent.innerHTML = `
            <p class="font-semibold">${event.titulo}</p>
            <p class="text-sm text-gray-600">${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        `;
        eventItem.appendChild(eventContent);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'flex items-center space-x-2 flex-shrink-0';

        const editButton = document.createElement('button');
        editButton.className = 'button button-secondary text-sm px-3 py-1';
        editButton.textContent = 'Editar';
        editButton.addEventListener('click', () => editEvent(event));
        actionsDiv.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.className = 'button button-danger text-sm px-3 py-1';
        deleteButton.textContent = 'Eliminar';
        deleteButton.addEventListener('click', () => {
            showConfirmationModal(
                'Eliminar Evento',
                `¿Estás seguro de que quieres eliminar el evento "${event.titulo}"?`,
                () => deleteEvent(event.id)
            );
        });
        actionsDiv.appendChild(deleteButton);

        eventItem.appendChild(actionsDiv);
        personalScheduleDiv.appendChild(eventItem);
    });
    initializeSortable('personal-schedule', 'events');
}

async function addEvent(event) {
    event.preventDefault();

    const eventId = document.getElementById('event-id').value;
    const title = document.getElementById('event-title').value;
    const description = document.getElementById('event-description').value;
    const startDate = document.getElementById('event-start-date').value;
    const endDate = document.getElementById('event-end-date').value;

    if (!validateEventForm(title, startDate, endDate)) return;

    const eventData = {
        titulo: title,
        descripcion: description,
        fecha_inicio: startDate,
        fecha_fin: endDate
    };

    let result;
    if (eventId) {
        eventData.id = eventId;
        result = await apiRequest('api/events.php', 'PUT', eventData);
    } else {
        result = await apiRequest('api/events.php', 'POST', eventData);
    }

    if (result.success) {
        showToast(result.message, 'success');
        closeModal('event-modal');
        fetchEvents(currentPageEvents);
    } else {
        showToast(`Error al guardar evento: ${result.message}`, 'error');
    }
}

function editEvent(event) {
    document.getElementById('event-modal-title').textContent = 'Editar Evento';
    document.getElementById('event-id').value = event.id;
    document.getElementById('event-title').value = event.titulo;
    document.getElementById('event-description').value = event.descripcion;
    document.getElementById('event-start-date').value = new Date(event.fecha_inicio).toISOString().slice(0, 16);
    document.getElementById('event-end-date').value = new Date(event.fecha_fin).toISOString().slice(0, 16);
    clearFormErrors(document.getElementById('event-form'));
    openModal('event-modal');
}

async function deleteEvent(id) {
    const result = await apiRequest(`api/events.php?id=${id}`, 'DELETE');
    if (result.success) {
        showToast(result.message, 'success');
        fetchEvents(currentPageEvents);
    } else {
        showToast(`Error al eliminar evento: ${result.message}`, 'error');
    }
}

// --- Funciones de Drag & Drop (SortableJS) ---
function initializeSortable(listId, type) {
    const listElement = document.getElementById(listId);
    if (!listElement) return;

    if (listElement.sortable) {
        listElement.sortable.destroy();
    }

    listElement.sortable = Sortable.create(listElement, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: function (evt) {
            const newOrder = Array.from(evt.to.children).map((item, index) => ({
                id: item.dataset.id,
                order: index
            }));
            updateItemOrder(newOrder, type);
        }
    });
}

async function updateItemOrder(items, type) {
    const result = await apiRequest('api/reorder.php', 'POST', { items: items, type: type });
    if (result.success) {
        showToast(result.message, 'success');
        // Recargar solo la página actual para reflejar el nuevo orden de la BD.
        if (type === 'tasks') {
            fetchTasks(currentPageTasks);
        } else if (type === 'events') {
            fetchEvents(currentPageEvents);
        }
    } else {
        showToast(`Error al reordenar ${type}: ${result.message}`, 'error');
        if (type === 'tasks') {
            fetchTasks(currentPageTasks);
        } else if (type === 'events') {
            fetchEvents(currentPageEvents);
        }
    }
}

