let products = [];
let categories = [];
let cart = [];
let discount = 0;
let businessSettings = null;

function showView(viewName) {
    const user = authManager.getUser();
    if (user && user.role === 'cashier') {
        const allowed = ['dashboard', 'pos', 'receipts', 'reports'];
        if (!allowed.includes(viewName)) { alert('Access denied.'); return; }
    }
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    const targetView = document.getElementById(viewName);
    if (targetView) { targetView.style.display = 'block'; }
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    document.getElementById('sidebar').classList.remove('active');
    if (viewName === 'products') loadProducts();
    if (viewName === 'categories') loadCategories();
    if (viewName === 'users') loadUsers();
    if (viewName === 'reports') { loadAllSales(); loadLowStock(); loadDailyClose(); loadProfitReport(); }
    if (viewName === 'analytics') { loadAnalytics(); loadExpiryReport(); }
    if (viewName === 'pos') loadProductsForPOS();
    if (viewName === 'backup') loadBackups();
    if (viewName === 'settings') { loadSettings(); loadMpesaSettings(); loadExpirySettings(); }
    if (viewName === 'dashboard') loadDashboard();
    if (viewName === 'receipts') loadReceiptHistory();
    if (viewName === 'purchaseOrders') loadPurchaseOrders();
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function openProductModal() { loadCategoriesForSelect(); openModal('productModal'); }
function openCategoryModal() { openModal('categoryModal'); }
function openUserModal() { openModal('userModal'); }

async function apiCall(url, method = 'GET', data = null) {
    const options = { method: method, headers: authManager.getAuthHeaders() };
    if (data) options.body = JSON.stringify(data);
    const response = await fetch(API_BASE_URL + url, options);
    if (!response.ok) { const error = await response.json(); throw new Error(error.detail || 'Request failed'); }
    return response.json();
}

async function loadCategories() {
    try {
        categories = await apiCall('/products/categories');
        const tbody = document.getElementById('categoriesTableBody');
        if (tbody) { tbody.innerHTML = categories.map(c => '<tr><td>' + c.id + '</td><td>' + c.name + '</td><td>' + (c.description || '-') + '</td></tr>').join('') || '<tr><td colspan="3">No categories</td></tr>'; }
    } catch (e) { console.error(e); }
}

async function loadCategoriesForSelect() {
    try {
        categories = await apiCall('/products/categories');
        const select = document.getElementById('productCategory');
        if (select) { select.innerHTML = '<option value="">Select Category</option>' + categories.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join(''); }
        const posFilter = document.getElementById('posCategoryFilter');
        if (posFilter) { posFilter.innerHTML = '<option value="all">All Categories</option>' + categories.map(c => '<option value="' + c.id + '">' + c.name + '</option>').join(''); }
    } catch (e) { console.error(e); }
}

async function loadProducts() {
    try {
        products = await apiCall('/products');
        const tbody = document.getElementById('productsTableBody');
        if (tbody) {
            tbody.innerHTML = products.map(p => {
                const cat = categories.find(c => c.id === p.category_id);
                const taxLabel = (p.tax_rate || 0) > 0 ? 'A' : 'B';
                return '<tr><td>' + p.id + '</td><td>' + p.name + '</td><td>' + (p.unit || '-') + '</td><td>' + (cat ? cat.name : '-') + '</td><td>KSh ' + p.price + '</td><td style="text-align:center;font-weight:bold">' + taxLabel + '</td><td>' + p.stock + '</td><td><button onclick="openEditProductModal(' + p.id + ')" style="padding:5px 10px;font-size:12px;margin-right:3px;background:#2e7d32;color:white;border:none;border-radius:3px">Edit</button> <button onclick="openStockModal(' + p.id + ')" style="padding:5px 10px;font-size:12px;margin-right:3px">Stock</button> <button onclick="deleteProduct(' + p.id + ')" style="padding:5px 10px;font-size:12px;color:red">Delete</button></td></tr>';
            }).join('') || '<tr><td colspan="8">No products</td></tr>';
        }
    } catch (e) { alert(e.message); }
}

async function loadProductsForPOS() {
    await loadCategoriesForSelect();
    try { products = await apiCall('/products'); renderPOSProducts(products); } catch (e) { alert(e.message); }
}

function renderPOSProducts(list) {
    const grid = document.getElementById('productGrid');
    if (grid) { grid.innerHTML = list.map(p => '<div class="product-card" onclick="addToCart(' + p.id + ')"><div class="product-name">' + p.name + '</div>' + (p.unit ? '<div style="font-size:12px;color:#666">' + p.unit + '</div>' : '') + '<div class="product-price">KSh ' + p.price + '</div>' + (p.stock <= 0 ? '<div style="background:#d32f2f;color:white;padding:2px 5px;border-radius:3px;font-size:11px">OUT OF STOCK</div>' : '<div class="product-stock">Stock: ' + p.stock + '</div>') + '</div>').join(''); }
}

function openEditProductModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    document.getElementById('editProductId').value = product.id;
    document.getElementById('editProductName').value = product.name;
    document.getElementById('editProductUnit').value = product.unit || '';
    document.getElementById('editProductPrice').value = product.price;
    document.getElementById('editProductTaxRate').value = product.tax_rate || 0;
    document.getElementById('editProductStock').value = product.stock;
    document.getElementById('editProductExpiry').value = product.expiry_date || '';
    document.getElementById('editProductModal').classList.add('active');
}

async function deleteProduct(id) {
    if (prompt('Type DELETE to confirm:') !== 'DELETE') return;
    if (!confirm('Are you sure?')) return;
    try { await apiCall('/products/' + id, 'DELETE'); loadProducts(); } catch (e) { alert(e.message); }
}

async function loadUsers() {
    try {
        const users = await apiCall('/users');
        document.getElementById('usersTableBody').innerHTML = users.map(u => '<tr><td>' + u.id + '</td><td>' + u.name + '</td><td>' + u.email + '</td><td>' + u.role.toUpperCase() + '</td><td><button onclick="deleteUser(' + u.id + ')" style="padding:5px 10px;font-size:12px;color:red">Remove</button></td></tr>').join('');
    } catch (e) { alert(e.message); }
}

async function deleteUser(id) {
    if (prompt('Type DELETE to confirm:') !== 'DELETE') return;
    if (!confirm('Deactivate?')) return;
    try { await apiCall('/users/' + id, 'DELETE'); loadUsers(); } catch (e) { alert(e.message); }
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    if (product.stock <= 0) { alert('OUT OF STOCK!'); return; }
    
    // Check expiry protection
    if (product.expiry_date) {
        const today = new Date();
        const expiry = new Date(product.expiry_date);
        const daysLeft = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
        
        // Check if blocking expired is enabled
        if (daysLeft < 0) {
            const settings = businessSettings;
            if (settings && settings.block_expired === 'true') {
                alert('CANNOT SELL! ' + product.name + ' EXPIRED ' + Math.abs(daysLeft) + ' days ago. Contact manager.');
                return;
            }
        }
        
        // Check if warning for expiring is enabled
        if (daysLeft >= 0 && daysLeft <= 7) {
            const settings = businessSettings;
            if (settings && settings.warn_expiring === 'true') {
                if (!confirm('WARNING: ' + product.name + ' expires in ' + daysLeft + ' days. Sell anyway?')) {
                    return;
                }
            }
        }
    }
    const existing = cart.find(i => i.product_id === productId);
    if (existing) {
        if (existing.quantity >= product.stock) { alert('NOT ENOUGH STOCK! Available: ' + product.stock); return; }
        existing.quantity++;
    } else {
        cart.push({ product_id: product.id, name: product.name, unit: product.unit, quantity: 1, unit_price: product.price, tax_rate: product.tax_rate || 0, stock: product.stock });
    }
    updateCart();
}

function removeFromCart(productId) { cart = cart.filter(i => i.product_id !== productId); updateCart(); }

function updateQuantity(productId, change) {
    const item = cart.find(i => i.product_id === productId);
    if (!item) return;
    item.quantity += change;
    if (item.quantity <= 0) { removeFromCart(productId); return; }
    if (item.quantity > item.stock) { alert('NOT ENOUGH STOCK! Available: ' + item.stock); item.quantity -= change; return; }
    updateCart();
}

function updateCart() {
    const cartDiv = document.getElementById('cartItems');
    let subtotal = 0, taxAmount = 0;
    cart.forEach(item => {
        const lineTotal = item.quantity * item.unit_price;
        const taxRate = item.tax_rate || 0;
        const lineTax = taxRate > 0 ? lineTotal - (lineTotal / (1 + taxRate / 100)) : 0;
        subtotal += lineTotal; taxAmount += lineTax;
    });
    const discountAmount = subtotal * (discount / 100);
    const total = subtotal - discountAmount;
    if (cartDiv) {
        cartDiv.innerHTML = cart.map(i => {
            const lineTotal = i.quantity * i.unit_price;
            const taxRate = i.tax_rate || 0;
            const lineTax = taxRate > 0 ? lineTotal - (lineTotal / (1 + taxRate / 100)) : 0;
            return '<div style="display:flex;align-items:center;justify-content:space-between;padding:15px;border-bottom:1px solid #ecf0f1;gap:10px">' +
                '<div style="flex:2"><strong style="font-size:14px">' + i.name + '</strong>' + (i.unit ? ' <small>(' + i.unit + ')</small>' : '') + '<br><small style="color:#666">KSh ' + i.unit_price + ' each</small></div>' +
                '<div style="flex:1;display:flex;align-items:center;gap:8px;justify-content:center">' +
                '<button onclick="updateQuantity(' + i.product_id + ',-1)" style="width:24px;height:24px;font-size:14px;background:#f0f0f0;color:#333;border:1px solid #ddd;border-radius:3px;cursor:pointer">-</button>' +
                '<span style="font-size:16px;font-weight:bold;min-width:30px;text-align:center">' + i.quantity + '</span>' +
                '<button onclick="updateQuantity(' + i.product_id + ',1)" style="width:24px;height:24px;font-size:14px;background:#f0f0f0;color:#333;border:1px solid #ddd;border-radius:3px;cursor:pointer">+</button>' +
                '</div>' +
                '<div style="flex:1.5;text-align:right"><strong style="font-size:14px">KSh ' + lineTotal.toFixed(2) + '</strong><br><small style="color:#d2691e">Tax: KSh ' + lineTax.toFixed(2) + '</small></div>' +
                '<button onclick="removeFromCart(' + i.product_id + ')" style="background:#d32f2f;color:white;border:none;border-radius:5px;width:25px;height:25px;cursor:pointer;font-size:14px">X</button>' +
                '</div>';
        }).join('') || '<p style="color:#95a5a6;text-align:center;margin-top:50px">Cart is empty</p>';
    }
    document.getElementById('subtotal').textContent = 'KSh ' + subtotal.toFixed(2);
    document.getElementById('tax').textContent = 'KSh ' + taxAmount.toFixed(2);
    document.getElementById('discount').textContent = '-KSh ' + discountAmount.toFixed(2);
    document.getElementById('total').textContent = 'KSh ' + total.toFixed(2);
}

async function checkout() {
    if (cart.length === 0) { alert('Cart is empty!'); return; }
    for (const item of cart) {
        const product = products.find(p => p.id === item.product_id);
        if (product && product.stock <= 0) { alert('OUT OF STOCK: ' + item.name); return; }
        if (product && item.quantity > product.stock) { alert('INSUFFICIENT STOCK: ' + item.name); return; }
    }
    const method = prompt('Payment method (cash/mpesa/card):', 'cash');
    if (!method) return;
    try {
        const sale = await apiCall('/sales', 'POST', { items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })), payment_method: method, discount: discount });
        printReceipt(sale);
        cart = []; discount = 0;
        document.getElementById('discountInput').value = 0;
        updateCart(); loadProductsForPOS(); loadDashboard();
    } catch (e) { alert(e.message); }
}

function printReceipt(sale) {
    let itemsHtml = '';
    sale.items.forEach(item => {
        const taxLabel = (item.tax_rate || 0) > 0 ? 'A' : 'B';
        itemsHtml += '<tr><td>' + item.name + (item.unit ? ' (' + item.unit + ')' : '') + '</td><td style="text-align:center">' + item.quantity + '</td><td style="text-align:center;font-weight:bold">' + taxLabel + '</td><td style="text-align:right">' + item.total_price.toFixed(2) + '</td></tr>';
    });
    const html = '<!DOCTYPE html><html><head><title>Receipt</title><style>body{font-family:"Courier New",monospace;padding:20px;max-width:300px;margin:auto}.header{text-align:center;margin-bottom:15px}.header h2{margin:0;font-size:18px}.header p{margin:2px 0;font-size:12px}hr{border:none;border-top:1px dashed #000;margin:10px 0}table{width:100%;font-size:12px;border-collapse:collapse}td{padding:3px 0}.total-row{font-weight:bold;font-size:14px}.footer{text-align:center;margin-top:15px;font-size:11px}.close-btn{display:block;margin:20px auto;padding:10px 20px;background:#8b4513;color:white;border:none;border-radius:5px;cursor:pointer}@media print{.close-btn{display:none}}</style></head><body><div class="header"><h2>' + (businessSettings ? businessSettings.business_name : '') + '</h2>' + (businessSettings && businessSettings.business_po_box ? '<p>' + businessSettings.business_po_box + '</p>' : '') + (businessSettings && businessSettings.business_location ? '<p>' + businessSettings.business_location + '</p>' : '') + (businessSettings && businessSettings.business_phone ? '<p>Tel: ' + businessSettings.business_phone + '</p>' : '') + '</div><hr><p style="font-size:12px">Receipt: ' + sale.receipt_no + '</p><p style="font-size:12px">Date: ' + new Date(sale.created_at).toLocaleString() + '</p><hr><table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:center">Tax</th><th style="text-align:right">Amount</th></tr></thead><tbody>' + itemsHtml + '</tbody></table><hr><table><tr><td>Subtotal:</td><td style="text-align:right">' + sale.subtotal.toFixed(2) + '</td></tr><tr><td>Tax (incl.):</td><td style="text-align:right">' + sale.tax_amount.toFixed(2) + '</td></tr><tr class="total-row"><td>TOTAL:</td><td style="text-align:right">KSh ' + sale.total_amount.toFixed(2) + '</td></tr></table><hr><p style="font-size:12px">Payment: ' + sale.payment_method.toUpperCase() + '</p><div class="footer"><p>' + (businessSettings ? businessSettings.receipt_footer : '') + '</p><hr><p style="font-size:9px">A = Taxable | B = Non-Taxable</p></div><button class="close-btn" onclick="window.close()">Close</button></body></html>';
    const pw = window.open('', 'Receipt', 'width=400,height=600');
    pw.document.write(html); pw.document.close();
    setTimeout(() => { try { pw.print(); } catch(e) {} }, 1000);
    setTimeout(() => { try { pw.close(); } catch(e) {} }, 15000);
}

async function loadDashboard() {
    try {
        const data = await apiCall('/sales/today');
        document.getElementById('todaySales').textContent = data.count;
        document.getElementById('todayRevenue').textContent = 'KSh ' + data.total_amount.toFixed(2);
        const tbody = document.getElementById('todaySalesTableBody');
        if (tbody && data.sales) { tbody.innerHTML = data.sales.map(s => '<tr><td>' + s.receipt_no + '</td><td>' + s.created_at + '</td><td>' + s.cashier + '</td><td>' + s.payment_method.toUpperCase() + '</td><td>KSh ' + s.total_amount.toFixed(2) + '</td></tr>').join('') || '<tr><td colspan="5">No sales</td></tr>'; }
    } catch (e) { console.error(e); }
}

async function loadReceiptHistory() {
    try {
        const receipts = await apiCall('/sales/history');
        const user = authManager.getUser();
        const isAdminManager = user && (user.role === 'admin' || user.role === 'manager');
        const tbody = document.getElementById('receiptHistoryBody');
        if (tbody) {
            tbody.innerHTML = receipts.map((r, index) => {
                let btn = '';
                if (isAdminManager) { btn = '<button onclick="reprintReceipt(\'' + r.receipt_no + '\')" style="padding:5px 10px;font-size:12px">Reprint</button>'; }
                else { btn = index === 0 ? '<button onclick="reprintLastReceiptOnly()" style="padding:5px 10px;font-size:12px">Reprint</button>' : '<span style="color:#999;font-size:11px">View only</span>'; }
                return '<tr><td>' + r.receipt_no + '</td><td>' + r.created_at + '</td><td>' + r.cashier + '</td><td>' + r.items.length + '</td><td>KSh ' + r.total_amount.toFixed(2) + '</td><td>' + btn + '</td></tr>';
            }).join('') || '<tr><td colspan="6">No receipts</td></tr>';
        }
    } catch (e) { alert(e.message); }
}

async function reprintLastReceiptOnly() {
    try {
        const receipt = await apiCall('/sales/last-receipt');
        if (!receipt || receipt.message) { alert('No receipt available.'); return; }
        let settings = businessSettings;
        if (!settings) { try { settings = await apiCall('/settings'); } catch (e) { settings = {}; } }
        let itemsHtml = '';
        receipt.items.forEach(item => {
            const taxLabel = (item.tax_rate || 0) > 0 ? 'A' : 'B';
            itemsHtml += '<tr><td>' + item.name + '</td><td style="text-align:center">' + item.quantity + '</td><td style="text-align:center;font-weight:bold">' + taxLabel + '</td><td style="text-align:right">' + item.total_price.toFixed(2) + '</td></tr>';
        });
        const html = '<!DOCTYPE html><html><head><title>Reprint</title><style>body{font-family:"Courier New",monospace;padding:20px;max-width:300px;margin:auto}.h{text-align:center;margin-bottom:10px}.h h2{margin:0;font-size:16px}.h p{margin:2px 0;font-size:11px}.stamp{text-align:center;background:#fff3cd;border:2px solid #ffc107;padding:8px;margin:10px 0}.stamp strong{color:#d32f2f;font-size:13px}hr{border:none;border-top:1px dashed #000;margin:10px 0}table{width:100%;font-size:12px;border-collapse:collapse}td{padding:3px 0}.tr{font-weight:bold;font-size:14px}.cb{display:block;margin:20px auto;padding:10px 20px;background:#8b4513;color:white;border:none;border-radius:5px;cursor:pointer}@media print{.cb{display:none}}</style></head><body><div class="h"><h2>' + (settings.business_name || 'Folksmed Supppliers') + '</h2>' + (settings.business_po_box ? '<p>' + settings.business_po_box + '</p>' : '') + (settings.business_location ? '<p>' + settings.business_location + '</p>' : '') + (settings.business_phone ? '<p>Tel: ' + settings.business_phone + '</p>' : '') + '</div><hr><div class="stamp"><strong>*** REPRINTED COPY ***</strong></div><hr><p style="font-size:12px">Receipt: ' + receipt.receipt_no + '</p><p style="font-size:12px">Date: ' + receipt.created_at + '</p><hr><table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:center">Tax</th><th style="text-align:right">Amount</th></tr></thead><tbody>' + itemsHtml + '</tbody></table><hr><table><tr><td>Subtotal:</td><td style="text-align:right">' + receipt.subtotal.toFixed(2) + '</td></tr><tr><td>Tax (incl.):</td><td style="text-align:right">' + receipt.tax_amount.toFixed(2) + '</td></tr><tr class="tr"><td>TOTAL:</td><td style="text-align:right">KSh ' + receipt.total_amount.toFixed(2) + '</td></tr></table><hr><p style="font-size:12px">Payment: ' + receipt.payment_method.toUpperCase() + '</p><hr><p style="font-size:9px">A = Taxable | B = Non-Taxable</p><button class="cb" onclick="window.close()">Close</button></body></html>';
        const pw = window.open('', 'Reprint', 'width=400,height=600');
        pw.document.write(html); pw.document.close();
        setTimeout(() => { try { pw.print(); } catch(e) {} }, 1000);
        setTimeout(() => { try { pw.close(); } catch(e) {} }, 15000);
    } catch (e) { alert(e.message); }
}

function openPOModal() { loadProductsForPO(); openModal('poModal'); }

async function loadProductsForPO() {
    try {
        const list = await apiCall('/products');
        const select = document.getElementById('poProductId');
        if (select) { select.innerHTML = '<option value="">Select Product...</option>' + list.map(p => '<option value="' + p.id + '">' + p.name + ' (' + (p.unit || 'N/A') + ')</option>').join(''); }
    } catch (e) { console.error(e); }
}

async function loadPurchaseOrders() {
    try {
        const pos = await apiCall('/purchase-orders');
        const tbody = document.getElementById('poTableBody');
        if (tbody) { tbody.innerHTML = pos.map(po => '<tr><td>' + po.id + '</td><td>' + po.supplier + '</td><td>' + po.product_name + '</td><td>' + (po.unit || '-') + '</td><td>' + po.quantity + '</td><td>KSh ' + po.unit_cost + '</td><td>KSh ' + po.total_cost + '</td><td>' + po.status.toUpperCase() + '</td><td>' + (po.status === 'pending' ? '<button onclick="updatePOStatus(' + po.id + ',\'received\')" style="padding:5px 10px;font-size:12px">Receive</button>' : '-') + '</td></tr>').join('') || '<tr><td colspan="9">No POs</td></tr>'; }
    } catch (e) { alert(e.message); }
}

async function updatePOStatus(poId, status) {
    try { await apiCall('/purchase-orders/' + poId + '/status?status=' + status, 'PUT'); alert('PO updated!'); loadPurchaseOrders(); loadProducts(); } catch (e) { alert(e.message); }
}

async function loadDailyClose() {
    try {
        const data = await apiCall('/sales/daily-close');
        document.getElementById('dailyCloseDate').textContent = data.date;
        document.getElementById('dailyCloseTransactions').textContent = data.total_transactions;
        const tbody = document.getElementById('dailyCloseTableBody');
        if (tbody) { tbody.innerHTML = '<tr><td>Cash</td><td style="text-align:right">KSh ' + data.cash_total.toFixed(2) + '</td></tr><tr><td>M-Pesa</td><td style="text-align:right">KSh ' + data.mpesa_total.toFixed(2) + '</td></tr><tr><td>Card</td><td style="text-align:right">KSh ' + data.card_total.toFixed(2) + '</td></tr><tr style="font-weight:bold"><td>TOTAL</td><td style="text-align:right">KSh ' + data.grand_total.toFixed(2) + '</td></tr>'; }
    } catch (e) { console.error(e); }
}

async function loadProfitReport() {
    try {
        const data = await apiCall('/reports/profit');
        const tbody = document.getElementById('profitTableBody');
        if (tbody) { tbody.innerHTML = data.map(p => '<tr><td>' + p.product + '</td><td>KSh ' + p.selling_price + '</td><td>' + p.tax_rate + '%</td><td>KSh ' + p.net_selling + '</td><td>KSh ' + (p.cost || 0) + '</td><td>KSh ' + p.gross_profit + '</td><td>' + p.profit_margin + '%</td></tr>').join('') || '<tr><td colspan="7">No cost data</td></tr>'; }
    } catch (e) { console.error(e); }
}

async function loadAllSales() {
    try {
        const sales = await apiCall('/sales/all');
        const tbody = document.getElementById('allSalesTableBody');
        if (tbody) { tbody.innerHTML = sales.map(s => '<tr><td>' + s.receipt_no + '</td><td>' + s.created_at + '</td><td>' + s.cashier + '</td><td>KSh ' + s.total_amount.toFixed(2) + '</td></tr>').join('') || '<tr><td colspan="4">No sales</td></tr>'; }
    } catch (e) { console.error(e); }
}

async function loadLowStock() {
    try {
        const items = await apiCall('/reports/low-stock');
        document.getElementById('lowStockList').innerHTML = items.map(p => '<div style="padding:10px;background:#fff3cd;margin-bottom:5px;border-radius:5px"><strong>' + p.name + '</strong> - Stock: ' + p.stock + '</div>').join('') || '<p>No low stock</p>';
    } catch (e) { console.error(e); }
}

async function loadSettings() {
    try {
        const settings = await apiCall('/settings');
        document.getElementById('defaultTaxRate').value = settings.default_tax_rate;
        document.getElementById('businessName').value = settings.business_name || '';
        document.getElementById('businessPoBox').value = settings.business_po_box || '';
        document.getElementById('businessLocation').value = settings.business_location || '';
        document.getElementById('businessPhone').value = settings.business_phone || '';
        document.getElementById('businessTaxPin').value = settings.business_tax_pin || '';
        document.getElementById('receiptFooter').value = settings.receipt_footer || '';
    } catch (e) { console.error(e); }
}

async function updateBusinessInfo() {
    try {
        await apiCall('/settings/business', 'PUT', { business_name: document.getElementById('businessName').value, business_po_box: document.getElementById('businessPoBox').value, business_location: document.getElementById('businessLocation').value, business_phone: document.getElementById('businessPhone').value, business_tax_pin: document.getElementById('businessTaxPin').value, receipt_footer: document.getElementById('receiptFooter').value });
        alert('Saved!');
    } catch (e) { alert(e.message); }
}

async function updateTaxRate() {
    try { await apiCall('/settings/tax-rate?rate=' + document.getElementById('defaultTaxRate').value, 'PUT'); alert('Tax rate updated!'); } catch (e) { alert(e.message); }
}

async function loadBusinessSettings() {
    try { businessSettings = await apiCall('/settings'); } catch (e) { businessSettings = null; }
}

async function loadMpesaSettings() {
    try {
        const settings = await apiCall('/settings');
        document.getElementById('mpesaEnabled').checked = settings.mpesa_enabled === 'true';
        document.getElementById('mpesaConsumerKey').value = settings.mpesa_consumer_key || '';
        document.getElementById('mpesaConsumerSecret').value = settings.mpesa_consumer_secret || '';
        document.getElementById('mpesaPasskey').value = settings.mpesa_passkey || '';
        document.getElementById('mpesaShortcode').value = settings.mpesa_shortcode || '';
    } catch (e) { console.error(e); }
}

async function saveMpesaSettings() {
    try {
        await apiCall('/settings/business', 'PUT', { mpesa_enabled: document.getElementById('mpesaEnabled').checked ? 'true' : 'false', mpesa_consumer_key: document.getElementById('mpesaConsumerKey').value, mpesa_consumer_secret: document.getElementById('mpesaConsumerSecret').value, mpesa_passkey: document.getElementById('mpesaPasskey').value, mpesa_shortcode: document.getElementById('mpesaShortcode').value });
        alert('M-Pesa settings saved!');
    } catch (e) { alert(e.message); }
}

function openStockModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    document.getElementById('stockProductId').value = product.id;
    document.getElementById('stockProductName').textContent = product.name;
    document.getElementById('stockCurrent').textContent = product.stock;
    document.getElementById('stockAdjustment').value = '';
    document.getElementById('stockReason').value = '';
    openModal('stockModal');
}

async function createBackup() { try { await apiCall('/backup/create', 'POST'); alert('Backup created!'); loadBackups(); } catch (e) { alert(e.message); } }

async function loadBackups() {
    try {
        const backups = await apiCall('/backup/list');
        const tbody = document.getElementById('backupsTableBody');
        if (tbody) { tbody.innerHTML = backups.map(b => '<tr><td>' + b.filename + '</td><td>' + (b.size / 1024).toFixed(2) + ' KB</td><td>' + b.created + '</td><td><button onclick="deleteBackup(\'' + b.filename + '\')" style="color:red">Delete</button></td></tr>').join('') || '<tr><td colspan="4">No backups</td></tr>'; }
    } catch (e) { console.error(e); }
}

async function deleteBackup(filename) { if (!confirm('Delete backup?')) return; try { await apiCall('/backup/' + filename, 'DELETE'); loadBackups(); } catch (e) { alert(e.message); } }

document.getElementById('discountInput').addEventListener('input', (e) => { discount = parseFloat(e.target.value) || 0; updateCart(); });
document.getElementById('searchProduct').addEventListener('input', (e) => { renderPOSProducts(products.filter(p => p.name.toLowerCase().includes(e.target.value.toLowerCase()))); });
document.getElementById('posCategoryFilter').addEventListener('change', (e) => { const catId = e.target.value; if (catId === 'all') renderPOSProducts(products); else renderPOSProducts(products.filter(p => p.category_id == catId)); });
document.getElementById('categoryForm').addEventListener('submit', async (e) => { e.preventDefault(); try { await apiCall('/products/categories', 'POST', { name: document.getElementById('categoryName').value, description: document.getElementById('categoryDescription').value || null }); closeModal('categoryModal'); e.target.reset(); alert('Category added!'); loadCategories(); } catch (e) { alert(e.message); } });
document.getElementById('productForm').addEventListener('submit', async (e) => { e.preventDefault(); try { await apiCall('/products', 'POST', { name: document.getElementById('productName').value, unit: document.getElementById('productUnit').value || null, category_id: document.getElementById('productCategory').value ? parseInt(document.getElementById('productCategory').value) : null, price: parseFloat(document.getElementById('productPrice').value), cost: parseFloat(document.getElementById('productCost').value) || null, tax_rate: parseFloat(document.getElementById('productTaxRate').value) || 0, stock: parseInt(document.getElementById('productStock').value), expiry_date: document.getElementById('productExpiry').value || null }); closeModal('productModal'); e.target.reset(); alert('Product added!'); loadProducts(); } catch (e) { alert(e.message); } });
document.getElementById('editProductForm').addEventListener('submit', async (e) => { e.preventDefault(); const productId = document.getElementById('editProductId').value; try { await apiCall('/products/' + productId, 'PUT', { name: document.getElementById('editProductName').value, unit: document.getElementById('editProductUnit').value || null, price: parseFloat(document.getElementById('editProductPrice').value), tax_rate: parseFloat(document.getElementById('editProductTaxRate').value), stock: parseInt(document.getElementById('editProductStock').value), expiry_date: document.getElementById('editProductExpiry').value || null }); closeModal('editProductModal'); alert('Product updated!'); loadProducts(); } catch (e) { alert(e.message); } });
document.getElementById('userForm').addEventListener('submit', async (e) => { e.preventDefault(); try { await apiCall('/users', 'POST', { name: document.getElementById('userNameInput').value, email: document.getElementById('userEmail').value, password: document.getElementById('userPassword').value, role: document.getElementById('userRoleSelect').value }); closeModal('userModal'); e.target.reset(); alert('User added!'); loadUsers(); } catch (e) { alert(e.message); } });
document.getElementById('stockForm').addEventListener('submit', async (e) => { e.preventDefault(); const productId = document.getElementById('stockProductId').value; const adjustment = parseInt(document.getElementById('stockAdjustment').value); const reason = document.getElementById('stockReason').value || 'manual'; try { await apiCall('/products/' + productId + '/stock?adjustment=' + adjustment + '&reason=' + reason, 'PUT'); closeModal('stockModal'); alert('Stock adjusted!'); loadProducts(); } catch (e) { alert(e.message); } });
document.getElementById('poForm').addEventListener('submit', async (e) => { e.preventDefault(); try { await apiCall('/purchase-orders', 'POST', { supplier: document.getElementById('poSupplier').value, product_id: parseInt(document.getElementById('poProductId').value), quantity: parseInt(document.getElementById('poQuantity').value), unit_cost: parseFloat(document.getElementById('poUnitCost').value) }); closeModal('poModal'); e.target.reset(); alert('PO created!'); loadPurchaseOrders(); } catch (e) { alert(e.message); } });

document.addEventListener('DOMContentLoaded', async () => {
    const user = authManager.getUser();
    if (user && user.role === 'cashier') {
        document.querySelectorAll('.sidebar-menu a').forEach(a => {
            const t = a.textContent.trim();
            if (['Products','Categories','Users','Reports','Analytics','Purchase Orders','Backup','Settings'].includes(t)) {
                a.style.display = 'none';
            }
        });
    }
    loadDashboard();
    loadCategoriesForSelect();
    await loadBusinessSettings();
});

function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') { input.type = 'text'; button.textContent = 'Hide'; }
    else { input.type = 'password'; button.textContent = 'Show'; }
}


// ============ EXPIRY PROTECTION SETTINGS ============
async function loadExpirySettings() {
    try {
        const settings = await apiCall('/settings');
        document.getElementById('blockExpired').checked = settings.block_expired === 'true';
        document.getElementById('warnExpiring').checked = settings.warn_expiring === 'true';
    } catch (e) { console.error(e); }
}

async function saveExpirySettings() {
    try {
        await apiCall('/settings/business', 'PUT', {
            block_expired: document.getElementById('blockExpired').checked ? 'true' : 'false',
            warn_expiring: document.getElementById('warnExpiring').checked ? 'true' : 'false'
        });
        alert('Expiry settings saved!');
    } catch (e) { alert(e.message); }
}
