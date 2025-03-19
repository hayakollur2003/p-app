// Constants
const DAILY_PRODUCTION_CAPACITY_PER_LINE = 120;
const NUMBER_OF_LINES = 4;
const TOTAL_DAILY_PRODUCTION_CAPACITY = DAILY_PRODUCTION_CAPACITY_PER_LINE * NUMBER_OF_LINES;
const MINUTES_PER_BATTERY = 15;

class ProductionScheduler {
    constructor() {
        this.ordersData = [];
        this.inventoryData = [];
    }

    // Parse CSV content
    parseCSV(csvContent) {
        const lines = csvContent.trim().split('\n'); // Trim to avoid empty lines
        if (lines.length < 2) return []; // Ensure at least header + 1 row
        const headers = lines[0].split(',').map(header => header.trim());

        return lines.slice(1).map(line => {
            const values = line.split(',').map(value => value.trim());
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index] || ''; // Handle missing values
                return obj;
            }, {});
        });
    }

    // Calculate production schedule for an order
    calculateProductionSchedule(orderQuantity, orderDate, leadTimeDays) {
        const totalProductionMinutes = orderQuantity * MINUTES_PER_BATTERY;
        const daysNeeded = Math.ceil(totalProductionMinutes / (TOTAL_DAILY_PRODUCTION_CAPACITY * MINUTES_PER_BATTERY));
        const remainingItems = orderQuantity % TOTAL_DAILY_PRODUCTION_CAPACITY;

        const productionSchedule = [];
        let currentDate = new Date(orderDate);

        for (let day = 0; day < daysNeeded; day++) {
            productionSchedule.push({
                'Production Date': currentDate.toISOString().split('T')[0],
                'Quantity Line 1': DAILY_PRODUCTION_CAPACITY_PER_LINE,
                'Quantity Line 2': DAILY_PRODUCTION_CAPACITY_PER_LINE,
                'Quantity Line 3': DAILY_PRODUCTION_CAPACITY_PER_LINE,
                'Quantity Line 4': DAILY_PRODUCTION_CAPACITY_PER_LINE,
                'Minutes Used': TOTAL_DAILY_PRODUCTION_CAPACITY * MINUTES_PER_BATTERY
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        if (remainingItems > 0) {
            const quantityPerLine = Array(NUMBER_OF_LINES).fill(0);
            for (let i = 0; i < remainingItems; i++) {
                quantityPerLine[i % NUMBER_OF_LINES]++;
            }

            productionSchedule.push({
                'Production Date': currentDate.toISOString().split('T')[0],
                'Quantity Line 1': quantityPerLine[0],
                'Quantity Line 2': quantityPerLine[1],
                'Quantity Line 3': quantityPerLine[2],
                'Quantity Line 4': quantityPerLine[3],
                'Minutes Used': remainingItems * MINUTES_PER_BATTERY
            });
        }

        const leadTimeCompletionDate = new Date(orderDate);
        leadTimeCompletionDate.setDate(leadTimeCompletionDate.getDate() + Math.ceil(leadTimeDays));

        return { productionSchedule, leadTimeCompletionDate };
    }

    // Process files and generate schedule
    async processFiles(ordersFile, inventoryFile) {
        try {
            const [ordersContent, inventoryContent] = await Promise.all([ 
                ordersFile.text(), 
                inventoryFile.text() 
            ]);

            this.ordersData = this.parseCSV(ordersContent);
            this.inventoryData = this.parseCSV(inventoryContent);

            if (!this.ordersData.length || !this.inventoryData.length) {
                throw new Error("Invalid CSV file format or empty data.");
            }

            // Merge orders with inventory
            const finalSchedule = [];
            let totalMinutesUsed = 0;

            this.ordersData.forEach(order => {
                const inventory = this.inventoryData.find(inv => inv.PRODUCT_ID === order.PRODUCT_ID);
                if (!inventory || !inventory.LEAD_TIME) return;

                // Reduce lead time by 10%, ensuring at least 1 day
                const leadTimeDays = Math.max(1, Math.ceil(parseFloat(inventory.LEAD_TIME) * 0.9));
                const orderQuantity = parseInt(order.QUANTITY, 10);
                const orderDate = new Date(order.ORDER_DATE);

                const { productionSchedule, leadTimeCompletionDate } = 
                    this.calculateProductionSchedule(orderQuantity, orderDate, leadTimeDays);

                productionSchedule.forEach(entry => {
                    finalSchedule.push({
                        'Order No': order.ORDER_ID,
                        'Item Code': order.PRODUCT_ID,
                        'Item Description': order.PRODUCT_NAME,
                        'Order Quantity': orderQuantity,
                        'Lead Time (days)': leadTimeDays,
                        'Lead Time Completion Date': leadTimeCompletionDate.toISOString().split('T')[0],
                        ...entry
                    });
                    totalMinutesUsed += entry['Minutes Used'];
                });
            });

            if (finalSchedule.length === 0) {
                throw new Error("No valid production schedules generated.");
            }

            // Calculate summary metrics
            const totalOrders = this.ordersData.length;
            const uniqueProductionDates = new Set(finalSchedule.map(entry => entry['Production Date'])).size;
            const averageLeadTime = finalSchedule.reduce((sum, entry) => 
                sum + parseFloat(entry['Lead Time (days)']), 0) / finalSchedule.length;

            return {
                schedule: finalSchedule,
                metrics: {
                    totalOrders,
                    totalProductionDays: uniqueProductionDates,
                    averageLeadTime: averageLeadTime.toFixed(2),
                    totalMinutesUsed
                }
            };
        } catch (error) {
            console.error('Error processing files:', error);
            throw error;
        }
    }
}

// Initialize the scheduler
const scheduler = new ProductionScheduler();

// Update form submission handler
document.getElementById('productionInputForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const ordersFile = document.getElementById('ordersFile').files[0];
    const inventoryFile = document.getElementById('inventoryFile').files[0];

    if (!ordersFile || !inventoryFile) {
        alert('Please select both orders and inventory files');
        return;
    }

    try {
        const result = await scheduler.processFiles(ordersFile, inventoryFile);  // Process the files
        console.log("Server Response:", result);  // Debugging log

        // Update the UI with the result
        updateDashboard(result);
    } catch (error) {
        console.error('Error generating production schedule:', error);
        alert('Error generating production schedule. Please check the console for details.');
    }
});

// Update dashboard with results
function updateDashboard(result) {
    if (!result.schedule || result.schedule.length === 0) {
        console.warn("No production schedule received.");
        alert("No production schedule available.");
        return;
    }

    document.getElementById('inventoryLevelDisplay').textContent = result.metrics.totalOrders;
    document.getElementById('pendingOrdersDisplay').textContent = result.metrics.totalProductionDays;
    document.getElementById('salesForecastDisplay').textContent = result.metrics.averageLeadTime;

    const tbody = document.getElementById('productionScheduleBody');
    tbody.innerHTML = '';

    result.schedule.forEach(entry => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry['Production Date']}</td>
            <td>${entry['Quantity Line 1'] + entry['Quantity Line 2'] + 
                 entry['Quantity Line 3'] + entry['Quantity Line 4']} units</td>
            <td>${entry['Order Quantity']} units</td>
            <td>${entry['Minutes Used']} minutes</td>
            <td>${((entry['Minutes Used'] / (TOTAL_DAILY_PRODUCTION_CAPACITY * MINUTES_PER_BATTERY)) * 100).toFixed(2)}%</td>
            <td><span class="badge bg-primary">In Progress</span></td>
        `;
        tbody.appendChild(row);
    });
}
