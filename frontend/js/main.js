let products = [];
let categories = [];
let cart = [];
let discount = 0;
let businessSettings = null;

function showView(viewName) {
    const user = authManager.getUser();
    if (user && user.role === 'cashier') {
        const allowed = ['dashboard', 'pos', 'receipts'];
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
    if (viewName === 'pos') loadProductsForPOS();
    if (viewName === 'backup') loadBackups();
    if (viewName === 'settings') { loadSettings(); loadMpesaSettings(); loadExpirySettings(); }
    if (viewName === 'dashboard') loadDashboard();
    if (viewName === 'receipts') loadReceiptHistory();
    if (viewName === 'purchaseOrders') loadPurchaseOrders();
    if (viewName === 'analytics') { loadAnalytics(); loadExpiryReport(); }
    if (viewName === 'tax') { loadTaxReport(); }
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function openProductModal() { loadCategoriesForSelect(); openModal('productModal'); }
function openCategoryModal() { openModal('categoryModal'); }
function openUserModal() { openModal('userModal'); }

async function apiCall(url, method, data) {
    method = method || 'GET';
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
        if (tbody) { tbody.innerHTML = categories.map(c => '<tr><td>' + c.id + '</td><td>' + c.name + '</td><td>' + (c.description || '-') + '</td><td><button onclick="deleteCategory(' + c.id + ')" style="color:red;padding:3px 8px;font-size:11px">Delete</button></td></tr>').join('') || '<tr><td colspan="4">No categories</td></tr>'; }
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
                return '<tr><td>' + p.id + '</td><td>' + p.name + '</td><td>' + (p.unit || '-') + '</td><td>' + (cat ? cat.name : '-') + '</td><td>KSh ' + p.price + '</td><td style="text-align:center;font-weight:bold">' + taxLabel + '</td><td>' + p.stock + '</td><td><button onclick="openEditProductModal(' + p.id + ')" style="padding:5px 10px;font-size:10px;margin-right:3px;background:#2e7d32;color:white;border:none;border-radius:3px">Edit</button> <button onclick="openStockModal(' + p.id + ')" style="padding:5px 10px;font-size:10px;margin-right:3px">Stock</button> <button onclick="deleteProduct(' + p.id + ')" style="padding:5px 10px;font-size:10px;color:red">Delete</button></td></tr>';
            }).join('') || '<tr><td colspan="8">No products</td></tr>';
        }
    } catch (e) { alert(e.message); }
}

async function loadProductsForPOS() {
    await loadCategoriesForSelect();
    try { products = await apiCall('/products'); renderPOSProducts(products); } catch (e) { alert(e.message); }
}

let productPage = 0;
const PRODUCTS_PER_PAGE = 6;

function renderPOSProducts(list) {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    
    // Show only first 6 products - use search for more
    const displayProducts = list.slice(0, 6);
    
    grid.innerHTML = displayProducts.map(p => 
        '<div class="product-card" onclick="addToCart(' + p.id + ')">' +
        '<div class="product-name">' + p.name + '</div>' +
        (p.unit ? '<div style="font-size:10px;color:#666">' + p.unit + '</div>' : '') +
        '<div class="product-price">KSh ' + p.price + '</div>' +
        (p.stock <= 0 ? '<div style="background:#d32f2f;color:white;padding:2px 5px;border-radius:3px;font-size:9px">OUT OF STOCK</div>' : '<div class="product-stock">Stock: ' + p.stock + '</div>') +
        '</div>'
    ).join('');
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
        document.getElementById('usersTableBody').innerHTML = users.map(u => '<tr><td>' + u.id + '</td><td>' + u.name + '</td><td>' + u.email + '</td><td>' + u.role.toUpperCase() + '</td><td><button onclick="deleteUser(' + u.id + ')" style="padding:5px 10px;font-size:10px;color:red">Remove</button></td></tr>').join('');
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
    if (product.expiry_date) {
        const today = new Date();
        const expiry = new Date(product.expiry_date);
        const daysLeft = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0 && businessSettings && businessSettings.block_expired === 'true') {
            alert('CANNOT SELL! ' + product.name + ' EXPIRED ' + Math.abs(daysLeft) + ' days ago.');
            return;
        }
        if (daysLeft >= 0 && daysLeft <= 7 && businessSettings && businessSettings.warn_expiring === 'true') {
            if (!confirm('WARNING: ' + product.name + ' expires in ' + daysLeft + ' days. Sell anyway?')) return;
        }
    }
    const existing = cart.find(i => i.product_id === productId);
    if (existing) {
        if (existing.quantity >= product.stock) { alert('NOT ENOUGH STOCK!'); return; }
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
    if (item.quantity > item.stock) { alert('NOT ENOUGH STOCK!'); item.quantity -= change; return; }
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
            return '<div style="display:flex;align-items:center;justify-content:space-between;padding:1px;border-bottom:1px solid #f0f0f0;gap:2px;min-height:20px"><div style="flex:2"><strong style="font-size:9px">' + i.name + '</strong>' + (i.unit ? ' <small>(' + i.unit + ')</small>' : '') + '<br><small style="color:#666;font-size:9px">KSh ' + i.unit_price + ' each</small></div><div style="flex:1;display:flex;align-items:center;gap:8px;justify-content:center"><button onclick="updateQuantity(' + i.product_id + ',-1)" style="width:24px;height:24px;font-size:9px;background:#f0f0f0;color:#333;border:1px solid #ddd;border-radius:3px;cursor:pointer">-</button><span style="font-size:10px;font-weight:bold;min-width:20px;text-align:center">' + i.quantity + '</span><button onclick="updateQuantity(' + i.product_id + ',1)" style="width:24px;height:24px;font-size:9px;background:#f0f0f0;color:#333;border:1px solid #ddd;border-radius:3px;cursor:pointer">+</button></div><div style="flex:1.5;text-align:right"><strong style="font-size:9px">KSh ' + lineTotal.toFixed(2) + '</strong> <small style="color:#d2691e;font-size:8px">Tax:' + lineTax.toFixed(2) + '</small></div><button onclick="removeFromCart(' + i.product_id + ')" style="background:#d32f2f;color:white;border:none;border-radius:5px;width:25px;height:25px;cursor:pointer;font-size:9px">X</button></div>';
        }).join('') || '<p style="color:#95a5a6;text-align:center;margin-top:50px">Cart is empty</p>';
    }
    document.getElementById('subtotal').textContent = 'KSh ' + subtotal.toFixed(2);
    document.getElementById('cartTax').textContent = 'KSh ' + taxAmount.toFixed(2);
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
    let total = 0;
    cart.forEach(i => { total += i.quantity * i.unit_price; });
    total -= (total * discount / 100);
    document.getElementById('paymentTotal').textContent = 'KSh ' + total.toFixed(2);
    document.getElementById('mpesaPhoneSection').style.display = 'none';
    openModal('paymentModal');
}

async function processPayment(paymentMethod) {
    // If M-Pesa, show phone input section (DON'T close modal)
    if (paymentMethod === 'mpesa') {
        document.getElementById('mpesaPhoneSection').style.display = 'block';
        return;
    }
    
    closeModal('paymentModal');
    
    try {
        const sale = await apiCall('/sales', 'POST', { items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })), payment_method: paymentMethod, discount: discount });
        printReceipt(sale);
        cart = []; discount = 0;
        document.getElementById('discountInput').value = 0;
        updateCart(); loadProductsForPOS(); loadDashboard();
    } catch (e) { alert(e.message); }
}



function normalizePhone(phone) {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');
    
    // If starts with 254, already international
    if (cleaned.startsWith('254')) {
        return cleaned;
    }
    
    // If starts with 0, remove it
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }
    
    // Add 254 prefix
    return '254' + cleaned;
}


async function confirmMpesa() {
    const phone = normalizePhone(document.getElementById('mpesaPhone').value.trim());
    if (!phone || phone.length < 12 || phone.length > 12) { alert('INVALID PHONE NUMBER!\n\nPlease enter a valid 10-digit phone number.\n\nExamples:\n0741676521\n741676521\n0112168732'); return; }
    let total = 0;
    cart.forEach(i => { total += i.quantity * i.unit_price; });
    total -= (total * discount / 100);
    closeModal('paymentModal');
    document.getElementById('mpesaPhoneSection').style.display = 'none';
    document.getElementById('mpesaPhone').value = '';
    try {
        await apiCall('/mpesa/stk-push', 'POST', { phone_number: phone, amount: total, receipt_no: 'INV-' + Date.now() });
        alert('M-Pesa prompt sent to ' + phone + '!');
    } catch (e) { alert('M-Pesa error: ' + e.message); return; }
    try {
        const sale = await apiCall('/sales', 'POST', { items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })), payment_method: 'mpesa', discount: discount });
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
    const html = '<!DOCTYPE html><html><head><title>Receipt</title><style>body{font-family:"Courier New",monospace;padding:20px;max-width:300px;margin:auto}.header{text-align:center;margin-bottom:15px}.header h2{margin:0;font-size:18px}.header p{margin:2px 0;font-size:10px}hr{border:none;border-top:1px dashed #000;margin:10px 0}table{width:100%;font-size:10px;border-collapse:collapse}td{padding:3px 0}.total-row{font-weight:bold;font-size:9px}.footer{text-align:center;margin-top:15px;font-size:9px}.close-btn{display:block;margin:20px auto;padding:10px 20px;background:#8b4513;color:white;border:none;border-radius:5px;cursor:pointer}@media print{.close-btn{display:none}}</style></head><body><div class="header"><h2>' + (businessSettings ? businessSettings.business_name : '') + '</h2>' + (businessSettings && businessSettings.business_po_box ? '<p>' + businessSettings.business_po_box + '</p>' : '') + (businessSettings && businessSettings.business_location ? '<p>' + businessSettings.business_location + '</p>' : '') + (businessSettings && businessSettings.business_tax_pin ? '<p>PIN: ' + businessSettings.business_tax_pin + '</p>' : '') + (businessSettings && businessSettings.business_phone ? '<p>Tel: ' + businessSettings.business_phone + '</p>' : '') + '</div><hr><p style="font-size:10px">Receipt: ' + sale.receipt_no + '</p><p style="font-size:10px">Date: ' + new Date(sale.created_at).toLocaleString() + '</p><hr><table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:center">Tax</th><th style="text-align:right">Amount</th></tr></thead><tbody>' + itemsHtml + '</tbody></table><hr><table><tr><td>Subtotal:</td><td style="text-align:right">' + sale.subtotal.toFixed(2) + '</td></tr><tr><td>Tax (incl.):</td><td style="text-align:right">' + sale.tax_amount.toFixed(2) + '</td></tr><tr class="total-row"><td>TOTAL:</td><td style="text-align:right">KSh ' + sale.total_amount.toFixed(2) + '</td></tr></table><hr><p style="font-size:10px">Payment: ' + sale.payment_method.toUpperCase() + '</p><div class="footer"><p>' + (businessSettings ? businessSettings.receipt_footer : '') + '</p><hr><p style="font-size:9px">A = Taxable | B = Non-Taxable</p></div><button class="close-btn" onclick="window.close()">Close</button></body></html>';
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
                if (isAdminManager) { btn = '<button onclick="reprintReceipt(\'' + r.receipt_no + '\')" style="padding:5px 10px;font-size:10px">Reprint</button>'; }
                else { btn = index === 0 ? '<button onclick="reprintLastReceiptOnly()" style="padding:5px 10px;font-size:10px">Reprint</button>' : '<span style="color:#999;font-size:9px">View only</span>'; }
                const delBtn = isAdminManager ? '<button onclick="deleteReceipt(\'' + r.receipt_no + '\')" style="color:red;padding:3px 8px;font-size:11px;margin-left:5px">Delete</button>' : '';
                return '<tr><td>' + r.receipt_no + '</td><td>' + r.created_at + '</td><td>' + r.cashier + '</td><td>' + r.items.length + '</td><td>KSh ' + r.total_amount.toFixed(2) + '</td><td>' + btn + delBtn + '</td></tr>';
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
        const html = '<!DOCTYPE html><html><head><title>Reprint</title><style>body{font-family:"Courier New",monospace;padding:20px;max-width:300px;margin:auto}.h{text-align:center;margin-bottom:10px}.h h2{margin:0;font-size:16px}.h p{margin:2px 0;font-size:9px}.stamp{text-align:center;background:#fff3cd;border:2px solid #ffc107;padding:8px;margin:10px 0}.stamp strong{color:#d32f2f;font-size:13px}hr{border:none;border-top:1px dashed #000;margin:10px 0}table{width:100%;font-size:10px;border-collapse:collapse}td{padding:3px 0}.tr{font-weight:bold;font-size:9px}.cb{display:block;margin:20px auto;padding:10px 20px;background:#8b4513;color:white;border:none;border-radius:5px;cursor:pointer}@media print{.cb{display:none}}</style></head><body><div class="h"><h2>' + (settings.business_name || 'Folksmed Supppliers') + '</h2>' + (settings.business_po_box ? '<p>' + settings.business_po_box + '</p>' : '') + (settings.business_location ? '<p>' + settings.business_location + '</p>' : '') + (settings.business_phone ? '<p>Tel: ' + settings.business_phone + '</p>' : '') + '</div><hr><div class="stamp"><strong>*** REPRINTED COPY ***</strong></div><hr><p style="font-size:10px">Receipt: ' + receipt.receipt_no + '</p><p style="font-size:10px">Date: ' + receipt.created_at + '</p><hr><table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:center">Tax</th><th style="text-align:right">Amount</th></tr></thead><tbody>' + itemsHtml + '</tbody></table><hr><table><tr><td>Subtotal:</td><td style="text-align:right">' + receipt.subtotal.toFixed(2) + '</td></tr><tr><td>Tax (incl.):</td><td style="text-align:right">' + receipt.tax_amount.toFixed(2) + '</td></tr><tr class="tr"><td>TOTAL:</td><td style="text-align:right">KSh ' + receipt.total_amount.toFixed(2) + '</td></tr></table><hr><p style="font-size:10px">Payment: ' + receipt.payment_method.toUpperCase() + '</p><hr><p style="font-size:9px">A = Taxable | B = Non-Taxable</p><button class="cb" onclick="window.close()">Close</button></body></html>';
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
        const grouped = await apiCall('/purchase-orders/by-date');
        const tbody = document.getElementById('poTableBody');
        if (!tbody) return;
        
        let html = '';
        const dates = Object.keys(grouped).sort().reverse();
        
        if (dates.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10">No POs</td></tr>';
            return;
        }
        
        dates.forEach(date => {
            const pos = grouped[date];
            const dayTotal = pos.reduce((sum, p) => sum + p.total_cost, 0);
            
            // Date header row
            html += '<tr style="background:#f5e6d3;font-weight:bold"><td colspan="7">📅 ' + date + ' — ' + pos.length + ' POs — Total: KSh ' + dayTotal.toFixed(2) + '</td><td colspan="3" style="text-align:right"><button onclick="printPODay(\'' + date + '\')" style="background:#0088cc;color:white;padding:4px 10px;border:none;border-radius:3px;cursor:pointer;font-size:11px;margin-right:5px">Print Day</button><button onclick="deletePODay(\'' + date + '\')" style="background:#d32f2f;color:white;padding:4px 10px;border:none;border-radius:3px;cursor:pointer;font-size:11px">Delete Day</button></td></tr>';
            
            // PO rows
            pos.forEach(po => {
                html += '<tr><td>' + po.id + '</td><td>' + po.supplier + '</td><td>' + po.product_name + '</td><td>' + (po.unit || '-') + '</td><td>' + po.quantity + '</td><td>KSh ' + po.unit_cost + '</td><td>KSh ' + po.total_cost + '</td><td>' + po.status.toUpperCase() + '</td><td>' + (po.status === 'pending' ? '<button onclick="updatePOStatus(' + po.id + ',\'received\')" style="padding:3px 8px;font-size:11px">Receive</button>' : '-') + '</td><td><button onclick="deletePO(' + po.id + ')" style="color:red;padding:3px 8px;font-size:11px">Delete</button></td></tr>';
            });
        });
        
        tbody.innerHTML = html;
    } catch (e) { alert(e.message); }
}

async function printPODay(date) {
    try {
        const pos = await apiCall('/purchase-orders/by-date/' + date);
        if (pos.length === 0) { alert('No POs for this date'); return; }
        
        let itemsHtml = '';
        let total = 0;
        pos.forEach(p => {
            itemsHtml += '<tr><td>' + p.id + '</td><td>' + p.supplier + '</td><td>' + p.product_name + ' ' + (p.unit || '') + '</td><td>' + p.quantity + '</td><td>KSh ' + p.unit_cost + '</td><td>KSh ' + p.total_cost + '</td></tr>';
            total += p.total_cost;
        });
        
        const html = '<!DOCTYPE html><html><head><title>PO Report ' + date + '</title><style>body{font-family:Arial,sans-serif;padding:20px}h2{text-align:center}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#8b4513;color:white}.total{font-weight:bold;background:#f5e6d3}</style></head><body><h2>Purchase Orders Report</h2><p style="text-align:center">Date: ' + date + '</p><table><thead><tr><th>ID</th><th>Supplier</th><th>Product</th><th>Qty</th><th>Unit Cost</th><th>Total</th></tr></thead><tbody>' + itemsHtml + '<tr class="total"><td colspan="5">TOTAL</td><td>KSh ' + total.toFixed(2) + '</td></tr></tbody></table></body></html>';
        
        const pw = window.open('', 'POReport', 'width=800,height=600');
        pw.document.write(html);
        pw.document.close();
        setTimeout(() => { try { pw.print(); } catch(e) {} }, 500);
    } catch (e) { alert(e.message); }
}

async function deletePODay(date) {
    if (prompt('Type DELETE to remove ALL POs for ' + date + ':') !== 'DELETE') return;
    if (!confirm('Delete all POs for ' + date + '?')) return;
    try {
        const result = await apiCall('/purchase-orders/delete-day/' + date, 'DELETE');
        alert(result.message);
        loadPurchaseOrders();
    } catch (e) { alert(e.message); }
}

async function deletePO(id) {
    if (prompt('Type DELETE to remove PO #' + id + ':') !== 'DELETE') return;
    if (!confirm('Delete PO #' + id + '?')) return;
    try {
        await apiCall('/purchase-orders/' + id, 'DELETE');
        alert('PO deleted');
        loadPurchaseOrders();
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
        if (tbody) { tbody.innerHTML = sales.map(s => '<tr><td>' + s.receipt_no + '</td><td>' + s.created_at + '</td><td>' + s.cashier + '</td><td>KSh ' + s.total_amount.toFixed(2) + '</td><td><button onclick="deleteReceipt(\'' + s.receipt_no + '\')" style="color:red;padding:3px 8px;font-size:11px">Delete</button></td></tr>').join('') || '<tr><td colspan="5">No sales</td></tr>'; }
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
        document.getElementById('backupLocation').value = settings.backup_location || '';
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

async function loadExpirySettings() {
    try {
        const settings = await apiCall('/settings');
        document.getElementById('blockExpired').checked = settings.block_expired === 'true';
        document.getElementById('warnExpiring').checked = settings.warn_expiring === 'true';
    } catch (e) { console.error(e); }
}

async function saveExpirySettings() {
    try {
        await apiCall('/settings/business', 'PUT', { block_expired: document.getElementById('blockExpired').checked ? 'true' : 'false', warn_expiring: document.getElementById('warnExpiring').checked ? 'true' : 'false' });
        alert('Expiry settings saved!');
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

async function createBackup() {
    openModal('backupLocationModal');
}

async function backupToDesktop() {
    closeModal('backupLocationModal');
    try {
        const result = await apiCall('/backup/create?location=desktop', 'POST');
        alert('Backup created!\nSaved to: ' + result.saved_to);
        loadBackups();
    } catch (e) { alert(e.message); }
}

async function backupToFlash() {
    closeModal('backupLocationModal');
    try {
        // Get available drives
        const data = await apiCall('/backup/drives');
        
        if (data.drives.length === 0) {
            alert('No drives detected!');
            return;
        }
        
        // Build drive selection
        let driveList = 'Available drives:\n';
        data.drives.forEach((d, i) => {
            driveList += (i+1) + '. ' + d + '\n';
        });
        driveList += '\nEnter number to select drive:';
        
        const choice = prompt(driveList, '1');
        if (!choice) return;
        
        const idx = parseInt(choice) - 1;
        if (idx < 0 || idx >= data.drives.length) {
            alert('Invalid selection');
            return;
        }
        
        const selectedDrive = data.drives[idx];
        const result = await apiCall('/backup/create?location=' + encodeURIComponent(selectedDrive), 'POST');
        alert('Backup created!\nSaved to: ' + result.saved_to);
        loadBackups();
    } catch (e) { alert(e.message); }
}



async function loadBackups() {
    try {
        const backups = await apiCall('/backup/list');
        const tbody = document.getElementById('backupsTableBody');
        if (tbody) {
            tbody.innerHTML = backups.map(b => {
                return '<tr><td>' + b.filename + '</td><td>' + (b.size / 1024).toFixed(2) + ' KB</td><td>' + b.created + '</td><td>' +
                    '<button onclick="restoreBackup(\'' + b.filename + '\')" style="color:#2e7d32;margin-right:5px;padding:3px 8px;font-size:11px">Restore</button>' +
                    '<button onclick="deleteBackup(\'' + b.filename + '\')" style="color:red;padding:3px 8px;font-size:11px">Delete</button>' +
                    '</td></tr>';
            }).join('') || '<tr><td colspan="4">No backups</td></tr>';
        }
    } catch (e) { console.error(e); }
}

async function restoreBackup(filename) {
    // Ask where to restore from
    const source = prompt('Restore from where?\n1. Default location\n2. Flash drive / External folder\n\nEnter 1 or 2:', '1');
    if (!source) return;
    
    if (source === '2') {
        const folderPath = prompt('Enter the full folder path where backup is located:\n(e.g., E:\\SafariPOS_Backups or D:\\Backups)');
        if (!folderPath) return;
        
        if (prompt('Type RESTORE to confirm!') !== 'RESTORE') return;
        if (!confirm('WARNING: All current data will be replaced!')) return;
        
        try {
            await apiCall('/backup/restore/' + filename + '?source_path=' + encodeURIComponent(folderPath), 'POST');
            alert('Database restored from external location! Restart server.');
        } catch (e) { alert(e.message); }
        return;
    }
    
    if (prompt('Type RESTORE to confirm!') !== 'RESTORE') return;
    if (!confirm('WARNING: All current data will be replaced!')) return;
    try {
        await apiCall('/backup/restore/' + filename, 'POST');
        alert('Database restored! Restart server.');
    } catch (e) { alert(e.message); }
}

async function deleteBackup(filename) { if (!confirm('Delete backup?')) return; try { await apiCall('/backup/' + filename, 'DELETE'); loadBackups(); } catch (e) { alert(e.message); } }

function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') { input.type = 'text'; button.textContent = 'Hide'; }
    else { input.type = 'password'; button.textContent = 'Show'; }
}

document.getElementById('discountInput').addEventListener('input', (e) => { discount = parseFloat(e.target.value) || 0; updateCart(); });
document.getElementById('searchProduct').addEventListener('input', (e) => { renderPOSProducts(products.filter(p => p.name.toLowerCase().includes(e.target.value.toLowerCase()))); });
document.getElementById('posCategoryFilter').addEventListener('change', (e) => { const catId = e.target.value; if (catId === 'all') renderPOSProducts(products); else renderPOSProducts(products.filter(p => p.category_id == catId)); });
document.getElementById('categoryForm').addEventListener('submit', async (e) => { e.preventDefault(); try { await apiCall('/products/categories', 'POST', { name: document.getElementById('categoryName').value, description: document.getElementById('categoryDescription').value || null }); closeModal('categoryModal'); e.target.reset(); alert('Category added!'); loadCategories(); } catch (e) { alert(e.message); } });
document.getElementById('productForm').addEventListener('submit', async (e) => { e.preventDefault(); try { await apiCall('/products', 'POST', { name: document.getElementById('productName').value, unit: document.getElementById('productUnit').value || null, category_id: document.getElementById('productCategory').value ? parseInt(document.getElementById('productCategory').value) : null, price: parseFloat(document.getElementById('productPrice').value), cost: parseFloat(document.getElementById('productCost').value) || null, tax_rate: parseFloat(document.getElementById('productTaxRate').value) || 0, stock: parseInt(document.getElementById('productStock').value), expiry_date: document.getElementById('productExpiry').value || null }); closeModal('productModal'); e.target.reset(); alert('Product added!'); loadProducts(); } catch (e) { alert(e.message); } });
document.getElementById('editProductForm').addEventListener('submit', async (e) => { e.preventDefault(); const productId = document.getElementById('editProductId').value; try { await apiCall('/products/' + productId, 'PUT', { name: document.getElementById('editProductName').value, unit: document.getElementById('editProductUnit').value || null, price: parseFloat(document.getElementById('editProductPrice').value), tax_rate: parseFloat(document.getElementById('editProductTaxRate').value), stock: parseInt(document.getElementById('editProductStock').value), expiry_date: document.getElementById('editProductExpiry').value || null }); closeModal('editProductModal'); alert('Product updated!'); loadProducts(); } catch (e) { alert(e.message); } });
document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('userNameInput').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const phone = document.getElementById('userPhone').value.trim();
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRoleSelect').value;
    
    if (!email && !phone) {
        alert('Provide EITHER an Email OR a Phone number!');
        return;
    }
    if (!password) {
        alert('Password is required!');
        return;
    }
    if (!role) {
        alert('Please select a role!');
        return;
    }
    
    try {
        await apiCall('/users', 'POST', {
            name: name,
            email: email || null,
            phone: phone || null,
            password: password,
            role: role
        });
        closeModal('userModal');
        e.target.reset();
        alert('User added successfully!');
        loadUsers();
    } catch (e) {
        alert('Error: ' + e.message);
    }
});
document.getElementById('stockForm').addEventListener('submit', async (e) => { e.preventDefault(); const productId = document.getElementById('stockProductId').value; const adjustment = parseInt(document.getElementById('stockAdjustment').value); const reason = document.getElementById('stockReason').value || 'manual'; try { await apiCall('/products/' + productId + '/stock?adjustment=' + adjustment + '&reason=' + reason, 'PUT'); closeModal('stockModal'); alert('Stock adjusted!'); loadProducts(); } catch (e) { alert(e.message); } });
document.getElementById('poForm').addEventListener('submit', async (e) => { e.preventDefault(); try { await apiCall('/purchase-orders', 'POST', { supplier: document.getElementById('poSupplier').value, product_id: parseInt(document.getElementById('poProductId').value), quantity: parseInt(document.getElementById('poQuantity').value), unit_cost: parseFloat(document.getElementById('poUnitCost').value) }); closeModal('poModal'); e.target.reset(); alert('PO created!'); loadPurchaseOrders(); } catch (e) { alert(e.message); } });

document.addEventListener('DOMContentLoaded', async () => {
    const user = authManager.getUser();
    if (user && user.role === 'cashier') {
        document.querySelectorAll('.sidebar-menu a').forEach(a => {
            const t = a.textContent.trim();
            if (['Products','Categories','Users','Reports','Analytics','Tax','Purchase Orders','Backup','Settings'].includes(t)) {
                a.style.display = 'none';
            }
        });
    }
    loadDashboard();
    loadCategoriesForSelect();
    await loadBusinessSettings();
});


async 


async function loadBackupLocation() {
    try {
        const settings = await apiCall('/settings');
        document.getElementById('backupLocation').value = settings.backup_location || '';
    } catch (e) { console.error(e); }
}

async function saveBackupLocation() {
    try {
        await apiCall('/settings/business', 'PUT', {
            backup_location: document.getElementById('backupLocation').value
        });
        alert('Backup location saved!');
    } catch (e) { alert(e.message); }
}


async function restoreFromPath() {
    const folderPath = document.getElementById('restorePath').value.trim();
    
    if (folderPath) {
        // Restore from external folder
        const filename = prompt('Enter the backup filename to restore:\n(e.g., safaripos_backup_20260909_135610.db)');
        if (!filename) return;
        
        if (prompt('Type RESTORE to confirm!') !== 'RESTORE') return;
        if (!confirm('WARNING: All current data will be replaced!')) return;
        
        try {
            await apiCall('/backup/restore/' + filename + '?source_path=' + encodeURIComponent(folderPath), 'POST');
            alert('Database restored from ' + folderPath + '! Restart server.');
        } catch (e) { alert(e.message); }
    } else {
        // Restore from default location
        const filename = prompt('Enter the backup filename to restore:\n(e.g., safaripos_backup_20260909_135610.db)');
        if (!filename) return;
        
        if (prompt('Type RESTORE to confirm!') !== 'RESTORE') return;
        if (!confirm('WARNING: All current data will be replaced!')) return;
        
        try {
            await apiCall('/backup/restore/' + filename, 'POST');
            alert('Database restored from default location! Restart server.');
        } catch (e) { alert(e.message); }
    }
}


async function restoreSelectedFile() {
    const fileInput = document.getElementById('restoreFileInput');
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select a backup file first!');
        return;
    }
    
    const file = fileInput.files[0];
    const filename = file.name;
    
    if (prompt('Type RESTORE to confirm database restoration!') !== 'RESTORE') return;
    if (!confirm('FINAL WARNING: All current data will be replaced with ' + filename + '!')) return;
    
    try {
        // Read the file and send to backend
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(API_BASE_URL + '/backup/restore-file', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + authManager.token },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Restore failed');
        }
        
        const result = await response.json();
        alert(result.message);
    } catch (e) { alert(e.message); }
}


async function deleteCategory(id) {
    if (prompt('Type DELETE to confirm category removal:') !== 'DELETE') return;
    try {
        await apiCall('/products/categories/' + id, 'DELETE');
        alert('Category deleted!');
        loadCategories();
    } catch (e) { alert(e.message); }
}


function printSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    const printWindow = window.open('', 'Print', 'width=800,height=600');
    printWindow.document.write('<html><head><title>Print</title><style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #ddd;text-align:left}th{background:#8b4513;color:white}h2{color:#8b4513}</style></head><body>');
    printWindow.document.write(section.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
}


async function deletePO(poId) {
    if (prompt('Type DELETE to confirm PO removal:') !== 'DELETE') return;
    try {
        await apiCall('/purchase-orders/' + poId, 'DELETE');
        alert('PO deleted!');
        loadPurchaseOrders();
    } catch (e) { alert(e.message); }
}


async function reprintReceipt(receiptNo) {
    try {
        const receipts = await apiCall('/sales/history');
        const receipt = receipts.find(r => r.receipt_no === receiptNo);
        if (!receipt) { alert('Receipt not found'); return; }
        
        let settings = businessSettings;
        if (!settings) { try { settings = await apiCall('/settings'); } catch (e) { settings = {}; } }
        
        let itemsHtml = '';
        receipt.items.forEach(item => {
            const taxLabel = (item.tax_rate || 0) > 0 ? 'A' : 'B';
            itemsHtml += '<tr><td>' + item.name + '</td><td style="text-align:center">' + item.quantity + '</td><td style="text-align:center;font-weight:bold">' + taxLabel + '</td><td style="text-align:right">' + item.total_price.toFixed(2) + '</td></tr>';
        });
        
        const html = '<!DOCTYPE html><html><head><title>Reprint ' + receipt.receipt_no + '</title><style>body{font-family:"Courier New",monospace;padding:20px;max-width:300px;margin:auto}.h{text-align:center;margin-bottom:10px}.h h2{margin:0;font-size:16px}.h p{margin:2px 0;font-size:11px}.stamp{text-align:center;background:#fff3cd;border:2px solid #ffc107;padding:8px;margin:10px 0}.stamp strong{color:#d32f2f;font-size:13px}hr{border:none;border-top:1px dashed #000;margin:10px 0}table{width:100%;font-size:12px;border-collapse:collapse}td{padding:3px 0}.tr{font-weight:bold;font-size:14px}.cb{display:block;margin:20px auto;padding:10px 20px;background:#8b4513;color:white;border:none;border-radius:5px;cursor:pointer}@media print{.cb{display:none}}</style></head><body><div class="h"><h2>' + (settings.business_name || 'Folksmed Supppliers') + '</h2>' + (settings.business_po_box ? '<p>' + settings.business_po_box + '</p>' : '') + (settings.business_location ? '<p>' + settings.business_location + '</p>' : '') + (settings.business_phone ? '<p>Tel: ' + settings.business_phone + '</p>' : '') + '</div><hr><div class="stamp"><strong>*** REPRINTED COPY ***</strong></div><hr><p style="font-size:12px">Receipt: ' + receipt.receipt_no + '</p><p style="font-size:12px">Date: ' + receipt.created_at + '</p><hr><table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:center">Tax</th><th style="text-align:right">Amount</th></tr></thead><tbody>' + itemsHtml + '</tbody></table><hr><table><tr><td>Subtotal:</td><td style="text-align:right">' + receipt.subtotal.toFixed(2) + '</td></tr><tr><td>Tax (incl.):</td><td style="text-align:right">' + receipt.tax_amount.toFixed(2) + '</td></tr><tr class="tr"><td>TOTAL:</td><td style="text-align:right">KSh ' + receipt.total_amount.toFixed(2) + '</td></tr></table><hr><p style="font-size:12px">Payment: ' + receipt.payment_method.toUpperCase() + '</p><button class="cb" onclick="window.close()">Close</button></body></html>';
        
        const pw = window.open('', 'Reprint', 'width=400,height=600');
        pw.document.write(html);
        pw.document.close();
        setTimeout(() => { try { pw.print(); } catch(e) {} }, 1000);
        setTimeout(() => { try { pw.close(); } catch(e) {} }, 15000);
        
    } catch (e) { alert(e.message); }
}


async function resetDemoData() {
    if (prompt('Type RESET to clear ALL demo data:') !== 'RESET') {
        alert('Reset cancelled.');
        return;
    }
    if (!confirm('FINAL WARNING: This will DELETE all products, sales, categories, tax records, and non-admin users.\n\nAdmin account and settings will be kept.\n\nA backup will be created automatically.\n\nContinue?')) return;
    
    try {
        const result = await apiCall('/backup/reset-demo', 'POST');
        alert('Demo data cleared successfully!\n\nBackup saved to:\n' + result.backup_created + '\n\nRestart the server now.');
    } catch (e) { alert(e.message); }
}


async function deleteReceipt(receiptNo) {
    if (prompt('Type DELETE to remove receipt ' + receiptNo + ':') !== 'DELETE') return;
    if (!confirm('Delete this receipt?\n\nNOTE: Tax records will be KEPT for compliance.')) return;
    try {
        await apiCall('/sales/receipt/' + receiptNo, 'DELETE');
        alert('Receipt deleted. Tax records preserved.');
        loadAllSales();
        loadReceiptHistory();
    } catch (e) { alert(e.message); }
}

async function deleteSalesBefore() {
    const date = prompt('Delete all sales before (YYYY-MM-DD):');
    if (!date) return;
    if (prompt('Type DELETE to confirm:') !== 'DELETE') return;
    if (!confirm('Delete ALL sales before ' + date + '?\n\nTax records will be KEPT.')) return;
    try {
        const result = await apiCall('/sales/delete-before/' + date, 'DELETE');
        alert(result.message);
        loadAllSales();
        loadReceiptHistory();
    } catch (e) { alert(e.message); }
}
