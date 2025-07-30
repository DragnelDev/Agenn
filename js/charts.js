// js/charts.js

let monthlyPieChart;
let allTasks = []; // Almacenar todas las tareas para las gráficas

function initializeChartsPage() {
    initializeCharts(); // Inicializa el objeto Chart (pero aún sin datos)
    fetchTasksForCharts(); // Obtiene los datos y actualiza los gráficos
}


function initializeCharts() {
    const ctx = document.getElementById('tasks-chart');

    if (!ctx) {
        console.error("Canvas con ID 'tasks-chart' no encontrado para el gráfico.");
        document.getElementById('chart-data-display').textContent = 'Error: No se encontró el área para dibujar el gráfico.';
        return;
    }

    if (monthlyPieChart) {
        monthlyPieChart.destroy();
    }

    const pieChartConfig = {
        type: 'doughnut',
        data: {
            labels: ['Completadas', 'Pendientes', 'Vencidas'],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#10B981',
                    '#FBBF24',
                    '#EF4444'
                ],
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Progreso de Tareas (Mes Actual)',
                    font: {
                        size: 16
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                const value = context.parsed;
                                label += value.toFixed(1) + '%';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    };

    monthlyPieChart = new Chart(ctx, pieChartConfig);
}

async function fetchTasksForCharts() {
    const result = await apiRequest('api/tasks.php', 'GET'); // Sin parámetros de filtro ni paginación
    if (result.success) {
        // En la API de tasks.php, cuando no se pasan límites, devuelve 'data' como el array de tareas
        allTasks = result.data || [];
        updateCharts();
    } else {
        console.error('Error al cargar tareas para gráficos:', result.message);
        allTasks = [];
        updateCharts(); // Asegurar que los gráficos se actualicen aunque no haya datos
    }
}

function updateCharts() {
    if (!monthlyPieChart) {
        initializeCharts();
        if (!monthlyPieChart) return;
    }

    const now = new Date();

    const currentMonthTasks = allTasks.filter(task => {
        const taskDate = task.fecha_vencimiento ? new Date(task.fecha_vencimiento) : null;
        if (!taskDate) return false;
        return taskDate.getMonth() === now.getMonth() && taskDate.getFullYear() === now.getFullYear();
    });

    let completedCount = currentMonthTasks.filter(task => task.completada == 1).length;
    let pendingCount = currentMonthTasks.filter(task =>
        task.completada == 0 &&
        new Date(task.fecha_vencimiento).getTime() > now.getTime()
    ).length;
    let overdueCount = currentMonthTasks.filter(task =>
        task.completada == 0 &&
        new Date(task.fecha_vencimiento).getTime() <= now.getTime()
    ).length;

    const totalForChart = completedCount + pendingCount + overdueCount;

    const completedPercent = totalForChart > 0 ? (completedCount / totalForChart) * 100 : 0;
    const pendingPercent = totalForChart > 0 ? (pendingCount / totalForChart) * 100 : 0;
    const overduePercent = totalForChart > 0 ? (overdueCount / totalForChart) * 100 : 0;

    monthlyPieChart.data.datasets[0].data = [completedPercent, pendingPercent, overduePercent];
    monthlyPieChart.update();

    const displayElement = document.getElementById('chart-data-display');
    if (displayElement) {
        if (totalForChart === 0) {
            displayElement.innerHTML = '<p>No hay tareas con fecha de vencimiento en el mes actual para mostrar el gráfico.</p>';
        } else {
            displayElement.innerHTML = `
                <p><strong>Total de Tareas en el Mes:</strong> ${totalForChart}</p>
                <p><strong>Completadas:</strong> ${completedCount} (${completedPercent.toFixed(1)}%)</p>
                <p><strong>Pendientes:</strong> ${pendingCount} (${pendingPercent.toFixed(1)}%)</p>
                <p><strong>Vencidas:</strong> ${overdueCount} (${overduePercent.toFixed(1)}%)</p>
            `;
        }
    }
}
